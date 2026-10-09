import React from 'react';
import { Box } from 'lucide-react';

export function NextGen3dEnginePanel() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
        <Box className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-bold">NextGen 3D Graphics Engine</h3>
      </div>
      <p className="text-xs text-slate-400">High-performance graphics rendering and compute acceleration via WebGPU.</p>
    </div>
  );
}
