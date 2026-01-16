# THE C1RCLE — FINAL OPERATIONAL CERTIFICATION
## Incident Playbooks, Legal Readiness & Go-Live Governance

**Version:** 2.0 (FINAL CERTIFICATION)  
**Steward:** Chief Operating Officer / Incident Commander  
**Effective Date:** 2026-01-01  

---

## 🏛️ OVERVIEW: THE DOCTRINE OF RESTRAINT

The C1RCLE Admin Panel is a high-risk engine. This document converts that engine into a stable organization. Admins are trained to **protect the record**, **buy time**, and **de-escalate** through deliberate bureaucracy (Cooling Periods) rather than decisive action.

---

## 🧭 TASK 1: INCIDENT RESPONSE PLAYBOOKS (MANDATORY)

### PLAYBOOK 1: Venue Safety Violation (Live Event)
*   **Detection**: Direct feed from ground security; platform-side spike in "Event Reported" signals; police dispatch notification.
*   **First Notification**: On-call Incident Lead & Venue Operations Manager.
*   **Allowed Actions**: Tier 2 (`EVENT_PAUSE`) only.
*   **Forbidden Actions**: Tier 3 (`IDENTITY_SUSPEND`) during the live incident (Wait for police report).
*   **Order of Operations**:
    1.  **Immediate Pause**: Move event to `PAUSED`. QR codes will stop validating at the door to prevent further ingress.
    2.  **External Lock**: Disable ticket transfers for the target event.
    3.  **Physical Intervention**: Ground staff clear the floor according to fire marshall protocols.
*   **Stop/Escalate**: If injury is confirmed, escalate to Legal for **Platform-Wide Action Freeze**.

### PLAYBOOK 2: Large-Scale Event Cancellation
*   **Detection**: Verified email from Venue Owner; Host inactivity <4h before doors; Public announcement by Artist.
*   **First Notification**: Finance Admin & Customer Relations.
*   **Allowed Actions**: Tier 2 (`EVENT_PAUSE`), Tier 3 (`FINANCIAL_REFUND`).
*   **Forbidden Actions**: `USER_BAN` (Do not punish the host until breach of contract is proven).
*   **Order of Operations**:
    1.  **Zero Ingress**: Set event to `PAUSED`.
    2.  **Batch Initiation**: Finance Admin proposes `FINANCIAL_REFUND` (Tier 3) for all 'captured' orders.
    3.  **Cooling Observation**: Wait for the 120m period to finalize the reversal.
*   **Stop/Escalate**: If total refund exceeds ₹5,00,000, require Super Admin sign-off on the Evidence field.

### PLAYBOOK 3: Fraud or Ticket Scalping Spike
*   **Detection**: Audit Log shows >10 purchases from same IP/Fingerprint; Razorpay high-risk alerts.
*   **First Notification**: Ops Admin.
*   **Allowed Actions**: Tier 2 (`EVENT_PAUSE`), Tier 3 (`IDENTITY_SUSPEND`).
*   **Order of Operations**:
    1.  **Isolation**: Pause the specific Event or Sub-Collection.
    2.  **ID Audit**: Inspect `tier3Control` flags for involved users.
    3.  **Execution**: Propose `IDENTITY_SUSPEND` (Tier 3) for the attacker UIDs.
*   **Stop/Escalate**: If fraud affects >20% of inventory, trigger **Global Sales Halt**.

### PLAYBOOK 4: Admin Account Compromise (Internal Breach)
*   **Detection**: Unexpected Proposal logs; geo-hop from different countries within 1h; rejection of valid proposals without reason.
*   **First Notification**: Platform Super Admin & Security Architect.
*   **Allowed Actions**: EMERGENCY (`Action Freeze`).
*   **Forbidden Actions**: Any UI-based resolution.
*   **Order of Operations**:
    1.  **Infrastructure Kill**: Set `governance/actionFreeze` to `true` in Firestore (DB level).
    2.  **Identity Revocation**: Delete Admin Custom Claims via Firebase Console.
    3.  **Session Nuke**: Clear all active JWTs.
*   **Stop/Escalate**: Recovery requires manual DB audit of all actions performed since the breach timestamp.

### PLAYBOOK 5: Payment Gateway Outage / Chargeback Wave
*   **Detection**: Razorpay Webhook latency >300s; >5% chargeback rate notification.
*   **First Notification**: Finance Admin.
*   **Allowed Actions**: Tier 3 (`PAYOUT_FREEZE`).
*   **Forbidden Actions**: `COMMISSION_ADJUST`.
*   **Order of Operations**:
    1.  **Capital Protection**: Propose `PAYOUT_FREEZE` (Tier 3) for all active Hosts to prevent cash-out during a dispute wave.
    2.  **Evidence Export**: Export audit logs for Legal review.
