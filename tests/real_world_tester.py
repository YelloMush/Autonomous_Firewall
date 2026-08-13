#!/usr/bin/env python3
"""
PROJECT AEGIS -- Real-World Load Tester v1.1
Autonomous Firewall (Model B / IaC)

PURPOSE:
  Simulate two distinct real-world traffic scenarios against the Aegis
  EC2 Edge Sensor + SQS pipeline to validate the AI's ability to
  differentiate a legitimate Flash Crowd from a coordinated Botnet attack.

MODES:
  1. Flash Crowd (HIGH ENTROPY)
     Spawns a massive pool of randomized source IPs. Mimics a viral
     product launch -- high volume, geographically diverse, legitimate.

  2. DDoS Botnet (LOW ENTROPY)
     Spawns requests from a tight cluster of 5-10 fixed IPs. Mimics a
     coordinated botnet -- high volume, narrow source, malicious.

USAGE:
  python tests/real_world_tester.py --demo
  python tests/real_world_tester.py --mode flash  --target http://your-ec2-ip:8000/
  python tests/real_world_tester.py --mode botnet --target http://your-ec2-ip:8000/
  python tests/real_world_tester.py --mode both   --target http://localhost:8000/ --duration 20
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
# Force UTF-8 output globally -- prevents cp1252 UnicodeEncodeError on Windows
# ---------------------------------------------------------------------------
def _fix_encoding():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass  # Python < 3.7

_fix_encoding()

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


# ==============================================================================
#  ANSI COLOUR HELPERS
# ==============================================================================

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
    mode_label = (
        "FLASH CROWD -- High Entropy (Viral Launch)"
        if mode == "flash"
        else "BOTNET DDoS  -- Low  Entropy (Coordinated Attack)"
    )
    colour = BLUE if mode == "flash" else RED
    print()
    print(_c("=" * width, colour))
    print(_c(f"  PROJECT AEGIS | Real-World Load Tester", BOLD + colour))
    print(_c(f"  Mode: {mode_label}", colour))
    print(_c("=" * width, colour))
    print()


# ==============================================================================
#  ENTROPY CALCULATION  (Shannon, base-2)
#    H = -sum( p_i * log2(p_i) )
# ==============================================================================

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
        return _c(f"H={h:.3f} bits  [DIVERSE  -- Legitimate]", GREEN)
    elif h >= 3.0:
        return _c(f"H={h:.3f} bits  [MODERATE]", AMBER)
    else:
        return _c(f"H={h:.3f} bits  [NARROW   -- Botnet Pattern]", RED)


# ==============================================================================
#  IP POOL GENERATORS
# ==============================================================================

def _rand_ip() -> str:
    """Generate a fully random public IPv4 address (avoids RFC-1918 ranges)."""
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
    """Large diverse pool -- simulates a global audience."""
    return [_rand_ip() for _ in range(size)]


def botnet_pool(size: int = 8) -> List[str]:
    """Tiny fixed cluster -- simulates a botnet C2 network."""
    return [_rand_ip() for _ in range(size)]


# ==============================================================================
#  HTTP REQUEST WORKER  (runs in child process)
# ==============================================================================

def _make_session() -> Optional[object]:
    if not REQUESTS_AVAILABLE:
        return None
    session = requests.Session()
    retry = Retry(total=0, backoff_factor=0)
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=50)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
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
    """Single worker process -- fires requests until run_flag is cleared."""
    _fix_encoding()   # <-- re-apply inside child process
    session = _make_session()
    local_count = 0
    local_errors = 0

    while run_flag.value:
        source_ip = random.choice(ip_pool)
        headers = {
            "X-Forwarded-For": source_ip,
            "X-Real-IP":       source_ip,
            "User-Agent":      f"AegisLoadTester/1.1 (worker={worker_id})",
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
                counter.value       += local_count
                error_counter.value += local_errors
                local_count  = 0
                local_errors = 0

    # Flush remainder
    with lock:
        counter.value       += local_count
        error_counter.value += local_errors


# ==============================================================================
#  STATS PRINTER  (runs in child process)
# ==============================================================================

def stats_printer(
    mode: str,
    ip_pool: List[str],
    counter: Value,
    error_counter: Value,
    run_flag: Value,
    duration: int,
    num_workers: int,
):
    """Live dashboard -- prints one line per second."""
    _fix_encoding()   # <-- re-apply inside child process

    colour   = BLUE if mode == "flash" else RED
    mode_lbl = "FLASH CROWD" if mode == "flash" else "BOTNET DDoS "
    start    = time.time()
    prev_reqs = 0

    # Static entropy from pool sample
    sample_size = min(len(ip_pool), 10_000)
    pool_sample = random.choices(ip_pool, k=sample_size)
    h = shannon_entropy(pool_sample)

    print(_c(f"  Workers     : {num_workers}", DIM))
    print(_c(f"  IP Pool     : {len(ip_pool):,} unique addresses", DIM))
    print(_c(f"  Duration    : {duration}s", DIM))
    print(_c(f"  {entropy_label(h)}", ""))
    print()
    print(_c(f"  {'Elapsed':>8}  {'Req/s':>8}  {'Total Reqs':>12}  {'Errors':>8}  Mode", DIM))
    print(_c("  " + "-" * 60, GREY))

    while run_flag.value:
        elapsed   = time.time() - start
        total     = counter.value
        errors    = error_counter.value
        rps       = total - prev_reqs
        prev_reqs = total

        live_sample = random.choices(ip_pool, k=min(len(ip_pool), 1000))
        live_h  = shannon_entropy(live_sample)
        h_badge = _c(
            f"H={live_h:.2f}",
            GREEN if live_h >= 6 else (AMBER if live_h >= 3 else RED),
        )

        rps_colour = colour if rps > 50 else GREY
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
    print(_c("=" * 70, colour))
    print(_c(f"  SUMMARY -- {mode_lbl}", BOLD + colour))
    print(_c("=" * 70, colour))
    print(f"  Duration       : {elapsed:.1f}s")
    print(f"  Total Requests : {total:,}")
    print(f"  Average Req/s  : {avg_rps:,}")
    print(f"  Errors         : {errors:,}")
    print(f"  IP Pool Size   : {len(ip_pool):,}")
    print(f"  Shannon Entropy: {entropy_label(h)}")
    verdict = (
        _c("  VERDICT: HIGH ENTROPY -- System should classify as LEGITIMATE SURGE", GREEN)
        if h >= 6.0
        else _c("  VERDICT: LOW  ENTROPY -- System should classify as BOTNET ATTACK", RED)
    )
    print(verdict)
    print(_c("=" * 70, colour))
    print()


# ==============================================================================
#  SCENARIO RUNNER
# ==============================================================================

def run_scenario(
    mode: str,
    target_url: str,
    duration: int,
    num_workers: int,
):
    banner(mode)

    if mode == "flash":
        ip_pool = flash_crowd_pool(size=50_000)
    else:
        ip_pool = botnet_pool(size=random.randint(5, 10))

    counter       = Value("i", 0)
    error_counter = Value("i", 0)
    lock          = Lock()
    run_flag      = Value("b", True)

    # Spawn worker processes
    processes: List[Process] = []
    for wid in range(num_workers):
        p = Process(
            target=worker,
            args=(target_url, ip_pool, counter, error_counter, lock, run_flag, wid),
            daemon=True,
        )
        p.start()
        processes.append(p)

    # Spawn stats printer process
    printer = Process(
        target=stats_printer,
        args=(mode, ip_pool, counter, error_counter, run_flag, duration, num_workers),
        daemon=True,
    )
    printer.start()

    time.sleep(duration)
    run_flag.value = False

    for p in processes:
        p.join(timeout=3)
        if p.is_alive():
            p.terminate()

    printer.join(timeout=5)
    if printer.is_alive():
        printer.terminate()


# ==============================================================================
#  ENTROPY DEMO (offline -- no network requests)
# ==============================================================================

def demo_entropy():
    """Visualise the entropy contrast between modes. Perfect for presentations."""
    _fix_encoding()

    print()
    print(_c("=" * 70, CYAN + BOLD))
    print(_c("  PROJECT AEGIS | Shannon Entropy Demo (Offline)", CYAN + BOLD))
    print(_c("=" * 70, CYAN + BOLD))
    print()

    scenarios = [
        ("Flash Crowd (Viral Launch)",    flash_crowd_pool(20_000), BLUE),
        ("Botnet DDoS (Coordinated)",     botnet_pool(8) * 20_000,  RED),
    ]

    for label, pool, colour in scenarios:
        sample  = random.choices(pool, k=10_000)
        h       = shannon_entropy(sample)
        unique  = len(set(pool))
        bar_len = int((h / 14.0) * 50)   # scale to 50 chars
        bar_len = min(bar_len, 50)
        bar     = "#" * bar_len + "." * (50 - bar_len)
        print(f"  {_c(label, colour + BOLD)}")
        print(f"    Unique IPs   : {unique:,}")
        print(f"    Entropy      : [{_c(bar, colour)}] {h:.3f} bits")
        verdict = _c("LEGITIMATE", GREEN) if h >= 6 else _c("MALICIOUS", RED)
        print(f"    AI Verdict   : {verdict}")
        print()

    print(_c("  Formula: H = -sum( p_i * log2(p_i) )", DIM))
    print(_c("  Flash Crowd entropy >> 8 bits  (huge diverse pool)", DIM))
    print(_c("  Botnet entropy      ~  3 bits  (tiny fixed cluster)", DIM))
    print()


# ==============================================================================
#  ENTRY POINT
# ==============================================================================

def parse_args():
    p = argparse.ArgumentParser(
        description="Project Aegis -- Real-World Load Tester v1.1",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tests/real_world_tester.py --demo
  python tests/real_world_tester.py --mode flash  --target http://localhost:8000/
  python tests/real_world_tester.py --mode botnet --target http://localhost:8000/
  python tests/real_world_tester.py --mode both   --target http://localhost:8000/ --duration 30
        """,
    )
    p.add_argument("--mode", choices=["flash", "botnet", "both"], help="Load generation mode.")
    p.add_argument("--target", default="http://localhost:8000/", help="Target URL.")
    p.add_argument("--duration", type=int, default=20, help="Duration in seconds per scenario (default: 20).")
    p.add_argument("--workers", type=int, default=None, help="Worker processes (default: CPU count x 2).")
    p.add_argument("--demo", action="store_true", help="Offline entropy demo -- no network requests.")
    return p.parse_args()


