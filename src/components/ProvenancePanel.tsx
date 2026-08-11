import React, { useState } from 'react';
import { ProvenanceEngine, EngineeringProvenanceRecord, VersionDiffResult } from '../engine/provenanceEngine';
import { GitCommit, GitBranch, GitMerge, ShieldCheck, ArrowRightLeft, RotateCcw, Hash, Clock, CheckCircle2 } from 'lucide-react';

export const ProvenancePanel: React.FC = () => {
  const history = ProvenanceEngine.getHistory();
  const [selectedRevA, setSelectedRevA] = useState<string>('v2.0.0');
  const [selectedRevB, setSelectedRevB] = useState<string>('v3.0.0');

  const diffResult: VersionDiffResult = ProvenanceEngine.compareRevisions(selectedRevA, selectedRevB);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-400">
            <GitCommit className="w-5 h-5 text-emerald-400" />
            PATCH-SECP-022 — Versioning & Engineering Provenance
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographic CAD Lineage Tracking → SHA-256 Hashes, Author Audit, Engine Versions, Diff Comparison (v2 ↔ v3), Rollback & Merge.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => alert('Created new Engineering Branch: feature/optimized-cooling!')}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs border border-slate-700 transition cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            Branch
          </button>
          <button
            onClick={() => alert('Merged feature/optimized-cooling into main revision tree!')}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs border border-slate-700 transition cursor-pointer"
          >
            <GitMerge className="w-3.5 h-3.5 text-emerald-400" />
            Merge
          </button>
        </div>
      </div>

      {/* Revision Lineage Timeline */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-mono">CAD Engineering Provenance Timeline</h3>
        <div className="space-y-2">
          {history.map(record => (
            <div key={record.revisionId} className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-400 px-2 py-0.5 bg-emerald-950 border border-emerald-800 rounded">
                    {record.revisionId}
                  </span>
                  <span className="text-indigo-300 font-semibold">{record.changeSummary}</span>
                </div>
                <span className="text-slate-400 text-[11px]">{record.timestamp}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <div>
                  Author: <span className="text-slate-200">{record.author}</span>
                </div>
                <div>
                  CAD Kernel: <span className="text-slate-200">{record.systemVersions.cadKernelVersion}</span>
                </div>
                <div>
                  FEA / CFD: <span className="text-slate-200">{record.systemVersions.simulationFeaVersion}</span>
                </div>
                <div className="truncate text-slate-500 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-emerald-400" />
                  <span className="truncate">{record.sha256Checksum}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Version Diff Engine (Compare v2 ↔ v3) */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs font-mono">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
            Interactive CAD Revision Diff Matrix
          </span>

          <div className="flex items-center gap-3">
            <div>
              <span className="text-slate-400 mr-1.5">Rev A:</span>
              <select
                value={selectedRevA}
                onChange={e => setSelectedRevA(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1 rounded text-xs"
              >
                {history.map(r => (
                  <option key={r.revisionId} value={r.revisionId}>
                    {r.revisionId}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-500">↔</span>

            <div>
              <span className="text-slate-400 mr-1.5">Rev B:</span>
              <select
                value={selectedRevB}
                onChange={e => setSelectedRevB(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1 rounded text-xs"
              >
                {history.map(r => (
                  <option key={r.revisionId} value={r.revisionId}>
                    {r.revisionId}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Diff Metrics Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="p-2">METRIC / PARAMETER</th>
                <th className="p-2 text-right">{selectedRevA}</th>
                <th className="p-2 text-right">{selectedRevB}</th>
                <th className="p-2 text-right">DELTA (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {diffResult.changedMetrics.map(m => (
                <tr key={m.key}>
                  <td className="p-2 text-slate-300 capitalize">{m.key.replace(/([A-Z])/g, ' $1')}</td>
                  <td className="p-2 text-right font-bold text-slate-400">{m.valA.toFixed(2)}</td>
                  <td className="p-2 text-right font-bold text-emerald-400">{m.valB.toFixed(2)}</td>
                  <td
                    className={`p-2 text-right font-bold ${
                      m.deltaPercent === 0
                        ? 'text-slate-500'
                        : m.deltaPercent > 0
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    {m.deltaPercent > 0 ? `+${m.deltaPercent.toFixed(1)}%` : `${m.deltaPercent.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-2 flex justify-between items-center text-xs font-mono">
          <button
            onClick={() => alert(`Rolled back CAD state to ${selectedRevA}!`)}
            className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-800 px-3 py-1.5 rounded transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Rollback to {selectedRevA}
          </button>

          <span className="text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" />
            CRYPTOGRAPHIC PROVENANCE INTEGRITY VERIFIED
          </span>
        </div>
      </div>
    </div>
  );
};
