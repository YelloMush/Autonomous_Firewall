"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                         PROJECT AEGIS v2.0                                  ║
║          Autonomous ML-Driven Cloud-Native DDoS Detection & Mitigation      ║
║                                                                              ║
║  Architecture:                                                               ║
║    • Lightweight Sensor Nodes (Scapy-modeled packet metadata capture)        ║
║    • Asynchronous Ingestion Queue (M/M/c SQS-modeled buffer)                 ║
║    • FastAPI Analytical Brain (Isolation Forest over sliding window)          ║
║    • AWS VPC NACL Automated Mitigation Layer (boto3-structured mock)         ║
║                                                                              ║
║  Mathematical Engine:                                                        ║
║    • Feature Vector: X_t = [N_t, H(X), Δt]                                  ║
║    • Shannon Entropy: H(X) = -Σ P(xᵢ) log₂ P(xᵢ)                           ║
║    • Anomaly Score:  s(x,n) = 2^(-E(h(x))/c(n))                             ║
║    • Queue Length:   L_q = λ² / μ(μ - λ)                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

# ─────────────────────────────────────────────────────────────────────────────
# IMPORTS
# ─────────────────────────────────────────────────────────────────────────────
import tkinter as tk
from tkinter import ttk, font as tkfont
import threading
import queue
import time
import random
import math
import json
import collections
import logging
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
import hashlib
import colorsys

# ML stack
import numpy as np
from sklearn.ensemble import IsolationForest

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger("ProjectAegis")

# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 1 — DATA STRUCTURES
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PacketMeta:
    """Lightweight packet metadata record (Scapy-modeled)."""
    src_ip: str
    dst_ip: str
    protocol: str          # 'UDP' | 'TCP' | 'ICMP'
    payload_bytes: int
    timestamp: float = field(default_factory=time.time)

@dataclass
class FeatureVector:
    """
    X_t = [N_t, H(X), Δt]
    N_t  — packet count in window
    H_X  — Shannon entropy of source-IP distribution
    dt   — mean inter-arrival spacing (seconds)
    score— Isolation Forest anomaly score s(x,n)
    """
    N_t: float
    H_X: float
    dt: float
    score: float = 0.0
    timestamp: float = field(default_factory=time.time)

@dataclass
class MitigationEvent:
    """Records a cloud firewall state-change action."""
    src_ip: str
    rule_id: int
    action: str            # 'DENY'
    protocol: str
    timestamp: float = field(default_factory=time.time)
    nacl_entry_id: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 2 — SHARED STATE BUS
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

class AegisStateBus:
    """
    Thread-safe shared memory bus. The GUI polls this object every N ms;
    all backend threads push into it exclusively via its update methods.
    No direct widget mutation happens outside the GUI thread.
    """
    def __init__(self):
        self._lock = threading.Lock()

        # Traffic rates (packets / second)
        self.lambda_rate: float = 0.0   # ingestion rate λ
        self.mu_rate: float = 150.0     # processing capacity μ

        # Queue metrics
        self.queue_depth: int = 0
        self.L_q: float = 0.0

        # Feature history for sparkline (ring buffer, 120 points)
        self.HISTORY_LEN = 120
        self.lambda_history: collections.deque = collections.deque(
            [0.0] * self.HISTORY_LEN, maxlen=self.HISTORY_LEN)
        self.entropy_history: collections.deque = collections.deque(
            [0.0] * self.HISTORY_LEN, maxlen=self.HISTORY_LEN)
        self.score_history: collections.deque = collections.deque(
            [0.0] * self.HISTORY_LEN, maxlen=self.HISTORY_LEN)

        # Latest computed feature vector
        self.last_vector: Optional[FeatureVector] = None

        # Anomaly score 0.0 – 1.0
        self.anomaly_score: float = 0.0

        # Mitigation state
        self.under_attack: bool = False
        self.attack_mode_active: bool = False
        self.blocked_events: List[MitigationEvent] = []

        # Event log (shown in the log pane)
        self.event_log: collections.deque = collections.deque(maxlen=200)

        # Status flags
        self.engine_running: bool = False

    # ── thread-safe setters ──────────────────────────────────────────────────

    def push_rates(self, lam: float, mu: float, depth: int):
        with self._lock:
            self.lambda_rate = lam
            self.mu_rate = mu
            self.queue_depth = depth
            # Queue length formula: L_q = λ² / μ(μ − λ)
            if mu > lam > 0:
                self.L_q = (lam ** 2) / (mu * (mu - lam))
            else:
                self.L_q = float('inf')
            self.lambda_history.append(lam)

    def push_feature(self, vec: FeatureVector):
        with self._lock:
            self.last_vector = vec
            self.anomaly_score = vec.score
            self.entropy_history.append(vec.H_X)
            self.score_history.append(vec.score)

    def push_mitigation(self, evt: MitigationEvent):
        with self._lock:
            self.blocked_events.append(evt)
            self.under_attack = True

    def log(self, msg: str, level: str = "INFO"):
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        with self._lock:
            self.event_log.appendleft(f"[{ts}] [{level:5s}] {msg}")

    def reset_attack_state(self):
        with self._lock:
            self.under_attack = False
            self.blocked_events.clear()
            self.attack_mode_active = False

    def snapshot(self) -> dict:
        """Return a consistent read snapshot for the GUI thread."""
        with self._lock:
            return {
                "lambda": self.lambda_rate,
                "mu": self.mu_rate,
                "L_q": self.L_q,
                "queue_depth": self.queue_depth,
                "anomaly_score": self.anomaly_score,
                "under_attack": self.under_attack,
                "attack_mode": self.attack_mode_active,
                "blocked_events": list(self.blocked_events),
                "lambda_hist": list(self.lambda_history),
                "entropy_hist": list(self.entropy_history),
                "score_hist": list(self.score_history),
                "event_log": list(self.event_log)[:30],
                "last_vector": self.last_vector,
            }


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 3 — THREAT SIMULATOR ENGINE
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

BOGON_NETS = [
    "10.{a}.{b}.{c}", "172.{a}.{b}.{c}", "192.168.{b}.{c}",
    "198.51.100.{c}", "203.0.113.{c}", "100.{a}.{b}.{c}",
    "45.{a}.{b}.{c}", "104.{a}.{b}.{c}", "185.{a}.{b}.{c}",
]

