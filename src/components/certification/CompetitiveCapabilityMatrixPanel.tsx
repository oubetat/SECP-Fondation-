/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-188 — Competitive Capability Matrix Dashboard
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, AlertTriangle, Search, Plus, Trash2, Copy, Check, RotateCcw, FileSignature, Cpu, Layers, Lock, ShieldAlert, Scale, HelpCircle, CheckCircle2, Filter, ArrowRight, Database, ExternalLink, Code } from 'lucide-react';
import {
  CompetitiveCapabilityMatrixEngine,
  CompetitiveCapabilityMatrixGate,
  MatrixSnapshot,
  MatrixGateResult,
  CapabilityStatus,
  CompetitiveCapabilityEvidence
} from '../../engine/certification/truth/CompetitiveCapabilityMatrix';

export function CompetitiveCapabilityMatrixPanel() {
  const [snapshot, setSnapshot] = useState<MatrixSnapshot>(() =>
    CompetitiveCapabilityMatrixEngine.generateSnapshot()
  );
  const [gateResult, setGateResult] = useState<MatrixGateResult>(() =>
    CompetitiveCapabilityMatrixGate.executeGate(snapshot)
  );

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  // Selected cell modal/panel state
  const [selectedCell, setSelectedCell] = useState<CompetitiveCapabilityEvidence | null>(null);

  // Manual Override Form states
  const [overridePlat, setOverridePlat] = useState<"SECP" | "NX" | "CATIA" | "FUSION" | "ANSYS" | "SIMULIA">("SECP");
  const [overrideCap, setOverrideCap] = useState<string>('Parametric Modeling');
  const [overrideStatus, setOverrideStatus] = useState<CapabilityStatus>("PROVEN");
  const [overrideActor, setOverrideActor] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideEvidence, setOverrideEvidence] = useState<string[]>(['Manual physical lab certification']);
  const [newEvidenceLine, setNewEvidenceLine] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Adversarial toggle states
  const [bypassGpuSim, setBypassGpuSim] = useState<boolean>(false);
  const [tamperHash, setTamperHash] = useState<boolean>(false);
  const [wipeEvidence, setWipeEvidence] = useState<boolean>(false);

  // General state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Trigger re-generation of matrix and gate checks when state changes
  useEffect(() => {
    // 1. Reset all overrides first to have clean engine base
    CompetitiveCapabilityMatrixEngine.clearOverrides();

    // 2. Inject Adversarial Attacks if toggled
    if (bypassGpuSim) {
      // Maliciously override WebGPU to PROVEN (which is simulated, should trigger Rule 6 failure)
      CompetitiveCapabilityMatrixEngine.registerOverride(
        "ATTACKER-99",
        "SECP",
        "WebGPU",
        "PROVEN",
        "Malicious bypass asserting GPU performance is hardware-proven",
        ["Mock GPU trace bypass log"]
      );
    }

    // 3. Generate snapshot
    let activeSnapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();

    // 4. Inject structural corruptions if toggled
    if (wipeEvidence) {
      const corrupted = activeSnapshot.capabilities.map(c => {
        if (c.platform === "SECP" && c.capability === "B-Rep") {
          return { ...c, evidence: [] }; // Wipe evidence (triggers Rule 2 failure)
        }
        return c;
      });
      activeSnapshot = { ...activeSnapshot, capabilities: corrupted };
    }

    if (tamperHash) {
      const corrupted = activeSnapshot.capabilities.map((c, idx) => {
        if (idx === 0) {
          return { ...c, evidenceHash: "TAMPERED_HASH_BAD_89" }; // Corrupt hash (triggers Rule 8 failure)
        }
        return c;
      });
      activeSnapshot = { ...activeSnapshot, capabilities: corrupted };
    }

    // Recalculate gate
    const activeGate = CompetitiveCapabilityMatrixGate.executeGate(activeSnapshot);

    setSnapshot(activeSnapshot);
    setGateResult(activeGate);
  }, [bypassGpuSim, tamperHash, wipeEvidence]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleResetEngine = () => {
    CompetitiveCapabilityMatrixEngine.clearOverrides();
    setBypassGpuSim(false);
    setTamperHash(false);
    setWipeEvidence(false);
    const cleanSnapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();
    const cleanGate = CompetitiveCapabilityMatrixGate.executeGate(cleanSnapshot);
    setSnapshot(cleanSnapshot);
    setGateResult(cleanGate);
    setFormError(null);
    setSelectedCell(null);
  };

  const handleRegisterOverride = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!overrideActor.trim()) {
      setFormError("Actor identity is required to complete override audit trail.");
      return;
    }
    if (overrideReason.trim().length < 10) {
      setFormError("Auditable justification reason must be at least 10 characters long.");
      return;
    }

    try {
      CompetitiveCapabilityMatrixEngine.registerOverride(
        overrideActor,
        overridePlat,
        overrideCap,
        overrideStatus,
        overrideReason,
        overrideEvidence.filter(x => x.trim() !== '')
      );

      // Re-generate snapshot
      let newSnapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();
      
      // Keep adversarial corruptions active if checked
      if (wipeEvidence) {
        newSnapshot = {
          ...newSnapshot,
          capabilities: newSnapshot.capabilities.map(c =>
            c.platform === "SECP" && c.capability === "B-Rep" ? { ...c, evidence: [] } : c
          )
        };
      }
      if (tamperHash) {
        newSnapshot = {
          ...newSnapshot,
          capabilities: newSnapshot.capabilities.map((c, idx) =>
            idx === 0 ? { ...c, evidenceHash: "TAMPERED_HASH_BAD_89" } : c
          )
        };
      }

      const newGate = CompetitiveCapabilityMatrixGate.executeGate(newSnapshot);
      setSnapshot(newSnapshot);
      setGateResult(newGate);

      // Reset form fields
      setOverrideActor('');
      setOverrideReason('');
      setOverrideEvidence(['Manual physical lab certification']);
    } catch (err: any) {
      setFormError(err.message || "An error occurred during override registration.");
    }
  };

  const handleAddEvidenceLine = () => {
    if (newEvidenceLine.trim()) {
      setOverrideEvidence([...overrideEvidence, newEvidenceLine.trim()]);
      setNewEvidenceLine('');
    }
  };

  const handleRemoveEvidenceLine = (idx: number) => {
    setOverrideEvidence(overrideEvidence.filter((_, i) => i !== idx));
  };

  // Group capabilities by category for the grid list
  const getGroupOfCapability = (cap: string): string => {
    const CAD = ["Parametric Modeling", "Direct Modeling", "B-Rep", "NURBS", "Boolean Operations", "Topology Healing", "Geometric Predicates", "Sketching", "GCS", "Constraint Propagation", "Feature History", "Parametric Regeneration", "Assembly", "Kinematics", "Clash Detection", "Large Assembly"];
    const CFD = ["Finite Volume", "Navier-Stokes", "Pressure-Velocity Coupling", "Turbulence", "RANS", "SST k-ω", "Compressible Flow", "Heat Transfer", "Transient CFD", "Multiphase", "Mesh Independence", "Conservation", "Verification", "Validation"];
    const FEM = ["Linear FEM", "Nonlinear FEM", "Contact", "Large Deformation", "Modal", "Buckling", "Fatigue", "Thermal", "Stress Recovery", "Sparse Solvers", "Verification", "Validation"];
    const CAM = ["3-Axis", "5-Axis", "Toolpath Generation", "Collision Detection", "Machine Kinematics", "Post Processing", "G-Code Verification", "Toolpath Simulation", "Manufacturing Digital Twin"];
    const PLM = ["BOM", "Revision Control", "ECO", "Configuration Management", "Variant Management", "Lifecycle Management", "Change Impact", "Traceability"];
    const DIGITAL_TWIN = ["Geometry Twin", "Physics Twin", "Manufacturing Twin", "Inspection Twin", "Runtime Telemetry", "State Synchronization", "Predictive Engineering"];
    const AI_ENGINEERING = ["Geometry Reasoning", "Physics Reasoning", "Simulation Diagnostics", "Root Cause", "Optimization", "Manufacturing Optimization", "Engineering Copilot", "Evidence-Constrained AI", "AI Hallucination Controls"];
    const HPC = ["CPU", "GPU", "WebGPU", "WASM", "Native HPC", "MPI", "Distributed CFD", "Distributed FEM", "Cloud Compute", "Multi-GPU", "HPC Scheduler Integration"];
    const TRUTH = ["Determinism", "Reproducibility", "Provenance", "Evidence Graph", "Cryptographic Attestation", "Result Certification", "Simulation Certificate", "Manufacturing Certificate", "Design Certificate", "Chain of Custody", "Independent Verification", "Cross-Organization Evidence", "Engineering Truth Certificate"];

    if (CAD.includes(cap)) return "CAD";
    if (CFD.includes(cap)) return "CFD";
    if (FEM.includes(cap)) return "FEM";
    if (CAM.includes(cap)) return "CAM";
    if (PLM.includes(cap)) return "PLM";
    if (DIGITAL_TWIN.includes(cap)) return "DIGITAL TWIN";
    if (AI_ENGINEERING.includes(cap)) return "AI ENGINEERING";
    if (HPC.includes(cap)) return "HPC";
    if (TRUTH.includes(cap)) return "ENGINEERING TRUTH";
    return "OTHER";
  };

  // Get list of unique capability names from active capabilities
  const getUniqueCapabilities = (): string[] => {
    const list = Array.from(new Set(snapshot.capabilities.map(c => c.capability))) as string[];
    return list.filter(cap => {
      const matchSearch = cap.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGroup = selectedGroup === 'ALL' || getGroupOfCapability(cap) === selectedGroup;
      return matchSearch && matchGroup;
    });
  };

  // Get record for a cell
  const getCellRecord = (platform: string, capability: string): CompetitiveCapabilityEvidence | undefined => {
    return snapshot.capabilities.find(c => c.platform === platform && c.capability === capability);
  };

  const getStatusStyle = (status: CapabilityStatus) => {
    switch (status) {
      case "PROVEN":
        return "bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-semibold";
      case "PARTIAL":
        return "bg-amber-950/40 text-amber-400 border border-amber-500/30 font-medium";
      case "UNPROVEN":
        return "bg-slate-900 text-slate-400 border border-slate-800";
      case "ABSENT":
        return "bg-rose-950/40 text-rose-400 border border-rose-500/20";
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen p-8 font-sans antialiased space-y-8" id="competitive-matrix-panel">
      {/* 1. Header with Metadata, Hash displays, and Unified Controls */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-indigo-950/60 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded">
              PATCH-188
            </span>
            <span className="text-xs font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
              SECP v2.0 SECURE
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Competitive Capability Matrix
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            A real-time, reproducible engineering comparison system. All claims map strictly to source symbols, 
            test logs, or certified competitor reports with absolute cryptographic provenance and zero mock-falsifications.
          </p>
        </div>

        {/* Cryptographic Hash Badges */}
        <div className="flex flex-col gap-2 font-mono text-xs bg-slate-900 border border-slate-800 rounded-xl p-4 shrink-0 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Snapshot Version:</span>
            <span className="text-indigo-400 font-bold">{snapshot.version}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Audit Revision:</span>
            <span className="text-slate-300 font-bold">{snapshot.engineeringRevision}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-2 mt-1">
            <span className="text-slate-400">Evidence Root Hash:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-300 text-[10px]">{snapshot.evidenceRootHash.slice(0, 12)}...</span>
              <button
                onClick={() => handleCopy(snapshot.evidenceRootHash, 'root')}
                className="hover:text-white text-slate-500 transition-colors"
                title="Copy full root hash"
              >
                {copiedText === 'root' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Matrix Signature:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-indigo-300 text-[10px]">{snapshot.matrixHash.slice(0, 12)}...</span>
              <button
                onClick={() => handleCopy(snapshot.matrixHash, 'matrix')}
                className="hover:text-white text-slate-500 transition-colors"
                title="Copy full matrix signature"
              >
                {copiedText === 'matrix' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Unified Verification Gate & Adversarial Lab */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Verification Gate Checklist (Left Panel) */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <Scale className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-lg text-slate-200">Competitive Integrity Verification Gate</h2>
            </div>
            
            {/* Verdict Badge */}
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border flex items-center gap-1.5 shadow-sm ${
              gateResult.verdict === 'PASS' 
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400' 
                : 'bg-rose-950/60 border-rose-500/50 text-rose-400'
            }`}>
              {gateResult.verdict === 'PASS' ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  GATE: PASS
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  GATE: FAIL
                </>
              )}
            </div>
          </div>

          {/* Checks Progress List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            {gateResult.checks.map((check, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all ${
                  check.passed 
                    ? 'bg-slate-900/40 border-slate-800 text-slate-300' 
                    : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                }`}
              >
                {check.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-medium text-slate-200">{check.criterion}</div>
                  <div className="text-[10px] text-slate-400 leading-normal">{check.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Adversarial Security Lab Controls (Right Panel) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <h2 className="font-semibold text-lg text-slate-200">Adversarial Security Lab</h2>
            </div>
            <button
              onClick={handleResetEngine}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-all font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Engine
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Test the gate's robustness by forcing common AI falsification vectors. Authentic gates reject any simulated backends or tampered evidence.
          </p>

          <div className="space-y-3.5">
            {/* Toggle 1: GPU Simulation Attack */}
            <label className="flex items-start gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={bypassGpuSim}
                onChange={e => setBypassGpuSim(e.target.checked)}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 border-slate-800 bg-slate-900"
              />
              <div className="space-y-1 select-none">
                <span className="text-xs font-semibold text-slate-200 block">Inject Simulated GPU Override</span>
                <span className="text-[10px] text-slate-400 block leading-normal">
                  Claims GPU/WebGPU parallel compute is hardware-proven. (Fails Gate Rule 6 - Simulated Hardware).
                </span>
              </div>
            </label>

            {/* Toggle 2: Wipe CAD Evidence */}
            <label className="flex items-start gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={wipeEvidence}
                onChange={e => setWipeEvidence(e.target.checked)}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 border-slate-800 bg-slate-900"
              />
              <div className="space-y-1 select-none">
                <span className="text-xs font-semibold text-slate-200 block">Wipe Solid B-Rep CAD Evidence</span>
                <span className="text-[10px] text-slate-400 block leading-normal">
                  Sets B-Rep status to PROVEN but clears all associated file logs. (Fails Gate Rule 2 - Incomplete Evidence).
                </span>
              </div>
            </label>

            {/* Toggle 3: Hash Tampering */}
            <label className="flex items-start gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={tamperHash}
                onChange={e => setTamperHash(e.target.checked)}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 border-slate-800 bg-slate-900"
              />
              <div className="space-y-1 select-none">
                <span className="text-xs font-semibold text-slate-200 block">Tamper Cryptographic Cell Hash</span>
                <span className="text-[10px] text-slate-400 block leading-normal">
                  Forces a hardcoded payload mismatch in cell indices. (Fails Gate Rule 8 - Hash Integrity & Rule 7 - Reproducibility).
                </span>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* 3. The Capability Matrix Grid and Interactive Filters */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Filters and Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-200">Matrix Scope Explorer</h3>
          </div>

          <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search capabilities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
              />
            </div>

            {/* Category Select */}
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-600 transition-all"
            >
              <option value="ALL">All Categories</option>
              <option value="CAD">CAD (Geometry)</option>
              <option value="CFD">CFD (Fluid Dynamics)</option>
              <option value="FEM">FEM (Structural Physics)</option>
              <option value="CAM">CAM (Manufacturing)</option>
              <option value="PLM">PLM (Enterprise Thread)</option>
              <option value="DIGITAL TWIN">Digital Twin</option>
              <option value="AI ENGINEERING">AI Engineering</option>
              <option value="HPC">HPC & Compute Backend</option>
              <option value="ENGINEERING TRUTH">Engineering Truth</option>
            </select>
          </div>
        </div>

        {/* Matrix Spreadsheet Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="w-full border-collapse text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-slate-300">
                <th className="p-4 font-semibold min-w-[200px] border-r border-slate-800">Capability Taxonomy</th>
                <th className="p-4 font-semibold border-r border-slate-800 text-center bg-indigo-950/10 text-indigo-300 min-w-[130px]">SECP Industrial OS</th>
                <th className="p-4 font-semibold border-r border-slate-800 text-center min-w-[120px]">Siemens NX</th>
                <th className="p-4 font-semibold border-r border-slate-800 text-center min-w-[120px]">CATIA</th>
                <th className="p-4 font-semibold border-r border-slate-800 text-center min-w-[120px]">Fusion 360</th>
                <th className="p-4 font-semibold border-r border-slate-800 text-center min-w-[120px]">ANSYS</th>
                <th className="p-4 font-semibold text-center min-w-[120px]">SIMULIA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {getUniqueCapabilities().length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                    No capability records matching the current filter parameters were found.
                  </td>
                </tr>
              ) : (
                getUniqueCapabilities().map((cap, capIdx) => (
                  <tr key={capIdx} className="hover:bg-slate-900/20 transition-all group">
                    {/* Taxonomy cell */}
                    <td className="p-4 font-medium border-r border-slate-800 flex flex-col justify-center min-h-[64px]">
                      <span className="text-slate-200 text-xs font-semibold">{cap}</span>
                      <span className="text-[10px] text-indigo-400 font-mono tracking-wider mt-0.5">
                        {getGroupOfCapability(cap)}
                      </span>
                    </td>

                    {/* Platform cells */}
                    {["SECP", "NX", "CATIA", "FUSION", "ANSYS", "SIMULIA"].map((plat, platIdx) => {
                      const cell = getCellRecord(plat, cap);
                      if (!cell) {
                        return (
                          <td key={platIdx} className="p-4 text-center border-r border-slate-800/80 text-slate-600 font-mono">
                            -
                          </td>
                        );
                      }

                      return (
                        <td
                          key={platIdx}
                          onClick={() => setSelectedCell(cell)}
                          className={`p-3 text-center border-r border-slate-800/80 cursor-pointer hover:bg-slate-800/40 transition-colors relative min-h-[64px] ${
                            plat === 'SECP' ? 'bg-indigo-950/5' : ''
                          }`}
                        >
                          <div className={`mx-auto rounded-lg px-2.5 py-1.5 text-[10px] max-w-[120px] transition-all text-center select-none shadow-sm ${getStatusStyle(cell.status)}`}>
                            {cell.status}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Cell Evidence inspector Panel */}
      <AnimatePresence>
        {selectedCell && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-6 relative"
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedCell(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center border border-slate-700 transition-colors"
            >
              ✕
            </button>

            {/* General Description */}
            <div className="md:col-span-4 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-mono font-bold">
                  Cell Evidence Audit
                </span>
                <h3 className="text-xl font-bold text-slate-200">{selectedCell.capability}</h3>
                <p className="text-xs text-slate-400">
                  Detailed integrity and verification level metrics for {selectedCell.platform}.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Platform:</span>
                  <span className="text-slate-200 font-semibold">{selectedCell.platform}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Claimed Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusStyle(selectedCell.status)}`}>
                    {selectedCell.status}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Source Type:</span>
                  <span className="text-slate-300 font-mono text-[10px]">{selectedCell.sourceType}</span>
                </div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-slate-400">Verification:</span>
                  <span className="text-slate-300 font-mono text-[10px]">{selectedCell.verificationLevel}</span>
                </div>
              </div>
            </div>

            {/* Evidence, hash values, limitations list */}
            <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-l border-slate-800 pl-6">
              
              {/* Evidence Panel */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Evidence Trace Refs
                </div>
                
                {selectedCell.evidence && selectedCell.evidence.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-400 list-none pl-0">
                    {selectedCell.evidence.map((ev, i) => (
                      <li key={i} className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        <Code className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span className="font-mono text-[11px] leading-relaxed break-all">{ev}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-500 italic bg-slate-950/40 p-4 rounded-lg border border-slate-800 text-center">
                    No auditable evidence references declared.
                  </div>
                )}
              </div>

              {/* Limitations Panel */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Engineering Limitations
                </div>

                {selectedCell.limitations && selectedCell.limitations.length > 0 ? (
                  <ul className="space-y-2 text-xs text-slate-400 list-none pl-0">
                    {selectedCell.limitations.map((lim, i) => (
                      <li key={i} className="flex items-start gap-2 bg-amber-950/10 p-2.5 rounded-lg border border-amber-950/20 text-amber-200/80">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span className="leading-relaxed text-[11px]">{lim}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-emerald-400/80 bg-emerald-950/10 p-4 rounded-lg border border-emerald-950/20 text-center">
                    No physics fallback or engineering boundary limitations disclosed for this cell scope.
                  </div>
                )}

                {selectedCell.evidenceHash && (
                  <div className="border-t border-slate-800 pt-3 mt-2">
                    <span className="text-[10px] text-slate-500 block font-mono">CELL EVIDENCE HASH:</span>
                    <span className="text-[10px] text-indigo-300 block font-mono truncate break-all bg-slate-950/60 p-2 rounded border border-slate-800 mt-1">
                      {selectedCell.evidenceHash}
                    </span>
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Secure Manual Override Form (Auditable Audit Trail Generator) */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Registration Form (Left Panel) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileSignature className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-lg text-slate-200">Register Auditable Manual Override</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Register any manual test verifications or competitor datasheet audits. The system logs every action to an 
            immutable trail and recalculates hashes immediately.
          </p>

          <form onSubmit={handleRegisterOverride} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Platform select */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Platform</label>
                <select
                  value={overridePlat}
                  onChange={e => setOverridePlat(e.target.value as any)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-600 transition-all"
                >
                  <option value="SECP">SECP Industrial OS</option>
                  <option value="NX">Siemens NX</option>
                  <option value="CATIA">CATIA</option>
                  <option value="FUSION">Fusion 360</option>
                  <option value="ANSYS">ANSYS</option>
                  <option value="SIMULIA">SIMULIA</option>
                </select>
              </div>

              {/* Capability select */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Capability</label>
                <select
                  value={overrideCap}
                  onChange={e => setOverrideCap(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-600 transition-all"
                >
                  {Array.from(new Set(snapshot.capabilities.map(c => c.capability))).map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">New Status</label>
                <select
                  value={overrideStatus}
                  onChange={e => setOverrideStatus(e.target.value as any)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-600 transition-all"
                >
                  <option value="PROVEN">PROVEN</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="UNPROVEN">UNPROVEN</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Actor Input */}
              <div className="space-y-1 md:col-span-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Author Identity</label>
                <input
                  type="text"
                  placeholder="e.g. ENG-CHIEF-07"
                  value={overrideActor}
                  onChange={e => setOverrideActor(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                />
              </div>

              {/* Reason Input */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Auditable Justification</label>
                <input
                  type="text"
                  placeholder="Provide detailed context for this verification override (min 10 chars)..."
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
                />
              </div>
            </div>

            {/* Evidence items creator */}
            <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Override Evidence References</label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add auditable file reference, symbol name, or test hash..."
                  value={newEvidenceLine}
                  onChange={e => setNewEvidenceLine(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddEvidenceLine}
                  className="bg-indigo-950 text-indigo-400 hover:bg-indigo-900 hover:text-white px-3.5 py-1.5 rounded-lg border border-indigo-800 text-xs transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {overrideEvidence.map((ev, i) => (
                  <span key={i} className="flex items-center gap-1.5 bg-slate-900 text-slate-300 font-mono text-[10px] px-2.5 py-1 rounded border border-slate-800">
                    {ev.length > 30 ? ev.slice(0, 30) + '...' : ev}
                    <button
                      type="button"
                      onClick={() => handleRemoveEvidenceLine(i)}
                      className="text-slate-500 hover:text-rose-400 ml-1 font-bold text-xs"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Error messaging and Submit */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
              <div className="text-xs text-rose-400 font-medium">
                {formError && `⚠️ Error: ${formError}`}
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-all shadow-lg shrink-0"
              >
                <Plus className="w-4 h-4" />
                Register Override
              </button>
            </div>
          </form>
        </div>

        {/* Immutable Audit Trail Log (Right Panel) */}
        <div className="lg:col-span-5 space-y-4 border-l border-slate-800 pl-8">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-lg text-slate-200">Immutable Audit Trail Logs</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Historical override registries synced in real-time. Changes modify the blockchain-style `matrixHash` signature.
          </p>

          <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-2">
            {snapshot.auditTrail && snapshot.auditTrail.length > 0 ? (
              snapshot.auditTrail.map((o, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300 font-mono text-[11px]">{o.actor}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(o.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="bg-slate-900/40 p-2 rounded border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-semibold">{o.capability} ({o.platform})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono pt-1">
                      <span className="text-slate-500">{o.previousStatus}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-indigo-400 font-bold">{o.newStatus}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic leading-relaxed">
                    "{o.reason}"
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 italic py-16 text-xs bg-slate-950/30 rounded-xl border border-slate-800">
                No manual override records registered in this session.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Auxiliary Icon list indicator as alert */}
      <div className="flex items-start gap-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400">
        <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-300 block">How to read the status taxonomy</span>
          <span className="leading-relaxed block">
            Click any cell in the comparison spreadsheet above to inspect detailed evidence references, verification level standards, and documented limitations. Under standard audits, "PROVEN" demands specific source code reference hashes. "PARTIAL" discloses limitations. Simulated clusters cannot be promoted.
          </span>
        </div>
      </div>
    </div>
  );
}

// Help component to resolve import checks
function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export default CompetitiveCapabilityMatrixPanel;
