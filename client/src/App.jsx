import React, { useState, useEffect } from 'react';
import { MessageSquare, FileText, Briefcase, FileCheck, Award, ShieldCheck, History, Activity, Sparkles, Building2 } from 'lucide-react';
import ChatIntake from './components/ChatIntake';
import BatchProcessing from './components/BatchProcessing';
import BuyerWorkspace from './components/BuyerWorkspace';
import ContractsView from './components/ContractsView';
import PreferredSuppliers from './components/PreferredSuppliers';
import PolicyAdmin from './components/PolicyAdmin';
import AuditLog from './components/AuditLog';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch((e) => console.error('Status error:', e));
  }, []);

  const tabs = [
    { id: 'chat', label: 'Chat Intake', icon: MessageSquare },
    { id: 'batch', label: 'Batch Test & CSV', icon: FileText },
    { id: 'workspace', label: 'Buyer Workspace', icon: Briefcase },
    { id: 'contracts', label: 'Contracts Register', icon: FileCheck },
    { id: 'preferred', label: 'Preferred Suppliers', icon: Award },
    { id: 'policy', label: 'Policy Governance', icon: ShieldCheck },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-white">Cantill</h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    PR-to-PO Engine v5.0
                  </span>
                </div>
                <p className="text-xs text-slate-400">Corvo Engineering Autonomous Procurement</p>
              </div>
            </div>

            {/* System Status Pills */}
            <div className="hidden md:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Storage: <strong className="text-slate-100 uppercase">{status?.storage || 'ready'}</strong></span>
              </div>
              {status?.counts?.items && (
                <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 font-mono text-[11px]">
                  {status.counts.items} Items · {status.counts.suppliers} Suppliers · {status.counts.contracts} Contracts
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <nav className="flex space-x-1 overflow-x-auto pb-2 -mb-px">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'chat' && <ChatIntake onPrCreated={() => {}} />}
        {activeTab === 'batch' && <BatchProcessing />}
        {activeTab === 'workspace' && <BuyerWorkspace />}
        {activeTab === 'contracts' && <ContractsView />}
        {activeTab === 'preferred' && <PreferredSuppliers />}
        {activeTab === 'policy' && <PolicyAdmin />}
        {activeTab === 'audit' && <AuditLog />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Cantill PR-to-PO Automation · Corvo Engineering Policy v5.0 Deterministic Engine · Built with React, Express, & Gemini
      </footer>
    </div>
  );
}
