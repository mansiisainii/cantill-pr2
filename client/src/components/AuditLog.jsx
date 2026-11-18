import React, { useState, useEffect } from 'react';
import { History, User, Clock, FileText, CheckCircle2, Edit3, ShieldAlert, RefreshCw } from 'lucide-react';

const ACTION_ICONS = {
  approve: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  override: <Edit3 className="w-4 h-4 text-amber-400" />,
  policy_approved: <ShieldAlert className="w-4 h-4 text-purple-400" />,
  policy_retired: <Clock className="w-4 h-4 text-rose-400" />,
  chat_pr_created: <FileText className="w-4 h-4 text-blue-400" />,
  import: <FileText className="w-4 h-4 text-slate-400" />,
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            Compliance & Procurement Audit Trail
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Immutable log of all user interventions, override justifications, approvals, and policy updates.
          </p>
        </div>

        <button
          onClick={loadAudit}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-xl transition"
          title="Refresh logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
        <div className="divide-y divide-slate-750">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading audit trail...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">No audit events recorded yet.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-750/40 transition flex items-start gap-3 text-xs">
                <div className="mt-0.5 shrink-0">
                  {ACTION_ICONS[log.action] || <Clock className="w-4 h-4 text-slate-400" />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold uppercase text-slate-200">{log.action}</span>
                      <span className="text-slate-400">by</span>
                      <span className="font-semibold text-slate-300">{log.user || 'system'}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(log.at).toLocaleString()}
                    </span>
                  </div>

                  {log.details && (
                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-750/80 font-mono text-[11px] text-slate-300 max-h-32 overflow-y-auto">
                      {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
