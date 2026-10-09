# ADSE-P0-AI-GOVERNANCE-CONTRACT.md
# SECP — ADSE-P0: AI Governance Contract

---

## 1. AI Role Restriction Rules
Engineering AI inside ADSE (e.g. ADSE-P19) is strictly bounded as an **Advisory Layer**.

### Permitted AI Actions
- `ANALYZE`: Inspect designs, parameters, and results.
- `DETECT`: Highlight potential conflicts or anomalies.
- `INTERPRET`: Provide natural language summaries.
- `PROPOSE`: Generate proposed design changes or parameter recommendations.
- `RECOMMEND`: Suggest optimization paths.
- `REQUEST_EXECUTION`: Submit execution requests to `CoreExecutionAuthority`.
- `TRACE`: Map requirements to engineering objects.
- `SUMMARIZE`: Synthesize evidence reports.

### Forbidden AI Actions
- **NO Silent Canonical Writing**: AI cannot write canonical revisions directly.
- **NO Approval**: AI cannot approve releases or baselines.
- **NO Self-Verification**: AI cannot certify its own output.
- **NO Bypass**: AI cannot bypass `CoreExecutionAuthority` or verification gates.

---

## 2. Enforcement
All AI actions pass through `ADSEEngine.evaluateAIProposal()`. Unpermitted action requests trigger immediate `AI_GOVERNANCE_VIOLATION` exceptions.
