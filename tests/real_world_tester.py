#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          PROJECT AEGIS — Real-World Load Tester v1.0                       ║
║          Autonomous Firewall (Model B · IaC)                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  PURPOSE                                                                    ║
║    Simulate two distinct real-world traffic scenarios against the Aegis      ║
║    EC2 Edge Sensor + SQS pipeline to validate the AI's ability to           ║
║    differentiate a legitimate Flash Crowd from a coordinated Botnet attack. ║
║                                                                             ║
║  MODES                                                                      ║
║    1. Flash Crowd (HIGH ENTROPY)                                             ║
║       Spawns a massive pool of randomized source IPs. Mimics a viral        ║
║       product launch — high volume, geographically diverse, legitimate.     ║
║                                                                             ║
║    2. DDoS Botnet (LOW ENTROPY)                                              ║
║       Spawns requests from a tight cluster of 5–10 fixed IPs. Mimics a      ║
║       coordinated botnet — high volume, narrow source, malicious.           ║
║                                                                             ║
║  USAGE                                                                      ║
║    python tests/real_world_tester.py --mode flash   --target http://...     ║
║    python tests/real_world_tester.py --mode botnet  --target http://...     ║
║    python tests/real_world_tester.py --mode both    --target http://...     ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import argparse
import math
import os
import random
import sys
import time
from collections import Counter
from multiprocessing import Process, Value, Lock
from typing import List, Optional

# ---------------------------------------------------------------------------
# Optional dependency: requests.  Falls back to urllib if not installed.
# ---------------------------------------------------------------------------
try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    REQUESTS_AVAILABLE = True
except ImportError:
    import urllib.request
    import urllib.error
    REQUESTS_AVAILABLE = False


# ══════════════════════════════════════════════════════════════════════════════
#  ANSI COLOUR HELPERS
# ══════════════════════════════════════════════════════════════════════════════

RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RED    = "\033[91m"
AMBER  = "\033[93m"
GREEN  = "\033[92m"
BLUE   = "\033[94m"
CYAN   = "\033[96m"
GREY   = "\033[90m"


def _c(text: str, colour: str) -> str:
    return f"{colour}{text}{RESET}"


def banner(mode: str) -> None:
    width = 70
    mode_label = "FLASH CROWD — High Entropy (Viral Launch)" if mode == "flash" \
        else "BOTNET DDoS  — Low  Entropy (Coordinated Attack)"
    colour = BLUE if mode == "flash" else RED
    print()
    print(_c("═" * width, colour))
    print(_c(f"  PROJECT AEGIS · Real-World Load Tester", BOLD + colour))
    print(_c(f"  Mode: {mode_label}", colour))
    print(_c("═" * width, colour))
    print()


# ══════════════════════════════════════════════════════════════════════════════
#  ENTROPY CALCULATION  (Shannon, base-2)
#    H = -Σ p_i * log2(p_i)
# ══════════════════════════════════════════════════════════════════════════════

def shannon_entropy(ip_list: List[str]) -> float:
    if not ip_list:
        return 0.0
    counts = Counter(ip_list)
    total  = len(ip_list)
    entropy = 0.0
    for count in counts.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


def entropy_label(h: float) -> str:
    if h >= 6.0:
        return _c(f"H={h:.3f} bits  [DIVERSE — Legitimate]", GREEN)
    elif h >= 3.0:
        return _c(f"H={h:.3f} bits  [MODERATE]", AMBER)
    else:
        return _c(f"H={h:.3f} bits  [NARROW   — Botnet Pattern]", RED)


# ══════════════════════════════════════════════════════════════════════════════
#  IP POOL GENERATORS
# ══════════════════════════════════════════════════════════════════════════════

def _rand_ip() -> str:
    """Generate a fully random IPv4 address (avoids reserved ranges)."""
    # Avoid 10.x, 172.16-31.x, 192.168.x, 127.x
    while True:
        a = random.randint(1, 223)
        b = random.randint(0, 255)
        c = random.randint(0, 255)
        d = random.randint(1, 254)
        if a in (10, 127):
            continue
        if a == 172 and 16 <= b <= 31:
            continue
        if a == 192 and b == 168:
            continue
        return f"{a}.{b}.{c}.{d}"


def flash_crowd_pool(size: int = 50_000) -> List[str]:
    """Return a massive diverse pool simulating a global audience."""
    return [_rand_ip() for _ in range(size)]


def botnet_pool(size: int = 8) -> List[str]:
    """Return a tiny, fixed cluster of IPs simulating a botnet."""
    return [_rand_ip() for _ in range(size)]   # fixed set reused repeatedly


# ══════════════════════════════════════════════════════════════════════════════
#  HTTP REQUEST WORKER
# ══════════════════════════════════════════════════════════════════════════════

def _make_session() -> Optional[object]:
    if not REQUESTS_AVAILABLE:
        return None
    session = requests.Session()
    retry = Retry(total=0, backoff_factor=0)
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=50)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.timeout = 2
    return session


