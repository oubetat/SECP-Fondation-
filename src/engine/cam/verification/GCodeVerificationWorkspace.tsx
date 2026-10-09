import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function GCodeVerificationWorkspace() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold">G-Code Verification & Toolpath Parser Workspace</h3>
      </div>
      <p className="text-xs text-slate-400">High-precision G-code parser, feed rate validation, and volume gouge detection.</p>
    </div>
  );
}
