import React from 'react';
import { Database, Beaker, FileCheck2, ShieldCheck, AlertTriangle } from 'lucide-react';

interface MaterialDefinition {
  id: string;
  name: string;
  category: string;
  properties: {
    name: string;
    value: number;
    unit: string;
    status: 'SUPPORTED' | 'LIMITED' | 'EXPERIMENTAL';
  }[];
  constitutiveModel: string;
  validityRange: string;
  revision: string;
}

const MOCK_MATERIALS: MaterialDefinition[] = [
  {
    id: 'MAT-TI-6AL4V-001',
    name: 'Ti-6Al-4V (Grade 5)',
    category: 'Metal / Titanium Alloy',
    properties: [
      { name: "Young's Modulus (E)", value: 110, unit: 'GPa', status: 'SUPPORTED' },
      { name: "Poisson's Ratio (nu)", value: 0.33, unit: '', status: 'SUPPORTED' },
      { name: 'Density (rho)', value: 4430, unit: 'kg/m^3', status: 'SUPPORTED' },
      { name: 'Yield Strength', value: 880, unit: 'MPa', status: 'LIMITED' },
    ],
    constitutiveModel: 'Linear Isotropic Elasticity / J2 Plasticity',
    validityRange: 'T < 400°C, Strain < 5%',
    revision: 'REV-2026.4',
  },
  {
    id: 'MAT-ABS-AM-002',
    name: 'ABS (AM Optimized)',
    category: 'Polymer / Thermoplastic',
    properties: [
      { name: "Young's Modulus (E)", value: 2.1, unit: 'GPa', status: 'SUPPORTED' },
      { name: "Poisson's Ratio (nu)", value: 0.35, unit: '', status: 'SUPPORTED' },
      { name: 'Density (rho)', value: 1040, unit: 'kg/m^3', status: 'SUPPORTED' },
    ],
    constitutiveModel: 'Orthotropic Elasticity (Layer-wise)',
    validityRange: 'Ambient Environment, No UV exposure',
    revision: 'REV-2025.1',
  }
];

export const MaterialIntelligence: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-600/20 rounded-lg">
          <Database className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Material Intelligence</h1>
          <p className="text-slate-400 text-sm">Programmable Material Definitions & Constitutive Logic</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {MOCK_MATERIALS.map((mat) => (
          <div key={mat.id} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-blue-500/50 transition-colors">
            <div className="p-5 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-white">{mat.name}</h3>
                <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded uppercase tracking-wider">{mat.id}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-slate-500 italic">{mat.revision}</span>
                <span className="text-xs px-2 py-1 bg-slate-800 rounded-full text-slate-300 border border-slate-700">{mat.category}</span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-400 mb-3 uppercase tracking-widest">
                  <Beaker className="w-4 h-4" />
                  <span>Physical Properties</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {mat.properties.map((prop) => (
                    <div key={prop.name} className="p-3 bg-slate-950/50 border border-slate-800/50 rounded-lg flex flex-col gap-1">
                      <span className="text-xs text-slate-500">{prop.name}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-white">{prop.value}</span>
                        <span className="text-xs text-slate-400">{prop.unit}</span>
                      </div>
                      <div className="mt-1">
                        {prop.status === 'SUPPORTED' && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> VERIFIED
                          </span>
                        )}
                        {prop.status === 'LIMITED' && (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> EXPERIMENTAL
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/50 space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 uppercase tracking-tighter">Constitutive Model</span>
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    {mat.constitutiveModel}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 uppercase tracking-tighter">Validity Envelope</span>
                  <span className="text-sm text-slate-300 font-mono italic bg-slate-800/30 p-2 rounded border border-slate-700/50">
                    {mat.validityRange}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="px-5 py-3 bg-slate-800/30 border-t border-slate-800 flex justify-between items-center">
              <button className="text-xs text-blue-400 font-semibold hover:text-blue-300 transition-colors uppercase tracking-widest">
                Edit Definition
              </button>
              <button className="text-xs text-slate-400 hover:text-white transition-colors">
                View History
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-amber-950/20 border border-amber-500/30 rounded-lg flex gap-4 items-start">
        <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-200 uppercase tracking-wide">Forensic Constraint Warning</h4>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            Only properties marked as <span className="text-emerald-400 font-bold">VERIFIED</span> are available for spatial field distribution in the solver. 
            Experimental properties will block industrial qualification (Gate 12) if used in critical structural load paths.
          </p>
        </div>
      </div>
    </div>
  );
};