def _rand_ip(template: str) -> str:
    return template.format(
        a=random.randint(0, 254),
        b=random.randint(0, 254),
        c=random.randint(1, 254),
    )

def generate_ip(attack_mode: bool) -> str:
    """
    Baseline: small pool of 'regular' IPs → low entropy.
    Attack  : huge distributed pool   → high entropy.
    """
    if attack_mode:
        template = random.choice(BOGON_NETS)
        return _rand_ip(template)
    else:
        # 12 regular clients only
        REGULAR_POOL = [
            "10.0.0.10", "10.0.0.11", "10.0.0.12", "10.0.0.15",
            "192.168.1.5", "192.168.1.6", "192.168.1.20", "172.16.0.1",
            "172.16.0.2", "172.16.0.50", "10.1.2.3", "10.1.2.4",
        ]
        return random.choice(REGULAR_POOL)


class ThreatSimulatorEngine(threading.Thread):
    """
    Asynchronous producer thread.
    Baseline: ~40–60 pps (packets per second).
    Attack  : ~2 000–5 000 pps (volumetric UDP/TCP flood).
    """
    BASELINE_PPS   = (40, 60)
    ATTACK_PPS     = (2000, 5000)
    PROTOCOLS      = ["UDP", "TCP", "ICMP"]
    ATTACK_WEIGHTS = [0.65, 0.30, 0.05]  # UDP-heavy flood

    def __init__(self, pkt_queue: queue.Queue, state: AegisStateBus):
        super().__init__(daemon=True, name="ThreatSimulator")
        self._pkt_queue = pkt_queue
        self._state = state
        self._stop_evt = threading.Event()

    def run(self):
        self._state.log("ThreatSimulatorEngine: online", "INFO")
        while not self._stop_evt.is_set():
            attack = self._state.attack_mode_active
            lo, hi = self.ATTACK_PPS if attack else self.BASELINE_PPS
            pps = random.randint(lo, hi)
            interval = 1.0 / pps  # seconds between packets

            for _ in range(pps):
                if self._stop_evt.is_set():
                    break
                proto = (
                    random.choices(self.PROTOCOLS, self.ATTACK_WEIGHTS)[0]
                    if attack else random.choice(self.PROTOCOLS)
                )
                pkt = PacketMeta(
                    src_ip=generate_ip(attack),
                    dst_ip="10.0.0.1",
                    protocol=proto,
                    payload_bytes=random.randint(40, 1500) if not attack
                                  else random.randint(500, 1500),
                )
                try:
                    self._pkt_queue.put_nowait(pkt)
                except queue.Full:
                    pass  # deliberately dropped — queue full signal
                time.sleep(interval)

    def stop(self):
        self._stop_evt.set()


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 4 — INGESTION & EVALUATION BRAIN
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

def _shannon_entropy(ip_counts: dict) -> float:
    """
    H(X) = -Σ P(xᵢ) log₂ P(xᵢ)
    Returns bits. Returns 0.0 for empty or singleton distributions.
    """
    total = sum(ip_counts.values())
    if total == 0:
        return 0.0
    entropy = 0.0
    for count in ip_counts.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


def _c_n(n: int) -> float:
    """
    c(n) — average path length of unsuccessful search in a BST of n nodes.
    c(n) = 2H(n-1) - (2(n-1)/n)
    where H(i) is the harmonic number ≈ ln(i) + 0.5772156649 (Euler–Mascheroni)
    """
    if n <= 1:
        return 1.0
    euler_mascheroni = 0.5772156649
    H_n_minus_1 = math.log(n - 1) + euler_mascheroni
    return 2.0 * H_n_minus_1 - (2.0 * (n - 1) / n)


