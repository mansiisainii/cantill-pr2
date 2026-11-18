import React, { useState, useEffect } from 'react';
import { Award, Download, Calendar, Search, Star, TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function PreferredSuppliers() {
  const [items, setItems] = useState([]);
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [asOfDate, setAsOfDate] = useState('2026-11-01');
  const [itemDetail, setItemDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    loadItems();
  }, [asOfDate]);

  useEffect(() => {
    if (selectedItemCode) {
      loadItemRankings(selectedItemCode, asOfDate);
    }
  }, [selectedItemCode, asOfDate]);

  const loadItems = async () => {
    try {
      const res = await fetch(`/api/preferred?asOf=${asOfDate}`);
      const data = await res.json();
      setItems(data.items || []);
      if (data.items?.length > 0 && !selectedItemCode) {
        setSelectedItemCode(data.items[0].item_code);
      }
    } catch (err) {
      console.error('Failed to load preferred items list:', err);
    }
  };

  const loadItemRankings = async (code, date) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/preferred?item=${code}&asOf=${date}`);
      const data = await res.json();
      setItemDetail(data);
    } catch (err) {
      console.error('Failed to load item detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    window.location.href = `/api/preferred/export.csv?asOf=${asOfDate}`;
  };

  const filteredItems = items.filter(
    (i) =>
      i.item_code.toLowerCase().includes(itemSearch.toLowerCase()) ||
      i.description.toLowerCase().includes(itemSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Preferred Supplier Rankings (Section 6)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic ranking calculated dynamically from 548-day purchase history, contracts, on-time delivery %, and quality ratings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> As-of Date:
            </span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow transition"
          >
            <Download className="w-4 h-4" />
            Export Top 3 CSV
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Item Selector List */}
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 shadow-xl overflow-hidden flex flex-col max-h-[680px]">
          <div className="p-4 border-b border-slate-700 bg-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-750">
            {filteredItems.map((item) => {
              const isSelected = item.item_code === selectedItemCode;
              return (
                <div
                  key={item.item_code}
                  onClick={() => setSelectedItemCode(item.item_code)}
                  className={`p-3.5 cursor-pointer transition ${
                    isSelected ? 'bg-emerald-500/10 border-l-4 border-emerald-500' : 'hover:bg-slate-750/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono font-bold text-xs text-slate-100">{item.item_code}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate">{item.description}</p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <span>Top:</span>
                    {(item.top || []).map((sup) => (
                      <span key={sup} className="font-mono text-amber-300 font-semibold px-1 rounded bg-slate-900/60">
                        {sup}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Item Ranking Details */}
        <div className="lg:col-span-2 space-y-4">
          {itemDetail ? (
            <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl space-y-6">
              {/* Item Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-700 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg text-emerald-400">{itemDetail.item.item_code}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      {itemDetail.item.category}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">UOM: {itemDetail.item.uom}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 mt-1">{itemDetail.item.description}</h3>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <span>Standard Price: </span>
                  <span className="font-mono font-semibold text-slate-200">
                    ₹{Number(itemDetail.item.standard_price).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Formula Explanation Callout */}
              <div className="p-3.5 bg-slate-900/70 rounded-xl border border-slate-750 text-xs text-slate-300 flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-slate-200">Scoring Formula: </span>
                  <span className="font-mono text-slate-400">
                    Score = 0.25·Freq + 0.20·Recency + 0.20·Contract + 0.15·OTD% + 0.20·Quality
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    1st preferred supplier receives direct Spot/Emergency POs at reference price.
                  </p>
                </div>
              </div>

              {/* Ranked Supplier Cards */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  Ranked Suppliers ({itemDetail.list?.length || 0})
                </h4>

                {itemDetail.list?.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl">
                    No active suppliers eligible under 548-day history or contracts.
                  </div>
                ) : (
                  itemDetail.list?.map((s) => (
                    <div
                      key={s.supplier_id}
                      className={`p-4 rounded-xl border transition ${
                        s.rank === 1
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-slate-900/50 border-slate-700/80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                              s.rank === 1
                                ? 'bg-amber-400 text-slate-950 font-mono shadow'
                                : s.rank === 2
                                ? 'bg-slate-300 text-slate-950 font-mono'
                                : 'bg-slate-700 text-slate-300 font-mono'
                            }`}
                          >
                            #{s.rank}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-100">{s.supplier_id}</span>
                              <span className="text-xs font-medium text-slate-300">{s.name}</span>
                              {s.has_contract && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  Contract Held
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Ref Price: <span className="font-mono text-emerald-400 font-semibold">₹{Number(s.reference_price).toFixed(2)}</span> ({s.reference_source})
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block">Composite Score</span>
                          <span className="text-base font-mono font-bold text-slate-100">{s.score}</span>
                        </div>
                      </div>

                      {/* Criteria breakdown bars */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3 border-t border-slate-800 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Orders ({s.po_count})</span>
                          <span className="font-mono text-slate-200">{(s.components.freq * 100).toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Recency</span>
                          <span className="font-mono text-slate-200">
                            {s.components.recency === 1 ? 'Within 90d' : s.components.recency === 0.5 ? '90-180d' : '>180d'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Contract</span>
                          <span className="font-mono text-slate-200">{s.components.contract ? 'Active' : 'None'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">On-Time</span>
                          <span className="font-mono text-slate-200">{s.on_time_pct}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Quality</span>
                          <span className="font-mono text-slate-200">{s.quality_rating} / 5.0</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-800/50 rounded-2xl border border-slate-700">
              Select an item to view rankings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
