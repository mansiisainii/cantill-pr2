import React, { useState, useEffect } from 'react';
import { ShieldCheck, Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, Eye, RefreshCw, Archive } from 'lucide-react';

export default function PolicyAdmin() {
  const [policies, setPolicies] = useState([]);
  const [activePolicy, setActivePolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [changeText, setChangeText] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('2026-11-01');
  const [proposalResult, setProposalResult] = useState(null);
  const [approvedBy, setApprovedBy] = useState('Head of Procurement');

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/policies');
      const data = await res.json();
      setPolicies(data);
      const active = data.find((p) => p.status === 'active') || data[0];
      setActivePolicy(active);
    } catch (err) {
      console.error('Failed to load policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePropose = async () => {
    if (!changeText.trim()) {
      alert('Please describe the policy amendment or paste the text.');
      return;
    }
    setProposing(true);
    try {
      const res = await fetch('/api/policies/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: changeText,
          effective_from: effectiveFrom,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to propose amendment');
      setProposalResult(data);
    } catch (err) {
      alert(`Policy Proposal Error: ${err.message}`);
    } finally {
      setProposing(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!proposalResult?.proposed) return;
    try {
      const res = await fetch('/api/policies/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy: proposalResult.proposed,
          approved_by: approvedBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve policy');
      alert(`Policy version ${data.version} successfully approved and activated!`);
      setProposalResult(null);
      setChangeText('');
      loadPolicies();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleRetire = async (version) => {
    if (!confirm(`Are you sure you want to retire policy version ${version}?`)) return;
    try {
      const res = await fetch(`/api/policies/${version}/retire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: approvedBy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retire policy');
      alert(`Version ${version} retired.`);
      loadPolicies();
    } catch (err) {
      alert(`Error retiring policy: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Policy Governance as Data (Zero-Code Rule Engine)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Rules, thresholds, windows, and order are stored as versioned data. Upload amendments or prompt changes to update logic instantly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
            Active: v{activePolicy?.version || '5.0'}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Effective: {activePolicy?.effective_from}
          </span>
        </div>
      </div>

      {/* Main Grid: Amendment Proposer & Active Policy Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Amendment Proposer Panel */}
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            Propose Policy Amendment
          </h3>
          <p className="text-xs text-slate-400">
            Describe the amendment in natural language or paste text from the amendment PDF (e.g. increase Spot PO limit, add plant/category rules).
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Effective Date</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Amendment Text / Prompt</label>
              <textarea
                rows="5"
                value={changeText}
                onChange={(e) => setChangeText(e.target.value)}
                placeholder="e.g. Policy v5.1 Amendment: Effective 2026-11-01. Raise Spot PO limit to ₹3,00,000. For Chakan plant, Electrical Spares must always go to RFQ..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-mono"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() =>
                  setChangeText(
                    `Corvo Procurement Policy Amendment v5.1:\n1. Effective 2026-11-01.\n2. In Rule 5.4, increase the Spot PO threshold to ₹3,00,000.\n3. Add rule: Chakan plant (CHK1): Electrical Spares always go to RFQ (suggest 3 suppliers).`
                  )
                }
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Insert Demo Amendment (v5.1)
              </button>

              <button
                onClick={handlePropose}
                disabled={proposing || !changeText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5"
              >
                {proposing ? 'Analyzing changes...' : 'Generate Diff & Preview'}
              </button>
            </div>
          </div>

          {/* Proposal Preview & Diff */}
          {proposalResult && (
            <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-400 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Proposed: Version {proposalResult.proposed.version}
                </span>
                <span className="text-[11px] text-slate-400">
                  Base: v{proposalResult.base_version}
                </span>
              </div>

              {proposalResult.errors && proposalResult.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  Validation issues: {proposalResult.errors.join('; ')}
                </div>
              )}

              {/* Changes list */}
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-750 max-h-48 overflow-y-auto space-y-2 text-xs">
                <span className="text-slate-400 font-semibold block mb-1">Human-Readable Rule Changes:</span>
                {proposalResult.changes?.length === 0 ? (
                  <span className="text-slate-500 italic">No structural differences detected.</span>
                ) : (
                  proposalResult.changes?.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-slate-300">
                      <span className="text-emerald-400 font-mono font-bold">•</span>
                      <span>{c}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400">Approver:</span>
                  <input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs w-36"
                  />
                </div>

                <button
                  onClick={handleApproveProposal}
                  disabled={proposalResult.errors?.length > 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition"
                >
                  Approve & Activate v{proposalResult.proposed.version}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Current Active Rules Inspector */}
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 flex flex-col max-h-[680px]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Active Policy Rules (v{activePolicy?.version})
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {activePolicy?.rules?.length || 0} chained rules
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {activePolicy?.rules?.map((rule, idx) => (
              <div key={rule.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-750 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-emerald-400">Rule {rule.id}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                    {rule.then?.decision} · {rule.then?.route}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] mb-2">{rule.text}</p>
                <div className="bg-slate-950/40 p-1.5 rounded font-mono text-[10px] text-slate-400">
                  WHEN: {(rule.when || []).map((w) => `${w.field} ${w.op} ${JSON.stringify(w.value)}`).join(' AND ') || 'always'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Policy History Table */}
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4">
        <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Archive className="w-4 h-4 text-purple-400" />
          Versioned Policy Ledger
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
              <tr>
                <th className="px-4 py-2.5">Version</th>
                <th className="px-4 py-2.5">Effective Date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Approved By</th>
                <th className="px-4 py-2.5">Rules Count</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-750">
              {policies.map((p) => (
                <tr key={p.version} className="hover:bg-slate-750/50">
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-100">v{p.version}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-300">{p.effective_from}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        p.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{p.approved_by || 'system'}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400">{p.rules?.length || 0}</td>
                  <td className="px-4 py-2.5 text-right">
                    {p.status === 'active' && policies.filter((x) => x.status === 'active').length > 1 && (
                      <button
                        onClick={() => handleRetire(p.version)}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Retire
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