def main():
    _fix_encoding()
    args = parse_args()

    if args.demo:
        demo_entropy()
        return

    if not args.mode:
        print(_c("\n  ERROR: --mode is required unless --demo is used.\n", RED))
        sys.exit(1)

    workers = args.workers or max(4, (os.cpu_count() or 4) * 2)

    if not REQUESTS_AVAILABLE:
        print(_c(
            "\n  [WARN] 'requests' not found. Falling back to urllib.\n"
            "         For better performance: pip install requests\n", AMBER
        ))

    print(_c("\n  Project Aegis | Real-World Load Tester v1.1", BOLD))
    print(_c(f"  Target  : {args.target}", DIM))
    print(_c(f"  Workers : {workers}", DIM))
    print()

    modes = ["flash", "botnet"] if args.mode == "both" else [args.mode]
    for m in modes:
        run_scenario(m, args.target, args.duration, workers)
        if args.mode == "both" and m == "flash":
            print(_c("  [Switching scenario in 3 seconds...]", DIM))
            time.sleep(3)


if __name__ == "__main__":
    # Required before spawning any multiprocessing.Process when this script
    # is run as a PyInstaller-frozen executable on Windows — without it,
    # every worker process would re-execute main() from scratch instead of
    # running as a child, and multiprocessing refuses to start at all.
    from multiprocessing import freeze_support
    freeze_support()
    main()
