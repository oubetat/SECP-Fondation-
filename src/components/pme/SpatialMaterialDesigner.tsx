import React, { useState } from 'react';
import { Layers, Sliders, Activity, Box, Sparkles, AlertCircle } from 'lucide-react';

interface SpatialFieldDefinition {
  id: string;
  propertyName: string;
  baseValue: number;
  unit: string;
  distributionType: 'LINEAR_GRADIENT' | 'STEP_FUNCTION' | 'POINT_MAP' | 'SIMP_DENSITY';
  parameters: Record<string, any>;
  revision: string;
  status: 'VALIDATED' | 'STALE' | 'INVALIDATED';
}

const MOCK_FIELDS: SpatialFieldDefinition[] = [
  {
    id: 'FLD-E-GRAD-001',
    propertyName: "Young's Modulus (E)",
    baseValue: 110,
    unit: 'GPa',
    distributionType: 'LINEAR_GRADIENT',
    parameters: { startPos: [0, 0, 0], endPos: [0, 100, 0], startVal: 110, endVal: 125 },
    revision: 'REV-B',
    status: 'VALIDATED'
  },
  {
    id: 'FLD-RHO-STEP-002',
    propertyName: 'Density (rho)',
    baseValue: 4430,
    unit: 'kg/m^3',
    distributionType: 'STEP_FUNCTION',
    parameters: { regions: ['Internal_Lattice', 'Outer_Shell'], values: [1200, 4430] },
    revision: 'REV-A',
    status: 'STALE'
  }
];

export const SpatialMaterialDesigner: React.FC = () => {
  const [selectedField, setSelectedField] = useState<string>(MOCK_FIELDS[0].id);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg">
            <Layers className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">Spatial Material Designer</h1>
            <p className="text-slate-400 text-xs tracking-tight">Non-homogeneous property distribution management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 uppercase">
            <Sparkles className="w-4 h-4" /> New Field
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Field List */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/10 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <Activity className="w-4 h-4" /> Active Fields
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {MOCK_FIELDS.map(field => (
              <button
                key={field.id}
                onClick={() => setSelectedField(field.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedField === field.id
                    ? 'bg-blue-600/10 border-blue-500/50'
                    : 'bg-slate-900/30 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    field.status === 'VALIDATED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {field.status}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{field.revision}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{field.propertyName}</h3>
                <p className="text-xs text-slate-400 font-mono">{field.id}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Main Workspace - Field Inspector */}
        <div className="flex-1 flex flex-col overflow-auto bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
          <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
            {/* Visual Placeholder for 3D Viewport */}
            <div className="aspect-video bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden group cursor-crosshair">
               <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(68,107,255,0.05)_50%,transparent_75%)] bg-[length:20px_20px]" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Box className="w-12 h-12 text-slate-700 mx-auto group-hover:text-blue-500/50 transition-colors" />
                    <p className="text-slate-600 text-sm font-mono group-hover:text-slate-400 transition-colors">3D SPATIAL FIELD VIEWPORT: {selectedField}</p>
                  </div>
               </div>
               {/* Overlay Controls */}
               <div className="absolute bottom-4 right-4 flex gap-2">
                 <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-slate-700 text-[10px] font-bold text-blue-400">ISO VIEW</div>
                 <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-slate-700 text-[10px] font-bold text-white">CONTOUR MAPPING</div>
               </div>
            </div>

            {/* Field Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <Sliders className="w-4 h-4 text-blue-400" /> Distribution Logic
                </div>
                <div className="space-y-4">
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 uppercase">Interpolation Method</label>
                      <select className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500">
                        <option>Linear Gradient</option>
                        <option>Kriging / Gaussian</option>
                        <option>Radial Basis Function</option>
                        <option>Discrete Mesh Mapping</option>
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-500 uppercase">Start Value ({MOCK_FIELDS.find(f => f.id === selectedField)?.unit})</label>
                        <input type="number" defaultValue={110} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-slate-500 uppercase">End Value ({MOCK_FIELDS.find(f => f.id === selectedField)?.unit})</label>
                        <input type="number" defaultValue={125} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>
                   </div>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-6 flex flex-col">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <AlertCircle className="w-4 h-4 text-amber-400" /> Numerical Verification
                </div>
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-emerald-500 flex items-center justify-center">
                    <span className="text-xl font-bold text-white">98%</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-400 uppercase">Coverage Verified</p>
                    <p className="text-[10px] text-slate-500">Numerical continuity checked across 2,450 mesh integration points.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
