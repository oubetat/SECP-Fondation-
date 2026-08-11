import React from 'react';
import { Cpu, CheckCircle2, ShieldCheck, Terminal, Layers, Database, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  passedCount: number;
  totalCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, passedCount, totalCount }) => {
  const tabs = [
    { id: 'overview', label: 'Acceptance Matrix', icon: ShieldCheck },
    { id: 'monorepo', label: 'Monorepo Hierarchy', icon: Layers },
    { id: 'cad-kernel', label: 'C++ CAD Engine', icon: Cpu },
    { id: 'database', label: 'PostgreSQL DB', icon: Database },
    { id: 'ci-tests', label: 'CI Test Pipeline', icon: Terminal },
    { id: 'provenance', label: 'Provenance Ledger', icon: Activity },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* SECP Brand Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white">SECP Platform</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                  PATCH-SECP-000
                </span>
              </div>
              <p className="text-xs text-slate-400">Phase 0 — Project Foundation & Architecture</p>
            </div>
          </div>

          {/* Acceptance Matrix Badge */}
          <div className="hidden md:flex items-center space-x-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Criteria Met:</span>
              <span className="font-bold text-white px-1.5 py-0.5 bg-emerald-950 rounded border border-emerald-800">
                {passedCount} / {totalCount} PASS
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="text-xs font-mono text-slate-400">
              Target: <span className="text-cyan-400 font-semibold">C++20 / React / Postgres</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto no-scrollbar border-t border-slate-800/80 pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-md text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