class IngestionBrain(threading.Thread):
    """
    Consumes the packet queue in a sliding window loop:
      1. Drain the queue for WINDOW_SEC seconds.
      2. Compute X_t = [N_t, H(X), Δt].
      3. Score via Isolation Forest → s(x,n).
      4. If s(x) ≥ ALERT_THRESHOLD → trigger mitigation.
    The Isolation Forest is pre-warm-trained on synthetic baseline data so
    scoring is available immediately on startup.
    """
    WINDOW_SEC       = 1.0           # sliding window duration
    ALERT_THRESHOLD  = 0.60          # anomaly score trigger (calibrated)
    TRAINING_SAMPLES = 2000          # baseline warm-up samples
    WINDOW_BUF_LEN   = 60            # feature windows kept for re-training

    def __init__(self, pkt_queue: queue.Queue, state: AegisStateBus,
                 mitigator: "AWSNACLMitigator"):
        super().__init__(daemon=True, name="IngestionBrain")
        self._pkt_queue = pkt_queue
        self._state = state
        self._mitigator = mitigator
        self._stop_evt = threading.Event()
        self._model: Optional[IsolationForest] = None
        self._feature_buffer: List[List[float]] = []
        self._packet_window: List[PacketMeta] = []
        self._last_arrival: float = time.time()

        # Processing rate tracker
        self._proc_count = 0
        self._proc_timer = time.time()

    # ── warm training ────────────────────────────────────────────────────────

    # percentile bounds for decision_function normalisation (set at training)
    _df_lo: float = -0.08
    _df_hi: float = 0.25

    def _train_baseline(self):
        """
        Synthesise a mixed training set (95 % normal + 5 % mild anomaly) so
        the IsolationForest decision boundary is properly calibrated:

          Normal traffic  → s(x) ∈ [0.00, 0.45]
          Attack traffic  → s(x) ∈ [0.60, 1.00]

        The decision_function output is normalised to [0,1] using the 2nd
        and 98th percentiles of the training distribution, giving a stable,
        presentation-ready anomaly index.
        """
        self._state.log("IngestionBrain: training Isolation Forest (mixed set) …", "INFO")
        n_normal  = int(self.TRAINING_SAMPLES * 0.95)
        n_anomaly = self.TRAINING_SAMPLES - n_normal
        rng = np.random.default_rng(42)

        # Normal: small pool of known clients → low entropy, moderate rate
        X_norm = np.column_stack([
            rng.normal(52, 8, n_normal),
            rng.normal(3.0, 0.2, n_normal),
            rng.normal(0.018, 0.004, n_normal),
        ])
        X_norm = np.clip(X_norm,
                         [10, 0.5, 0.001],
                         [200, 5.0, 0.060])

        # Mild anomalies: bursts / partial floods → wider distributions
        X_anom = np.column_stack([
            rng.uniform(200, 800, n_anomaly),
            rng.uniform(5.0, 7.5, n_anomaly),
            rng.uniform(0.0005, 0.003, n_anomaly),
        ])

        X_train = np.vstack([X_norm, X_anom])
        rng.shuffle(X_train)

        self._model = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            max_samples=256,
            random_state=42,
        )
        self._model.fit(X_train)

        # Calibrate normalisation percentiles from training scores
        train_df = self._model.decision_function(X_train)
        self._df_lo = float(np.percentile(train_df, 2))
        self._df_hi = float(np.percentile(train_df, 98))
        self._state.log(
            f"IngestionBrain: model hot | "
            f"DF bounds [{self._df_lo:.4f}, {self._df_hi:.4f}]", "INFO"
        )

    # ── score computation ────────────────────────────────────────────────────

    def _compute_score(self, n_t: float, h_x: float, dt: float) -> float:
        """
        Implements s(x,n) = 2^( −E(h(x)) / c(n) ) per Liu et al. (2008).

        sklearn's IsolationForest.decision_function() internally computes:
            df(x) = −E(h(x)) / c(n_samples)  minus a contamination offset
        which is the signed log₂ form of the theoretical anomaly score.

        We convert to a presentation-friendly [0,1] index using the
        percentile bounds calibrated at training time:
            anomaly_score = 1 − clip_normalise(df(x), p2, p98)

        Result interpretation:
            0.00 – 0.45  →  NOMINAL   (inlier)
            0.45 – 0.60  →  ELEVATED  (border)
            0.60 – 1.00  →  CRITICAL  (outlier / DDoS)
        """
        if self._model is None:
            return 0.0
        x = np.array([[n_t, h_x, dt]])
        df = self._model.decision_function(x)[0]
        span = self._df_hi - self._df_lo + 1e-9
        norm = (df - self._df_lo) / span          # 0=anomaly edge, 1=normal
        anomaly = 1.0 - norm
        return float(np.clip(anomaly, 0.0, 1.0))

    # ── main loop ────────────────────────────────────────────────────────────

    def run(self):
        self._train_baseline()
        self._state.engine_running = True
        self._state.log("IngestionBrain: evaluation loop active.", "INFO")
        window_packets: List[PacketMeta] = []
        window_start = time.time()
        arrival_times: List[float] = []
        mu_count = 0
        mu_timer = time.time()

        while not self._stop_evt.is_set():
            now = time.time()
            elapsed = now - window_start

            # Drain queue for this window slice
            try:
                pkt = self._pkt_queue.get(timeout=0.05)
                window_packets.append(pkt)
                arrival_times.append(pkt.timestamp)
                mu_count += 1
            except queue.Empty:
                pass

            # Update μ (processing throughput) every second
            mu_elapsed = now - mu_timer
            if mu_elapsed >= 1.0:
                mu = mu_count / mu_elapsed
                mu_count = 0
                mu_timer = now
                lam = len(window_packets) / max(elapsed, 0.001)
                self._state.push_rates(lam, mu, self._pkt_queue.qsize())

            # Process window every WINDOW_SEC seconds
            if elapsed >= self.WINDOW_SEC:
                if window_packets:
                    self._process_window(window_packets, arrival_times)
                window_packets.clear()
                arrival_times.clear()
                window_start = time.time()

    def _process_window(self, packets: List[PacketMeta],
                        arrivals: List[float]):
        """Compute feature vector and score; trigger mitigation if warranted."""
        # N_t — packet count
        N_t = float(len(packets))

        # H(X) — Shannon entropy of source IP distribution
        ip_counter: dict = {}
        for pkt in packets:
            ip_counter[pkt.src_ip] = ip_counter.get(pkt.src_ip, 0) + 1
        H_X = _shannon_entropy(ip_counter)

        # Δt — mean inter-arrival time
        if len(arrivals) >= 2:
            deltas = [arrivals[i+1] - arrivals[i]
                      for i in range(len(arrivals) - 1)]
            dt = float(np.mean([d for d in deltas if d >= 0]))
        else:
            dt = 0.0

        # Anomaly score s(x,n)
        score = self._compute_score(N_t, H_X, dt)

        vec = FeatureVector(N_t=N_t, H_X=H_X, dt=dt, score=score)
        self._state.push_feature(vec)

        self._state.log(
            f"Window → N_t={N_t:.0f} pkt | H(X)={H_X:.4f} bits | "
            f"Δt={dt*1000:.2f} ms | s(x)={score:.4f}",
            "DEBUG"
        )

        # Threshold check → mitigation
        if score >= self.ALERT_THRESHOLD and not self._state.under_attack:
            # Identify top attacking IPs (highest packet count)
            top_ips = sorted(ip_counter.items(),
                             key=lambda kv: kv[1], reverse=True)[:3]
            for attacker_ip, count in top_ips:
                self._state.log(
                    f"⚠ ANOMALY THRESHOLD BREACHED: s(x)={score:.4f} ≥ "
                    f"{self.ALERT_THRESHOLD:.2f} | Triggering AWS NACL DENY "
                    f"for {attacker_ip} ({count} pkt)", "ALERT"
                )
                self._mitigator.apply_nacl_deny(attacker_ip, "UDP")

    def stop(self):
        self._stop_evt.set()


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 5 — AWS NACL CLOUD MITIGATOR (boto3-structured mock)
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

