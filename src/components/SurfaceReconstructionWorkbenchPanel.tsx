import React, { useState } from 'react';
import { 
  Layers, 
  Activity, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Play, 
  RefreshCw, 
  Sliders, 
  Database, 
  Box, 
  Grid, 
  TrendingUp, 
  Spline,
  Search
} from 'lucide-react';
import { SurfaceReconstructionEngine321 } from '../engine/reverse_engineering/surfaces/SurfaceReconstructionEngine321';
import { HardAcceptanceGate321, Gate321Report } from '../engine/reverse_engineering/surfaces/HardAcceptanceGate321';
import { SurfaceReconstructionSession, ReconstructedSurface } from '../engine/reverse_engineering/surfaces/SurfaceReconstructionTypes321';
import { MeshHealingEngine319 } from '../engine/reverse_engineering/mesh/MeshHealingEngine319';
import { ScanToMeshEngine318 } from '../engine/reverse_engineering/mesh/ScanToMeshEngine318';
import { PointCloudImportService } from '../engine/reverse_engineering/point_cloud/PointCloudImportService';
import { PointCloudRegistrationEngine } from '../engine/reverse_engineering/registration/PointCloudRegistrationEngine';

export const SurfaceReconstructionWorkbenchPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FITTING' | 'SURFACES' | 'INSPECTOR' | 'GATE321'>('FITTING');
  const [ransacTolerance, setRansacTolerance] = useState<number>(0.05);
  const [smoothAngleThreshold, setSmoothAngleThreshold] = useState<number>(15.0);
  const [maxRmseThreshold, setMaxRmseThreshold] = useState<number>(0.02);
  
  const [isRunning, setIsRunning] = useState(false);
  const [session, setSession] = useState<SurfaceReconstructionSession | null>(null);
  const [gateReport, setGateReport] = useState<Gate321Report | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  const handleRunSurfaceFitting = () => {
    setIsRunning(true);
    setFeedback('Extracting analytical geometric patches & fitting analytical surfaces...');

    setTimeout(() => {
      try {
        const importService = PointCloudImportService.getInstance();
        const regEngine = PointCloudRegistrationEngine.getInstance();
        const meshEngine = ScanToMeshEngine318.getInstance();
        const healingEngine = MeshHealingEngine319.getInstance();
        const surfEngine = SurfaceReconstructionEngine321.getInstance();

        importService.clearAll();
        regEngine.clearAll();
        meshEngine.clearAll();
        healingEngine.clearAll();

        const cloud = importService.importFromMemory({
          datasetName: 'SURFACE-FIT-HOUSING-01',
          sourceFormat: 'PCD',
          points: Array.from({ length: 2000 }, (_, i) => ({
            x: (i % 40) * 1.5,
            y: Math.floor(i / 40) * 1.5,
            z: Math.sin(i * 0.1) * 2.0,
            intensity: 0.95,
            confidence: 0.99
          })),
          unit: 'MM',
          sensorModel: 'GOM_ATOS_5'
        });

        const regSession = regEngine.prepareSingleCloudSession(cloud, 'GLOBAL_CAD_FRAME');
        const regResult = regEngine.runRegistration(regSession.sessionId);

        const meshSession = meshEngine.prepare(regResult, {
          mode: 'BALL_PIVOTING',
          normalEstimation: { kNeighbors: 10, pcaAnisotropyThreshold: 0.1, orientNormalsToSensor: true },
          ballPivotingRadius: 3.0,
          alphaShapeRadius: 4.5,
          maxInterpolationGap: 5.0,
          units: 'MM',
          executionBackend: 'CPU_MULTI_THREAD'
        });
        meshEngine.estimateNormals(meshSession.sessionId);
        meshEngine.reconstruct(meshSession.sessionId);
        meshEngine.optimize(meshSession.sessionId);
        meshEngine.validate(meshSession.sessionId);
        const meshDataset = meshEngine.commit(meshSession.sessionId);

        const healSession = healingEngine.prepare(meshDataset, {
          allowSmallHoleFilling: true,
          maxHoleEdgeCount: 12,
          protectPhysicalHoles: true,
          stitchTolerance: 0.1,
          reorientInvertedNormals: true,
          removeDegenerateTriangles: true,
          removeDuplicateVertices: true,
          maxAllowedVertexDisplacement: 0.5
        });
        healingEngine.detectDefects(healSession.sessionId);
        healingEngine.proposeRepairs(healSession.sessionId);
        healingEngine.executeRepairs(healSession.sessionId);
        healingEngine.validateRepairs(healSession.sessionId);
        const healedMesh = healingEngine.commit(healSession.sessionId);

        const surfSession = surfEngine.prepare(healedMesh);
        surfEngine.fit(surfSession, healedMesh, undefined, {
          fittingAlgorithm: 'HYBRID_RANSAC_LSQ',
          distanceToleranceMm: ransacTolerance,
          angleToleranceDegrees: smoothAngleThreshold,
          minPointsPerSurface: 50,
          maxRmseMm: maxRmseThreshold,
          continuityEnforcement: 'C1_CONTINUOUS'
        });
        surfEngine.evaluateContinuity(surfSession);
        const finalSession = surfEngine.commit(surfSession);

        setSession(finalSession);
        setFeedback(`Surface Reconstruction complete! Fitted ${finalSession.surfaces.length} analytical patches covering ${finalSession.reconstructedAreaMm2.toFixed(1)} mm².`);
      } catch (err: any) {
        setFeedback(`Surface fitting error: ${err.message}`);
      } finally {
        setIsRunning(false);
      }
    }, 300);
  };

  const handleRunGate321 = () => {
    const report = HardAcceptanceGate321.runGate();
    setGateReport(report);
    setActiveTab('GATE321');
    setFeedback(`Gate 321 evaluated: ${report.passed ? 'PASSED (100%)' : 'FAILED'} (${report.passedCount}/${report.totalAssertions} assertions passed).`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 flex flex-col gap-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Spline className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight">Analytical Surface Patch Fitting</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-full">
              PATCH-SECP-321
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fit analytical geometry patches (Planes, Cylinders, Spheres, Cones, Extrusions) onto healed meshes with C0/C1 continuity verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunGate321}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            <ShieldCheck className="w-4 h-4" />
            RUN GATE 321
          </button>
          <button
            onClick={handleRunSurfaceFitting}
            disabled={isRunning}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2"
          >
            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Fitting Surfaces...' : 'Run Surface Fitting'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-indigo-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>{feedback}</span>
          </div>
        </div>
      )}

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('FITTING')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'FITTING' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Sliders className="w-3.5 h-3.5" /> RANSAC Controls
        </button>
        <button
          onClick={() => setActiveTab('SURFACES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'SURFACES' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Spline className="w-3.5 h-3.5" /> Reconstructed Patches ({session ? session.surfaces.length : 0})
        </button>
        <button
          onClick={() => setActiveTab('INSPECTOR')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'INSPECTOR' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <Database className="w-3.5 h-3.5" /> Session Audit
        </button>
        <button
          onClick={() => setActiveTab('GATE321')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'GATE321' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:bg-slate-800/50'}`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Acceptance Gate 321
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'FITTING' && (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" /> RANSAC Fitting Tolerances
              </h3>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">RANSAC Inlier Distance (mm): {ransacTolerance} mm</label>
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={ransacTolerance}
                  onChange={(e) => setRansacTolerance(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Smooth Angle Threshold: {smoothAngleThreshold}°</label>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="5"
                  value={smoothAngleThreshold}
                  onChange={(e) => setSmoothAngleThreshold(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Max RMSE Limit (mm): {maxRmseThreshold} mm</label>
                <input
                  type="range"
                  min="0.005"
                  max="0.05"
                  step="0.005"
                  value={maxRmseThreshold}
                  onChange={(e) => setMaxRmseThreshold(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <button
                onClick={handleRunSurfaceFitting}
                disabled={isRunning}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2"
              >
                <Spline className="w-3.5 h-3.5" /> Execute Surface Reconstruction
              </button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-indigo-400" /> Analytical Surface Patch Overview
                </span>
                {session && (
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                    {session.surfaces.length} Patches Fitted
                  </span>
                )}
              </div>

              {session ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Total Surfaces</span>
                    <span className="text-sm font-bold font-mono text-white">{session.surfaces.length}</span>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Covered Area</span>
                    <span className="text-sm font-bold font-mono text-indigo-400">{session.reconstructedAreaMm2.toFixed(1)} mm²</span>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Mean RMSE</span>
                    <span className="text-sm font-bold font-mono text-amber-400">
                      {(session.surfaces.reduce((acc, s) => acc + s.metrics.rmseMm, 0) / Math.max(1, session.surfaces.length)).toFixed(4)} mm
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Continuity</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">C1 Smooth</span>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-xs">
                  Click 'Run Surface Fitting' to fit analytical planes, cylinders, and NURBS patches.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'SURFACES' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Analytical Surface Patches ({session?.surfaces.length || 0})</span>
            <span className="text-[11px] text-slate-400">Least-squares & RANSAC analytical fitting</span>
          </div>

          {session && session.surfaces.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {session.surfaces.map((s) => (
                <div key={s.surfaceId} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-indigo-400 font-mono">{s.surfaceId} ({s.type})</span>
                    <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                      Inliers: {(s.metrics.inlierRatio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>RMSE: <span className="font-mono text-amber-400">{s.metrics.rmseMm.toFixed(4)} mm</span></div>
                    <div>Max Dev: <span className="font-mono text-amber-400">{s.metrics.maxResidualMm.toFixed(4)} mm</span></div>
                    <div>Area: <span className="font-mono text-indigo-300">{s.sourceRegion.surfaceAreaMm2} mm²</span></div>
                    <div>Confidence: <span className="font-mono text-emerald-300">{(s.metrics.confidenceScore * 100).toFixed(0)}%</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              No surface patches fitted yet. Run the pipeline first.
            </div>
          )}
        </div>
      )}

      {activeTab === 'INSPECTOR' && (
        <div className="space-y-4">
          {session ? (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300">Session ID: {session.sessionId}</span>
                <span className="text-xs font-mono text-indigo-400">Status: {session.status}</span>
              </div>
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-indigo-300 overflow-x-auto max-h-[300px]">
                {JSON.stringify(session, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              No session data available. Run the pipeline first.
            </div>
          )}
        </div>
      )}

      {activeTab === 'GATE321' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Hard Acceptance Gate 321 Test Battery
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Verifies analytical surface patch fitting, RMSE thresholds, non-destructive mesh invariant, & Evidence Bus logging.
              </p>
            </div>
            <button
              onClick={handleRunGate321}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition"
            >
              Re-run Gate 321
            </button>
          </div>

          {gateReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gateReport.assertions.map((r) => (
                <div
                  key={r.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${r.passed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'}`}
                >
                  {r.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{r.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${r.passed ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'}`}>
                        {r.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-xl text-slate-500 text-xs">
              Click 'RUN GATE 321' to execute the formal verification suite.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