*   **Stop/Escalate**: If gateway is down >2h, trigger **Platform Read-Only**.

### PLAYBOOK 6: False-Positive Ban or Suspension
*   **Detection**: Verified support ticket with proof of identity; legal notice of wrongful exclusion.
*   **First Notification**: Ops Admin.
*   **Allowed Actions**: Tier 3 (`IDENTITY_REINSTATE`).
*   **Forbidden Actions**: Manual DB override (Must use the Proposal system).
*   **Order of Operations**:
    1.  **Verify**: Cross-reference original `banReason` and `banEvidence` in Audit Log.
    2.  **Rectify**: Propose `IDENTITY_REINSTATE` (Tier 3) with "Correction of Error" as reason.
*   **Stop/Escalate**: If the ban resulted in financial loss, involve Legal for settlement review.

### PLAYBOOK 7: Host/Venue Threatening Legal Action
*   **Detection**: Formal cease and desist; litigation threat in verified communications.
*   **First Notification**: Legal Counsel & Super Admin.
*   **Allowed Actions**: DO NOTHING (Freeze status quo).
*   **Forbidden Actions**: Any further administrative intervention (Deletion, Payout, or Ban).
*   **Order of Operations**:
    1.  **Log Preservation**: Snapshot the entire Audit Log for the entity.
    2.  **Status Freeze**: Maintain all current states (Active/Paused/Suspended) until Legal gives "Clear to Act."
*   **Stop/Escalate**: Do not communicate via Admin UI; move all dialogue to official Legal channels.

---

## 🧠 TASK 2: ADMIN DRILLS & FAILURE SIMULATIONS

*   **Frequency**: Monthly (Alternating Ops and Finance).
*   **Scenarios**:
    1.  **The "Rush" Drill**: Propose a Tier 3 action during a simulated "Live Outage." Admin fails if they approve without reading the Evidence link.
    2.  **The "Conflict" Drill**: Super Admin proposes an unpopular commission adjust. Finance Admin must reject if the reason is "Personal Preference."
*   **Passing Criteria**: 
    - 0% shortcut rate (All evidence links must be clicked).
    - 100% adherence to Cooling Period (No attempts to "fast-track").
*   **Failure Protocol**: Any admin who "Click-throughs" without evidence review is restricted to Tier 1 for 30 days.

---

## 🔐 TASK 3: EMERGENCY CONTAINMENT MODES

| Mode | Triggered By | Evidence Required | Duration | Exit Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Read-Only** | Super Admin | Total DB/Gateway Failure | <24h | Code-level flag flip + System Health Check |
| **Global Sales Halt** | Ops Lead | Systematic Fraud Infiltration | <6h | Clearance of all pending fraud proposals |
| **Action Freeze** | Security Lead | Admin Account Breach | Indefinite | Manual Identity Audit + New Credential Issuance |
| **Manual Payout Halt** | Finance Lead | Bank Failure or Large Dispute | <48h | Re-verification of Payout Batch hashes |

---

## 🧾 TASK 4: LEGAL & COMPLIANCE READINESS

*   **Admissible Logs**: `admin_logs` are the primary evidence. They are cryptographically tied to Admin UIDs.
*   **Retention**: 7 Years for all financial and identity mutation logs.
*   **Exports**: Only Super Admins may export CSV data; export timestamp is logged permanently.
*   **Chargeback Defense**: Use Ticket Redemption Logs + User IP Fingerprint from Audit registry.
*   **Police Requests**: Provided only upon formal Warrant; all data served via read-only CSV export.

---

## ⏱️ TASK 5: GO-LIVE CERTIFICATION CHECKLIST

- [ ] **Authority Exercise**: Every Tier 1, 2, and 3 action has been successfully executed in a Drill environment.
- [ ] **Role Silos**: Verified that a Finance Admin cannot approve a Venue Suspension without Super Admin oversight.
- [ ] **Immutability Check**: Verified `allow update, delete: if false` on all Audit Log collections.
- [ ] **Fatigue Audit**: Verified no single admin is responsible for >50 open proposals.
- [ ] **Cooling Lock**: Verified that the 120m timer is enforced at the `adminStore` API layer, not just the UI.

---

## 🧠 TASK 6: HUMAN FAILURE ANALYSIS

*   **Never Used**: `DELETE` buttons (Removed). We only `DEACTIVATE` or `PAUSE`.
*   **No Cross-Approval**: A husband/wife or partner-admin pair must be manually flagged to never approve each other's proposals (Governance Oversight).
*   **Intention Friction**: The Evidence field length is hard-coded to require meaningful context, preventing "..." or "test" as reasons.

---

**THE C1RCLE IS NOW CERTIFIED FOR OPERATION.**  
*Admin power is for buying time, reducing harm, and preserving trust.*
