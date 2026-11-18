import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, CheckCircle2, AlertCircle, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';

const SUGGESTIONS = [
  "Need 200 nitrile gloves for Chakan by next Friday",
  "Need 50 safety helmets for Bhosari urgently by 2026-11-25",
  "Order 10 solenoid valves for Chakan plant",
  "Need 5 ball bearings 6205 for Bhosari by next Monday"
];

export default function ChatIntake({ onPrCreated }) {
  const [messages, setMessages] = useState([
    {
      id: 'init',
      role: 'bot',
      text: "👋 Hello! I am Cantill, Corvo Engineering's procurement assistant. Tell me what you need to purchase (e.g. *\"Need 200 nitrile gloves for Chakan by next Friday\"*), and I'll match the catalog, gather details, and apply Procurement Policy v5.0."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [lastDecision, setLastDecision] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          draft: draft || {},
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          text: data.reply,
          status: data.status,
          decision: data.decision,
        },
      ]);

      if (data.draft) setDraft(data.draft);
      if (data.decision) {
        setLastDecision(data.decision);
        if (onPrCreated) onPrCreated(data.decision);
      }
      if (data.status === 'created') setDraft(null);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          text: `⚠️ **Error**: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'init',
        role: 'bot',
        text: "👋 Hello! I am Cantill, Corvo Engineering's procurement assistant. Tell me what you need to purchase (e.g. *\"Need 200 nitrile gloves for Chakan by next Friday\"*), and I'll match the catalog, gather details, and apply Procurement Policy v5.0."
      }
    ]);
    setDraft(null);
    setLastDecision(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      {/* Chat Conversation Column */}
      <div className="lg:col-span-2 flex flex-col bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 shadow-xl overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                Requisition Assistant
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Policy v5.0 Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">Natural language chat intake with automatic slot-filling</p>
            </div>
          </div>
          <button
            onClick={resetChat}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition"
            title="Reset conversation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white shadow-md rounded-tr-none'
                    : 'bg-slate-750 bg-slate-900/70 text-slate-200 border border-slate-750 border-slate-700/60 rounded-tl-none shadow-sm'
                }`}
              >
                {m.text}

                {/* Confirm Action Button shortcut */}
                {m.status === 'confirm' && (
                  <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                    <button
                      onClick={() => handleSend('Yes, confirm and create PR')}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm & Submit PR
                    </button>
                    <button
                      onClick={() => handleSend('No, let me change something')}
                      className="px-3 py-1.5 bg-slate-750 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700"
                    >
                      Modify
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-slate-400 flex items-center gap-2">
                <span>Matching catalog & policy rules...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-6 py-2 bg-slate-800/40 border-t border-slate-750 flex items-center gap-2 overflow-x-auto text-xs text-slate-400">
          <span className="shrink-0 flex items-center gap-1 text-slate-500">
            <Sparkles className="w-3 h-3 text-amber-400" /> Examples:
          </span>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              className="shrink-0 px-2.5 py-1 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition border border-slate-650"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-800 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <textarea
              rows="1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Need 200 nitrile gloves for Chakan plant by next Friday..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium transition flex items-center gap-1.5 shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Side Status & Live Draft Inspector */}
      <div className="flex flex-col gap-6">
        {/* Active Draft Card */}
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-5 shadow-xl">
          <h3 className="font-semibold text-slate-200 text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Requisition Slot Status
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-750">
              <span className="text-slate-400">Resolved Item</span>
              <span className="font-mono text-slate-200 font-medium">
                {draft?.item_code ? `${draft.item_code} (${draft.description})` : draft?.description || <span className="text-slate-500 italic">Pending...</span>}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-750">
              <span className="text-slate-400">Quantity</span>
              <span className="text-slate-200 font-medium">
                {draft?.quantity ? `${draft.quantity} ${draft.uom || 'NOS'}` : <span className="text-slate-500 italic">Pending...</span>}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-750">
              <span className="text-slate-400">Plant</span>
              <span className="text-slate-200 font-medium">
                {draft?.plant ? (draft.plant === 'CHK1' ? 'Chakan (CHK1)' : 'Bhosari (PUN1)') : <span className="text-slate-500 italic">Pending...</span>}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-750">
              <span className="text-slate-400">Need-by Date</span>
              <span className="text-slate-200 font-medium">
                {draft?.need_by_date || <span className="text-slate-500 italic">Pending...</span>}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-400">Urgency</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${draft?.urgency === 'Emergency' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-700 text-slate-300'}`}>
                {draft?.urgency || 'Normal'}
              </span>
            </div>
          </div>
        </div>

        {/* Latest Evaluation Result */}
        {lastDecision && (
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-emerald-500/30 p-5 shadow-xl bg-gradient-to-br from-slate-800 via-slate-800 to-emerald-950/20">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-emerald-400 text-sm">Policy Decision Rendered</h3>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">PR Number:</span>
                <span className="font-mono text-slate-200 font-bold">{lastDecision.pr_no}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Decision & Route:</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {lastDecision.route}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Requirement Value:</span>
                <span className="font-semibold text-slate-100">₹{Number(lastDecision.group_value_inr).toLocaleString('en-IN')}</span>
              </div>
              {lastDecision.supplier_id && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Assigned Supplier:</span>
                  <span className="font-mono text-amber-300">{lastDecision.supplier_id}</span>
                </div>
              )}
              {lastDecision.po_id && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">PO Number:</span>
                  <span className="font-mono text-emerald-300 font-bold">{lastDecision.po_id}</span>
                </div>
              )}
              {lastDecision.suggested_supplier_ids && (
                <div className="pt-1">
                  <span className="text-slate-400 block mb-1">Suggested Suppliers:</span>
                  <div className="flex flex-wrap gap-1">
                    {lastDecision.suggested_supplier_ids.split(';').map((s) => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-slate-700 font-mono text-slate-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-slate-700/80 text-[11px] text-slate-400">
                <span className="font-medium text-slate-300">Policy Reason:</span> {lastDecision.reason}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
