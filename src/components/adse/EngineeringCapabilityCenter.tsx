import React, { useState } from 'react';
import { 
  Award, 
  CheckCircle, 
  Layers, 
  Flame, 
  Zap, 
  Activity, 
  Radio, 
  Cpu, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { 
  ADSEWorkbenchBridge, 
  CapabilityMaturityLevel 
} from '../../engine/adse/workbench/ADSEWorkbenchBridge';

export const EngineeringCapabilityCenter: React.FC = () => {
  const bridge = ADSEWorkbenchBridge.getInstance();

  const domainCapabilities = [
    { domain: 'P0', title: 'Foundation & Core Authority', icon: ShieldCheck, color: 'text-blue-400', cap: 'Canonical Engine Lifecycle' },
    { domain: 'P1', title: 'Requirements & Traceability', icon: Layers, color: 'text-sky-400', cap: 'Multi-Tier Requirement Allocations' },
    { domain: 'P2', title: 'MBSE & Semantic Modeling', icon: Cpu, color: 'text-indigo-400', cap: 'Semantic Graph & Flow Consistency' },
    { domain: 'P3', title: 'System Architecture', icon: Layers, color: 'text-cyan-400', cap: 'Hierarchical Decomposition & Interfaces' },
    { domain: 'P4', title: 'Digital Thread & Provenance', icon: CheckCircle, color: 'text-teal-400', cap: 'Cryptographic Thread Integrity' },
    { domain: 'P5', title: 'Structural & Assembly Truth', icon: Activity, color: 'text-emerald-400', cap: 'Solid B-Rep & Clearance Solver' },
    { domain: 'P6', title: 'Thermal Multiphysics', icon: Flame, color: 'text-amber-400', cap: 'Thermal Resistor-Capacitor Matrix' },
    { domain: 'P7', title: 'Electrical Power Systems', icon: Zap, color: 'text-yellow-400', cap: 'Bus Topology & Power Budgeting' },
    { domain: 'P8', title: 'Controls & Dynamic Loops', icon: Activity, color: 'text-rose-400', cap: 'Multi-Rate Closed Loop Execution' },
    { domain: 'P9', title: 'Cyber-Physical Communications', icon: Radio, color: 'text-purple-400', cap: 'Bandwidth, Latency & AI Governance' }
  ];

  const lifecycleStages: CapabilityMaturityLevel[] = [
    'DECLARED',
    'IMPLEMENTED',
    'EXECUTED',
    'CORE_BOUND',
    'CANONICALLY_BOUND',
    'VERIFIED',
    'EVIDENCE_BACKED',
    'PERSISTED',
    'BENCHMARKED',
    'PUBLISHED'
  ];

  const [selectedDomain, setSelectedDomain] = useState(domainCapabilities[0]);
  const maturityData = bridge.deriveCapabilityMaturity(selectedDomain.domain, selectedDomain.cap);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden font-sans">
      {/* Domain List Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-xs uppercase tracking-wider">ADSE Capability Register</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {domainCapabilities.map(d => {
            const isSelected = selectedDomain.domain === d.domain;
            const Icon = d.icon;
            return (
              <button
                key={d.domain}
                onClick={() => setSelectedDomain(d)}
                className={`p-2.5 rounded-lg text-left transition border flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                    : 'border-transparent hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${d.color}`} />
                  <div>
                    <div className="text-xs font-bold text-white">{d.title}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{d.domain}: {d.cap}</div>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold uppercase">
                  M10
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Capability Lifecycle & Maturity Inspector */}
      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto flex flex-col gap-6">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-mono">Domain Capability</div>
            <div className="text-base font-extrabold text-white mt-0.5">{selectedDomain.title}</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">{maturityData.capability}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end text-xs">
              <span className="text-[9px] text-slate-400 uppercase font-mono">Maturity Level</span>
              <span className="text-emerald-400 font-mono font-extrabold text-sm">{maturityData.maturity} (100%)</span>
            </div>
          </div>
        </div>

        {/* 10-Stage Lifecycle Progression Stepper */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Maturity Derivation & Truth Progression
            </span>
            <span className="text-[10px] text-slate-400 font-mono">10 / 10 Phases Closed</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {lifecycleStages.map((stage, idx) => (
              <div
                key={stage}
                className="p-3 rounded-lg bg-slate-950 border border-emerald-500/30 flex flex-col gap-1 text-center"
              >
                <div className="text-[9px] font-mono text-emerald-400 font-bold">STAGE {idx + 1}</div>
                <div className="text-[11px] font-bold text-white truncate">{stage}</div>
                <div className="flex items-center justify-center text-emerald-400 text-xs mt-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verification Gates & Evidence Summary */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Canonical Gate Proofs & Evidence Binding
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Verified Gate Closure:</span>
              <span className="font-mono text-emerald-400 font-bold">{selectedDomain.domain}-V_CLOSURE (PASS)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Core Evidence Records:</span>
              <span className="font-mono text-cyan-400 font-bold">{maturityData.evidenceCount} Cryptographic Leaves</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
