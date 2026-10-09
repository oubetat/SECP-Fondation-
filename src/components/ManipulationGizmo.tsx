import React from 'react';
import { Move, RotateCcw, Maximize2 } from 'lucide-react';
import { ManipulationMode } from '../engine/assembly/ManipulationController';

interface ManipulationGizmoProps {
  mode: ManipulationMode;
  onModeChange: (mode: ManipulationMode) => void;
}

export const ManipulationGizmo: React.FC<ManipulationGizmoProps> = ({ mode, onModeChange }) => {
  return (
    <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-slate-700 rounded-lg p-1 flex gap-1 shadow-xl backdrop-blur-sm">
      <button
        onClick={() => onModeChange('TRANSLATE')}
        className={`p-2 rounded ${mode === 'TRANSLATE' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        title="Translate (G)"
      >
        <Move className="w-4 h-4" />
      </button>
      <button
        onClick={() => onModeChange('ROTATE')}
        className={`p-2 rounded ${mode === 'ROTATE' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        title="Rotate (R)"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <button
        onClick={() => onModeChange('SCALE')}
        className={`p-2 rounded ${mode === 'SCALE' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        title="Scale (S)"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};
