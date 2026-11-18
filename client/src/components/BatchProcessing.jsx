import React, { useState } from 'react';
import { Upload, Download, FileText, CheckCircle2, AlertTriangle, Filter, Search, Play, ArrowUpDown } from 'lucide-react';

const ROUTE_COLORS = {
  CONTRACT_PO: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  SPOT_PO: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  EMERGENCY_PO: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  RFQ: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  RFP: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  CAPEX_SOURCING: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  NEW_ITEM_SOURCING: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  NOT_PROCESSED: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function BatchProcessing() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [search, setSearch] = useState('');
  const [policyMode, setPolicyMode] = useState('current'); // 'current' or 'dated'

  const handleRunBatch = async (useSample = false) => {
    setLoading(true);
    try {
      let formData = new FormData();
      if (useSample) {
        // Fetch sample file from public or pass as text
        const sampleRes = await fetch('/data/sample_pr_batch.csv');
        let text = '';
        if (sampleRes.ok) {
          text = await sampleRes.text();
        } else {
          // If not in client/public, server can handle empty or read directly
          formData.append('sample', 'true');
        }
        if (text) {
          const blob = new Blob([text], { type: 'text/csv' });
          formData.append('file', blob, 'sample_pr_batch.csv');
        }
      } else if (file) {
        formData.append('file', file);
      } else {
        alert('Please select a CSV file or click "Run Sample Batch".');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/process-batch?policyMode=${policyMode}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process batch');
      setBatchResult(data);
    } catch (err) {
      alert(`Error running batch: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!batchResult?.batch_id) return;
    window.location.href = `/api/batches/${batchResult.batch_id}/export.csv`;
  };

  const rows = batchResult?.decisions || [];
  const filteredRows = rows.filter((r) => {
    const matchesRoute = selectedRoute === 'ALL' || r.route === selectedRoute;
    const matchesSearch =
      search === '' ||
      r.pr_no.toLowerCase().includes(search.toLowerCase()) ||
      (r.resolved_item_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.supplier_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.group_id || '').toLowerCase().includes(search.toLowerCase());
    return matchesRoute && matchesSearch;
  });

  // Calculate route metrics
  const routeCounts = {};
  let totalValue = 0;
  for (const r of rows) {
    routeCounts[r.route] = (routeCounts[r.route] || 0) + 1;
    totalValue += Number(r.group_value_inr || 0);
  }

  return (
    <div className="space-y-6">
      {/* Upload and Control Header Card */}
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              Batch PR Processing & Policy Evaluation
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload a requisition batch CSV or process the reference 186-line November batch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv"
              id="batch-file-input"
              className="hidden"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <label
              htmlFor="batch-file-input"
              className="cursor-pointer px-4 py-2 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-xl text-sm font-medium transition flex items-center gap-2 border border-slate-600"
            >
              <Upload className="w-4 h-4" />
              {file ? file.name : 'Select CSV'}
            </label>

            {file && (
              <button
                onClick={() => handleRunBatch(false)}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow"
              >
                <Play className="w-4 h-4" />
                Run Uploaded
              </button>
            )}

            <button
              onClick={() => handleRunBatch(true)}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow"
            >
              <Play className="w-4 h-4" />
              Run Sample Batch (186 PRs)
            </button>

            {batchResult && (
              <button
                onClick={handleExportCsv}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow"
              >
                <Download className="w-4 h-4" />
                Export decisions.csv
              </button>
            )}
          </div>
        </div>

        {/* Quick summary stats after run */}
        {batchResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-700/80">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-750">
              <span className="text-xs text-slate-400 block">Total PR Lines</span>
              <span className="text-lg font-bold text-slate-100">{batchResult.summary.lines}</span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-750">
              <span className="text-xs text-slate-400 block">Clubbed Reqs</span>
              <span className="text-lg font-bold text-slate-100">{batchResult.summary.requirements}</span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-750">
              <span className="text-xs text-slate-400 block">POs Generated</span>
              <span className="text-lg font-bold text-emerald-400">{batchResult.summary.pos}</span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-750">
              <span className="text-xs text-slate-400 block">Direct PO Lines</span>
              <span className="text-lg font-bold text-blue-400">
                {(routeCounts.CONTRACT_PO || 0) + (routeCounts.SPOT_PO || 0) + (routeCounts.EMERGENCY_PO || 0)}
              </span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-750">
              <span className="text-xs text-slate-400 block">Sourcing Events</span>
              <span className="text-lg font-bold text-amber-400">
                {(routeCounts.RFQ || 0) + (routeCounts.RFP || 0) + (routeCounts.CAPEX_SOURCING || 0) + (routeCounts.NEW_ITEM_SOURCING || 0)}
              </span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-750">
              <span className="text-xs text-slate-400 block">Active Policy</span>
              <span className="text-lg font-mono font-bold text-purple-300">
                v{batchResult.policy_versions?.[0] || '5.0'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Table Card */}
      {batchResult && (
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" /> Route:
              </span>
              {['ALL', 'CONTRACT_PO', 'SPOT_PO', 'EMERGENCY_PO', 'RFQ', 'RFP', 'CAPEX_SOURCING', 'NEW_ITEM_SOURCING', 'NOT_PROCESSED'].map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRoute(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    selectedRoute === r
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {r} {routeCounts[r] ? `(${routeCounts[r]})` : ''}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search PR, item, supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
              />
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 sticky top-0 uppercase tracking-wider font-semibold border-b border-slate-700">
                <tr>
                  <th className="px-3 py-3">PR / Line</th>
                  <th className="px-3 py-3">Matched Item</th>
                  <th className="px-3 py-3">Req ID</th>
                  <th className="px-3 py-3">PO Number</th>
                  <th className="px-3 py-3">Decision</th>
                  <th className="px-3 py-3">Route</th>
                  <th className="px-3 py-3">Supplier</th>
                  <th className="px-3 py-3 text-right">Unit Price</th>
                  <th className="px-3 py-3 text-right">Req Value (₹)</th>
                  <th className="px-3 py-3">Suggested Suppliers</th>
                  <th className="px-4 py-3">Reason / Policy Clause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-750">
                {filteredRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-750/50 transition">
                    <td className="px-3 py-2.5 font-mono font-medium text-slate-200 whitespace-nowrap">
                      {r.pr_no}/{r.pr_line}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono">
                      {r.resolved_item_code === 'NEW' ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">NEW</span>
                      ) : (
                        <span className="text-slate-300">{r.resolved_item_code}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400 whitespace-nowrap">{r.group_id}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-emerald-400 whitespace-nowrap">
                      {r.po_id || '-'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${r.decision === 'PO' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                        {r.decision}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${ROUTE_COLORS[r.route] || 'bg-slate-700 text-slate-300'}`}>
                        {r.route}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-amber-300 whitespace-nowrap">{r.supplier_id || '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-200 whitespace-nowrap">
                      {r.unit_price ? `₹${Number(r.unit_price).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-100 whitespace-nowrap">
                      {r.group_value_inr ? `₹${Number(r.group_value_inr).toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400 max-w-xs truncate" title={r.suggested_supplier_ids}>
                      {r.suggested_supplier_ids || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 max-w-md truncate" title={r.reason}>
                      <span className="text-slate-300 font-medium font-mono text-[11px]">v{r.policy_version}:</span> {r.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
