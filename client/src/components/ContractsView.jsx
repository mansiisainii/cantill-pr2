import React, { useState, useEffect } from 'react';
import { FileCheck, Plus, Upload, AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function ContractsView() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [contractForm, setContractForm] = useState({
    contract_id: '',
    supplier_id: '',
    start_date: '',
    end_date: '',
    value_cap: '',
    consumed_value: '0',
    source: 'pdf',
    lines: [],
  });

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contracts');
      const data = await res.json();
      setContracts(data);
    } catch (err) {
      console.error('Failed to load contracts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFile(file);
    setExtracting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/contracts/extract', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract PDF contract');
      setContractForm(data);
    } catch (err) {
      alert(`PDF Extraction Error: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveContract = async () => {
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save contract');
      alert(`Contract ${data.contract_id} successfully saved!`);
      setShowAddModal(false);
      loadContracts();
    } catch (err) {
      alert(`Error saving contract: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-400" />
            Rate Contracts Register
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Active and signed rate contracts covering items, validity periods, value ceilings, and consumed headroom.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow transition"
        >
          <Plus className="w-4 h-4" />
          Add / Extract Contract PDF
        </button>
      </div>

      {/* Contracts Table */}
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
              <tr>
                <th className="px-4 py-3">Contract No.</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Validity Period</th>
                <th className="px-4 py-3 text-right">Ceiling (₹)</th>
                <th className="px-4 py-3 text-right">Consumed (₹)</th>
                <th className="px-4 py-3 text-right">Remaining Headroom</th>
                <th className="px-4 py-3">Items Covered</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-750">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-400">Loading contracts...</td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-400">No contracts found.</td>
                </tr>
              ) : (
                contracts.map((c) => {
                  const remaining = Math.max(0, c.value_cap - (c.consumed_value || 0));
                  const pct = Math.min(100, Math.round(((c.consumed_value || 0) / c.value_cap) * 100));

                  return (
                    <tr key={c.contract_id} className="hover:bg-slate-750/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-100">{c.contract_id}</td>
                      <td className="px-4 py-3 font-mono text-amber-300">{c.supplier_id}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {c.start_date} <span className="text-slate-500">to</span> {c.end_date}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-200">
                        ₹{Number(c.value_cap).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        ₹{Number(c.consumed_value || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        ₹{remaining.toLocaleString('en-IN')}
                        <span className="text-[10px] text-slate-500 ml-1">({100 - pct}%)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[11px]">
                          {c.lines?.length || 0} line(s)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${c.source === 'pdf' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                          {c.source === 'pdf' ? 'Signed PDF' : 'Register'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Extract Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                Upload & Extract Signed Contract PDF
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="border-2 border-dashed border-slate-700 hover:border-slate-600 rounded-xl p-6 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  id="pdf-upload"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer block">
                  <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <span className="text-slate-200 font-medium block">
                    {pdfFile ? pdfFile.name : 'Click to select signed contract PDF (e.g. RC-2026-031.pdf)'}
                  </span>
                  <span className="text-slate-500 text-[11px] mt-1 block">
                    Auto-extracts contract number, supplier, dates, ceiling, and line items
                  </span>
                </label>
              </div>

              {extracting && (
                <div className="text-center text-emerald-400 py-2">
                  Parsing PDF with pdf-parse...
                </div>
              )}

              {/* Form fields for review */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-400 mb-1">Contract ID</label>
                  <input
                    type="text"
                    value={contractForm.contract_id}
                    onChange={(e) => setContractForm({ ...contractForm, contract_id: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono"
                    placeholder="RC-2026-XXX"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Supplier ID</label>
                  <input
                    type="text"
                    value={contractForm.supplier_id}
                    onChange={(e) => setContractForm({ ...contractForm, supplier_id: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono"
                    placeholder="S021"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={contractForm.start_date}
                    onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={contractForm.end_date}
                    onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Value Ceiling (INR)</label>
                  <input
                    type="number"
                    value={contractForm.value_cap}
                    onChange={(e) => setContractForm({ ...contractForm, value_cap: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono"
                    placeholder="1000000"
                  />
                </div>
              </div>

              {/* Line items preview */}
              {contractForm.lines && contractForm.lines.length > 0 && (
                <div className="mt-3">
                  <span className="block text-slate-400 mb-1 font-semibold">
                    Extracted Contract Lines ({contractForm.lines.length})
                  </span>
                  <div className="max-h-36 overflow-y-auto bg-slate-900/60 rounded-xl p-2 border border-slate-750">
                    {contractForm.lines.map((l, i) => (
                      <div key={i} className="flex justify-between py-1 border-b border-slate-800 last:border-0 font-mono">
                        <span className="text-slate-200">{l.item_code}</span>
                        <span className="text-emerald-400 font-semibold">₹{Number(l.rate).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-650 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContract}
                disabled={!contractForm.contract_id || !contractForm.lines.length}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow"
              >
                Save Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