class AWSNACLMitigator:
    """
    Production-structured AWS VPC NACL mitigator.
    Mirrors the real boto3 EC2 create_network_acl_entry() call signature.
    In a live deployment, replace _mock_boto3_client() with:
        boto3.client('ec2', region_name='us-east-1')
    """
    NACL_ID        = "acl-0x4AEG1S09F3C1D"   # mock NACL identifier
    RULE_START     = 100                        # first rule number
    RULE_INCREMENT = 10
    VPC_ID         = "vpc-0x4AEGIS00000001"

    def __init__(self, state: AegisStateBus):
        self._state = state
        self._rule_counter = self.RULE_START
        self._ec2 = self._mock_boto3_client()
        self._state.log(
            f"AWSNACLMitigator: connected to mock EC2 endpoint | "
            f"VPC={self.VPC_ID} | NACL={self.NACL_ID}", "INFO"
        )

    def _mock_boto3_client(self):
        """Returns a namespace that mirrors boto3.client('ec2') methods."""
        class MockEC2:
            def create_network_acl_entry(self_, **kwargs) -> dict:
                entry_id = hashlib.md5(
                    json.dumps(kwargs, sort_keys=True).encode()
                ).hexdigest()[:12].upper()
                log.info(f"[MOCK boto3] create_network_acl_entry → {kwargs}")
                return {
                    "ResponseMetadata": {
                        "HTTPStatusCode": 200,
                        "RequestId": entry_id,
                    }
                }
        return MockEC2()

    def apply_nacl_deny(self, src_ip: str, protocol: str = "UDP"):
        """
        Appends a high-priority INBOUND DENY rule to the VPC NACL,
        blocking all traffic from src_ip.

        Mirrors live boto3 call:
            ec2.create_network_acl_entry(
                NetworkAclId=...,
                RuleNumber=...,
                Protocol=...,
                RuleAction='deny',
                Egress=False,
                CidrBlock='x.x.x.x/32',
                PortRange={'From': 0, 'To': 65535},
            )
        """
        rule_num = self._rule_counter
        self._rule_counter += self.RULE_INCREMENT

        proto_map = {"UDP": "17", "TCP": "6", "ICMP": "1", "ALL": "-1"}
        proto_num = proto_map.get(protocol, "-1")

        response = self._ec2.create_network_acl_entry(
            NetworkAclId=self.NACL_ID,
            RuleNumber=rule_num,
            Protocol=proto_num,
            RuleAction="deny",
            Egress=False,
            CidrBlock=f"{src_ip}/32",
            PortRange={"From": 0, "To": 65535},
        )

        entry_id = response["ResponseMetadata"]["RequestId"]
        evt = MitigationEvent(
            src_ip=src_ip,
            rule_id=rule_num,
            action="DENY",
            protocol=protocol,
            nacl_entry_id=entry_id,
        )
        self._state.push_mitigation(evt)
        self._state.log(
            f"AWS NACL RULE APPLIED: #{rule_num} DENY {src_ip}/32 "
            f"PROTO={protocol} NACL={self.NACL_ID} ID={entry_id}", "ALERT"
        )


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 6 — CANVAS SPARKLINE WIDGET
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

