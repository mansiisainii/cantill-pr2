# Corvo Engineering — Procurement Policy Decisions & Assumptions (DECISIONS.md)

This document records all design choices, business interpretations, and edge-case resolutions implemented in Cantill for Corvo Engineering's **Procurement Policy v5.0** and its automated PR-to-PO engine.

---

## 1. Item Identification & Resolution (Policy Section 1)

### 1.1 Item Code vs. Free Text
- **What we noticed**: Many requisition lines in real plant environments contain informal abbreviations, typos, or lack `item_code` entirely (e.g., `"brg 6205 2rs"`, `"hyd hose 1/2 inch 2 wire"`, `"Drinking water purifier 50 LPH"`).
- **Decision**: 
  1. If a valid `item_code` is provided and exists in `item_master.csv`, it is accepted immediately.
  2. If only an item description is provided, we use a deterministic tokenizer and fuzzy match against the catalog (`item_master`). Tokens are normalized (lowercase, alphanumeric, punctuation stripped, unit stop-words removed).
  3. When confidence is unequivocal (exact or dominant similarity $\ge 0.82$), the item code is resolved.
  4. If multiple catalog items match with near-equal scores, the status is flagged as `AMBIGUOUS` so the user/buyer can clarify.
  5. If no match is found above threshold, it is resolved as `NEW` (`is_new_item = true`).

