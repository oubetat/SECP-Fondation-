import React, { useState, useMemo } from 'react';
import {
  Layers,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  Play,
  Download,
  ShieldCheck,
  Compass,
  Gauge,
  Sliders,
  RefreshCw,
  GitCommit,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  HardAcceptanceGate239,
  HardAcceptanceGate239Report,
  ContactSolverEvidence,
  ContactDetector,
  ContactConstraint,
  CoulombFrictionModel,
  ContactSurface,
  ContactPair,
  ContactPairData
} from '../../engine/fem/contact';

export const ContactSolverWorkspace: React.FC = () => {
  // Solver controls
  const [penaltyStiffnessExponent, setPenaltyStiffnessExponent] = useState<number | null>(null);
  const [frictionCoeff, setFrictionCoeff] = useState<number | null>(null);
  const [enforcementMethod, setEnforcementMethod] = useState<'PENALTY' | 'AUGMENTED_LAGRANGIAN' | 'LAGRANGE_MULTIPLIER'>('PENALTY');
  const [slaveDisplacementY, setSlaveDisplacementY] = useState<number | null>(null);
  const [slaveDisplacementX, setSlaveDisplacementX] = useState<number | null>(null);

  // Gate report state
  const [gateReport, setGateReport] = useState<HardAcceptanceGate239Report | null>(null);
  const [isExecutingGate, setIsExecutingGate] = useState<boolean>(false);

  const penaltyStiffness = penaltyStiffnessExponent !== null ? Math.pow(10, penaltyStiffnessExponent) : 0;

  // Compute live single-point contact simulation
  const simulationResult = useMemo(() => {
    if (penaltyStiffnessExponent === null || frictionCoeff === null || slaveDisplacementY === null || slaveDisplacementX === null) {
      return null;
    }
    // Initial setup: Master surface at y=1.0, Slave at y = 1.0 + 0.002 + slaveDisplacementY
    const gapInitial = 0.002;
    const currentY = 1.0 + gapInitial + slaveDisplacementY;
    const currentX = slaveDisplacementX;

    const slaveSurface = new ContactSurface({
      surfaceId: 's_slave',
      bodyId: 'body_1',
      nodes: [{ id: 's1', originalCoords: [0, 1.0 + gapInitial], currentCoords: [currentX, currentY] }],
      facets: [{ facetId: 'f_s', nodeIds: ['s1'] }],
      role: 'SLAVE',
      normalConvention: 'OUTWARD'
    });

    const masterSurface = new ContactSurface({
      surfaceId: 's_master',
      bodyId: 'body_2',
      nodes: [
        { id: 'm1', originalCoords: [-1, 1.0], currentCoords: [-1, 1.0] },
        { id: 'm2', originalCoords: [1, 1.0], currentCoords: [1, 1.0] }
      ],
      facets: [{ facetId: 'f_m', nodeIds: ['m1', 'm2'] }],
      role: 'MASTER',
      normalConvention: 'OUTWARD'
    });

    const pairData: ContactPairData = {
      pairId: 'pair_demo',
      slaveSurfaceId: slaveSurface.surfaceId,
      masterSurfaceId: masterSurface.surfaceId,
      formulation: 'MASTER_SLAVE',
      enforcement: enforcementMethod,
      normalBehavior: 'FRICTIONLESS_UNILATERAL',
      tangentialBehavior: frictionCoeff > 0 ? 'FRICTIONAL_COULOMB' : 'FRICTIONLESS',
      parameters: {
        penaltyStiffness,
        searchTolerance: 0.05,
        penetrationTolerance: 1e-4,
        frictionCoefficient: frictionCoeff
      }
    };

    const pair = new ContactPair(pairData, slaveSurface, masterSurface);
    const candidates = ContactDetector.broadPhaseSearch(pair);
    const { projections } = ContactDetector.narrowPhaseSearch(pair, candidates);

    const proj = projections.get('s1');
    const gap = proj ? proj.gap : currentY - 1.0;
    const constraint = ContactConstraint.evaluateNormalConstraint(gap, pair.parameters, enforcementMethod);

    const frictionModel = new CoulombFrictionModel(frictionCoeff, penaltyStiffness * 0.1);
    const tangRes = frictionModel.computeTangentialTraction(
      constraint.normalPressure,
      [currentX, 0],
      [0, 0]
    );

    let stateMode = 'OPEN';
    if (gap > 0) {
      stateMode = 'OPEN';
    } else if (frictionCoeff > 0) {
      stateMode = tangRes.stateMode;
    } else {
      stateMode = gap < -1e-4 ? 'PENETRATING' : 'CONTACT';
    }

    // Generate force-displacement curve points
    const curvePoints = [];
    for (let d = -0.015; d <= 0.005; d += 0.001) {
      const g = d; // gap
      const c = ContactConstraint.evaluateNormalConstraint(g, pair.parameters, enforcementMethod);
      const ft = frictionCoeff * c.normalPressure;
      curvePoints.push({
        gapMm: (g * 1000).toFixed(2),
        normalForce: (c.normalPressure / 1000).toFixed(2), // kN
        frictionLimit: (ft / 1000).toFixed(2)
      });
    }

    return {
      gap,
      penetration: constraint.penetration,
      normalPressure: constraint.normalPressure,
      tangentialTraction: tangRes.tangentialTraction[0],
      stateMode,
      frictionLimit: tangRes.frictionLimit,
      complementarityViolation: constraint.complementarityViolation,
      curvePoints,
      normal: proj ? proj.normal : [0, 1]
    };
  }, [penaltyStiffnessExponent, frictionCoeff, enforcementMethod, slaveDisplacementY, slaveDisplacementX]);

  const runGate239 = () => {
    setIsExecutingGate(true);
    setTimeout(() => {
      const report = HardAcceptanceGate239.evaluateGate();
      setGateReport(report);
      setIsExecutingGate(false);
    }, 150);
  };

  const exportEvidence = () => {
    const pkg = ContactSolverEvidence.generateEvidencePackage();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pkg, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "PATCH-239-Contact-Evidence.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div id="contact-solver-workspace" className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Header Banner */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Nonlinear Contact Solver Engine
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
                PATCH-239
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Surface-to-Surface • Penalty & Augmented Lagrangian • Coulomb Friction Return Mapping • Gate 239
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="run-gate-239-btn"
            onClick={runGate239}
            disabled={isExecutingGate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isExecutingGate ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>Run Gate 239 Battery</span>
          </button>

          <button
            id="export-evidence-239-btn"
            onClick={exportEvidence}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Evidence JSON</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
        {/* Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Contact Status</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white flex items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded font-bold ${
                !simulationResult ? 'bg-slate-800 text-slate-500' :
                simulationResult.stateMode === 'OPEN' ? 'bg-slate-800 text-slate-400' :
                simulationResult.stateMode === 'STICK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                simulationResult.stateMode === 'SLIP' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {simulationResult ? simulationResult.stateMode : 'UNAVAILABLE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Normal law: Unilateral • Gap: {simulationResult ? (simulationResult.gap * 1000).toFixed(3) : '---'} mm
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Normal Contact Force (F_n)</span>
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-black text-white">
              {simulationResult ? (simulationResult.normalPressure / 1000).toFixed(2) : '---'} <span className="text-xs font-normal text-slate-400">kN</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Penetration δ: {simulationResult ? (simulationResult.penetration * 1000).toFixed(3) : '---'} mm
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Tangential Friction Force (F_t)</span>
              <Compass className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-white">
              {simulationResult ? (Math.abs(simulationResult.tangentialTraction) / 1000).toFixed(2) : '---'} <span className="text-xs font-normal text-slate-400">kN</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Coulomb Limit μF_n: {simulationResult ? (simulationResult.frictionLimit / 1000).toFixed(2) : '---'} kN
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
              <span>Complementarity Error</span>
              <Gauge className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-black text-white">
              {simulationResult ? simulationResult.complementarityViolation.toExponential(3) : '---'}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Kuhn-Tucker Residual |g_n · λ_n|
            </p>
          </div>
        </div>

        {/* Workspace Main Panels */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel: Parameter Controls */}
          <div className="col-span-12 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Contact Parameters & Kinematics
              </h2>
            </div>

            {/* Penalty Stiffness Control */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Penalty Stiffness (k_p)</span>
                <span className="text-amber-400 font-mono">{penaltyStiffnessExponent !== null ? `10^${penaltyStiffnessExponent}` : 'UNAVAILABLE'} N/m</span>
              </div>
              <input
                type="range"
                min="6"
                max="10"
                step="1"
                value={penaltyStiffnessExponent ?? 6}
                onChange={e => setPenaltyStiffnessExponent(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Controls normal force constraint stiffness (F_n = k_p · δ)
              </p>
            </div>

            {/* Friction Coefficient Control */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Friction Coefficient (μ)</span>
                <span className="text-emerald-400 font-mono">{frictionCoeff !== null ? frictionCoeff.toFixed(2) : 'UNAVAILABLE'}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={frictionCoeff ?? 0}
                onChange={e => setFrictionCoeff(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Coulomb friction limit ||F_t|| ≤ μ · F_n
              </p>
            </div>

            {/* Enforcement Method */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Constraint Enforcement Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['PENALTY', 'AUGMENTED_LAGRANGIAN', 'LAGRANGE_MULTIPLIER'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setEnforcementMethod(m)}
                    className={`py-2 px-2 text-[10px] font-bold rounded-lg border transition-all ${
                      enforcementMethod === m
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {m === 'AUGMENTED_LAGRANGIAN' ? 'AUG LAG' : m}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical Displacement (Penetration control) */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Vertical Kinematic Shift (Δy)</span>
                <span className="text-cyan-400 font-mono">{slaveDisplacementY !== null ? (slaveDisplacementY * 1000).toFixed(1) : 'UNAVAILABLE'} mm</span>
              </div>
              <input
                type="range"
                min="-0.015"
                max="0.005"
                step="0.0005"
                value={slaveDisplacementY ?? 0}
                onChange={e => setSlaveDisplacementY(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Penetration</span>
                <span>Separation</span>
              </div>
            </div>

            {/* Lateral Displacement (Tangential Slip control) */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Lateral Tangential Shift (Δx)</span>
                <span className="text-indigo-400 font-mono">{slaveDisplacementX !== null ? (slaveDisplacementX * 1000).toFixed(1) : 'UNAVAILABLE'} mm</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.01"
                step="0.0005"
                value={slaveDisplacementX ?? 0}
                onChange={e => setSlaveDisplacementX(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>

          {/* Right Panel: Diagrams & Curves */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Visual Canvas Diagram */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                <span>Contact Interaction Visualizer</span>
                <span className="text-xs text-slate-400 font-mono font-normal">
                  Master Surface: y = 1.0 m • Slave Surface: y = {simulationResult ? (1.0 + 0.002 + slaveDisplacementY!).toFixed(4) : '---'} m
                </span>
              </h3>

              <div className="h-56 bg-slate-950 rounded-xl border border-slate-800 relative flex items-center justify-center overflow-hidden p-4">
                {/* Master Body */}
                <div className="absolute bottom-6 left-12 right-12 h-20 bg-slate-850 border-t-2 border-cyan-500/60 rounded-b-md flex items-center justify-center">
                  <span className="text-xs font-semibold text-cyan-400 tracking-wider">
                    MASTER SURFACE (RIGID / DEFORMABLE FACET)
                  </span>
                </div>

                {/* Slave Body */}
                {simulationResult && (
                  <div
                    className="absolute w-48 h-16 bg-slate-800/90 border-2 border-amber-500/80 rounded-t-md flex items-center justify-center transition-all duration-150 shadow-2xl"
                    style={{
                      bottom: `${80 - (slaveDisplacementY! * 2000)}px`,
                      transform: `translateX(${slaveDisplacementX! * 3000}px)`
                    }}
                  >
                    <div className="text-center">
                      <span className="text-xs font-bold text-amber-300 block">SLAVE BODY</span>
                      <span className="text-[10px] text-slate-400">Node s1</span>
                    </div>
                  </div>
                )}

                {/* Force Arrow Indicators if contacting */}
                {simulationResult && simulationResult.normalPressure > 0 && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                    <div className="w-1 bg-gradient-to-t from-red-500 to-amber-400 h-14 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-amber-400 bg-slate-900/90 px-2 py-0.5 rounded border border-amber-500/30">
                      F_n = {(simulationResult.normalPressure / 1000).toFixed(1)} kN
                    </span>
                  </div>
                )}

                {!simulationResult && (
                  <div className="text-slate-500 text-xs font-mono animate-pulse">
                    WAITING FOR KINEMATIC INPUT...
                  </div>
                )}
              </div>
            </div>

            {/* Load-Displacement & Friction Curve */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-1">
                Normal Contact Force vs. Gap Response Curve
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Response behavior across penetration (gap &lt; 0) and separation (gap &gt; 0)
              </p>
              <div className="h-56">
                {simulationResult ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simulationResult.curvePoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="gapMm" stroke="#64748b" tick={{ fontSize: 10 }} label={{ value: 'Gap g_n (mm)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} label={{ value: 'Force (kN)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                      <Line type="monotone" dataKey="normalForce" name="Normal Force F_n (kN)" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="frictionLimit" name="Coulomb Friction Limit μF_n (kN)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-600 text-xs font-mono uppercase tracking-widest bg-slate-950/30">
                    Analytical Path Unavailable
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gate 239 Qualification Test Results */}
        {gateReport && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${gateReport.verdict === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {gateReport.verdict === 'VERIFIED' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Hard Acceptance Gate 239 Report — {gateReport.verdict}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Passed {gateReport.passedChecks} / {gateReport.totalChecks} Qualification Tests
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {gateReport.checks.map(c => (
                <div key={c.testId} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">{c.testId}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {c.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200">{c.name}</h4>
                  <p className="text-[11px] text-slate-400">{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
