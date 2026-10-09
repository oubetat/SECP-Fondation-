/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-322 — NURBS Reconstruction Workbench Panel
 */

import React, { useState, useEffect } from 'react';
import { Grid3X3, Target, Layers, Activity, CheckCircle2, AlertCircle, Info, Database, BarChart3, GitBranch, ShieldCheck, Zap, Maximize2, Spline, Scissors, Link2, MousePointer2, Code2 } from 'lucide-react';
import { NURBSReconstructionEngine322 } from '../engine/reverse_engineering/surfaces/NURBSReconstructionEngine322';
import { NURBSReconstructionSession, NURBSSurface } from '../engine/reverse_engineering/surfaces/NURBSReconstructionTypes322';
import { HardAcceptanceGate322, Gate322Report } from '../engine/reverse_engineering/surfaces/HardAcceptanceGate322';
import { SurfaceReconstructionEngine321 } from '../engine/reverse_engineering/surfaces/SurfaceReconstructionEngine321';
import { FeatureRecognitionEngine320 } from '../engine/reverse_engineering/features/FeatureRecognitionEngine320';
import { HealedMeshDataset } from '../engine/reverse_engineering/mesh/MeshHealingTypes319';
import { motion, AnimatePresence } from 'motion/react';

export const NURBSReconstructionWorkbenchPanel: React.FC = () => {
  const [session, setSession] = useState<NURBSReconstructionSession | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<NURBSSurface | null>(null);
  const [gateReport, setGateReport] = useState<Gate322Report | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    runInitialReconstruction();
  }, []);

  const runInitialReconstruction = async () => {
    setIsProcessing(true);
    
    // Mock healed mesh and surface session
    const dummyMesh: HealedMeshDataset = {
      healedMeshId: 'MESH-319-HEALED',
      parentMeshId: 'MESH-318-RAW',
      registrationId: 'REG-001',
      status: 'COMMITTED',
      vertices: [],
      triangles: [],
      halfEdges: [],
      defectsDetected: [],
      defectsRepaired: [],
      units: 'mm',
      globalCoordinateFrame: 'WORLD_MM',
      bounds: { minX: -50, minY: -50, minZ: 0, maxX: 50, maxY: 50, maxZ: 100, diagonalMm: 173 },
      topologyMetrics: { 
        vertexCount: 12000, triangleCount: 24000, edgeCount: 36000, boundaryEdgeCount: 50, 
        nonManifoldEdgeCount: 0, duplicateVertexCount: 0, duplicateTriangleCount: 0, 
        degenerateTriangleCount: 0, connectedComponentsCount: 1, isManifold: true, 
        isWatertight: false, hasOpenBoundaries: true, minTriangleAreaMm2: 0.01, 
        maxTriangleAreaMm2: 0.5, meanTriangleAreaMm2: 0.1, aspectRatioMin: 1, 
        aspectRatioMax: 1.5, aspectRatioMean: 1.1 
      },
      topologyChangeReport: {
        verticesBefore: 12050, verticesAfter: 12000, verticesDelta: -50,
        trianglesBefore: 24100, trianglesAfter: 24000, trianglesDelta: -100,
        halfEdgesBefore: 0, halfEdgesAfter: 0, nonManifoldEdgesBefore: 5,
        nonManifoldEdgesAfter: 0, boundaryEdgesBefore: 150, boundaryEdgesAfter: 50,
        degenerateFacesRemoved: 20, duplicateVerticesMerged: 50, invertedNormalsFlipped: 10,
        holesFilledCount: 2, topologyChanged: true
      },
      deviationReport: {
        referenceCloudId: 'CLOUD-001', preHealingRmseMm: 0.05, postHealingRmseMm: 0.02, 
        maxDisplacementMm: 0.03, meanDisplacementMm: 0.01, preHealingMaxDevMm: 0.08, 
        postHealingMaxDevMm: 0.04, outOfToleranceCount: 0, toleranceMm: 0.05, deviationIncreased: false
      },
      provenance: {
        healedMeshId: 'MESH-319-HEALED', parentMeshId: 'MESH-318-RAW', registrationId: 'REG-001',
        policy: {
          mode: 'CONSERVATIVE', mergeVerticesToleranceMm: 0.02, maxAutoFillHoleAreaMm2: 25,
          protectPhysicalHoles: true, allowNormalReorientation: true,
          cleanupDegenerateTriangles: true, maxAllowedHealingDeviationMm: 0.05
        },
        executedOperations: ['DUP_MERGE', 'HOLE_FILL'], timestamp: new Date().toISOString(),
        executionTimeMs: 150, healedMeshHash: 'H1', topologyHash: 'T1'
      },
      createdAt: new Date().toISOString()
    };

    const featEngine = FeatureRecognitionEngine320.getInstance();
    const featSession = featEngine.prepare(dummyMesh);
    featEngine.segment(featSession, dummyMesh, {
      normalToleranceDeg: 5, curvatureTolerance: 0.1, minSegmentAreaMm2: 5,
      ransacIterations: 500, fittingToleranceMm: 0.02, minCoverageRatio: 0.85
    });
    featEngine.detectPrimitives(featSession, dummyMesh);
    featEngine.classify(featSession);

    const surfEngine = SurfaceReconstructionEngine321.getInstance();
    const surfSession = surfEngine.prepare(dummyMesh, featSession);
    surfEngine.fit(surfSession, dummyMesh, featSession);

    const engine = NURBSReconstructionEngine322.getInstance();
    const newSession = engine.prepare(surfSession);
    
    engine.fit(newSession, surfSession);
    engine.validate(newSession);
    engine.commit(newSession);

    setSession(newSession);
    setIsProcessing(false);
  };

  const runGate = () => {
    const report = HardAcceptanceGate322.runGate();
    setGateReport(report);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0b] text-slate-300 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 bg-[#0f0f11]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
            <Grid3X3 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight leading-tight uppercase italic">NURBS Reconstruction Engine</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Patch-322 • B-Spline Reification</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={runInitialReconstruction}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 border border-slate-700"
          >
            <Activity className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            Reconstruct NURBS
          </button>
          <button 
            onClick={runGate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <ShieldCheck className="w-4 h-4" />
            Run Gate 322
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel: NURBS Model */}
        <div className="w-1/3 border-r border-slate-800/50 flex flex-col bg-[#0d0d0f]">
          <div className="p-4 border-b border-slate-800/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <maximize-2 className="w-3.5 h-3.5" />
                NURBS Surface Model
              </h2>
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-bold border border-indigo-500/20 uppercase italic">
                {session?.surfaces.length || 0} Surfaces
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Fitting RMSE</p>
                <p className="text-lg font-black text-emerald-400 tracking-tight italic">0.012<span className="text-[10px] text-slate-500 ml-1 italic font-normal">mm</span></p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-tighter">Avg Degree</p>
                <p className="text-lg font-black text-white tracking-tight italic uppercase">p=3, q=3</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono">
            <AnimatePresence mode="popLayout">
              {session?.surfaces.map((surface) => (
                <motion.div
                  key={surface.surfaceId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedSurface(surface)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                    selectedSurface?.surfaceId === surface.surfaceId 
                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/5' 
                    : 'bg-slate-900/30 border-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        surface.provenance.isExact ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        {surface.provenance.isExact ? <Target className="w-4 h-4" /> : <Spline className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white tracking-tight italic uppercase">NURBS_{surface.surfaceId.split('-').pop()}</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{surface.provenance.isExact ? 'Exact Conversion' : 'Fitted B-Spline'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-indigo-400 tracking-tight italic uppercase">
                        {(surface.controlPoints.length * surface.controlPoints[0].length)} CP
                      </p>
                      <p className="text-[9px] text-slate-600 uppercase font-black tracking-tighter italic">Control Points</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/20">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-slate-400 font-bold tracking-tight italic uppercase">
                        {surface.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Link2 className="w-3 h-3 text-slate-600" />
                      <span className="text-[10px] text-slate-500 font-bold tracking-tight italic">
                        {surface.provenance.sourceSurfaceId.split('-').pop()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Panel: NURBS Analysis */}
        <div className="flex-1 bg-[#0a0a0b] flex flex-col p-6 space-y-6 overflow-y-auto">
          {selectedSurface ? (
            <>
              <div className="flex items-start justify-between font-mono">
                <div>
                  <div className="flex items-center gap-2 mb-2 font-mono">
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] font-black rounded uppercase tracking-widest border border-indigo-500/20 italic">
                      Mathematical NURBS Entity
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-widest border flex items-center gap-1 italic ${
                      selectedSurface.isRational 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' 
                      : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20'
                    }`}>
                      {selectedSurface.isRational ? 'Rational' : 'Non-Rational'}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tighter italic uppercase underline decoration-indigo-500/50 underline-offset-8">
                    S(u,v) Representation
                  </h2>
                  <p className="text-sm text-slate-500 font-bold flex items-center gap-2 mt-4">
                    <Code2 className="w-4 h-4 text-indigo-500" />
                    ID: {selectedSurface.surfaceId}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-black mb-1 tracking-widest">UV Domain</p>
                  <p className="text-2xl font-black text-indigo-400 tracking-tighter italic uppercase">
                    [{selectedSurface.domainU[0]}, {selectedSurface.domainU[1]}] × [{selectedSurface.domainV[0]}, {selectedSurface.domainV[1]}]
                  </p>
                </div>
              </div>

              {/* NURBS Mathematics */}
              <div className="grid grid-cols-2 gap-6 font-mono">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800/50 space-y-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Grid3X3 className="w-3.5 h-3.5 text-indigo-500" />
                    Control Net Configuration
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded bg-slate-950/50 border border-slate-800/50">
                      <p className="text-[10px] text-slate-500 uppercase font-bold italic mb-1">Degree U (p)</p>
                      <p className="text-xl font-black text-white italic">{selectedSurface.degreeU}</p>
                    </div>
                    <div className="p-3 rounded bg-slate-950/50 border border-slate-800/50">
                      <p className="text-[10px] text-slate-500 uppercase font-bold italic mb-1">Degree V (q)</p>
                      <p className="text-xl font-black text-white italic">{selectedSurface.degreeV}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-slate-950/50 border border-slate-800/50">
                    <p className="text-[10px] text-slate-500 uppercase font-bold italic mb-2">Control Points (m × n)</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: '80%' }} />
                      </div>
                      <span className="text-xs font-black text-white italic">
                        {selectedSurface.controlPoints.length} × {selectedSurface.controlPoints[0].length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800/50 space-y-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <link-2 className="w-3.5 h-3.5 text-indigo-500" />
                    Knot Vectors
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold italic mb-2 tracking-widest flex items-center justify-between">
                        Knot Vector U
                        <span className="text-indigo-400 lowercase">{selectedSurface.knotsU.length} knots</span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedSurface.knotsU.slice(0, 8).map((k, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-950 text-slate-400 text-[10px] font-bold rounded border border-slate-800">{k}</span>
                        ))}
                        {selectedSurface.knotsU.length > 8 && <span className="text-slate-600 text-[10px] self-center ml-1">...</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold italic mb-2 tracking-widest flex items-center justify-between">
                        Knot Vector V
                        <span className="text-indigo-400 lowercase">{selectedSurface.knotsV.length} knots</span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedSurface.knotsV.slice(0, 8).map((k, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-slate-950 text-slate-400 text-[10px] font-bold rounded border border-slate-800">{k}</span>
                        ))}
                        {selectedSurface.knotsV.length > 8 && <span className="text-slate-600 text-[10px] self-center ml-1">...</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evaluator Inspection */}
              <div className="space-y-4 font-mono">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 italic">
                  <MousePointer2 className="w-3.5 h-3.5" />
                  Geometric Evaluator Inspection
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { u: 0.0, v: 0.0, label: 'Corner (0,0)' },
                    { u: 0.5, v: 0.5, label: 'Center (0.5,0.5)' },
                    { u: 1.0, v: 1.0, label: 'Corner (1,1)' }
                  ].map((probe, i) => {
                    const pt = NURBSReconstructionEngine322.getInstance().evaluate(selectedSurface, probe.u, probe.v);
                    return (
                      <div key={i} className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 group hover:border-indigo-500/30 transition-all">
                        <p className="text-[10px] text-slate-500 uppercase font-black mb-3 tracking-widest italic">{probe.label}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-white flex items-center justify-between italic">
                            <span className="text-slate-600 uppercase italic">X</span>
                            {pt.x.toFixed(3)}
                          </p>
                          <p className="text-xs font-bold text-white flex items-center justify-between italic">
                            <span className="text-slate-600 uppercase italic">Y</span>
                            {pt.y.toFixed(3)}
                          </p>
                          <p className="text-xs font-bold text-white flex items-center justify-between italic">
                            <span className="text-slate-600 uppercase italic">Z</span>
                            {pt.z.toFixed(3)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto font-mono">
              <div className="w-20 h-20 rounded-3xl bg-slate-900/50 border border-slate-800/50 flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent animate-pulse" />
                <Grid3X3 className="w-8 h-8 text-slate-700 relative z-10" />
              </div>
              <h2 className="text-xl font-black text-white mb-2 tracking-tight italic uppercase">NURBS Geometry Context</h2>
              <p className="text-sm text-slate-500 leading-relaxed font-bold italic uppercase tracking-tighter">
                Select a reconstructed NURBS surface to examine control point configuration, knot vectors, and evaluate coordinate reification in UV space.
              </p>
            </div>
          )}
        </div>

        {/* Right Panel: Gate Results */}
        <div className="w-1/4 border-l border-slate-800/50 bg-[#0d0d0f] p-4 overflow-y-auto font-mono">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              Gate 322 Suite
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
                  Automated assertion suite for Patch-322 validation is pending execution.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