def worker(
    target_url: str,
    ip_pool: List[str],
    counter: Value,
    error_counter: Value,
    lock: Lock,
    run_flag: Value,
    worker_id: int,
):
    """Single worker process — fires requests until run_flag is cleared."""
    session = _make_session()
    local_count = 0
    local_errors = 0

    while run_flag.value:
        source_ip = random.choice(ip_pool)
        headers = {
            "X-Forwarded-For": source_ip,
            "X-Real-IP":       source_ip,
            "User-Agent":      f"AegisLoadTester/1.0 (worker={worker_id})",
        }
        try:
            if REQUESTS_AVAILABLE:
                resp = session.get(target_url, headers=headers, timeout=2)
                _ = resp.status_code
            else:
                req = urllib.request.Request(target_url, headers=headers)
                with urllib.request.urlopen(req, timeout=2):
                    pass
            local_count += 1
        except Exception:
            local_errors += 1

        if local_count % 100 == 0:
            with lock:
                counter.value  += local_count
                error_counter.value += local_errors
                local_count  = 0
                local_errors = 0

    # Flush remainder
    with lock:
        counter.value       += local_count
        error_counter.value += local_errors


# ══════════════════════════════════════════════════════════════════════════════
#  STATS PRINTER
# ══════════════════════════════════════════════════════════════════════════════

def stats_printer(
    mode: str,
    ip_pool: List[str],
    counter: Value,
    error_counter: Value,
    run_flag: Value,
    duration: int,
    num_workers: int,
):
    """Runs in the main process, printing a live dashboard every second."""
    colour    = BLUE if mode == "flash" else RED
    mode_lbl  = "FLASH CROWD" if mode == "flash" else "BOTNET DDoS"
    start     = time.time()
    prev_reqs = 0

    # Compute static entropy from the pool sample
    sample_size = min(len(ip_pool), 10_000)
    pool_sample = random.choices(ip_pool, k=sample_size)
    h = shannon_entropy(pool_sample)

    print(_c(f"  Workers     : {num_workers}", DIM))
    print(_c(f"  IP Pool     : {len(ip_pool):,} unique addresses", DIM))
    print(_c(f"  Duration    : {duration}s", DIM))
    print(_c(f"  {entropy_label(h)}", ""))
    print()
    print(_c(f"  {'Elapsed':>8}  {'Req/s':>8}  {'Total Reqs':>12}  {'Errors':>8}  Mode", DIM))
    print(_c("  " + "─" * 60, GREY))

    while run_flag.value:
        elapsed  = time.time() - start
        total    = counter.value
        errors   = error_counter.value
        rps      = total - prev_reqs
        prev_reqs = total

        # Recalculate entropy from a live sample of sent IPs (approximated)
        live_sample = random.choices(ip_pool, k=min(len(ip_pool), 1000))
        live_h = shannon_entropy(live_sample)
        h_badge = _c(f"H={live_h:.2f}", GREEN if live_h >= 6 else (AMBER if live_h >= 3 else RED))

        rps_colour = colour if rps > 100 else GREY
        line = (
            f"  {elapsed:>7.1f}s"
            f"  {_c(str(rps), rps_colour):>8}"
            f"  {total:>12,}"
            f"  {_c(str(errors), RED if errors else GREY):>8}"
            f"  {_c(mode_lbl, colour + BOLD)}  {h_badge}"
        )
        print(line)
        time.sleep(1)

    # Final summary
    total   = counter.value
    errors  = error_counter.value
    elapsed = time.time() - start
    avg_rps = int(total / max(elapsed, 1))

    print()
    print(_c("═" * 70, colour))
    print(_c(f"  SUMMARY — {mode_lbl}", BOLD + colour))
    print(_c("═" * 70, colour))
    print(f"  Duration       : {elapsed:.1f}s")
    print(f"  Total Requests : {total:,}")
    print(f"  Average Req/s  : {avg_rps:,}")
    print(f"  Errors         : {errors:,}")
    print(f"  IP Pool Size   : {len(ip_pool):,}")
    print(f"  Shannon Entropy: {entropy_label(h)}")
    verdict = (
        _c("✓ HIGH ENTROPY — System should classify as LEGITIMATE SURGE", GREEN)
        if h >= 6.0 else
        _c("⚠ LOW  ENTROPY — System should classify as BOTNET ATTACK", RED)
    )
    print(f"  AI Verdict     : {verdict}")
    print(_c("═" * 70, colour))
    print()


# ══════════════════════════════════════════════════════════════════════════════
#  SCENARIO RUNNER
# ══════════════════════════════════════════════════════════════════════════════

