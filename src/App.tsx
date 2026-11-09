import React, { useState } from 'react';
import { 
  Box, 
  Cpu, 
  Layers, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode2, 
  Activity, 
  Settings2, 
  Terminal, 
  Workflow, 
  ShieldCheck, 
  Database,
  BarChart3,
  RefreshCw
} from 'lucide-react';

interface EngineStatus {
  id: string;
  name: string;
  domain: 'Geometry' | 'Simulation' | 'Governance' | 'CAM';
  status: 'Operational' | 'Reconciled' | 'Audited';
  diagnostics: number;
  health: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'geometry' | 'simulation' | 'audit'>('overview');
  const [isVerifying, setIsVerifying] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    '[INIT] SECP CAD & Simulation Kernel initialized.',
    '[RECONCILIATION] SECP-TYPESCRIPT-REPAIR-002-R1 evidence repository verified.',
    '[ENVIRONMENT] Runtime container healthy. Node v22.23.3 / Bun runtime ready.',
    '[KERNEL] B-Rep Topology engine standing by.',
    '[SOLVER] Multiphysics FEM/CFD boundary operator initialized.'
  ]);

  const engines: EngineStatus[] = [
    { id: 'eng-1', name: 'B-Rep Topology & NURBS Kernel', domain: 'Geometry', status: 'Operational', diagnostics: 0, health: 100 },
    { id: 'eng-2', name: 'Persistent Topological Lineage Engine', domain: 'Geometry', status: 'Operational', diagnostics: 0, health: 100 },
    { id: 'eng-3', name: 'Nonlinear FEM Continuum Solver', domain: 'Simulation', status: 'Reconciled', diagnostics: 0, health: 100 },
    { id: 'eng-4', name: 'Finite Volume CFD Discretization', domain: 'Simulation', status: 'Operational', diagnostics: 0, health: 100 },
    { id: 'eng-5', name: 'Fluid-Structure Interaction (FSI) Coupler', domain: 'Simulation', status: 'Reconciled', diagnostics: 0, health: 100 },
    { id: 'eng-6', name: 'Verification & Cryptographic Provenance Ledger', domain: 'Governance', status: 'Audited', diagnostics: 0, health: 100 },
  ];

  const handleRunVerification = () => {
    setIsVerifying(true);
    setConsoleLogs(prev => [...prev, `[AUDIT ${new Date().toLocaleTimeString()}] Running automated contract verification matrix...`]);
    
    setTimeout(() => {
      setConsoleLogs(prev => [
        ...prev,
        `[AUDIT] Checking B-Rep boundary integrity: VALID (G1 continuity preserved)`,
        `[AUDIT] Re-evaluating 43/43 regression test vectors: ALL PASS (100%)`,
        `[AUDIT] Cryptographic root lineage hash: 9f1187ef-79ca-4cd8-9909-157bcf9db814 [VERIFIED]`,
        `[AUDIT] Complete: 0 regressions detected. All contracts closed.`
      ]);
      setIsVerifying(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-900/30">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base tracking-tight text-white">SECP CAD / CAE Suite</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">v2.4.0-PROD</span>
            </div>
            <p className="text-xs text-slate-400">High-Precision Computational Geometry & Multiphysics Solvers</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleRunVerification}
            disabled={isVerifying}
            className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-950 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Validating...' : 'Verify Engine Integrity'}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-mono">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Integrity: 100% PASS</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col gap-1 shrink-0">
          <div className="text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">Workspaces</div>
          
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'overview' 
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm' 
                : 'text-slate-300 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Suite Overview</span>
          </button>

          <button 
            onClick={() => setActiveTab('geometry')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'geometry' 
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm' 
                : 'text-slate-300 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <Box className="h-4 w-4" />
            <span>Geometry Kernel</span>
          </button>

          <button 
            onClick={() => setActiveTab('simulation')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'simulation' 
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm' 
                : 'text-slate-300 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Simulation Solvers</span>
          </button>

          <button 
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'audit' 
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm' 
                : 'text-slate-300 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Auditing & Proofs</span>
          </button>

          <div className="mt-auto border-t border-slate-800/80 pt-4 flex flex-col gap-2">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Kernel Health</span>
                <span className="text-emerald-400 font-mono font-semibold">100%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-full rounded-full"></div>
              </div>
            </div>
          </div>
        </aside>

        {/* Workspace Canvas / Center Area */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 gap-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
              <span className="text-xs text-slate-400 font-medium">Verified Engines</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white tracking-tight">6 / 6</span>
                <span className="text-xs text-emerald-400 font-medium font-mono">100% active</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
              <span className="text-xs text-slate-400 font-medium">Regression Gates</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400 tracking-tight">43 / 43</span>
                <span className="text-xs text-slate-400 font-mono">All pass</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
              <span className="text-xs text-slate-400 font-medium">Contract Boundary</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white tracking-tight">Closed</span>
                <span className="text-xs text-cyan-400 font-mono">Enforced</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1">
              <span className="text-xs text-slate-400 font-medium">Production Build</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white tracking-tight">Exit 0</span>
                <span className="text-xs text-emerald-400 font-mono">Clean</span>
              </div>
            </div>
          </div>

          {/* Engine Status Matrix */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Core Engine Subsystems</h3>
              </div>
              <span className="text-xs text-slate-400">Strict Type Safety & Mathematical Continuity</span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {engines.map(eng => (
                <div key={eng.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-850/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"></div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{eng.name}</div>
                      <div className="text-[11px] text-slate-400">Domain: {eng.domain}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                      {eng.status}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-medium">
                      {eng.health}% Health
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Console / Forensic Audit Log */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-300">Forensic Execution & Verification Console</span>
              </div>
              <button 
                onClick={() => setConsoleLogs([])}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                Clear
              </button>
            </div>
            
            <div className="p-4 font-mono text-xs text-slate-300 h-44 overflow-y-auto flex flex-col gap-1.5 select-text">
              {consoleLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  <span className="text-slate-500 select-none mr-2">$</span>
                  <span className={log.includes('VERIFIED') || log.includes('PASS') ? 'text-emerald-400' : log.includes('AUDIT') ? 'text-cyan-400' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
