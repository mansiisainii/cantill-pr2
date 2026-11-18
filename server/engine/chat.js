import { matchItem } from './matchItem.js';
import { processBatch } from './index.js';

function parseRelativeDate(text, baseDateStr = '2026-11-18') {
  const base = new Date(baseDateStr);
  const lower = text.toLowerCase();

  // YYYY-MM-DD
  const iso = lower.match(/\b(202\d-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = lower.match(/\b(\d{1,2})[-/](\d{1,2})[-/](202\d)\b/);
  if (dmy) {
    const [_, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Month name e.g. "by Dec 1", "by 15 Nov", "1st December"
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const monthMatch = lower.match(/\b(?:by\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (monthMatch) {
    const d = parseInt(monthMatch[1], 10);
    const m = months[monthMatch[2].slice(0, 3)];
    const date = new Date(base.getFullYear(), m, d);
    return date.toISOString().slice(0, 10);
  }
  const monthMatchRev = lower.match(/\b(?:by\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthMatchRev) {
    const m = months[monthMatchRev[1].slice(0, 3)];
    const d = parseInt(monthMatchRev[2], 10);
    const date = new Date(base.getFullYear(), m, d);
    return date.toISOString().slice(0, 10);
  }

  // "tomorrow"
  if (lower.includes('tomorrow')) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // "in X days"
  const inDays = lower.match(/in\s+(\d+)\s+days?/);
  if (inDays) {
    const d = new Date(base);
    d.setDate(d.getDate() + parseInt(inDays[1], 10));
    return d.toISOString().slice(0, 10);
  }

  // "next Friday / Monday / ..."
  const daysOfWeek = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  for (const [dayName, dayIdx] of Object.entries(daysOfWeek)) {
    if (lower.includes(dayName)) {
      const currentDay = base.getDay();
      let diff = dayIdx - currentDay;
      if (diff <= 0 || lower.includes('next')) diff += 7;
      const d = new Date(base);
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    }
  }

  return null;
}

function parsePlant(text) {
  const lower = text.toLowerCase();
  if (lower.includes('chakan') || lower.includes('chk1')) return 'CHK1';
  if (lower.includes('bhosari') || lower.includes('pun1') || lower.includes('pune')) return 'PUN1';
  return null;
}

function parseUrgency(text) {
  const lower = text.toLowerCase();
  if (
    lower.includes('emergency') ||
    lower.includes('urgent') ||
    lower.includes('breakdown') ||
    lower.includes('critical') ||
    lower.includes('asap') ||
    lower.includes('immediately')
  ) {
    return 'Emergency';
  }
  if (lower.includes('normal') || lower.includes('regular') || lower.includes('standard')) {
    return 'Normal';
  }
  return null;
}

function parseQuantity(text) {
  // e.g. 200 nos, 50 pcs, need 100, qty: 50, 10 units
  const m = text.match(/(?:need|qty|quantity|order)?\s*(\d+)\s*(?:nos|pcs|pieces|units|kg|mtr|pair|liters|l|sheets|boxes)?\b/i);
  if (m) {
    const val = parseInt(m[1], 10);
    if (val > 0 && val < 1000000) return val;
  }
  return null;
}

export function extractDraft(userText, currentDraft = {}, master) {
  const draft = { ...currentDraft };

  // Plant
  const p = parsePlant(userText);
  if (p) draft.plant = p;

  // Urgency
  const u = parseUrgency(userText);
  if (u) draft.urgency = u;

  // Need by date
  const d = parseRelativeDate(userText);
  if (d) draft.need_by_date = d;

  // Quantity
  const q = parseQuantity(userText);
  if (q && !draft.quantity) draft.quantity = q;

  // Item extraction & matching
  if (!draft.item_code && !draft.description) {
    // Check if user specified direct item code
    const codeMatch = userText.match(/\b(ITM-\d{4})\b/i);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      const itm = master.itemMap.get(code);
      if (itm) {
        draft.item_code = code;
        draft.description = itm.description;
        draft.uom = itm.uom;
        draft.is_new = false;
      }
    } else {
      // Clean phrase of quantity, plant, dates, urgency words to isolate item text
      let cleaned = userText
        .replace(/need|want|please|create|order|purchase|pr\s*for/gi, '')
        .replace(/\b\d+\s*(?:nos|pcs|pieces|units|kg|mtr|pair|liters|l|sheets|boxes)?\b/gi, '')
        .replace(/for\s+(?:chakan|bhosari|pune|chk1|pun1)/gi, '')
        .replace(/at\s+(?:chakan|bhosari|pune|chk1|pun1)/gi, '')
        .replace(/\b(?:chakan|bhosari|pune|chk1|pun1)\b/gi, '')
        .replace(/by\s+next\s+[a-z]+/gi, '')
        .replace(/by\s+\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+/gi, '')
        .replace(/\b(?:urgently|urgent|emergency|immediately|asap|normal)\b/gi, '')
        .trim();

      if (cleaned.length >= 3) {
        const index = master.itemIndex || [];
        const matchRes = matchItem(cleaned, index);
        if (matchRes.status === 'MATCHED' && matchRes.item) {
          draft.item_code = matchRes.item.item_code;
          draft.description = matchRes.item.description;
          draft.uom = matchRes.item.uom;
          draft.is_new = false;
        } else if (matchRes.status === 'AMBIGUOUS') {
          draft.description = cleaned;
          draft.candidates = matchRes.candidates?.map((c) => ({
            item_code: c.item.item_code,
            description: c.item.description,
            uom: c.item.uom,
          })) || [];
        } else {
          // If not matched, treat as free text / potential new item
          draft.description = cleaned;
          draft.is_new = true;
        }
      }
    }
  }

  // Default urgency to Normal if not specified and other fields are filled
  if (!draft.urgency && draft.quantity && draft.plant && draft.need_by_date) {
    draft.urgency = 'Normal';
  }

  return draft;
}

export function validateDraft(draft) {
  const missing = [];
  if (!draft.item_code && !draft.description) missing.push('item (what do you need?)');
  if (!draft.quantity) missing.push('quantity (how many units?)');
  if (!draft.plant) missing.push('plant (Chakan [CHK1] or Bhosari [PUN1]?)');
  if (!draft.need_by_date) missing.push('need-by date (by when is it required?)');
  if (draft.is_new && !draft.estimated_price) missing.push('estimated unit price in INR (since this is a new item not in catalog)');
  return missing;
}

export async function processChatMessage({ message, history = [], draft = {}, master, policies }) {
  const updatedDraft = extractDraft(message, draft, master);
  const missing = validateDraft(updatedDraft);

  // If user says "confirm", "yes", "proceed", "create" and no fields missing -> create PR
  const lowerMsg = message.trim().toLowerCase();
  const isConfirming = /\b(yes|confirm|proceed|create|submit|ok|sure|go ahead)\b/i.test(lowerMsg);

  if (missing.length === 0 && isConfirming) {
    // Generate PR Line
    const prDate = new Date().toISOString().slice(0, 10);
    const prTime = new Date().toTimeString().slice(0, 5);
    const prNo = `PR-CH-${Date.now().toString().slice(-5)}`;
    const lineObj = {
      pr_no: prNo,
      pr_line: '1',
      created_at: `${prDate} ${prTime}`,
      plant: updatedDraft.plant,
      item_code: updatedDraft.item_code || '',
      description: updatedDraft.description || '',
      quantity: String(updatedDraft.quantity),
      uom: updatedDraft.uom || 'NOS',
      need_by_date: updatedDraft.need_by_date,
      urgency: updatedDraft.urgency || 'Normal',
      estimated_unit_price: updatedDraft.estimated_price ? String(updatedDraft.estimated_price) : '',
    };

    // Run through policy engine
    const out = processBatch([lineObj], master, policies);
    const dec = out.rows[0];

    return {
      reply: `✅ **Purchase Request Created & Evaluated!**\n\n- **PR Number**: \`${dec.pr_no}\`\n- **Item**: ${dec.resolved_item_code !== 'NEW' ? `${dec.resolved_item_code} (${updatedDraft.description})` : `NEW ITEM: ${updatedDraft.description}`}\n- **Plant**: ${dec.plant || updatedDraft.plant}\n- **Quantity**: ${updatedDraft.quantity} ${updatedDraft.uom || 'NOS'}\n- **Need-by**: ${updatedDraft.need_by_date}\n\n**Policy Engine Outcome:**\n- **Decision**: **${dec.decision}**\n- **Route**: \`${dec.route}\`\n- **Requirement Value**: ₹${dec.group_value_inr.toLocaleString('en-IN')}\n${dec.supplier_id ? `- **Supplier**: \`${dec.supplier_id}\` (${dec.supplier_name || 'Assigned'})\n- **Unit Price**: ₹${dec.unit_price}\n- **PO Number**: \`${dec.po_id || 'PO-NEW'}\`` : ''}\n${dec.suggested_supplier_ids ? `- **Suggested Suppliers**: \`${dec.suggested_supplier_ids}\`` : ''}\n- **Policy Clause & Reason**: ${dec.reason}\n\nThis requirement has been logged in the **Buyer Workspace** for approval.`,
      status: 'created',
      pr: lineObj,
      decision: dec,
      draft: null,
    };
  }

  // If candidate items exist and user hasn't chosen one
  if (updatedDraft.candidates && updatedDraft.candidates.length > 0 && !updatedDraft.item_code) {
    const list = updatedDraft.candidates.map((c, i) => `${i + 1}. \`${c.item_code}\` — ${c.description} (${c.uom})`).join('\n');
    return {
      reply: `I found multiple items matching "${updatedDraft.description}":\n\n${list}\n\nPlease reply with the number or item code you want, or confirm if this is a completely new item.`,
      status: 'clarify_item',
      draft: updatedDraft,
    };
  }

  // If missing fields exist
  if (missing.length > 0) {
    const prompt = `I have recorded:\n` +
      (updatedDraft.item_code ? `- **Item**: ${updatedDraft.description} (\`${updatedDraft.item_code}\`)\n` : (updatedDraft.description ? `- **Item**: ${updatedDraft.description}\n` : '')) +
      (updatedDraft.quantity ? `- **Quantity**: ${updatedDraft.quantity} ${updatedDraft.uom || 'NOS'}\n` : '') +
      (updatedDraft.plant ? `- **Plant**: ${updatedDraft.plant}\n` : '') +
      (updatedDraft.need_by_date ? `- **Need-by Date**: ${updatedDraft.need_by_date}\n` : '') +
      (updatedDraft.urgency ? `- **Urgency**: ${updatedDraft.urgency}\n` : '') +
      `\nPlease provide: **${missing.join(', ')}**`;

    return {
      reply: prompt,
      status: 'collecting',
      draft: updatedDraft,
    };
  }

  // All fields are ready, ask for confirmation
  return {
    reply: `Here are the details for your Purchase Request:\n\n` +
      `- **Item**: ${updatedDraft.item_code ? `${updatedDraft.description} (\`${updatedDraft.item_code}\`)` : `${updatedDraft.description} *(New Item)*`}\n` +
      `- **Quantity**: ${updatedDraft.quantity} ${updatedDraft.uom || 'NOS'}\n` +
      `- **Plant**: ${updatedDraft.plant === 'CHK1' ? 'Chakan (CHK1)' : 'Bhosari (PUN1)'}\n` +
      `- **Need-by Date**: ${updatedDraft.need_by_date}\n` +
      `- **Urgency**: ${updatedDraft.urgency || 'Normal'}\n` +
      (updatedDraft.estimated_price ? `- **Est. Unit Price**: ₹${updatedDraft.estimated_price}\n` : '') +
      `\nReady to raise this PR? Reply **"Yes"** to confirm.`,
    status: 'confirm',
    draft: updatedDraft,
  };
}
