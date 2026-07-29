# Project Aegis: SaaS Evolution & Roadmap

## The Core Concept
Transitioning Project Aegis from a standalone academic project into a commercially viable Firewall-as-a-Service (FWaaS). The goal is to provide enterprise-grade, ML-driven DDoS mitigation with zero manual configuration required from the end-user.

---

## 🎯 Phase 1: Model A (The Reverse Proxy / Hosted Shield) - *CURRENT FOCUS*
**The Strategy:** We host the massive infrastructure. Clients simply change their DNS settings to route traffic through our AWS environment. We absorb the attack, filter the anomalies, and only forward clean, legitimate traffic to their origin server.

### Methodology & Architecture
*   **Multi-Tenant Edge:** A single massive EC2 cluster (or load balancer) intercepts traffic for *multiple* clients. 
*   **Metadata Tagging:** The edge sensor extracts $X_t = [N_t, H(x), \delta_t]$ but now appends a `Tenant_ID` so the AI knows which client is under attack.
*   **The Clean Pipe:** Once traffic passes the SQS buffer and the AI clears it, an Nginx or HAProxy reverse proxy forwards the packets to the client's actual IP address.
*   **Mitigation:** If the AI scores $s \ge 0.60$, the NACL block is applied at *our* edge, completely shielding the client's origin server from ever feeling the impact.

### Action Items for Model A
- [ ] Research Nginx reverse proxy configurations for forwarding clean traffic.
- [ ] Update `sniffer_node.py` to extract and append the target hostname/IP as a `Tenant_ID`.
- [ ] Modify the Boto3 action layer so that NACL rules are applied specifically to the port/route of the affected tenant, minimizing collateral damage.
- [ ] Design a simple onboarding flow on the frontend (Client enters their Domain Name -> We generate DNS nameservers for them to use).

---

## 🚀 Phase 2: Model B (The 1-Click AWS Integration) - *FUTURE SCOPE*
**The Strategy:** The "Bring Your Own Cloud" approach. We package our entire microservice architecture into a deployable template. Clients install our system directly inside their own AWS VPC.

### Methodology & Architecture
*   **Infrastructure as Code (IaC):** Convert our manual AWS setup into a Terraform or AWS CloudFormation template.
*   **Containerization:** Package the `api_server.py` AI Core and `sniffer_node.py` into Docker containers for easy, environment-agnostic deployment.
*   **The IAM Role:** The client grants our software an IAM role with permission to manage their SQS queues and NACL rules.

### Action Items for Model B
- [ ] Learn basic Terraform or AWS CloudFormation syntax.
- [ ] Write a script that automatically provisions the SQS Queue, VPC, and EC2 instance in a target environment.
- [ ] Create a `Dockerfile` for the core backend.

---

## 🎤 Phase 3: The Pitch (Saturday Alumni Presentation)
**Objective:** Prove the core loop and pitch the Model A vision without getting bogged down in complex mathematics.

### Action Items
- [ ] Finalize the Anthropic-style React website via Claude.
- [ ] Test the live `simulate_attack.py` script against the current EC2 sensor to ensure reliable metric spikes.
- [ ] Rehearse the narrative: Use the "Scout, Buffer, Detective, Bouncer" analogies.
- [ ] Ensure `reset_nacl.py` works flawlessly so the demo can be run multiple times.