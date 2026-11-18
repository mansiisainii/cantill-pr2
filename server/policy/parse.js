import { FIELDS, OPERATORS } from '../engine/rules.js';
import { validatePolicy } from './diff.js';

const SYSTEM = `You maintain a procurement policy stored as JSON. You receive the CURRENT policy JSON and a CHANGE (an amendment document or an instruction).
Return ONLY the full updated policy JSON, with no markdown and no commentary.
Rules:
- Keep every rule the change does not touch, unchanged and in the same order.
- Rule shape: {"id","text","when":[{"field","op","value"}],"then":{"decision":"PO|SOURCING_REQUEST","route":"CONTRACT_PO|EMERGENCY_PO|SPOT_PO|RFQ|RFP|CAPEX_SOURCING|NEW_ITEM_SOURCING","supplier":"contract|preferred_1","suggest":number}}.
- Allowed condition fields: ${FIELDS.join(', ')}. Allowed operators: ${OPERATORS.join(', ')}.
- Rules are checked in order and the first rule whose conditions all hold decides. Put more specific rules BEFORE general ones.
- Limits and windows live in "params" (club_days, club_needby_days, history_days, preferred_days, consolidation_hours, ranking weights) or in rule conditions. Change the number where it lives.
- Set "version" and "effective_from" (YYYY-MM-DD) from the document. If no date is stated use EFFECTIVE_HINT.
- All values are INR. "5,00,000" means 500000 and "1 lakh" means 100000.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postWithRetry(url, options, label) {
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res.json();
    lastStatus = res.status;
    lastBody = (await res.text()).slice(0, 300);
    if (res.status !== 429 && res.status !== 503) break;
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`${label} request failed (${lastStatus}): ${lastBody}`);
}

async function callGemini(userText) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const data = await postWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 16000, responseMimeType: 'application/json' },
      }),
    },
    `Gemini (${model})`
  );
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    const why = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'no content returned';
    throw new Error(`Gemini returned no answer (${why}).`);
  }
  return parts.map((p) => p.text || '').join('');
}

async function callAnthropic(userText) {
  const data = await postWithRetry(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: SYSTEM,
        messages: [{ role: 'user', content: userText }],
      }),
    },
    'Anthropic'
  );
  return data.content.map((c) => c.text || '').join('');
}

export const llmConfigured = () => !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);

export async function proposePolicy(currentPolicy, changeText, effectiveHint) {
  if (!llmConfigured()) {
    throw new Error('No GEMINI_API_KEY or ANTHROPIC_API_KEY is set. Edit the policy JSON by hand and use the diff endpoint instead.');
  }
  const userText = `CURRENT POLICY:\n${JSON.stringify(currentPolicy)}\n\nEFFECTIVE_HINT: ${effectiveHint || currentPolicy.effective_from}\n\nCHANGE:\n${changeText}`;
  const raw = process.env.GEMINI_API_KEY ? await callGemini(userText) : await callAnthropic(userText);

  const text = raw.replace(/```json|```/g, '').trim();
  let proposed;
  try {
    proposed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    throw new Error('The model did not return valid JSON. Try again, or edit the policy JSON by hand.');
  }
  return { proposed, errors: validatePolicy(proposed) };
}