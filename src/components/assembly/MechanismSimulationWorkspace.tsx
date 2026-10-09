import React from 'react';
import { Activity } from 'lucide-react';

export function MechanismSimulationWorkspace() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
        <Activity className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-bold">Mechanism Kinematics & Dynamic Simulation</h3>
      </div>
      <p className="text-xs text-slate-400">Multibody kinematics, dynamic trajectory planning, and joint force simulation.</p>
    </div>
  );
}
