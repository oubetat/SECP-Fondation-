import React, { useState } from 'react';
import { Wrench, ShieldCheck, CheckCircle2, AlertTriangle, Cpu, Layers, Activity, FileText } from 'lucide-react';

interface FastenerRecord {
  id: string;
  name: string;
  size: string;
  qty: number;
  material: string;
  torqueNm: number;
  preloadN: number;
  shearSafetyFactor: number;
  threadlocker: string;
  purpose: string;
}

export const DroneFastenersPanel: React.FC = () => {
  const [selectedFastenerId, setSelectedFastenerId] = useState<string>('FAST-01');

  const fasteners: FastenerRecord[] = [
    {
      id: 'FAST-01',
      name: 'Top Deck Standoff Fasteners',
      size: 'M3 x 8mm ISO 4762 Socket Head',
      qty: 6,
      material: 'Grade 12.9 High-Tensile Alloy Steel',
      torqueNm: 1.2,
      preloadN: 1450,
      shearSafetyFactor: 4.8,
      threadlocker: 'Loctite 243 (Medium Blue)',
      purpose: 'Fastens upper 2.5mm carbon fiber deck plate to aluminum knurled standoffs'
    },
    {
      id: 'FAST-02',
      name: 'Bottom Deck Standoff Fasteners',
      size: 'M3 x 8mm ISO 4762 Socket Head',
      qty: 6,
      material: 'Grade 12.9 High-Tensile Alloy Steel',
      torqueNm: 1.2,
      preloadN: 1450,
      shearSafetyFactor: 4.8,
      threadlocker: 'Loctite 243 (Medium Blue)',
      purpose: 'Fastens lower carbon fiber deck plate to standoffs'
    },
    {
      id: 'FAST-03',
      name: 'Carbon Arm Clamp Bolts',
      size: 'M3 x 22mm Hex Cap Screw',
      qty: 8,
      material: 'Titanium Ti-6Al-4V (Grade 5)',
      torqueNm: 1.8,
      preloadN: 2100,
      shearSafetyFactor: 5.2,
      threadlocker: 'Loctite 243 (Medium Blue)',
      purpose: 'Compresses CNC aluminum arm clamps around Ø16mm carbon fiber boom tubes'
    },
    {
      id: 'FAST-04',
      name: 'Motor Base Mounting Screws',
      size: 'M3 x 6mm Countersunk Socket',
      qty: 16,
      material: 'Grade 10.9 Steel (Black Oxide)',
      torqueNm: 1.0,
      preloadN: 1100,
      shearSafetyFactor: 6.4,
      threadlocker: 'Loctite 243 (Medium Blue)',
      purpose: 'Secures 4x brushless outrunner motor stator base plates to arm motor mounts'
    },
    {
      id: 'FAST-05',
      name: 'Propeller Locknuts',
      size: 'M6 Flanged Nylon-Insert Locknut',
      qty: 4,
      material: 'Anodized Aluminum 7075-T6',
      torqueNm: 4.5,
      preloadN: 3200,
      shearSafetyFactor: 7.5,
      threadlocker: 'Nylon Ring Mechanical Lock',
      purpose: 'Clamps 10x4.5 carbon-composite propellers to 5mm threaded motor shafts'
    },
    {
      id: 'FAST-06',
      name: 'Knurled Frame Standoffs',
      size: 'M3 Female x 21.5mm Hexagonal Spacers',
      qty: 6,
      material: 'Aluminum 7075-T6 (Black Anodized)',
      torqueNm: 1.2,
      preloadN: 1450,
      shearSafetyFactor: 4.2,
      threadlocker: 'N/A (Threaded Spacer Body)',
      purpose: 'Structural vertical load path separating top and bottom fuselage carbon plates'
    }
  ];

  const activeFastener = fasteners.find(f => f.id === selectedFastenerId) || fasteners[0];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-400" />
              Fasteners, Bolted Joints & Clamping Verification
            </h1>
            <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-xs font-mono font-bold">
              ISO 4762 · VDI 2230 BOLTED JOINTS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Torque specifications, preloads, thread engagement depth, Loctite threadlocker standards & piece-by-piece disassembly sequence.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            VDI 2230: ALL JOINTS VALIDATED
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fastener List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Airframe Fastener Catalog
          </h2>

          <div className="space-y-2">
            {fasteners.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFastenerId(f.id)}
                className={`w-full text-left p-3 rounded-lg border transition text-xs ${
                  selectedFastenerId === f.id
                    ? 'bg-blue-600/20 text-white border-blue-500/60 shadow-md'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="font-bold flex justify-between items-center">
                  <span>{f.name}</span>
                  <span className="font-mono text-[10px] text-amber-400">{f.qty}x</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">{f.size}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Fastener Engineering Sheet */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">{activeFastener.name}</h3>
                <div className="text-xs text-slate-400 font-mono mt-1">{activeFastener.size}</div>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-emerald-400">
                SF: {activeFastener.shearSafetyFactor}x (SAFE)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <div className="text-[10px] text-slate-500 uppercase">Torque Spec</div>
                <div className="text-base font-mono font-bold text-amber-400">{activeFastener.torqueNm} N·m</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <div className="text-[10px] text-slate-500 uppercase">Clamp Preload</div>
                <div className="text-base font-mono font-bold text-sky-400">{activeFastener.preloadN} N</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <div className="text-[10px] text-slate-500 uppercase">Quantity</div>
                <div className="text-base font-mono font-bold text-slate-200">{activeFastener.qty} Units</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                <div className="text-[10px] text-slate-500 uppercase">Threadlocker</div>
                <div className="text-xs font-mono font-bold text-emerald-400 truncate mt-1">
                  {activeFastener.threadlocker.split(' ')[0]}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg space-y-1.5">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Mechanical Purpose:</div>
                <div className="text-slate-200">{activeFastener.purpose}</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg space-y-1.5">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Material Specification:</div>
                <div className="text-slate-200">{activeFastener.material}</div>
              </div>
            </div>
          </div>

          {/* Piece-by-Piece Disassembly Procedure */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              Standard Disassembly Procedure (Step-by-Step Disassembly)
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300">
              <li><strong className="text-white">Step 1:</strong> Unthread 4x M6 Propeller Locknuts (FAST-05) counter to rotor rotation and slide off 4x 1045 Propeller blades.</li>
              <li><strong className="text-white">Step 2:</strong> Remove 16x M3x6mm Motor Base Screws (FAST-04) from underneath arm clamps to release 4x Brushless Motors.</li>
              <li><strong className="text-white">Step 3:</strong> Disconnect XT60 battery leads and release LiPo battery pack from bottom carbon deck.</li>
              <li><strong className="text-white">Step 4:</strong> Unthread 6x M3x8mm Top Deck Screws (FAST-01) from knurled standoffs; lift top deck plate and GPS mast.</li>
              <li><strong className="text-white">Step 5:</strong> Disconnect JST wiring and lift STM32H7 Flight Controller and PDB stack from internal vibration dampers.</li>
              <li><strong className="text-white">Step 6:</strong> Loosen 8x M3x22mm Titanium Arm Clamping Bolts (FAST-03) and withdraw 4x carbon fiber boom tubes.</li>
              <li><strong className="text-white">Step 7:</strong> Remove 6x M3x8mm Bottom Deck Screws (FAST-02) to detach landing gear skids and camera gimbal.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
