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

---

## 🚦 Phase 4: Nuanced Traffic Analysis (Surge vs. Attack)
**Objective:** Expand the narrative and technical capability to differentiate between legitimate "Flash Crowds" (e.g., sudden viral traffic, product launches) and malicious volumetric attacks.
*   Instead of just terming all high-volume traffic as "malicious," we need to articulate how the system handles a legitimate surge.
*   **Action Items:**
    - [ ] Define the behavior of the SQS buffer during a legitimate flash crowd (auto-scaling without triggering NACL drops).
    - [ ] Tune the Isolation Forest features (e.g., Shannon entropy of IP distributions) so the AI can distinguish between 100,000 requests from diverse, legitimate IPs vs. a botnet flood.
    - [ ] Add a visual state to the dashboard for "High Load / Benign Surge" where the buffer expands but the threat score stays low.

---

## 🔍 Phase 5: System Flaws, Drawbacks, and Loopholes
**Objective:** Be intellectually honest about the limitations of Project Aegis to anticipate questions from professors/investigators and guide future iterations.
*   **Action Items:**
    - [ ] **Cost Loopholes:** Document the risk of AWS bills spiking if the SQS queue absorbs a massive Layer 7 flood before the AI can drop the IPs.
    - [ ] **False Positives:** Detail what happens if the AI accidentally blocks a legitimate major ISP gateway (collateral damage).
    - [ ] **Layer 7 Complexity:** Acknowledge that while we handle volumetric floods (Layer 3/4), sophisticated application-layer attacks (Layer 7 HTTP floods that mimic human behavior perfectly) might bypass the current 5-feature Isolation Forest model.
    - [ ] **Latency Overheads:** Document the inherent latency introduced by routing all packets through an SQS queue and AI inference layer before reaching the origin.