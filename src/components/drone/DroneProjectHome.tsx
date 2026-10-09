import React from 'react';
import { Layers3, Cpu, ShieldCheck, Zap, Wind, Wrench, FileSpreadsheet, CheckCircle2, Activity } from 'lucide-react';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';

interface Props {
  canonicalDocument: EngineeringDocument | null;
  onNavigate: (tab: string) => void;
}

export const DroneProjectHome: React.FC<Props> = ({ canonicalDocument, onNavigate }) => {
  const doc = canonicalDocument;
  const assembly = doc?.assembly;
  const instances = assembly?.instances || [];
  
  const modeledCount = instances.filter(i => i.geometryStatus === 'MODELED').length;
  const plannedCount = instances.filter(i => i.geometryStatus === 'PLANNED_NOT_MODELED').length;
  const subAssemblies = instances.filter(i => i.type === 'SUB_ASSEMBLY').length;
  
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Industrial Quadcopter Drone</h1>
            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-mono font-bold">
              PRODUCTION_REFERENCE_PROJECT
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400 font-mono">
            <span>Project ID: SECP-DRONE-001</span>
            <span>Document ID: DOC_DRONE_001</span>
            <span>Revision: 1.0.0</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Engineering Status</div>
          <div className="text-sm text-sky-400 font-bold flex items-center justify-end gap-2">
            <CheckCircle2 className="w-4 h-4" />
            CANONICAL BASELINE
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assembly Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Layers3 className="w-5 h-5 text-amber-400" />
            Assembly Summary
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg">
              <div className="text-3xl font-light text-white mb-1">{instances.length}</div>
              <div className="text-xs text-slate-500 uppercase">Total Instances</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg">
              <div className="text-3xl font-light text-cyan-400 mb-1">{subAssemblies}</div>
              <div className="text-xs text-slate-500 uppercase">Sub-Assemblies</div>
            </div>
            <div className="bg-slate-950 border border-emerald-900/30 p-4 rounded-lg">
              <div className="text-3xl font-light text-emerald-400 mb-1">{modeledCount}</div>
              <div className="text-xs text-emerald-500/70 uppercase">Modeled Components</div>
            </div>
            <div className="bg-slate-950 border border-amber-900/30 p-4 rounded-lg">
              <div className="text-3xl font-light text-amber-400 mb-1">{plannedCount}</div>
              <div className="text-xs text-amber-500/70 uppercase">Planned (Not Modeled)</div>
            </div>
          </div>
        </div>

        {/* Engineering Domains (Mechanical, Electrical, Avionics, Aero) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Multi-Disciplinary Engineering Domains
          </h2>
          <div className="grid grid-cols-1 gap-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            <DomainButton 
              icon={Layers3} 
              title="Assembly & Disassembly Explorer" 
              desc="Interactive piece-by-piece disassembly, part isolation and properties."
              color="text-amber-400" 
              onClick={() => onNavigate('DRONE-ASSEMBLY')} 
              available={true}
            />
            <DomainButton 
              icon={Zap} 
              title="Electrical Power & Propulsion" 
              desc="6S 22.2V bus, 100A circuit fuse, 4x BLHeli_32 ESCs & throttle."
              color="text-yellow-400" 
              onClick={() => onNavigate('DRONE-ELECTRICAL')} 
              available={true}
            />
            <DomainButton 
              icon={Cpu} 
              title="Avionics PCB & Flight Controller" 
              desc="STM32H753 4-layer layout, dual ICM-42688P IMUs, 30.5mm mounting."
              color="text-emerald-400" 
              onClick={() => onNavigate('DRONE-PCB')} 
              available={true}
            />
            <DomainButton 
              icon={Wind} 
              title="Aerodynamics & Rotor CFD" 
              desc="Blade Element Momentum (BEM) solver, downwash field & ground effect."
              color="text-cyan-400" 
              onClick={() => onNavigate('DRONE-AERO')} 
              available={true}
            />
            <DomainButton 
              icon={Wrench} 
              title="Fasteners & Bolted Joints" 
              desc="ISO 4762 M3 screws, tightening torques, preloads & VDI 2230 checks."
              color="text-indigo-400" 
              onClick={() => onNavigate('DRONE-FASTENERS')} 
              available={true}
            />
            <DomainButton 
              icon={FileSpreadsheet} 
              title="Mass Budget & Bill of Materials" 
              desc="Complete 18-line BOM, unit weights, CG calculation & dry mass."
              color="text-purple-400" 
              onClick={() => onNavigate('DRONE-BOM')} 
              available={true}
            />
            <DomainButton 
              icon={Cpu} 
              title="Manufacturing (CAM)" 
              desc="CNC 2.5D pocketing, contouring and G-code generation for carbon deck."
              color="text-rose-400" 
              onClick={() => onNavigate('DRONE-CAM')} 
              available={true}
            />
            <DomainButton 
              icon={ShieldCheck} 
              title="Engineering Evidence & Hashes" 
              desc="Cryptographic provenance and geometry validation records."
              color="text-emerald-400" 
              onClick={() => onNavigate('DRONE-EVIDENCE')} 
              available={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const DomainButton = ({ icon: Icon, title, desc, color, onClick, available }: any) => (
  <button 
    onClick={available ? onClick : undefined}
    disabled={!available}
    className={`flex items-center text-left gap-3.5 p-3 rounded-lg border transition-all ${
      available 
        ? 'bg-slate-950 border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 cursor-pointer' 
        : 'bg-slate-950/50 border-slate-900 opacity-60 cursor-not-allowed'
    }`}
  >
    <div className={`p-2 rounded-md bg-slate-900 border border-slate-800 ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1">
      <div className="font-bold text-xs text-slate-200 flex items-center justify-between">
        {title}
        {!available && <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold">Not Available</span>}
      </div>
      <div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>
    </div>
  </button>
);
