# Cantill — PR-to-PO Autonomous Procurement Engine for Corvo Engineering

> **One-command launch:** `docker compose up` or `npm start`
> 
> Web App URL: [**http://localhost:4000**](https://cantill-pr2-1.onrender.com)

Cantill is a policy-driven procurement web application built for Corvo Engineering. It converts employee Purchase Requests (PRs), submitted via a conversational chat interface or uploaded in batches, into Purchase Orders (POs) or Sourcing Requests (RFQ/RFP). 

The core engine deterministically executes **Corvo Procurement Policy v5.0** (and future amendments) without AI guesswork in the decision loop, while leveraging Google Gemini Flash for natural-language chat intake and zero-code policy amendment parsing.

---

## Table of Contents

1. [Quick Start (Docker)](#1-quick-start-docker)
2. [Local Development](#2-local-development)
3. [Architecture & Tech Stack](#3-architecture--tech-stack)
4. [Key Features & Navigation](#4-key-features--navigation)
5. [Automated Test Suite (TDD)](#5-automated-test-suite-tdd)
6. [How to Run the Batch Evaluation (Run 1 & Run 2)](#6-how-to-run-the-batch-evaluation-run-1--run-2)
7. [DECISIONS.md & Business Assumptions](#7-decisionsmd--business-assumptions)
8. [API Endpoints Reference](#8-api-endpoints-reference)

---

## 1. Quick Start (Docker)

**Prerequisites:** Docker Desktop installed and running.

```bash
# 1. Start the containerized application
docker compose up

# 2. Open in your browser:
# http://localhost:4000
```

---

## 2. Local Development

**Prerequisites:** Node.js (v18+) and npm.

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install
cd ..

# 2. Build frontend assets
npm run build

# 3. Start the unified server (API + Frontend on port 4000)
npm start

# Alternatively, for live front-end hot-reloading:
# Terminal 1: npm run dev:server (Port 4000)
# Terminal 2: npm run dev:client (Port 3000, proxies /api to 4000)
```

---

## 3. Architecture & Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend UI** | **React 18 + Vite + Tailwind CSS** | Clean SPA with 7 dedicated workspaces (Chat, Batch, Buyer, Contracts, Preferred, Policy Admin, Audit) |
| **Backend API** | **Node.js (Express 5)** | High-throughput REST API with dual storage (in-memory fallback + MongoDB) |
| **Decision Engine** | **Pure Algorithmic TypeScript/ESM** | Deterministic rule-chaining (5.1–5.7), 14-day clubbing, valuation fallback, and 24h PO consolidation |
| **AI — Chat Intake** | **Gemini Flash + Catalog Matcher** | Natural-language slot filling (`item`, `quantity`, `plant`, `need_by_date`, `urgency`) |
| **AI — Policy Documents**| **Gemini Flash + pdf-parse** | Zero-code policy updates: extracts amendments from PDF/text into structured rules with visual diff |
| **PDF Extraction** | **pdf-parse** | Extracts signed PDF contracts (`contracts/pdf/`) into rate lines & ceilings |

---

## 4. Key Features & Navigation

1. 💬 **Requisition Chat Intake**: Natural-language conversational intake (e.g. *"Need 200 nitrile gloves for Chakan by next Friday"*). Auto-detects item, asks clarifying questions for missing slots, copes with vague/new items, and renders real-time policy evaluation.
2. 📊 **Batch Processing**: Upload custom CSV batches or click *"Run Sample Batch"* (186 PR lines from `sample_pr_batch.csv`). Displays full decision table and downloads `decisions.csv`.
3. 💼 **Buyer Action Workspace**: Displays clubbed requirements with lines, value, assigned supplier, and exact policy clause. Buyers can execute 1-click **Approve** or **Override** (modal with mandatory audit justification).
4. 📜 **Contracts Register**: Live register with value ceilings, consumed value, and remaining headroom. Upload new signed PDF contracts with automated text extraction.
5. ⭐ **Preferred Supplier Engine**: Dynamic rankings as of any chosen date based on 548-day history, contracts, on-time delivery %, and quality rating. Includes **Export Top-3 CSV**.
6. ⚙️ **Policy Governance as Data**: View active rules, propose amendments via natural language prompt or PDF, inspect side-by-side visual diffs, and activate new versions.
7. 🕒 **Compliance Audit Trail**: Immutable log of every approval, override comment, and policy change.

---

## 5. Automated Test Suite (TDD)

The test suite contains **32 automated tests** covering all 14 worked examples from `Worked_Examples.pdf`, preferred supplier rankings, emergency limits, and policy amendment diffs.

```bash
# Run unit and integration tests:
npm test
```

All 32 tests execute and pass:
```
✔ chat extracts slots from natural text
✔ chat detects emergency urgency and specific date
✔ chat asks for missing fields when incomplete
✔ chat presents confirmation and creates evaluated PR
✔ 1 contract PO (Ex 1)
✔ 2 contract that exists only as a PDF (Ex 2)
✔ 3 contract ceiling used up goes to RFQ (Ex 3)
✔ 4 two contracts: the cheaper one has no ceiling (Ex 4)
✔ 5 split PRs are clubbed into one requirement (Ex 5)
✔ 6 same item in different plants is not clubbed (Ex 6)
✔ 7 free text item is matched (Ex 7)
✔ 8 emergency PO (Ex 8)
✔ 9 RFQ above the PO limit (Ex 9)
✔ 10 small value but never bought goes to RFQ (Ex 10)
✔ 11 RFP (Ex 11)
✔ 12 capex (Ex 12)
✔ 13 new item (Ex 13)
✔ 14 several requirements on one PO (Ex 14)
✔ preferred lists match the three sample rankings
✔ Blocked and Inactive suppliers never get a PO or a suggestion
✔ bad lines are NOT_PROCESSED and never dropped
✔ item matcher does not invent items
✔ amendment: changed limit & new Chakan-only rule need no code change
```

---

## 6. How to Run the Batch Evaluation (Run 1 & Run 2)

### Run 1: Policy v5.0 Baseline
```bash
# Process batch via API and export decisions CSV
curl -sS -F file=@data/sample_pr_batch.csv "localhost:4000/api/process-batch?format=csv" -o run1.csv

# View route distribution
cut -d, -f6 run1.csv | sort | uniq -c
```

### Run 2: Policy Amendment (e.g. v5.1)
1. In the Web UI, open the **Policy Governance** tab.
2. Click **Insert Demo Amendment (v5.1)** (or upload amendment document).
3. Review the visual diff (Spot PO ceiling raised to ₹3,00,000, Chakan Electrical Spares forced to RFQ).
4. Click **Approve & Activate v5.1**.
5. Re-run the batch:
```bash
curl -sS -F file=@data/sample_pr_batch.csv "localhost:4000/api/process-batch?format=csv" -o run2.csv
```
6. Export Preferred Suppliers as of target date:
```bash
curl -sS "localhost:4000/api/preferred/export.csv?asOf=2026-11-01" -o preferred_2026-11-01.csv
```

---

## 7. DECISIONS.md & Business Assumptions

All edge cases, clubbing window boundaries (14d fixed anchor), valuation fallbacks, and the composite preferred supplier ranking formula are rigorously documented in [DECISIONS.md](file:///c:/Users/hp/OneDrive/Desktop/cantill-pr2/DECISIONS.md).

For methodology and AI usage details, refer to [APPROACH.md](file:///c:/Users/hp/OneDrive/Desktop/cantill-pr2/APPROACH.md).

---

## 8. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Returns system health, storage type, and entity counts |
| `POST` | `/api/chat` | Conversational PR intake (natural language slot filling & evaluation) |
| `POST` | `/api/process-batch` | Processes PR batch CSV (`?format=csv` downloads Section 4 CSV) |
| `GET` | `/api/batches` | Lists past batch runs and summary statistics |
| `GET` | `/api/batches/:id/export.csv` | Downloads batch decisions as CSV |
| `POST` | `/api/batches/:id/requirements/:group/approve` | Approves requirement and generates PO / Sourcing doc |
| `POST` | `/api/batches/:id/requirements/:group/override` | Overrides decision route/supplier with mandatory comment |
| `GET` | `/api/contracts` | Lists active contracts and remaining headroom |
| `POST` | `/api/contracts/extract` | Auto-extracts contract details from uploaded PDF |
| `GET` | `/api/preferred` | Returns ranked preferred suppliers per item (`?item=ITM-XXXX&asOf=YYYY-MM-DD`) |
| `GET` | `/api/preferred/export.csv` | Exports Top 3 preferred suppliers CSV for all items |
| `GET` | `/api/policies` | Lists active and retired policy versions |
| `POST` | `/api/policies/propose` | Ingests amendment text/PDF and returns structured proposal & diff |
| `POST` | `/api/policies/approve` | Approves and activates new policy version |
| `GET` | `/api/audit` | Returns immutable audit event trail |
