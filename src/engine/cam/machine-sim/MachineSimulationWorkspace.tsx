import React from 'react';
import { Settings } from 'lucide-react';

export function MachineSimulationWorkspace() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
        <Settings className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-bold">True CNC Machine Kinematic Simulation Workspace</h3>
      </div>
      <p className="text-xs text-slate-400">Real-time kinematic simulation of 3-axis and 5-axis CNC machines with collision avoidance.</p>
    </div>
  );
}