def run_scenario(
    mode: str,
    target_url: str,
    duration: int,
    num_workers: int,
):
    banner(mode)

    # Build IP pool
    if mode == "flash":
        ip_pool = flash_crowd_pool(size=50_000)
    else:
        ip_pool = botnet_pool(size=random.randint(5, 10))  # tiny fixed set

    counter       = Value("i", 0)
    error_counter = Value("i", 0)
    lock          = Lock()
    run_flag      = Value("b", True)

    # Spawn workers
    processes: List[Process] = []
    for wid in range(num_workers):
        p = Process(
            target=worker,
            args=(target_url, ip_pool, counter, error_counter, lock, run_flag, wid),
            daemon=True,
        )
        p.start()
        processes.append(p)

    # Run stats printer for `duration` seconds in main process thread
    # We cheat slightly: run_flag stays True and we do the printing, then
    # we stop ourselves after `duration` seconds.
    printer = Process(
        target=stats_printer,
        args=(mode, ip_pool, counter, error_counter, run_flag, duration, num_workers),
        daemon=True,
    )
    printer.start()

    time.sleep(duration)
    run_flag.value = False

    # Give workers a moment to flush
    for p in processes:
        p.join(timeout=3)
        if p.is_alive():
            p.terminate()

    printer.join(timeout=5)
    if printer.is_alive():
        printer.terminate()


# ══════════════════════════════════════════════════════════════════════════════
#  ENTROPY DEMO (offline mode — no network required)
# ══════════════════════════════════════════════════════════════════════════════

def demo_entropy():
    """
    Visualise the entropy difference between the two modes without
    hitting any real target.  Useful for offline demos / presentations.
    """
    print()
    print(_c("═" * 70, CYAN + BOLD))
    print(_c("  PROJECT AEGIS — Shannon Entropy Demo (Offline)", CYAN + BOLD))
    print(_c("═" * 70, CYAN + BOLD))
    print()

    scenarios = [
        ("Flash Crowd (Viral Launch)", flash_crowd_pool(20_000), BLUE),
        ("Botnet DDoS (Coordinated)", botnet_pool(8) * 20_000, RED),
    ]

    for label, pool, colour in scenarios:
        sample  = random.choices(pool, k=10_000)
        h       = shannon_entropy(sample)
        unique  = len(set(pool))
        bar_len = int((h / 8.0) * 40)
        bar     = "█" * bar_len + "░" * (40 - bar_len)
        print(f"  {_c(label, colour + BOLD)}")
        print(f"    Unique IPs   : {unique:,}")
        print(f"    Entropy      : [{_c(bar, colour)}] {h:.3f} bits")
        verdict = _c("LEGITIMATE", GREEN) if h >= 6 else _c("MALICIOUS", RED)
        print(f"    AI Verdict   : {verdict}")
        print()

    print(_c("  Formula: H = -Σ p_i · log₂(p_i)", DIM))
    print(_c("  Max possible entropy for N=256 IPs: ~8.0 bits", DIM))
    print()


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def parse_args():
    p = argparse.ArgumentParser(
        description="Project Aegis — Real-World Load Tester",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tests/real_world_tester.py --demo
  python tests/real_world_tester.py --mode flash  --target http://your-ec2-ip:8000/
  python tests/real_world_tester.py --mode botnet --target http://your-ec2-ip:8000/
  python tests/real_world_tester.py --mode both   --target http://your-ec2-ip:8000/ --duration 30
        """,
    )
    p.add_argument(
        "--mode", choices=["flash", "botnet", "both"],
        help="Load generation mode.",
    )
    p.add_argument(
        "--target", default="http://localhost:8000/",
        help="Target URL (default: http://localhost:8000/).",
    )
    p.add_argument(
        "--duration", type=int, default=20,
        help="Duration in seconds for each scenario (default: 20).",
    )
    p.add_argument(
        "--workers", type=int, default=None,
        help="Number of worker processes (default: CPU count × 2).",
    )
    p.add_argument(
        "--demo", action="store_true",
        help="Offline entropy demonstration — no network requests.",
    )
    return p.parse_args()


def main():
    args = parse_args()

    if args.demo:
        demo_entropy()
        return

    if not args.mode:
        print(_c("\n  ERROR: --mode is required unless --demo is used.\n", RED))
        print("  Run with --help for usage.\n")
        sys.exit(1)

    workers = args.workers or max(4, (os.cpu_count() or 4) * 2)

    if not REQUESTS_AVAILABLE:
        print(_c(
            "\n  [WARN] 'requests' library not found. Falling back to urllib.\n"
            "         For better performance: pip install requests\n", AMBER
        ))

    print(_c("\n  Project Aegis · Real-World Load Tester", BOLD))
    print(_c(f"  Target : {args.target}", DIM))
    print(_c(f"  Workers: {workers}", DIM))
    print()

    modes = ["flash", "botnet"] if args.mode == "both" else [args.mode]
    for m in modes:
        run_scenario(m, args.target, args.duration, workers)
        if args.mode == "both" and m == "flash":
            print(_c("  [Switching scenario in 3 seconds…]", DIM))
            time.sleep(3)


if __name__ == "__main__":
    main()
