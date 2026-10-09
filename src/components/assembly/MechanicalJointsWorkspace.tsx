import React from 'react';
import { GitBranch } from 'lucide-react';

export function MechanicalJointsWorkspace() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
        <GitBranch className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-bold">Mechanical Joints & Kinematic Constraints</h3>
      </div>
      <p className="text-xs text-slate-400">Manage revolute, prismatic, cylindrical, spherical, and planar joint constraints.</p>
    </div>
  );
}