### 1.2 Valuation of New Items
- **What we noticed**: Rule 1.2 states that new items go to `NEW_ITEM_SOURCING` and are valued at $\text{quantity} \times \text{requester's estimated unit price}$.
- **Decision**: For PR lines marked as new items, if an estimated price is provided in the PR, it is multiplied by quantity to compute `group_value_inr`. If no estimate is given by the requester, the line is routed to `NEW_ITEM_SOURCING` with `unit_price = 0` and flagged for buyer quotation. New items are strictly isolated and never clubbed with catalog requirements.

---

## 2. Requirement Clubbing & Anti-Splitting (Policy Section 2)

### 2.1 Fixed Anchor vs. Rolling Window
- **What we noticed**: Policy 2.2 states: *"A line joins an existing requirement when it is for the same item, for the same plant, was created within 14 calendar days of the requirement's first line, and its need-by date is within 7 days (either side) of the first line's need-by date. Otherwise it starts a new requirement. If it could join more than one, it joins the earliest."*
- **Decision**: 
  - The window is anchored to the **first line** of the requirement (`firstLine.created_at`). A new line arriving on Day 15 does **not** join the existing requirement, even if another line joined on Day 10. This prevents "infinite rolling windows" where requirements never close.
  - Sorting order is strictly deterministic: lines are processed chronologically by `created_date + created_time`, then by `pr_no`, then by `pr_line`.
  - Plant separation: Even identical items across `PUN1` (Bhosari) and `CHK1` (Chakan) are kept in distinct requirements because delivery addresses, logistics, and plant budgets are independent.

### 2.2 Emergency Inheritance in Clubbed Groups
- **What we noticed**: Policy 2.3 states: *"If any line in the requirement is marked Emergency, the requirement is an emergency."*
- **Decision**: If a requirement has three lines where two are `Normal` and one is `Emergency`, the entire clubbed requirement is treated as `Emergency`. This ensures the plant receives the entire batch under emergency procurement speed rather than splitting deliveries.

---

## 3. Valuation Fallback Ladder (Policy Section 3)

### 3.1 Fallback Precedence
- **Decision**: The valuation strictly follows Policy 3.1:
  1. **Contract Rate**: If an applicable rate contract is active, valid for the requirement date, and has sufficient remaining ceiling, its rate is used.
  2. **Ceiling-Exceeded Contract Rate**: If all applicable contracts are valid but lack sufficient ceiling headroom, Policy 3.1(a) mandates using the **lowest applicable contract rate** to calculate the requirement's value before routing to RFQ/RFP.
  3. **Recent PO Price**: If no contract applies, we look up the most recent PO in `po_history.csv` for the item placed within the preceding 365 calendar days ($[D_{\text{req}} - 365, D_{\text{req}}]$) with an `Active` supplier.
  4. **Item Master Standard Price**: If the item was not purchased in the last 365 days, we fall back to `item_master.standard_price`.

---

## 4. Contract Ceiling Management (Policy Section 4)

### 4.1 Chronological Ceiling Consumption
- **What we noticed**: Contracts have an aggregate `value_cap` and an existing `consumed_value`. Multiple PR requirements may compete for the same contract ceiling.
- **Decision**:
  - Requirements consume contract ceiling strictly in chronological order of `requirement_date` (the timestamp of the requirement's first line).
  - If a requirement's total value exceeds the remaining headroom (`consumed_value + req_value > value_cap`), that contract cannot be used (Policy 4.2).
  - When multiple contracts are valid, Policy 4.3 dictates selecting the one with the lowest unit rate that has sufficient ceiling remaining.

### 4.2 Capex Exemption from Contract Consumption
- **What we noticed**: Rule 5.1 precedes Rule 5.2. If an item type is `Capex`, it must route to `CAPEX_SOURCING` and obtain capex board approval.
- **Decision**: Capex requirements do **not** consume rate contract ceiling, because no PO is placed directly under Rule 5.2.

### 4.3 PDF-Only Contracts (Policy 4.4)
- **What we noticed**: Certain contracts (e.g., `RC-2026-031`, `RC-2026-033`) exist only as signed PDF documents executed after the register snapshot (31 Oct 2026).
- **Decision**: 
  - PDF-only contracts are extracted and treated as legally binding starting from their `start_date`.
  - Their initial `consumed_value` starts at ₹0 as specified in Policy 4.2.

---

## 5. Preferred Supplier Ranking Methodology (Policy Section 6)

### 5.1 Eligibility Criteria (Policy 6.1)
An entity qualifies for an item's preferred supplier list as of date $T$ if and only if:
1. Status in `supplier_master` is `Active` (Blocked and Inactive suppliers are unconditionally banned under Rule 5.7).
2. AND has either:
   - At least 1 PO for the item in the preceding 548 days ($[T - 548, T]$), OR
   - A rate contract covering the item with `start_date` $\le T$ (even if expired).

### 5.2 Composite Scoring Formula
To balance historical purchase frequency, recency, formal contractual commitments, delivery reliability, and quality standards, the scoring function is defined as:

$$\text{Score} = w_{\text{freq}} \cdot F + w_{\text{recency}} \cdot R + w_{\text{contract}} \cdot C + w_{\text{ontime}} \cdot O + w_{\text{quality}} \cdot Q$$

Where:
- **Weights**:
  - $w_{\text{freq}} = 0.25$ (Weight for purchase frequency)
  - $w_{\text{recency}} = 0.20$ (Weight for order recency)
  - $w_{\text{contract}} = 0.20$ (Weight for contract history)
  - $w_{\text{ontime}} = 0.15$ (Weight for on-time delivery record)
  - $w_{\text{quality}} = 0.20$ (Weight for quality rating)
  - $\sum w = 1.00$

- **Normalized Components**:
  - **Frequency ($F$)**: $\min(\text{PO count}, 5) / 5.0$. Cap of 5 orders prevents high-volume commodities from skewing relative capability.
  - **Recency ($R$)**:
    - $1.0$ if last PO was within 90 days.
    - $0.5$ if last PO was between 91 and 180 days.
    - $0.0$ if older than 180 days or contract-only.
  - **Contract Commitment ($C$)**: $1.0$ if the supplier has ever held a signed rate contract for this item, else $0.0$.
  - **On-Time Delivery ($O$)**: $\text{on\_time\_pct} / 100.0$.
  - **Quality Score ($Q$)**: $\text{quality\_rating} / 5.0$.

### 5.3 Deterministic Tie-Breaking
When two suppliers achieve identical composite scores:
1. Most recent PO date (closer date wins).
2. Total lifetime PO count for the item (higher wins).
3. Supplier ID alphabetical order (`S001` before `S002`) for reproducible output.

### 5.4 Reference Price Definition (Policy 6.3)
1. The unit price on the supplier's most recent PO for the item in the 548-day window.
2. If the supplier has no POs in that window (contract-only eligibility), the unit rate from their contract covering the item.

### 5.5 Sourcing Suggestions Backfill (Policy 6.4)
When routing to `RFQ` (requires 3 suggestions) or `RFP` / `CAPEX_SOURCING` (requires 5 suggestions):
1. Preferred suppliers for the item are selected first in rank order.
2. If fewer than required preferred suppliers exist, we backfill from other `Active` suppliers listed in `supplier_master` that serve the item's `category`, ordered by composite $(\text{OTD} + \text{Quality})$.
3. No `Blocked` or `Inactive` supplier is ever included.

---

## 6. Decision Rules Hierarchy & Edge Cases (Policy Section 5)

| Rule | Clause | Condition | Route | Supplier & Pricing |
|---|---|---|---|---|
| 5.1 | Capex | `item_type == 'Capex'` | `CAPEX_SOURCING` | Suggest 5 suppliers; requires capex approval |
| 5.2 | Contract PO | Active contract with available ceiling | `CONTRACT_PO` | Contract supplier at contract rate |
| 5.3 | Emergency PO | `urgency == 'Emergency'` AND `value <= 500,000` AND bought from Active supplier in last 365 days | `EMERGENCY_PO` | 1st preferred supplier at reference price |
| 5.4 | Spot PO | `value < 200,000` AND bought from Active supplier in last 365 days | `SPOT_PO` | 1st preferred supplier at reference price |
| 5.5 | RFQ | `value < 1,000,000` (including items never bought in last 365 days) | `RFQ` | Suggest 3 suppliers |
| 5.6 | RFP | `value >= 1,000,000` | `RFP` | Suggest 5 suppliers |

### Edge Case: Emergency Value Above ₹5,00,000
- **What we noticed**: Rule 5.3 specifies `value <= 5,00,000`. If an emergency requirement is valued at ₹7,00,000, what happens?
- **Decision**: In accordance with policy rule precedence, it falls through Rule 5.3 and Rule 5.4 to Rule 5.5 (`RFQ`) or Rule 5.6 (`RFP`). Emergency status alone does not permit bypassing high-value competitive bidding limits without executive override.

---

## 7. Purchase Order Consolidation (Policy Section 7)

- **Condition**: Requirements resulting in direct POs (`CONTRACT_PO`, `EMERGENCY_PO`, `SPOT_PO`) that share:
  1. The **same supplier**
  2. The **same plant**
  3. The **same route**
  4. Created within **24 hours** (`consolidation_hours = 24`) of each other
- **Outcome**: Grouped under a shared `po_id` (`PO-0001`, `PO-0002`, etc.), minimizing dispatch overhead and supplier invoice fragmentation.

---

## 8. Data Validation & Error Handling (`NOT_PROCESSED`)

- **What we noticed**: Input files may contain corrupted rows (e.g. `PR-26-00172` with negative quantity or invalid plant).
- **Decision**: Bad lines are never silently deleted. They are preserved in the output with:
  - `route = 'NOT_PROCESSED'`
  - `reason = 'Invalid quantity or missing mandatory plant/date attributes'`
  - Full audit trail maintained for compliance.


---

## 9. Policy Amendment No. 1 (v5.1, Effective 1 December 2026)

During the blind test, Procurement Policy Amendment No. 1 was received and evaluated:

### 9.1 Packaging Spot Limit (Clause A1)
- **Interpretation**: Rule 5.4 spot limit is reduced from ₹2,00,000 to ₹1,00,000 strictly for items in the `Packaging` category. Packaging requirements $\ge ₹1,00,000$ must be sourced.
- **Implementation**: Deployed as split rules:
  - `Rule 5.4a`: `category == 'Packaging'` AND `value < 100,000` AND `bought_recently == true` $\to$ `SPOT_PO`.
  - `Rule 5.4b`: `category != 'Packaging'` AND `value < 200,000` AND `bought_recently == true` $\to$ `SPOT_PO`.
  - Packaging requirements between ₹1,00,000 and ₹8,00,000 now route to `RFQ` (e.g. `PR-26-00603` to `PR-26-00610`).

### 9.2 RFP Threshold Reduction (Clause A2)
- **Interpretation**: The monetary boundary separating `RFQ` (Rule 5.5) and formal `RFP` (Rule 5.6) is reduced from ₹10,00,000 to ₹8,00,000.
- **Implementation**:
  - `Rule 5.5`: `value < 800,000` $\to$ `RFQ` (suggest 3 suppliers).
  - `Rule 5.6`: `value >= 800,000` $\to$ `RFP` (suggest 5 suppliers).
  - Lines between ₹8,00,000 and ₹10,00,000 (e.g. `PR-26-00621`, `PR-26-00622`, `PR-26-00623`, `PR-26-00625`) now appropriately mandate formal `RFP` sourcing.

### 9.3 Chakan Electrical Safety (Clause A3 - Rule 5.2A)
- **Interpretation**: At the Chakan plant (`CHK1`), any requirement in the `Electrical Spares` category valued at ₹50,000 or more must be sourced via `RFQ` (or `RFP` if $\ge ₹8,00,000$), even if emergency or spot PO criteria would otherwise apply. A contract PO (Rule 5.2) remains permitted.
- **Implementation**: Positioned immediately following Rule 5.2:
  - `Rule 5.2`: Contract PO takes precedence if an active contract with available ceiling covers the item.
  - `Rule 5.2A.1`: `plant == 'CHK1'` AND `category == 'Electrical Spares'` AND `value >= 800,000` $\to$ `RFP` (suggest 5).
  - `Rule 5.2A`: `plant == 'CHK1'` AND `category == 'Electrical Spares'` AND `value >= 50,000` $\to$ `RFQ` (suggest 3).
  - Requirements below ₹50,000 at CHK1 remain eligible for spot PO or emergency PO under standard rules.
