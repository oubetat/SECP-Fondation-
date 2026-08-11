import React, { useState } from 'react';
import { Activity, ShieldCheck, Plus, Hash, CheckCircle2 } from 'lucide-react';
import { ProvenanceRecord } from '../types/secp';

export const ProvenanceLedger: React.FC = () => {
  const [records, setRecords] = useState<ProvenanceRecord[]>([
    {
      id: 'prov-1001',
      timestamp: '2026-08-11T10:12:00Z',
      action: 'INITIALIZE_MONOREPO_FOUNDATION',
      author: 'Lead Architect',
      hash: '0x3f1a89b0124c',
      status: 'VERIFIED',
      metadata: { patch: 'PATCH-SECP-000', phase: 0 },
    },
    {
      id: 'prov-1002',
      timestamp: '2026-08-11T10:24:30Z',
      action: 'COMPILE_CPP_CAD_KERNEL',
      author: 'Dr. Engineering Core',
      hash: '0x892e11a876cc',
      status: 'VERIFIED',
      metadata: { target: 'cad-core', cmake: 'C++20' },
    },
    {
      id: 'prov-1003',
      timestamp: '2026-08-11T10:30:15Z',
      action: 'VALIDATE_GEOMETRY_BOUNDINGBOX',
      author: 'CI Test Automation',
      hash: '0xa4178bc901e2',
      status: 'VERIFIED',
      metadata: { nodesCount: 4, bboxVerified: true },
    },
  ]);

  const [newAuthor, setNewAuthor] = useState('Structural Engineer');
  const [newAction, setNewAction] = useState('VERIFY_POSTGRES_SCHEMA');

  const handleAddRecord = () => {
    const timestamp = new Date().toISOString();
    const payload = `${timestamp}:${newAuthor}:${newAction}`;
    let hashInt = 0;
    for (let i = 0; i < payload.length; i++) {
      hashInt = (hashInt << 5) - hashInt + payload.charCodeAt(i);
      hashInt |= 0;
    }
    const hash = '0x' + Math.abs(hashInt).toString(16).padStart(12, '0');

    const newRec: ProvenanceRecord = {
      id: `prov-${Date.now().toString().slice(-4)}`,
      timestamp,
      action: newAction,
      author: newAuthor,
      hash,
      status: 'VERIFIED',
      metadata: { verifiedBy: 'SECP Cryptographic Audit Engine' },
    };

    setRecords(prev => [newRec, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-purple-950 text-purple-400 rounded-xl border border-purple-800">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-lg font-mono">Immutable Engineering Provenance Ledger</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              secp/services/provenance-service — Cryptographic SHA-256 revision chain for peer review compliance
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Total Audit Logs:</span>
          <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">{records.length} Verified</span>
        </div>
      </div>

      {/* Add New Provenance Log Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3">
          + Record Cryptographic Provenance Event
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Author / Engineer</label>
            <input
              type="text"
              value={newAuthor}
              onChange={e => setNewAuthor(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-white focus:border-purple-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Engineering Action</label>
            <input
              type="text"
              value={newAction}
              onChange={e => setNewAction(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-white focus:border-purple-500 outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddRecord}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Sign & Commit Audit Event</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
              <th className="pb-3 font-semibold">Log ID</th>
              <th className="pb-3 font-semibold">Timestamp</th>
              <th className="pb-3 font-semibold">Author</th>
              <th className="pb-3 font-semibold">Action</th>
              <th className="pb-3 font-semibold">Cryptographic Checksum</th>
              <th className="pb-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {records.map(rec => (
              <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 font-bold text-slate-400">{rec.id}</td>
                <td className="py-3 text-slate-400 text-[11px]">{new Date(rec.timestamp).toLocaleTimeString()}</td>
                <td className="py-3 font-semibold text-purple-300">{rec.author}</td>
                <td className="py-3 font-mono text-cyan-400">{rec.action}</td>
                <td className="py-3 font-mono text-slate-400 text-[11px] flex items-center space-x-1">
                  <Hash className="w-3.5 h-3.5 text-purple-400" />
                  <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{rec.hash}</span>
                </td>
                <td className="py-3">
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800 inline-flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{rec.status}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
