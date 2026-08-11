import React, { useState } from 'react';
import { AcceptanceCriterion } from '../types/secp';
import { CheckCircle2, Play, RefreshCw, FolderTree, Cpu, Database, Terminal, ShieldCheck, ArrowRight } from 'lucide-react';

interface AcceptanceMatrixProps {
  criteria: AcceptanceCriterion[];
  onRunAllChecks: () => void;
  isRunning: boolean;
  onNavigateTab: (tab: string) => void;
}

export const AcceptanceMatrix: React.FC<AcceptanceMatrixProps> = ({
  criteria,
  onRunAllChecks,
  isRunning,
  onNavigateTab,
}) => {
  const getIconForCategory = (id: string) => {
    switch (id) {
      case 'repository':
        return FolderTree;
      case 'build':
        return RefreshCw;
      case 'frontend starts':
        return ShieldCheck;
      case 'C++ core builds':
        return Cpu;
      case 'database connection':
        return Database;
      case 'CI test':
        return Terminal;
      default:
        return CheckCircle2;
    }
  };

  const getTargetTabForId = (id: string) => {
    switch (id) {
      case 'repository':
        return 'monorepo';
      case 'build':
        return 'monorepo';
      case 'frontend starts':
        return 'overview';
      case 'C++ core builds':
        return 'cad-kernel';
      case 'database connection':
        return 'database';
      case 'CI test':
        return 'ci-tests';
      default:
        return 'overview';
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-cyan-950/30 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Phase 0 — Project Foundation Verification</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              PATCH-SECP-000 Verification Matrix
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Strict compliance validator for monorepo directory layout, TypeScript/React frontend, C++ CMake kernels, PostgreSQL pool connection, and automated CI test suite.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onRunAllChecks}
              disabled={isRunning}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs rounded-lg shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isRunning ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              <span>{isRunning ? 'Validating Pipeline...' : 'Run Full Verification Suite'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Acceptance Criteria */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {criteria.map((item) => {
          const Icon = getIconForCategory(item.id);
          const targetTab = getTargetTabForId(item.id);

          return (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-slate-800 text-cyan-400 group-hover:bg-cyan-950 group-hover:text-cyan-300 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">{item.category}</div>
                      <h3 className="font-bold text-slate-100 text-sm font-mono">✓ {item.id}</h3>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center space-x-1 text-xs font-mono px-2.5 py-1 rounded-md font-semibold border ${
                      item.status === 'PASS'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : item.status === 'RUNNING'
                        ? 'bg-amber-950 text-amber-400 border-amber-800 animate-pulse'
                        : 'bg-rose-950 text-rose-400 border-rose-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{item.status}</span>
                  </span>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed mt-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono">
                  {item.details}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono text-[11px]">Checked: {item.timestamp}</span>
                <button
                  onClick={() => onNavigateTab(targetTab)}
                  className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer transition-colors"
                >
                  <span>Inspect View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monorepo Quick Architecture Blueprint */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono mb-3 flex items-center space-x-2">
          <FolderTree className="w-4 h-4 text-cyan-400" />
          <span>SECP Directory Architecture Overview</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-cyan-400 font-bold block mb-1">/apps</span>
            <span className="text-slate-500 block">desktop (Tauri)</span>
            <span className="text-slate-500 block">web (Vite/React)</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-cyan-400 font-bold block mb-1">/packages</span>
            <span className="text-slate-500 block">engineering-types</span>
            <span className="text-slate-500 block">geometry-api</span>
            <span className="text-slate-500 block">ui / shared</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-cyan-400 font-bold block mb-1">/engines</span>
            <span className="text-slate-500 block">cad-core (C++)</span>
            <span className="text-slate-500 block">simulation-core</span>
            <span className="text-slate-500 block">manufacturing</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-cyan-400 font-bold block mb-1">/services</span>
            <span className="text-slate-500 block">project-service</span>
            <span className="text-slate-500 block">asset-service</span>
            <span className="text-slate-500 block">provenance-service</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-cyan-400 font-bold block mb-1">/database</span>
            <span className="text-slate-500 block">schema.sql</span>
            <span className="text-slate-500 block">connection.ts</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-cyan-400 font-bold block mb-1">/tests & /docs</span>
            <span className="text-slate-500 block">ci_runner.test.ts</span>
            <span className="text-slate-500 block">PATCH-SECP-000.md</span>
          </div>
        </div>
      </div>
    </div>
  );
};
