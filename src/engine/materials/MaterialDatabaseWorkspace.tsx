import React from 'react';
import { Database } from 'lucide-react';

export function MaterialDatabaseWorkspace() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
        <Database className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold">Engineering Materials Database Workspace</h3>
      </div>
      <p className="text-xs text-slate-400">Manage physical properties, constitutive stress-strain curves, and thermal coefficients.</p>
    </div>
  );
}