class SparklineCanvas(tk.Canvas):
    """
    Lightweight canvas-based sparkline / time-series chart.
    Renders multiple data series with configurable colors and labels.
    """
    PADDING = {"top": 28, "right": 12, "bottom": 28, "left": 52}

    def __init__(self, parent, title: str, y_label: str,
                 series_config: list, bg: str = "#0a0f1e", **kwargs):
        super().__init__(parent, bg=bg, highlightthickness=0, **kwargs)
        self._title = title
        self._y_label = y_label
        self._series = series_config   # [{name, color, data_key}]
        self._bg = bg
        self.bind("<Configure>", self._on_resize)
        self._data: dict = {}

    def update_data(self, **series_data):
        """Push new data for one or more series by their data_key."""
        self._data.update(series_data)
        self._redraw()

    def _on_resize(self, event):
        self._redraw()

    def _redraw(self):
        self.delete("all")
        W, H = self.winfo_width(), self.winfo_height()
        if W < 10 or H < 10:
            return
        P = self.PADDING
        pw = W - P["left"] - P["right"]
        ph = H - P["top"] - P["bottom"]

        # Background grid
        self.create_rectangle(P["left"], P["top"],
                              W - P["right"], H - P["bottom"],
                              fill="#0d1526", outline="#1a2744")
        for i in range(5):
            y = P["top"] + (ph * i // 4)
            self.create_line(P["left"], y, W - P["right"], y,
                             fill="#1a2744", dash=(4, 4))

        # Y-axis label
        self.create_text(14, H // 2, text=self._y_label,
                         angle=90, fill="#4a6fa5",
                         font=("Consolas", 8))

        # Title
        self.create_text(P["left"] + pw // 2, 10, text=self._title,
                         fill="#7ba3d4", font=("Consolas", 9, "bold"),
                         anchor="n")

        # Find global max for normalization across all series
        all_vals = []
        for s in self._series:
            data = self._data.get(s["data_key"], [])
            all_vals.extend([v for v in data if math.isfinite(v)])
        if not all_vals:
            return
        y_max = max(all_vals) * 1.15 or 1.0
        y_min = 0.0

        # Y-axis ticks
        for i in range(5):
            y = P["top"] + (ph * i // 4)
            val = y_max * (1 - i / 4)
            self.create_text(P["left"] - 4, y,
                             text=f"{val:.0f}",
                             fill="#3a5a8a", font=("Consolas", 7),
                             anchor="e")

        # Draw each series
        for s in self._series:
            data = list(self._data.get(s["data_key"], []))
            if len(data) < 2:
                continue
            n = len(data)
            pts = []
            for i, v in enumerate(data):
                if not math.isfinite(v):
                    v = 0.0
                x = P["left"] + int(pw * i / (n - 1))
                y_norm = (v - y_min) / max(y_max - y_min, 1e-9)
                y = P["top"] + ph - int(ph * y_norm)
                pts.append(x)
                pts.append(y)
            if len(pts) >= 4:
                self.create_line(*pts, fill=s["color"],
                                 width=1.5, smooth=True)

        # Legend
        lx = P["left"] + 4
        for i, s in enumerate(self._series):
            self.create_rectangle(lx, H - P["bottom"] + 8,
                                  lx + 12, H - P["bottom"] + 16,
                                  fill=s["color"], outline="")
            self.create_text(lx + 16, H - P["bottom"] + 12,
                             text=s["name"], fill=s["color"],
                             font=("Consolas", 7), anchor="w")
            lx += 80


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 7 — ANOMALY GAUGE WIDGET
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

class AnomalyGaugeCanvas(tk.Canvas):
    """
    Arc-based radial gauge: 0.0 (safe) → 1.0 (critical).
    Color transitions:  #00c896 (green) → #ffd700 (amber) → #ff3333 (red).
    """
    def __init__(self, parent, bg="#0a0f1e", **kwargs):
        super().__init__(parent, bg=bg, highlightthickness=0, **kwargs)
        self._score = 0.0
        self._bg = bg
        self.bind("<Configure>", lambda e: self._redraw())

    def set_score(self, score: float):
        self._score = max(0.0, min(1.0, score))
        self._redraw()

    def _score_to_color(self, score: float) -> str:
        """Lerp: green(0) → amber(0.5) → red(1.0)"""
        if score < 0.5:
            t = score * 2.0
            r = int(0 + t * (255 - 0))
            g = int(200 - t * (200 - 215))
            b = int(150 - t * 150)
        else:
            t = (score - 0.5) * 2.0
            r = 255
            g = int(215 - t * 215)
            b = 0
        return f"#{r:02x}{g:02x}{b:02x}"

    def _redraw(self):
        self.delete("all")
        W, H = self.winfo_width(), self.winfo_height()
        if W < 10 or H < 10:
            return

        cx, cy = W // 2, int(H * 0.55)
        r = min(W, H) // 2 - 20

        # Track arc background
        self.create_arc(cx - r, cy - r, cx + r, cy + r,
                        start=225, extent=-270,
                        style="arc", outline="#1a2744", width=14)

        # Score arc
        extent = -270 * self._score
        color = self._score_to_color(self._score)
        if abs(extent) > 0.5:
            self.create_arc(cx - r, cy - r, cx + r, cy + r,
                            start=225, extent=extent,
                            style="arc", outline=color, width=14)

        # Needle
        angle_deg = 225 - 270 * self._score
        angle_rad = math.radians(angle_deg)
        nx = cx + int((r - 20) * math.cos(angle_rad))
        ny = cy - int((r - 20) * math.sin(angle_rad))
        self.create_line(cx, cy, nx, ny, fill=color, width=3)
        self.create_oval(cx - 5, cy - 5, cx + 5, cy + 5,
                         fill=color, outline="")

        # Score label
        score_pct = self._score * 100
        self.create_text(cx, cy + 18,
                         text=f"{score_pct:.1f}%",
                         fill=color,
                         font=("Consolas", 22, "bold"))

        # Status text
        if self._score < 0.45:
            status, sc = "NOMINAL", "#00c896"
        elif self._score < 0.72:
            status, sc = "ELEVATED", "#ffd700"
        else:
            status, sc = "CRITICAL", "#ff3333"
        self.create_text(cx, cy + 44,
                         text=status, fill=sc,
                         font=("Consolas", 11, "bold"))

        # Tick marks
        for i, (label, val) in enumerate(
                [("0.0", 0), ("0.25", 0.25), ("0.5", 0.5),
                 ("0.75", 0.75), ("1.0", 1.0)]):
            a_deg = 225 - 270 * val
            a_rad = math.radians(a_deg)
            x1 = cx + int((r - 8)  * math.cos(a_rad))
            y1 = cy - int((r - 8)  * math.sin(a_rad))
            x2 = cx + int((r + 4)  * math.cos(a_rad))
            y2 = cy - int((r + 4)  * math.sin(a_rad))
            xt = cx + int((r + 18) * math.cos(a_rad))
            yt = cy - int((r + 18) * math.sin(a_rad))
            self.create_line(x1, y1, x2, y2, fill="#3a5a8a", width=2)
            self.create_text(xt, yt, text=label,
                             fill="#3a5a8a", font=("Consolas", 7))

        # Label above
        self.create_text(cx, 14,
                         text="ISOLATION FOREST  s(x,n)",
                         fill="#4a6fa5", font=("Consolas", 9, "bold"),
                         anchor="n")


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 8 — MAIN GUI DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

PALETTE = {
    "bg_deep":     "#111827",
    "bg_panel":    "#1f2937",
    "bg_widget":   "#374151",
    "border":      "#4b5563",
    "accent_blue": "#3b82f6",
    "accent_cyan": "#60a5fa",
    "text_primary":"#f9fafb",
    "text_muted":  "#9ca3af",
    "safe":        "#10b981",
    "warn":        "#f59e0b",
    "critical":    "#ef4444",
    "attack_red":  "#dc2626",
}

class AegisDashboard(tk.Tk):
    POLL_MS    = 250   # GUI refresh interval
    BLINK_MS   = 500   # alert blink interval

    def __init__(self, state: AegisStateBus):
        super().__init__()
        self._state = state
        self._blink_flag = False
        self._setup_window()
        self._build_layout()
        self._start_polling()

    # ── window chrome ────────────────────────────────────────────────────────

    def _setup_window(self):
        self.title("Project Aegis  |  Autonomous DDoS Threat Detection & Mitigation")
        self.configure(bg=PALETTE["bg_deep"])
        self.resizable(True, True)

        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        W, H = min(1440, sw - 60), min(900, sh - 60)
        x, y = (sw - W) // 2, (sh - H) // 2
        self.geometry(f"{W}x{H}+{x}+{y}")
        self.minsize(1100, 720)

        self.option_add("*Font", "Consolas 9")

    # ── layout builder ───────────────────────────────────────────────────────

    def _build_layout(self):
        # ── header bar ──────────────────────────────────────────────────────
        hdr = tk.Frame(self, bg=PALETTE["bg_deep"], height=52)
        hdr.pack(fill="x", padx=0, pady=0)
        hdr.pack_propagate(False)

        tk.Label(
            hdr,
            text="Aegis Cloud Security Module",
            bg=PALETTE["bg_deep"],
            fg=PALETTE["accent_cyan"],
            font=("Consolas", 18, "bold"),
        ).pack(side="left", padx=18, pady=12)

        tk.Label(
            hdr,
            text="Distributed Ingestion & Autonomous Threat Isolation Pipeline",
            bg=PALETTE["bg_deep"],
            fg=PALETTE["text_muted"],
            font=("Consolas", 8),
        ).pack(side="left", padx=8, pady=18)

        self._clock_var = tk.StringVar(value="")
        tk.Label(
            hdr,
            textvariable=self._clock_var,
            bg=PALETTE["bg_deep"],
            fg=PALETTE["text_muted"],
            font=("Consolas", 8),
        ).pack(side="right", padx=18)

        # Separator
        sep = tk.Frame(self, bg=PALETTE["border"], height=1)
        sep.pack(fill="x")

        # ── main body ───────────────────────────────────────────────────────
        body = tk.Frame(self, bg=PALETTE["bg_deep"])
        body.pack(fill="both", expand=True, padx=10, pady=6)

        # 3-column: left (charts) | center (gauge + firewall) | right (log)
        body.columnconfigure(0, weight=5)
        body.columnconfigure(1, weight=3)
        body.columnconfigure(2, weight=3)
        body.rowconfigure(0, weight=1)

        left  = tk.Frame(body, bg=PALETTE["bg_deep"])
        left.grid(row=0, column=0, sticky="nsew", padx=(0,6))

        center = tk.Frame(body, bg=PALETTE["bg_deep"])
        center.grid(row=0, column=1, sticky="nsew", padx=(0,6))

        right = tk.Frame(body, bg=PALETTE["bg_deep"])
        right.grid(row=0, column=2, sticky="nsew")

        self._build_left_column(left)
        self._build_center_column(center)
        self._build_right_column(right)

        # ── bottom bar ──────────────────────────────────────────────────────
        self._build_bottom_bar()

    # ── LEFT: traffic charts ─────────────────────────────────────────────────

    def _build_left_column(self, parent):
        parent.rowconfigure(0, weight=3)
        parent.rowconfigure(1, weight=3)
        parent.rowconfigure(2, weight=2)
        parent.columnconfigure(0, weight=1)

        # ── Panel A: Traffic Rate ────────────────────────────────────────────
        panA = self._panel(parent, "PANEL A  │  TRAFFIC INGESTION RATE  (λ pps)")
        panA.grid(row=0, column=0, sticky="nsew", pady=(0,6))
        panA.rowconfigure(1, weight=1)
        panA.columnconfigure(0, weight=1)

        self._chart_traffic = SparklineCanvas(
            panA, title="", y_label="pps",
            series_config=[
                {"name": "λ Ingestion Rate",  "color": "#2979e8", "data_key": "lambda_data"},
                {"name": "μ Proc. Capacity",  "color": "#00c896", "data_key": "mu"},
            ],
            bg=PALETTE["bg_panel"],
        )
        self._chart_traffic.grid(row=1, column=0, sticky="nsew",
                                 padx=8, pady=(4,8))

        # ── Panel B: Entropy ─────────────────────────────────────────────────
        panB = self._panel(parent, "PANEL B  │  SHANNON ENTROPY  H(X) [bits]")
        panB.grid(row=1, column=0, sticky="nsew", pady=(0,6))
        panB.rowconfigure(1, weight=1)
        panB.columnconfigure(0, weight=1)

        self._chart_entropy = SparklineCanvas(
            panB, title="", y_label="bits",
            series_config=[
                {"name": "H(X) Entropy", "color": "#ff9f43", "data_key": "entropy"},
            ],
            bg=PALETTE["bg_panel"],
        )
        self._chart_entropy.grid(row=1, column=0, sticky="nsew",
                                 padx=8, pady=(4,8))

        # ── Panel C: Queue metrics ───────────────────────────────────────────
        panC = self._panel(parent, "PANEL C  │  M/M/c QUEUE  TELEMETRY")
        panC.grid(row=2, column=0, sticky="nsew")
        panC.columnconfigure(0, weight=1)
        panC.columnconfigure(1, weight=1)
        panC.columnconfigure(2, weight=1)
        panC.columnconfigure(3, weight=1)

        self._lbl_lambda = self._metric_card(panC, "λ  Ingestion", "—",
                                             PALETTE["accent_blue"], 0)
        self._lbl_mu     = self._metric_card(panC, "μ  Processing", "—",
                                             PALETTE["safe"], 1)
        self._lbl_Lq     = self._metric_card(panC, "Lq  Queue Length",  "—",
                                             PALETTE["warn"], 2)
        self._lbl_depth  = self._metric_card(panC, "Buffer Depth", "—",
                                             "#cc66ff", 3)

    def _metric_card(self, parent, label: str, init: str,
                     color: str, col: int) -> tk.Label:
        f = tk.Frame(parent, bg=PALETTE["bg_widget"],
                     highlightbackground=PALETTE["border"],
                     highlightthickness=1)
        f.grid(row=1, column=col, sticky="nsew", padx=4, pady=8)
        tk.Label(f, text=label, bg=PALETTE["bg_widget"],
                 fg=PALETTE["text_muted"], font=("Consolas", 7)).pack(pady=(6,0))
        lbl = tk.Label(f, text=init, bg=PALETTE["bg_widget"],
                       fg=color, font=("Consolas", 16, "bold"))
        lbl.pack(pady=(2,8))
        return lbl

    # ── CENTER: gauge + firewall state ───────────────────────────────────────

    def _build_center_column(self, parent):
        parent.rowconfigure(0, weight=4)
        parent.rowconfigure(1, weight=5)
        parent.columnconfigure(0, weight=1)

        # Gauge panel
        panG = self._panel(parent, "ANOMALY ISOLATION SCORE  │  s(x, n)")
        panG.grid(row=0, column=0, sticky="nsew", pady=(0,6))
        panG.rowconfigure(1, weight=1)
        panG.columnconfigure(0, weight=1)

        self._gauge = AnomalyGaugeCanvas(panG, bg=PALETTE["bg_panel"])
        self._gauge.grid(row=1, column=0, sticky="nsew", padx=8, pady=(4,8))

        # Firewall state panel
        panF = self._panel(parent, "INFRASTRUCTURE FIREWALL STATE")
        panF.grid(row=1, column=0, sticky="nsew")
        panF.rowconfigure(1, weight=1)
        panF.columnconfigure(0, weight=1)

        self._fw_frame = tk.Frame(panF, bg=PALETTE["bg_panel"])
        self._fw_frame.grid(row=1, column=0, sticky="nsew", padx=8, pady=(4,8))
        self._fw_frame.rowconfigure(0, weight=1)
        self._fw_frame.columnconfigure(0, weight=1)

        # State banner
        self._fw_state_label = tk.Label(
            self._fw_frame,
            text="VPC INFRASTRUCTURE STATE",
            bg=PALETTE["bg_panel"],
            fg=PALETTE["text_muted"],
            font=("Consolas", 8, "bold"),
        )
        self._fw_state_label.grid(row=0, column=0, pady=(14,0))

        self._fw_banner = tk.Label(
            self._fw_frame,
            text="COMPLIANT  /  ALLOW ALL",
            bg=PALETTE["bg_panel"],
            fg=PALETTE["safe"],
            font=("Consolas", 14, "bold"),
            wraplength=280,
            justify="center",
        )
        self._fw_banner.grid(row=1, column=0, pady=6)

        self._fw_detail = tk.Label(
            self._fw_frame,
            text="No active NACL enforcement rules.",
            bg=PALETTE["bg_panel"],
            fg=PALETTE["text_muted"],
            font=("Consolas", 8),
            wraplength=280,
            justify="center",
        )
        self._fw_detail.grid(row=2, column=0, pady=(0,6))

        # NACL rules list box
        self._nacl_frame = tk.Frame(self._fw_frame, bg=PALETTE["bg_widget"])
        self._nacl_frame.grid(row=3, column=0, sticky="nsew",
                               padx=8, pady=4)

        tk.Label(self._nacl_frame,
                 text="ACTIVE NACL DENY RULES",
                 bg=PALETTE["bg_widget"],
                 fg=PALETTE["text_muted"],
                 font=("Consolas", 7, "bold")).pack(anchor="w", padx=6, pady=(4,2))

        self._nacl_box = tk.Text(
            self._nacl_frame,
            bg="#060a14",
            fg=PALETTE["critical"],
            font=("Consolas", 8),
            height=6,
            width=36,
            relief="flat",
            state="disabled",
            wrap="word",
        )
        self._nacl_box.pack(fill="both", expand=True, padx=4, pady=(0,4))

    # ── RIGHT: event log ─────────────────────────────────────────────────────

    def _build_right_column(self, parent):
        parent.rowconfigure(0, weight=1)
        parent.columnconfigure(0, weight=1)

        panL = self._panel(parent, "SYSTEM EVENT LOG  │  REAL-TIME AUDIT TRAIL")
        panL.grid(row=0, column=0, sticky="nsew")
        panL.rowconfigure(1, weight=1)
        panL.columnconfigure(0, weight=1)

        # Tags for colored log lines
        self._log_box = tk.Text(
            panL,
            bg="#06090f",
            fg=PALETTE["text_primary"],
            font=("Consolas", 8),
            relief="flat",
            wrap="word",
            state="disabled",
        )
        self._log_box.grid(row=1, column=0, sticky="nsew", padx=8, pady=(4,8))
        self._log_box.tag_configure("INFO",  foreground="#4a90d9")
        self._log_box.tag_configure("DEBUG", foreground="#3a5a6a")
        self._log_box.tag_configure("WARN",  foreground=PALETTE["warn"])
        self._log_box.tag_configure("ALERT", foreground=PALETTE["critical"])
        self._log_box.tag_configure("ERROR", foreground="#ff6b6b")

        sb = ttk.Scrollbar(panL, command=self._log_box.yview)
        sb.grid(row=1, column=1, sticky="ns", pady=(4,8))
        self._log_box.configure(yscrollcommand=sb.set)

    # ── BOTTOM BAR ───────────────────────────────────────────────────────────

    def _build_bottom_bar(self):
        bar = tk.Frame(self, bg="#060a14", height=64)
        bar.pack(fill="x", padx=0, pady=0)
        bar.pack_propagate(False)

        tk.Frame(bar, bg=PALETTE["border"], height=1).pack(fill="x")

        inner = tk.Frame(bar, bg="#060a14")
        inner.pack(fill="both", expand=True, padx=14)

        # Status pill
        self._status_pill = tk.Label(
            inner,
            text="●  ENGINE ACTIVE",
            bg="#060a14",
            fg=PALETTE["safe"],
            font=("Consolas", 9, "bold"),
        )
        self._status_pill.pack(side="left", pady=16)

        # Feature vector readout
        self._vec_label = tk.Label(
            inner,
            text="X_t = [ N_t: —  |  H(X): —  |  Δt: — ]",
            bg="#060a14",
            fg=PALETTE["text_muted"],
            font=("Consolas", 8),
        )
        self._vec_label.pack(side="left", padx=24, pady=16)

        # Attack button
        self._atk_btn = tk.Button(
            inner,
            text="Execute Load Stress Test (Anomaly Injection)",
            bg=PALETTE["attack_red"],
            fg="white",
            font=("Consolas", 10, "bold"),
            relief="flat",
            padx=20,
            pady=10,
            cursor="hand2",
            activebackground="#c9001c",
            activeforeground="white",
            command=self._toggle_attack,
        )
        self._atk_btn.pack(side="right", pady=10)

        # Reset button
        self._reset_btn = tk.Button(
            inner,
            text="↺  RESET NACL STATE",
            bg=PALETTE["bg_widget"],
            fg=PALETTE["text_primary"],
            font=("Consolas", 9),
            relief="flat",
            padx=14,
            pady=10,
            cursor="hand2",
            activebackground=PALETTE["border"],
            activeforeground="white",
            command=self._reset_state,
        )
        self._reset_btn.pack(side="right", padx=8, pady=10)

    # ── panel factory ────────────────────────────────────────────────────────

    def _panel(self, parent, title: str) -> tk.Frame:
        outer = tk.Frame(
            parent,
            bg=PALETTE["bg_panel"],
            highlightbackground=PALETTE["border"],
            highlightthickness=1,
        )
        tk.Label(
            outer,
            text=title,
            bg=PALETTE["bg_panel"],
            fg=PALETTE["text_muted"],
            font=("Consolas", 8, "bold"),
            anchor="w",
        ).grid(row=0, column=0, columnspan=10, sticky="ew", padx=10, pady=(6,0))
        return outer

    # ── control actions ──────────────────────────────────────────────────────

    def _toggle_attack(self):
        if self._state.attack_mode_active:
            self._state.attack_mode_active = False
            self._state.log("Load stress test deactivated by operator.", "INFO")
            self._atk_btn.configure(
                text="Execute Load Stress Test (Anomaly Injection)",
                bg=PALETTE["attack_red"],
            )
        else:
            self._state.attack_mode_active = True
            self._state.log(
                "Load stress test activated — volumetric flood engaged.",
                "ALERT"
            )
            self._atk_btn.configure(
                text="Halt Load Stress Test",
                bg="#880000",
            )

    def _reset_state(self):
        self._state.reset_attack_state()
        self._state.log("Operator reset: NACL enforcement rules cleared.", "INFO")
        self._atk_btn.configure(
            text="Execute Load Stress Test (Anomaly Injection)",
            bg=PALETTE["attack_red"],
        )

    # ── polling loop ─────────────────────────────────────────────────────────

    def _start_polling(self):
        self._poll()

    def _poll(self):
        try:
            snap = self._state.snapshot()
            self._update_clock()
            self._update_charts(snap)
            self._update_metrics(snap)
            self._update_gauge(snap)
            self._update_firewall_state(snap)
            self._update_log(snap)
            self._update_status(snap)
            self._update_vector_display(snap)
        except Exception as e:
            log.warning(f"GUI poll error: {e}")
        finally:
            self.after(self.POLL_MS, self._poll)

        # Blink cycle
        self._blink_flag = not self._blink_flag

    def _update_clock(self):
        self._clock_var.set(
            datetime.now().strftime("UTC+0  %Y-%m-%d  %H:%M:%S")
        )

    def _update_charts(self, snap: dict):
        # Pad mu history to same length as lambda history
        lam_hist = snap["lambda_hist"]
        mu_val   = snap["mu"]
        mu_hist  = [mu_val] * len(lam_hist)

        self._chart_traffic.update_data(lambda_data=lam_hist, mu=mu_hist)
        self._chart_entropy.update_data(entropy=snap["entropy_hist"])

    def _update_metrics(self, snap: dict):
        lam = snap["lambda"]
        mu  = snap["mu"]
        Lq  = snap["L_q"]
        dep = snap["queue_depth"]

        self._lbl_lambda.config(text=f"{lam:,.0f}")
        self._lbl_mu.config(text=f"{mu:,.0f}")
        self._lbl_Lq.config(
            text="∞" if Lq == float("inf") else f"{Lq:.2f}",
            fg=PALETTE["critical"] if Lq > 50 else PALETTE["warn"]
                if Lq > 10 else PALETTE["safe"],
        )
        self._lbl_depth.config(
            text=str(dep),
            fg=PALETTE["critical"] if dep > 5000 else PALETTE["warn"]
                if dep > 1000 else "#cc66ff",
        )

    def _update_gauge(self, snap: dict):
        self._gauge.set_score(snap["anomaly_score"])

    def _update_firewall_state(self, snap: dict):
        evts: List[MitigationEvent] = snap["blocked_events"]
        attack = snap["under_attack"]

        if attack and evts:
            # Alert state
            if self._blink_flag:
                banner_bg = "#200000"
                banner_fg = PALETTE["critical"]
            else:
                banner_bg = "#3d0000"
                banner_fg = "#ff6666"

            self._fw_frame.config(bg=banner_bg)
            self._fw_state_label.config(bg=banner_bg, fg=PALETTE["critical"])
            self._fw_banner.config(
                bg=banner_bg,
                fg=banner_fg,
                text="THREAT ISOLATED\nAWS NACL INBOUND DENY APPLIED",
            )
            self._fw_detail.config(
                bg=banner_bg,
                fg=PALETTE["warn"],
                text=f"{len(evts)} enforcement rule(s) active | "
                     f"NACL: {AWSNACLMitigator.NACL_ID}",
            )
            self._nacl_frame.config(bg="#1a0000")

            # Update NACL rules list
            self._nacl_box.config(state="normal")
            self._nacl_box.delete("1.0", "end")
            for e in evts:
                ts = datetime.fromtimestamp(e.timestamp).strftime("%H:%M:%S")
                line = (f"#{e.rule_id:04d}  DENY  {e.src_ip}/32  "
                        f"{e.protocol}  [{ts}]\n")
                self._nacl_box.insert("end", line)
            self._nacl_box.config(state="disabled")

        else:
            # Safe state
            self._fw_frame.config(bg=PALETTE["bg_panel"])
            self._fw_state_label.config(bg=PALETTE["bg_panel"],
                                        fg=PALETTE["text_muted"])
            self._fw_banner.config(
                bg=PALETTE["bg_panel"],
                fg=PALETTE["safe"],
                text="COMPLIANT  /  ALLOW ALL",
            )
            self._fw_detail.config(
                bg=PALETTE["bg_panel"],
                fg=PALETTE["text_muted"],
                text="No active NACL enforcement rules.",
            )
            self._nacl_frame.config(bg=PALETTE["bg_widget"])
            self._nacl_box.config(state="normal")
            self._nacl_box.delete("1.0", "end")
            self._nacl_box.config(state="disabled")

    def _update_log(self, snap: dict):
        lines = snap["event_log"]
        self._log_box.config(state="normal")
        self._log_box.delete("1.0", "end")
        for line in reversed(lines):
            # detect level tag
            tag = "INFO"
            for lvl in ("ALERT", "WARN", "ERROR", "DEBUG", "INFO"):
                if f"[{lvl}" in line or f"[{lvl:5s}" in line:
                    tag = lvl
                    break
            self._log_box.insert("end", line + "\n", tag)
        self._log_box.config(state="disabled")
        self._log_box.see("end")

    def _update_status(self, snap: dict):
        if snap["attack_mode"]:
            color = (PALETTE["critical"] if self._blink_flag
                     else PALETTE["warn"])
            self._status_pill.config(
                text="Load Stress Test Active",
                fg=color,
            )
        elif snap["under_attack"]:
            self._status_pill.config(
                text="🛡  MITIGATION ENGAGED",
                fg=PALETTE["warn"],
            )
        else:
            self._status_pill.config(
                text="●  ENGINE NOMINAL",
                fg=PALETTE["safe"],
            )

    def _update_vector_display(self, snap: dict):
        vec = snap["last_vector"]
        if vec:
            self._vec_label.config(
                text=(f"X_t = [ N_t: {vec.N_t:.0f} pkt  │  "
                      f"H(X): {vec.H_X:.4f} bits  │  "
                      f"Δt: {vec.dt*1000:.2f} ms  │  "
                      f"s(x): {vec.score:.4f} ]")
            )


# ─────────────────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 9 — ORCHESTRATOR / ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

def main():
    log.info("=== Project Aegis v2.0 — Initialising ===")

    # Shared state bus
    state = AegisStateBus()

    # SQS-modeled packet queue  (max depth = 50 000 packets in buffer)
    pkt_queue: queue.Queue = queue.Queue(maxsize=50_000)

    # Initialise subsystems
    mitigator  = AWSNACLMitigator(state)
    brain      = IngestionBrain(pkt_queue, state, mitigator)
    simulator  = ThreatSimulatorEngine(pkt_queue, state)

    # Boot background threads
    brain.start()
    simulator.start()

    log.info("All subsystems online. Launching GUI dashboard …")

    # Launch GUI (must run on main thread)
    app = AegisDashboard(state)
    app.protocol("WM_DELETE_WINDOW", lambda: _shutdown(app, simulator, brain))
    app.mainloop()


def _shutdown(app, simulator, brain):
    log.info("Operator exit — shutting down subsystems …")
    simulator.stop()
    brain.stop()
    app.destroy()


if __name__ == "__main__":
    main()