"""
tenant_api.py — Aegis Tenant Control Plane
==========================================
Runs on port 8001 (separate from the main api_server.py on port 8000).

Start:  python tenant_api.py
Docs:   http://127.0.0.1:8001/docs
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import time
import random
import uvicorn

app = FastAPI(
    title="Aegis Tenant Control Plane",
    description=(
        "Model A provisioning API — onboards new tenants onto the Aegis "
        "reverse proxy pipeline (SQS buffer -> Isolation Forest -> clean pipe)."
    ),
    version="0.0.1",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Accepts requests from the React pitch site (served at any origin, including
# file:// for the artifact window and http://localhost:8000 for the dev server).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory tenant store ────────────────────────────────────────────────────
# Keyed by tenant_id (UUID4 string).
# In production: swap for RDS / DynamoDB with encrypted at-rest storage.
tenants: dict[str, dict] = {}

# ── Constants ─────────────────────────────────────────────────────────────────
CNAME_TARGET            = "ingress.aegis-shield.net"
DNS_VERIFIED_AFTER_SECS = 10  # Simulated propagation window (10 s for demo)

# Mock Anycast ingress IP pool.
# In production these are real Aegis edge IPs assigned via BGP Anycast.
INGRESS_IP_POOL: list[str] = [
    "34.100.182.41",
    "34.93.202.115",
    "35.200.48.59",
    "34.126.65.104",
    "35.207.249.97",
]

# ── Request / Response models ─────────────────────────────────────────────────
class ProvisionRequest(BaseModel):
    domain_name: str


# ── Nginx config generator ────────────────────────────────────────────────────
def generate_nginx_config(domain: str, tenant_id: str) -> str:
    """
    Simulates writing a per-tenant Nginx reverse proxy block.
    Each tenant gets a dedicated upstream group pointing at the
    M/M/c SQS buffer pipeline, with tenant-scoped rate limiting.
    """
    upstream_name = tenant_id.replace("-", "")[:12]
    generated_at  = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    lines = [
        f"# ─────────────────────────────────────────────────",
        f"# Aegis Model A  —  Auto-Generated Tenant Config",
        f"# Tenant ID : {tenant_id}",
        f"# Domain    : {domain}",
        f"# Generated : {generated_at}",
        f"# ─────────────────────────────────────────────────",
        f"",
        f"upstream aegis_buf_{upstream_name} {{",
        f"    # M/M/c SQS buffer pipeline (3-node weighted pool)",
        f"    server sqs-buf-1.aegis-internal.net:8080 weight=3;",
        f"    server sqs-buf-2.aegis-internal.net:8080 weight=3;",
        f"    server sqs-buf-3.aegis-internal.net:8080 weight=2;",
        f"    keepalive 32;",
        f"}}",
        f"",
        f"# HTTP -> HTTPS redirect",
        f"server {{",
        f"    listen 80;",
        f"    server_name {domain};",
        f"    return 301 https://$host$request_uri;",
        f"}}",
        f"",
        f"server {{",
        f"    listen 443 ssl http2;",
        f"    server_name {domain};",
        f"",
        f"    # TLS — managed by Aegis certificate authority",
        f"    ssl_certificate     /etc/aegis/certs/{domain}.crt;",
        f"    ssl_certificate_key /etc/aegis/certs/{domain}.key;",
        f"    ssl_protocols       TLSv1.2 TLSv1.3;",
        f"    ssl_ciphers         HIGH:!aNULL:!MD5;",
        f"",
        f"    # Pre-buffer, per-tenant rate limiting",
        f"    limit_req_zone $binary_remote_addr zone={upstream_name}:10m rate=200r/s;",
        f"    limit_req      zone={upstream_name} burst=500 nodelay;",
        f"",
        f"    location / {{",
        f"        proxy_pass          http://aegis_buf_{upstream_name};",
        f"        proxy_set_header    Host              $host;",
        f"        proxy_set_header    X-Real-IP         $remote_addr;",
        f"        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;",
        f"        proxy_set_header    X-Forwarded-Proto $scheme;",
        f"        # Inject tenant context for downstream AI engine",
        f"        proxy_set_header    X-Tenant-ID       {tenant_id};",
        f"        proxy_set_header    X-Aegis-Model     A;",
        f"        proxy_connect_timeout 5s;",
        f"        proxy_send_timeout    30s;",
        f"        proxy_read_timeout    30s;",
        f"        proxy_buffering       on;",
        f"        proxy_buffer_size     16k;",
        f"    }}",
        f"}}",
    ]
    return "\n".join(lines)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/provision-tenant", summary="Provision a new Model A tenant")
async def provision_tenant(req: ProvisionRequest):
    """
    Accepts a domain name, generates a unique tenant_id and Nginx config,
    assigns an ingress IP, and returns CNAME routing instructions.

    Idempotent: calling this twice with the same domain returns the
    existing tenant rather than creating a duplicate.
    """
    domain = req.domain_name.lower().strip()

    # ── Validation ──
    if not domain or "." not in domain or len(domain) < 4:
        raise HTTPException(
            status_code=422,
            detail="Invalid domain. Please enter a valid domain (e.g. api.example.com).",
        )

    # ── Idempotency check ──
    for tid, t in tenants.items():
        if t["domain_name"] == domain:
            print(f"[~] Idempotent re-provision -> {tid} | {domain}")
            return {
                "tenant_id":    tid,
                "domain_name":  t["domain_name"],
                "ingress_ip":   t["ingress_ip"],
                "cname_target": CNAME_TARGET,
                "status":       "already_provisioned",
                "message":      f"{domain} is already provisioned. Returning existing configuration.",
                "nginx_config": t["nginx_config"],
            }

    # ── Provision new tenant ──
    tenant_id  = str(uuid.uuid4())
    ingress_ip = random.choice(INGRESS_IP_POOL)
    nginx_conf = generate_nginx_config(domain, tenant_id)

    tenants[tenant_id] = {
        "domain_name":    domain,
        "ingress_ip":     ingress_ip,
        "cname_target":   CNAME_TARGET,
        "nginx_config":   nginx_conf,
        "provisioned_at": time.time(),
        "status":         "pending",
    }

    print(f"[+] Tenant provisioned")
    print(f"    tenant_id  = {tenant_id}")
    print(f"    domain     = {domain}")
    print(f"    ingress_ip = {ingress_ip}")
    print(f"    nginx conf = {len(nginx_conf)} chars generated")

    return {
        "tenant_id":    tenant_id,
        "domain_name":  domain,
        "ingress_ip":   ingress_ip,
        "cname_target": CNAME_TARGET,
        "status":       "provisioned",
        "message":      f"Successfully provisioned. Point {domain} CNAME to {CNAME_TARGET}.",
        "nginx_config": nginx_conf,
    }


@app.get("/api/check-dns/{tenant_id}", summary="Poll DNS propagation status")
async def check_dns(tenant_id: str):
    """
    Simulates a DNS propagation check. Returns 'verified' once
    DNS_VERIFIED_AFTER_SECS seconds have elapsed since provisioning.

    The React frontend polls this endpoint every 3 seconds.
    """
    if tenant_id not in tenants:
        raise HTTPException(status_code=404, detail="Tenant not found. Has this domain been provisioned?")

    t       = tenants[tenant_id]
    elapsed = time.time() - t["provisioned_at"]

    if elapsed >= DNS_VERIFIED_AFTER_SECS:
        t["status"] = "verified"
        print(f"[+] DNS verified -> {tenant_id} | {t['domain_name']} ({elapsed:.1f}s elapsed)")
        return {
            "tenant_id":      tenant_id,
            "domain_name":    t["domain_name"],
            "status":         "verified",
            "message":        f"Propagation confirmed. {t['domain_name']} is now routing through Aegis.",
            "elapsed_seconds": round(elapsed, 1),
        }

    remaining = round(DNS_VERIFIED_AFTER_SECS - elapsed, 1)
    return {
        "tenant_id":      tenant_id,
        "domain_name":    t["domain_name"],
        "status":         "pending",
        "message":        f"Awaiting propagation… ({remaining}s remaining in simulation).",
        "elapsed_seconds": round(elapsed, 1),
    }


@app.get("/api/tenants", summary="[Dev] List all provisioned tenants")
async def list_tenants():
    """Development-only introspection endpoint."""
    return {
        "count":   len(tenants),
        "tenants": [
            {
                "tenant_id":      tid,
                "domain_name":    t["domain_name"],
                "ingress_ip":     t["ingress_ip"],
                "cname_target":   t["cname_target"],
                "status":         t["status"],
                "provisioned_at": t["provisioned_at"],
                "elapsed_seconds": round(time.time() - t["provisioned_at"], 1),
            }
            for tid, t in tenants.items()
        ],
    }


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    banner = "=" * 52
    print(f"\n{banner}")
    print("  Aegis Tenant Control Plane  v0.0.1")
    print(f"{banner}")
    print("  POST /api/provision-tenant")
    print("  GET  /api/check-dns/{{tenant_id}}")
    print("  GET  /api/tenants          [dev only]")
    print(f"  Interactive docs: http://127.0.0.1:8001/docs")
    print(f"{banner}\n")
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
