/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-323 — B-Rep Reconstruction Workbench Panel
 */

import React, { useState, useEffect } from 'react';
import { Box, Square, Minus, CircleDot, Activity, CheckCircle2, AlertCircle, ShieldCheck, Zap, Maximize2, Link2, Database, Grid3X3 } from 'lucide-react';
import { BRepReconstructionEngine323 } from '../engine/reverse_engineering/surfaces/BRepReconstructionEngine323';
import { BRepReconstructionSession, BRepSolid } from '../engine/reverse_engineering/surfaces/BRepReconstructionTypes323';
import { HardAcceptanceGate323, Gate323Report } from '../engine/reverse_engineering/surfaces/HardAcceptanceGate323';
import { NURBSReconstructionSession } from '../engine/reverse_engineering/surfaces/NURBSReconstructionTypes322';
import { motion, AnimatePresence } from 'motion/react';

export const BRepReconstructionWorkbenchPanel: React.FC = () => {
  const [session, setSession] = useState<BRepReconstructionSession | null>(null);
  const [selectedSolid, setSelectedSolid] = useState<BRepSolid | null>(null);
  const [gateReport, setGateReport] = useState<Gate323Report | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    runInitialReconstruction();
  }, []);

  const runInitialReconstruction = async () => {
    setIsProcessing(true);
    
    // Canonical baseline reconstruction session
    const canonicalNurbsSession: NURBSReconstructionSession = {
      sessionId: 'SESSION-BREP-RECON-CANONICAL-001',
      sourceSurfaceModelId: 'SURF-MODEL-CYLINDER-001',
      surfaces: [
        {
          surfaceId: 'NURBS-SURF-001',
          degreeU: 2,
          degreeV: 1,
          controlPoints: [
            [{ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 1, w: 1 }],
            [{ x: 1, y: 0, z: 0, w: 1 }, { x: 1, y: 0, z: 1, w: 1 }],
            [{ x: 1, y: 1, z: 0, w: 1 }, { x: 1, y: 1, z: 1, w: 1 }]
          ],
          knotsU: [0, 0, 0, 1, 1, 1],
          knotsV: [0, 0, 1, 1],
          domainU: [0, 1],
          domainV: [0, 1],
          isRational: false,
          trimLoops: [],
          metrics: { fitRmseMm: 0.001, maxDeviationMm: 0.005, parameterizationQuality: 0.999 },
          provenance: { sourceSurfaceId: 'SURF-CANONICAL-001', algorithm: 'NURBS_FIT_LOFT', timestamp: new Date().toISOString(), isExact: true },
          status: 'VALIDATED'
        }
      ],
      status: 'VALIDATED',
      createdAt: new Date().toISOString()
    };

    const engine = BRepReconstructionEngine323.getInstance();
    const newSession = engine.prepare(canonicalNurbsSession);
    
    engine.buildTopology(newSession, canonicalNurbsSession);
    engine.validate(newSession);
    engine.commit(newSession);

    setSession(newSession);
    setIsProcessing(false);
  };

  const runGate = () => {
    const report = HardAcceptanceGate323.runGate();
    setGateReport(report);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0b] text-slate-300 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 bg-[#0f0f11]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
            <Box className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight leading-tight uppercase italic">B-Rep Reconstruction Engine</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Patch-323 • Topology Solidification</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={runInitialReconstruction}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 border border-slate-700"
          >
            <Activity className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            Construct B-Rep
          </button>
          <button 
            onClick={runGate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <ShieldCheck className="w-4 h-4" />
            Run Gate 323
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel: B-Rep Model Explorer */}
        <div className="w-1/3 border-r border-slate-800/50 flex flex-col bg-[#0d0d0f]">
          <div className="p-4 border-b border-slate-800/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5" />
                Topology Model
              </h2>
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-bold border border-indigo-500/20 uppercase italic">
                {session?.model.solids.length || 0} Solids
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Manifold Check</p>
                {session?.model.validationReport?.isManifold ? (
                  <p className="text-lg font-black text-emerald-400 tracking-tight italic">PASS</p>
                ) : (
                  <p className="text-lg font-black text-rose-400 tracking-tight italic">FAIL</p>
                )}
              </div>
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-tighter">Watertight</p>
                {session?.model.validationReport?.isWatertight ? (
                  <p className="text-lg font-black text-emerald-400 tracking-tight italic">YES</p>
                ) : (
                  <p className="text-lg font-black text-rose-400 tracking-tight italic">NO</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono">
            <AnimatePresence mode="popLayout">
              {session?.model.solids.map((solid) => (
                <motion.div
                  key={solid.solidId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedSolid(solid)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                    selectedSolid?.solidId === solid.solidId 
                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/5' 
                    : 'bg-slate-900/30 border-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Box className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white tracking-tight italic uppercase">{solid.solidId}</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{solid.outerShellId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-indigo-400 tracking-tight italic uppercase">
                        {(solid.volumeMm3 / 1000).toFixed(1)} cm³
                      </p>
                      <p className="text-[9px] text-slate-600 uppercase font-black tracking-tighter italic">Solid Volume</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/20">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-slate-400 font-bold tracking-tight italic uppercase">
                        {solid.isWatertight ? 'Closed' : 'Open'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Panel: B-Rep Details */}
        <div className="flex-1 bg-[#0a0a0b] flex flex-col p-6 space-y-6 overflow-y-auto">
          {selectedSolid ? (
            <>
              <div className="flex items-start justify-between font-mono">
                <div>
                  <div className="flex items-center gap-2 mb-2 font-mono">
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] font-black rounded uppercase tracking-widest border border-indigo-500/20 italic">
                      Strict Boundary Representation
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded uppercase tracking-widest border border-emerald-500/20 flex items-center gap-1 italic">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Euler Validated
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tighter italic uppercase underline decoration-indigo-500/50 underline-offset-8">
                    Solid Topology
                  </h2>
                  <p className="text-sm text-slate-500 font-bold flex items-center gap-2 mt-4">
                    <Database className="w-4 h-4 text-indigo-500" />
                    ID: {selectedSolid.solidId}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-widest">Euler Characteristic</p>
                  <p className="text-2xl font-black text-indigo-400 tracking-tighter italic uppercase">
                    χ = {session?.model.validationReport?.eulerCharacteristic}
                  </p>
                </div>
              </div>

              {/* Entity Breakdown */}
              <div className="grid grid-cols-4 gap-4 font-mono">
                <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 flex flex-col items-center justify-center text-center">
                  <Square className="w-5 h-5 text-indigo-400 mb-2" />
                  <p className="text-2xl font-black text-white italic">{session?.model.faces.length}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Faces</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 flex flex-col items-center justify-center text-center">
                  <Link2 className="w-5 h-5 text-indigo-400 mb-2" />
                  <p className="text-2xl font-black text-white italic">{session?.model.loops.length}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Loops</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 flex flex-col items-center justify-center text-center">
                  <Minus className="w-5 h-5 text-indigo-400 mb-2" />
                  <p className="text-2xl font-black text-white italic">{session?.model.edges.length}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Edges</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 flex flex-col items-center justify-center text-center">
                  <CircleDot className="w-5 h-5 text-indigo-400 mb-2" />
                  <p className="text-2xl font-black text-white italic">{session?.model.vertices.length}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Vertices</p>
                </div>
              </div>

              {/* Geometric & Topological Consistency */}
              <div className="grid grid-cols-2 gap-6 font-mono">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800/50 space-y-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    Manifold Validation Report
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded bg-slate-950/50 border border-slate-800/50">
                      <span className="text-[10px] text-slate-500 font-bold uppercase italic">Open Edges (Boundaries)</span>
                      <span className={`text-sm font-black italic ${session?.model.validationReport?.openEdgeCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {session?.model.validationReport?.openEdgeCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded bg-slate-950/50 border border-slate-800/50">
                      <span className="text-[10px] text-slate-500 font-bold uppercase italic">Non-Manifold Edges</span>
                      <span className={`text-sm font-black italic ${session?.model.validationReport?.nonManifoldEdgeCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {session?.model.validationReport?.nonManifoldEdgeCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded bg-slate-950/50 border border-slate-800/50">
                      <span className="text-[10px] text-slate-500 font-bold uppercase italic">Maximum Gap</span>
                      <span className="text-sm font-black text-indigo-400 italic">{session?.model.validationReport?.maxGapMm.toFixed(4)} mm</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800/50 space-y-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Grid3X3 className="w-3.5 h-3.5 text-indigo-500" />
                    Mass Properties
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="p-3 rounded bg-slate-950/50 border border-slate-800/50">
                      <p className="text-[10px] text-slate-500 uppercase font-bold italic mb-1">Total Volume</p>
                      <p className="text-xl font-black text-white italic">{(selectedSolid.volumeMm3 / 1000).toFixed(3)} cm³</p>
                    </div>
                    
                    <div className="p-3 rounded bg-slate-950/50 border border-slate-800/50">
                      <p className="text-[10px] text-slate-500 uppercase font-bold italic mb-2">Centroid (x, y, z)</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-indigo-400 italic">{selectedSolid.centroid.x.toFixed(2)}</span>
                        <span className="text-sm font-black text-indigo-400 italic">{selectedSolid.centroid.y.toFixed(2)}</span>
                        <span className="text-sm font-black text-indigo-400 italic">{selectedSolid.centroid.z.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto font-mono">
              <div className="w-20 h-20 rounded-3xl bg-slate-900/50 border border-slate-800/50 flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent animate-pulse" />
                <Box className="w-8 h-8 text-slate-700 relative z-10" />
              </div>
              <h2 className="text-xl font-black text-white mb-2 tracking-tight italic uppercase">Topology Selection</h2>
              <p className="text-sm text-slate-500 leading-relaxed font-bold italic uppercase tracking-tighter">
                Select a reconstructed Solid to evaluate B-Rep constraints, manifold integrity, and Eulerian topological properties.
              </p>
            </div>
          )}
        </div>

        {/* Right Panel: Gate Results */}
        <div className="w-1/4 border-l border-slate-800/50 bg-[#0d0d0f] p-4 overflow-y-auto font-mono">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              Gate 323 Suite
            </h2>
            {gateReport && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter italic border ${
                gateReport.passed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {gateReport.passed ? 'PASSED' : 'FAILED'}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {gateReport ? (
              gateReport.assertions.map((assertion) => (
                <div 
                  key={assertion.id} 
                  className={`p-3 rounded-xl border transition-colors ${
                    assertion.passed ? 'bg-emerald-500/5 border-emerald-500/20 shadow-sm' : 'bg-rose-500/5 border-rose-500/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {assertion.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-black text-white tracking-tighter italic uppercase">{assertion.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed italic">{assertion.message}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-900/20 border border-dashed border-slate-800/50 rounded-2xl group hover:border-indigo-500/30 transition-colors">
                <Zap className="w-8 h-8 text-slate-800 mx-auto mb-3 group-hover:text-indigo-500/50 transition-colors" />
                <p className="text-xs text-slate-600 font-black uppercase tracking-widest italic">Verification Ready</p>
                <p className="text-[10px] text-slate-700 mt-2 font-bold italic leading-relaxed uppercase">
                  Automated assertion suite for Patch-323 validation is pending execution.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
