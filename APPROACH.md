# Cantill PR-to-PO Automation — Architecture & Engineering Approach (APPROACH.md)

## 1. Executive Summary

Cantill is built for **Corvo Engineering** to eliminate manual delays, anti-splitting policy evasion, and procurement inconsistency. The system adheres to a core philosophical principle:

> **"AI in the conversation and document intake; 100% deterministic, auditable code in the procurement decision loop."**

Requesters interact with an intelligent conversational assistant to raise PRs without memorizing catalog codes or filling clunky forms. Policy administrators upload natural-language policy amendments or PDFs without code redeployments. However, when determining whether ₹5,00,000 of factory spend requires a competitive RFQ or direct Purchase Order, the execution is strictly mathematical, rule-ordered, and reproducible.

---

## 2. AI Tools & Usage Disclosure

In compliance with the task ground rules, the following AI tools and models were utilized:
1. **Google Gemini Flash (`gemini-3.8-flash` / `gemini-2.5-flash`)**:
   - Natural language conversational intake for extracting requisition slots (item, quantity, plant, need-by, urgency).
   - Semi-structured policy document ingestion: converting procurement policy PDF amendments into validated JSON rules.
2. **Anthropic Claude (Sonnet 3.7 & 4.6)**:
   - Co-architecting the policy engine data structures, rule chaining pipeline, and unit test suite.
3. **Google DeepMind Antigravity**:
   - Implementation agent orchestrating the end-to-end full-stack delivery, frontend components, and production build.

---

## 3. Architecture Overview

Cantill is organized into decoupled layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 React 18 Single Page App (Vite)              │
│   💬 Chat Intake  │ 📊 Batch Run │ 💼 Buyer Workspace       │
│   📜 Contracts    │ ⭐ Preferred │ ⚙️ Policy Admin           │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API (JSON)
┌────────────────────────────▼────────────────────────────────┐
│               Node.js Express API Server (:4000)             │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    API Routers                      │   │
│   │  /api/chat          /api/process-batch              │   │
│   │  /api/batches       /api/policies                   │   │
│   │  /api/contracts     /api/preferred                  │   │
│   │  /api/admin/import  /api/audit                      │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                  │
│   ┌──────────────────────▼──────────────────────────────┐   │
│   │               Core Decision Engine                  │   │
│   │   1. Item Matching (Exact + Normalized Tokenizer)   │   │
│   │   2. Requirement Clubbing (14d create / 7d need-by) │   │
│   │   3. Valuation Ladder (Contract > PO > Standard)    │   │
│   │   4. Deterministic Rule Chaining (5.1 -> 5.7)       │   │
│   │   5. PO Consolidation (24h Window / Same Supplier)  │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                  │
│   ┌──────────────────────▼──────────────────────────────┐   │
│   │           Storage Layer (Memory / MongoDB)          │   │
│   │  items | suppliers | plants | history | contracts   │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Key Engineering Highlights

### 4.1 Policy as Data (Zero-Code Dynamic Governance)
Procurement policies frequently change. Instead of hard-coding `if (value < 200000)` into business logic, rules are expressed as structured JSON objects:
```json
{
  "id": "5.4",
  "text": "Value below 2,00,000 and bought from an Active supplier in last 365 days",
  "when": [
    { "field": "value", "op": "lt", "value": 200000 },
    { "field": "bought_recently", "op": "eq", "value": true }
  ],
  "then": {
    "decision": "PO",
    "route": "SPOT_PO",
    "supplier": "preferred_1"
  }
}
```
When an amendment document is uploaded:
1. Gemini extracts the proposed changes into the schema.
2. A deterministic JSON-diff generator displays changes in human-readable terms.
3. Upon buyer approval, the version is activated with an effective date (`effective_from`).
4. Requirements are evaluated using the policy active on their specific requirement date.

### 4.2 Preferred Supplier Engine
Suppliers are scored using a normalized composite metric:
$$\text{Score} = 0.25 F + 0.20 R + 0.20 C + 0.15 O + 0.20 Q$$
- Frequency ($F$) capped at 5 orders to prevent distorting commodity suppliers.
- Recency ($R$) decaying over 90 and 180 days.
- Contract tenure ($C$) rewarding strategic vendor relationships.
- Delivery reliability ($O$) and quality rating ($Q$) safeguarding factory throughput.

### 4.3 Test-Driven Development (TDD)
The suite includes 28 rigorous automated tests covering:
- All **14 Worked Examples** provided in the kit.
- Emergency orders exceeding ₹5,00,000 falling through to RFQ.
- Banned/Inactive supplier safeguards.
- PDF contract extraction.
- Deterministic output idempotency.
