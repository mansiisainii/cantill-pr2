import React, { useState, useEffect } from 'react';
import { Briefcase, Check, Edit3, AlertCircle, Clock, CheckCircle2, ChevronDown, ChevronRight, X } from 'lucide-react';

const ROUTES = ['CONTRACT_PO', 'EMERGENCY_PO', 'SPOT_PO', 'RFQ', 'RFP', 'CAPEX_SOURCING', 'NEW_ITEM_SOURCING'];

export default function BuyerWorkspace() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batchDetail, setBatchDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedReqs, setExpandedReqs] = useState({});

  // Override modal state
  const [overrideReq, setOverrideReq] = useState(null);
  const [overrideRoute, setOverrideRoute] = useState('');
  const [overrideSupplier, setOverrideSupplier] = useState('');
  const [overrideComment, setOverrideComment] = useState('');
  const [buyerName, setBuyerName] = useState('Senior Buyer');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const res = await fetch('/api/batches');
      const data = await res.json();
      setBatches(data);
      if (data.length > 0 && !selectedBatchId) {
        setSelectedBatchId(data[0].id);
        loadBatchDetail(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  const loadBatchDetail = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/batches/${id}`);
      const data = await res.json();
      setBatchDetail(data);
    } catch (err) {
      console.error('Failed to load batch detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBatch = (id) => {
    setSelectedBatchId(id);
    loadBatchDetail(id);
  };

  const toggleExpand = (groupId) => {
    setExpandedReqs((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleApprove = async (groupId) => {
    if (!selectedBatchId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/batches/${selectedBatchId}/requirements/${groupId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: buyerName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      // Refresh batch detail
      await loadBatchDetail(selectedBatchId);
    } catch (err) {
      alert(`Error approving requirement: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenOverride = (req) => {
    setOverrideReq(req);
    setOverrideRoute(req.route);
    setOverrideSupplier(req.supplier_id || '');
    setOverrideComment('');
  };

  const handleSaveOverride = async () => {
    if (!overrideComment || overrideComment.trim().length < 5) {
      alert('An override requires a written business reason (at least 5 characters).');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/batches/${selectedBatchId}/requirements/${overrideReq.group_id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: overrideRoute,
          supplier_id: overrideSupplier,
          comment: overrideComment,
          user: buyerName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Override failed');
      setOverrideReq(null);
      await loadBatchDetail(selectedBatchId);
    } catch (err) {
      alert(`Error applying override: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const reqs = batchDetail?.requirements || [];
  const filteredReqs = reqs.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return (r.status || 'pending').toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Header & Batch Selector */}
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            Buyer Action Workspace
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Review clubbed purchase requirements, verify policy rules applied, and execute Approve or Override actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Acting Buyer:</span>
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 w-32 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Batch:</span>
            <select
              value={selectedBatchId}
              onChange={(e) => handleSelectBatch(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({b.requirements} reqs, {new Date(b.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['ALL', 'PENDING', 'APPROVED', 'OVERRIDDEN'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            {st} ({reqs.filter((r) => st === 'ALL' || (r.status || 'pending').toUpperCase() === st).length})
          </button>
        ))}
      </div>

      {/* Requirements List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-slate-400 bg-slate-800/50 rounded-2xl border border-slate-700">
            Loading requirements...
          </div>
        ) : filteredReqs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-800/50 rounded-2xl border border-slate-700">
            No requirements match the filter.
          </div>
        ) : (
          filteredReqs.map((r) => {
            const isExpanded = !!expandedReqs[r.group_id];
            const status = (r.status || 'pending').toLowerCase();

            return (
              <div
                key={r.group_id}
                className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 shadow-md hover:border-slate-650 transition overflow-hidden"
              >
                {/* Main Card Summary */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleExpand(r.group_id)}
                      className="mt-1 text-slate-400 hover:text-slate-200"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-slate-100 text-base">{r.group_id}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : status === 'overridden'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {status}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-700 text-slate-300">
                          {r.decision} · {r.route}
                        </span>
                        {r.po_id && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300">
                            PO: {r.po_id}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                        <span className="text-slate-300 font-medium">Policy Reason:</span> {r.reason}
                      </p>
                    </div>
                  </div>

                  {/* Financial & Supplier Summary */}
                  <div className="flex flex-wrap items-center gap-6 lg:justify-end">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Requirement Value</span>
                      <span className="font-mono font-bold text-slate-100 text-sm">
                        ₹{Number(r.group_value_inr).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {r.supplier_id && (
                      <div>
                        <span className="text-[11px] text-slate-400 block">Supplier</span>
                        <span className="font-mono font-semibold text-amber-300 text-sm">
                          {r.supplier_id} {r.unit_price ? `(@ ₹${r.unit_price})` : ''}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleApprove(r.group_id)}
                            disabled={actionLoading}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenOverride(r)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 border border-slate-600 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Override
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-slate-400 italic flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          {r.approved_by ? `By ${r.approved_by}` : r.override?.by ? `Overridden by ${r.override.by}` : 'Completed'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details / Clubbed PR Lines */}
                {isExpanded && (
                  <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-700/80 space-y-3">
                    <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                      Clubbed PR Lines in this Requirement ({r.lines?.length || 0})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-slate-500 uppercase border-b border-slate-800">
                          <tr>
                            <th className="py-2">PR / Line</th>
                            <th className="py-2">Created</th>
                            <th className="py-2">Plant</th>
                            <th className="py-2">Item</th>
                            <th className="py-2">Quantity</th>
                            <th className="py-2">Need By</th>
                            <th className="py-2">Urgency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {(r.lines || []).map((l, idx) => (
                            <tr key={idx}>
                              <td className="py-2 font-mono font-medium text-slate-200">{l.pr_no}/{l.pr_line}</td>
                              <td className="py-2">{l.created_at || l.created_date}</td>
                              <td className="py-2 font-mono">{l.plant}</td>
                              <td className="py-2">{l.item_code || l.resolved_item_code} - {l.description || l.item_description}</td>
                              <td className="py-2 font-mono font-medium">{l.quantity} {l.uom || 'NOS'}</td>
                              <td className="py-2">{l.need_by || l.need_by_date}</td>
                              <td className="py-2">
                                <span className={`px-2 py-0.5 rounded text-[11px] ${l.urgency === 'Emergency' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400'}`}>
                                  {l.urgency || 'Normal'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {r.override && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                        <span className="font-semibold block mb-1">Override Reason:</span>
                        "{r.override.comment}" — by {r.override.by} at {new Date(r.override.at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Override Modal */}
      {overrideReq && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Override Decision: {overrideReq.group_id}
              </h3>
              <button onClick={() => setOverrideReq(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Route</label>
                <select
                  value={overrideRoute}
                  onChange={(e) => setOverrideRoute(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {ROUTES.map((route) => (
                    <option key={route} value={route}>
                      {route}
                    </option>
                  ))}
                </select>
              </div>

              {['CONTRACT_PO', 'EMERGENCY_PO', 'SPOT_PO'].includes(overrideRoute) && (
                <div>
                  <label className="block text-slate-400 mb-1">Supplier ID (Required for PO routes)</label>
                  <input
                    type="text"
                    value={overrideSupplier}
                    onChange={(e) => setOverrideSupplier(e.target.value)}
                    placeholder="e.g. S001"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Mandatory Business Justification</label>
                <textarea
                  rows="3"
                  value={overrideComment}
                  onChange={(e) => setOverrideComment(e.target.value)}
                  placeholder="Explain why this policy rule is being overridden (audit required)..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                onClick={() => setOverrideReq(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-650 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                disabled={actionLoading || !overrideComment.trim()}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow transition"
              >
                Save & Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
