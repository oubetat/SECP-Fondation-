/**
 * PATCH-SECP-043 — Assembly Workbench Workspace
 * Master Engineering Workbench for Assembly Constraints, Geometric References,
 * Degrees of Freedom (DOF) Analysis, Real OCCT Interference Detection,
 * Kinematics Preview, and Selective Assembly Rebuild.
 */

import React, { useState, useEffect } from 'react';
import { 
  Layers3, 
  AlertTriangle, 
  Scale, 
  Eye, 
  EyeOff, 
  Sliders, 
  CheckCircle2, 
  Box, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Anchor, 
  Settings, 
  Zap,
  Check,
  ShieldCheck,
  Minimize2,
  Activity,
  Compass,
  Play,
  Pause,
  Maximize2
} from 'lucide-react';

import { 
  AssemblyCore,
  AssemblyComponent,
  AssemblyConstraint,
  AssemblyConstraintType,
  ComponentDOF,
  AssemblySolverReport,
  AssemblyInterferenceReport,
  KinematicJoint,
  computeTransformMatrix
} from '../engine/assembly/AssemblyCore';
import { AssemblyKinematicsEngine } from '../engine/assembly/AssemblyKinematicsEngine';
import { HardAcceptanceGate043, AcceptanceGate043Report } from '../engine/validation/HardAcceptanceGate043';

interface AssemblyEnginePanelProps {
  onAssemblyComponentsChange?: (components: any[]) => void;
  explodedFactor?: number;
  onExplodedFactorChange?: (factor: number) => void;
  activeUnit?: string;
  defaultTab?: 'CONSTRAINTS' | 'COMPONENTS' | 'INTERFERENCE' | 'KINEMATICS' | 'GATE043';
}

export const AssemblyEnginePanel: React.FC<AssemblyEnginePanelProps> = ({
  onAssemblyComponentsChange,
  explodedFactor = 0,
  onExplodedFactorChange,
  activeUnit = 'mm',
  defaultTab = 'CONSTRAINTS'
}) => {
  // Core Assembly Manager
  const [assemblyCore] = useState(() => new AssemblyCore());

  // UI Tabs: 'CONSTRAINTS' | 'COMPONENTS' | 'INTERFERENCE' | 'KINEMATICS' | 'GATE043'
  const [activeTab, setActiveTab] = useState<'CONSTRAINTS' | 'COMPONENTS' | 'INTERFERENCE' | 'KINEMATICS' | 'GATE043'>(defaultTab);

  // Sync activeTab when defaultTab changes (switching sidebar tabs)
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Assembly State
  const [components, setComponents] = useState<AssemblyComponent[]>(() => assemblyCore.getAllInstances());
  const [constraints, setConstraints] = useState<AssemblyConstraint[]>(() => assemblyCore.getConstraints());
  const [selectedCompId, setSelectedCompId] = useState<string>('comp-piston-01');

  // Solver State & Telemetry
  const [solverReport, setSolverReport] = useState<AssemblySolverReport | null>(() => assemblyCore.solveConstraints());
  const [dofReport, setDofReport] = useState<{
    componentDofs: Record<string, ComponentDOF>;
    totalAssemblyDof: number;
    diagnostics: string[];
  }>(() => assemblyCore.calculateDegreesOfFreedom());

  // Interference State
  const [interferenceReport, setInterferenceReport] = useState<AssemblyInterferenceReport | null>(null);
  const [isCheckingInterference, setIsCheckingInterference] = useState<boolean>(false);

  // Kinematic Joints & Simulation State
  const [joints, setJoints] = useState<KinematicJoint[]>(() => assemblyCore.getJoints());
  const [selectedJointId, setSelectedJointId] = useState<string>('joint-crank-rev');
  const [isKinematicsPlaying, setIsKinematicsPlaying] = useState<boolean>(false);
  const [jointSliderPos, setJointSliderPos] = useState<number>(0);

  // Gate 043 Report State
  const [gateReport, setGateReport] = useState<AcceptanceGate043Report | null>(null);
  const [isRunningGate, setIsRunningGate] = useState<boolean>(false);

  // Form states for creating custom constraints
  const [newConstraintName, setNewConstraintName] = useState<string>('New Cylindrical Concentricity');
  const [newConstraintType, setNewConstraintType] = useState<AssemblyConstraintType>('CONCENTRIC');
  const [compAId, setCompAId] = useState<string>('comp-piston-01');
  const [compBId, setCompBId] = useState<string>('comp-block-01');
  const [offsetMm, setOffsetMm] = useState<number>(0);
  const [angleDeg, setAngleDeg] = useState<number>(0);

  // Form states for adding instance from Part definition
  const [newInstanceName, setNewInstanceName] = useState<string>('Idler Gear B');
  const [selectedPartId, setSelectedPartId] = useState<string>('part-spur-gear');
  const [initX, setInitX] = useState<number>(120);
  const [initY, setInitY] = useState<number>(-90);
  const [initZ, setInitZ] = useState<number>(120);

  // Sync state helpers
  const refreshAssembly = () => {
    const allComps = assemblyCore.getAllInstances();
    const allConstrs = assemblyCore.getConstraints();
    setComponents([...allComps]);
    setConstraints([...allConstrs]);
    
    const solveRes = assemblyCore.solveConstraints();
    setSolverReport(solveRes);

    const dofRes = assemblyCore.calculateDegreesOfFreedom();
    setDofReport(dofRes);

    if (onAssemblyComponentsChange) {
      onAssemblyComponentsChange(allComps);
    }
  };

  // Live Kinematics Animation Loop
  useEffect(() => {
    let animId: number;
    if (isKinematicsPlaying) {
      const loop = () => {
        const activeJoint = joints.find(j => j.jointId === selectedJointId);
        if (activeJoint) {
          const nextPos = (activeJoint.currentPosition + 2) % (activeJoint.motionRange.max || 360);
          setJointSliderPos(nextPos);
          
          const parent = assemblyCore.getInstance(activeJoint.parentComponentId);
          const child = assemblyCore.getInstance(activeJoint.childComponentId);
          if (parent && child) {
            AssemblyKinematicsEngine.evaluateJointState(activeJoint, nextPos, parent, child);
            setComponents([...assemblyCore.getAllInstances()]);
          }
        }
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [isKinematicsPlaying, selectedJointId, joints, assemblyCore]);

  // Run Solver manually
  const handleSolve = () => {
    const res = assemblyCore.solveConstraints();
    setSolverReport(res);
    setDofReport(assemblyCore.calculateDegreesOfFreedom());
    setComponents([...assemblyCore.getAllInstances()]);
  };

  // Run OCCT Interference Detection
  const handleRunInterference = async () => {
    setIsCheckingInterference(true);
    try {
      const res = await assemblyCore.detectInterference();
      setInterferenceReport(res);
    } catch (e) {
      console.error('Interference detection error:', e);
    } finally {
      setIsCheckingInterference(false);
    }
  };

  // Run Hard Acceptance Gate 043
  const handleRunGate043 = async () => {
    setIsRunningGate(true);
    try {
      const res = await HardAcceptanceGate043.runGateVerification();
      setGateReport(res);
    } catch (e) {
      console.error('Gate 043 execution error:', e);
    } finally {
      setIsRunningGate(false);
    }
  };

  // Add a new Constraint
  const handleAddConstraint = (e: React.FormEvent) => {
    e.preventDefault();
    if (compAId === compBId) return;

    const newConstraint: AssemblyConstraint = {
      constraintId: `constr-${Date.now().toString().slice(-4)}`,
      assemblyId: 'asm-root-001',
      name: newConstraintName,
      componentA: compAId,
      componentB: compBId,
      geometryRefA: {
        componentId: compAId,
        topologyType: newConstraintType === 'CONCENTRIC' ? 'AXIS' : 'FACE',
        topologyIndex: 0,
        geometricSignature: `ref_${newConstraintType.toLowerCase()}_${compAId}`
      },
      geometryRefB: {
        componentId: compBId,
        topologyType: newConstraintType === 'CONCENTRIC' ? 'AXIS' : 'FACE',
        topologyIndex: 0,
        geometricSignature: `ref_${newConstraintType.toLowerCase()}_${compBId}`
      },
      type: newConstraintType,
      parameters: {
        offsetMm: offsetMm,
        angleDeg: angleDeg,
        tolerance: 1e-4
      },
      status: 'UNRESOLVED',
      solverError: 0,
      revision: 1,
      suppressionState: 'ACTIVE'
    };

    assemblyCore.addConstraint(newConstraint);
    refreshAssembly();
  };

  // Add a new Instance referencing a Part definition
  const handleAddInstance = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `comp-inst-${Date.now().toString().slice(-4)}`;
    const newInst: AssemblyComponent = {
      instanceId: newId,
      partId: selectedPartId,
      name: newInstanceName,
      placementTransform: {
        position: { x: initX, y: initY, z: initZ },
        rotation: { x: 0, y: 0, z: 0 },
        matrix: computeTransformMatrix({ x: initX, y: initY, z: initZ }, { x: 0, y: 0, z: 0 })
      },
      worldTransform: {
        position: { x: initX, y: initY, z: initZ },
        rotation: { x: 0, y: 0, z: 0 },
        matrix: computeTransformMatrix({ x: initX, y: initY, z: initZ }, { x: 0, y: 0, z: 0 })
      },
      suppressed: false,
      fixed: false,
      colorHex: '#' + Math.floor(Math.random() * 16777215).toString(16),
      visible: true,
      revision: 1
    };

    assemblyCore.addInstance(newInst);
    setSelectedCompId(newId);
    refreshAssembly();
  };

  // Mass Properties
  const massProps = assemblyCore.calculateMassProperties();
  const selectedComp = components.find(c => c.instanceId === selectedCompId);
  const selectedCompDof = selectedCompId ? dofReport.componentDofs[selectedCompId] : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
              <Layers3 className="w-5 h-5 text-amber-400" /> PATCH-SECP-043 — Assembly Constraints & Kinematics Core
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
              REAL OCCT KERNEL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Formal Multi-Body Constraints (Mate, Align, Concentric, Distance, Angle, Parallel, Perpendicular, Lock), Degrees of Freedom (DOF), Geometric Signatures, and Real OCCT Interference Detection.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSolve}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-Solve Assembly
          </button>
          <button
            onClick={handleRunGate043}
            disabled={isRunningGate}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> {isRunningGate ? 'Running Gate 043...' : 'Run Gate 043'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('CONSTRAINTS')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'CONSTRAINTS' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Anchor className="w-3.5 h-3.5" /> Constraints & DOF ({constraints.length})
        </button>
        <button
          onClick={() => setActiveTab('COMPONENTS')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'COMPONENTS' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Box className="w-3.5 h-3.5" /> Component Instances ({components.length})
        </button>
        <button
          onClick={() => setActiveTab('INTERFERENCE')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'INTERFERENCE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> OCCT Interference Engine
        </button>
        <button
          onClick={() => setActiveTab('KINEMATICS')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'KINEMATICS' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Kinematic Preview ({joints.length})
        </button>
        <button
          onClick={() => setActiveTab('GATE043')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'GATE043' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Hard Acceptance Gate 043
        </button>
      </div>

      {/* Solver Summary Banner */}
      {solverReport && (
        <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-4 text-xs ${
          solverReport.status === 'SOLVED' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' :
          solverReport.status === 'UNDER_CONSTRAINED' ? 'bg-amber-950/20 border-amber-500/30 text-amber-300' :
          solverReport.status === 'OVER_CONSTRAINED' ? 'bg-purple-950/20 border-purple-500/30 text-purple-300' :
          'bg-rose-950/20 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            <span className="font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-slate-900 border border-current">
              STATUS: {solverReport.status}
            </span>
            <span>Satisfied: <strong className="font-mono">{solverReport.satisfiedConstraintsCount} / {solverReport.totalActiveConstraintsCount}</strong></span>
            <span>Total Assembly DOF: <strong className="font-mono">{solverReport.totalAssemblyDof}</strong></span>
            <span>Residual: <strong className="font-mono">{solverReport.convergenceResidual.toExponential(3)}</strong></span>
            <span>Iterations: <strong className="font-mono">{solverReport.iterationsTaken}</strong></span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Assembly Mass: <strong className="text-white">{massProps.totalMassKg} kg</strong></span>
            <span>COG: <strong className="text-white">({massProps.centerOfGravity.x}, {massProps.centerOfGravity.y}, {massProps.centerOfGravity.z})</strong></span>
          </div>
        </div>
      )}

      {/* Tab 1: Constraints & DOF */}
      {activeTab === 'CONSTRAINTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Constraints List */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Constraints ({constraints.length})</span>
            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
              {constraints.map(c => {
                const compA = components.find(cmp => cmp.instanceId === c.componentA);
                const compB = components.find(cmp => cmp.instanceId === c.componentB);
                return (
                  <div key={c.constraintId} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{c.name || c.constraintId}</span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        c.status === 'SATISFIED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {c.type} : {c.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{compA?.name || c.componentA} &harr; {compB?.name || c.componentB}</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {c.parameters.offsetMm !== undefined ? `Offset: ${c.parameters.offsetMm}mm` : ''}
                        {c.parameters.angleDeg !== undefined ? `Angle: ${c.parameters.angleDeg}°` : ''}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-slate-500 border-t border-slate-900 pt-1 flex justify-between">
                      <span>Sig A: {c.geometryRefA.geometricSignature}</span>
                      <span>Residual: {c.solverError.toFixed(4)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DOF Analysis Inspector */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Degrees of Freedom (DOF) Inspector</span>
            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
              {components.map(comp => {
                const dof = dofReport.componentDofs[comp.instanceId];
                if (!dof) return null;
                return (
                  <div key={comp.instanceId} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: comp.colorHex }} />
                        <span className="font-semibold text-slate-200">{comp.name}</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        dof.remainingDofCount === 0 ? 'bg-slate-800 text-slate-300' : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {dof.remainingDofCount} DOF FREE
                      </span>
                    </div>

                    {/* 6-DOF Grid Badges */}
                    <div className="grid grid-cols-6 gap-1 text-[10px] font-mono text-center">
                      <div className={`p-1 rounded border ${dof.translation.tx ? 'bg-amber-950/40 text-amber-400 border-amber-800' : 'bg-slate-900 text-slate-600 border-slate-850'}`}>Tx</div>
                      <div className={`p-1 rounded border ${dof.translation.ty ? 'bg-amber-950/40 text-amber-400 border-amber-800' : 'bg-slate-900 text-slate-600 border-slate-850'}`}>Ty</div>
                      <div className={`p-1 rounded border ${dof.translation.tz ? 'bg-amber-950/40 text-amber-400 border-amber-800' : 'bg-slate-900 text-slate-600 border-slate-850'}`}>Tz</div>
                      <div className={`p-1 rounded border ${dof.rotation.rx ? 'bg-amber-950/40 text-amber-400 border-amber-800' : 'bg-slate-900 text-slate-600 border-slate-850'}`}>Rx</div>
                      <div className={`p-1 rounded border ${dof.rotation.ry ? 'bg-amber-950/40 text-amber-400 border-amber-800' : 'bg-slate-900 text-slate-600 border-slate-850'}`}>Ry</div>
                      <div className={`p-1 rounded border ${dof.rotation.rz ? 'bg-amber-950/40 text-amber-400 border-amber-800' : 'bg-slate-900 text-slate-600 border-slate-850'}`}>Rz</div>
                    </div>

                    <div className="text-[10px] text-slate-400">
                      {dof.statusMessage}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Constraint Form */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Assembly Constraint
            </span>
            <form onSubmit={handleAddConstraint} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Constraint Name</label>
                <input
                  type="text"
                  value={newConstraintName}
                  onChange={e => setNewConstraintName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Constraint Type</label>
                  <select
                    value={newConstraintType}
                    onChange={e => setNewConstraintType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                  >
                    <option value="MATE">MATE (Planar Coincident)</option>
                    <option value="ALIGN">ALIGN (Directional)</option>
                    <option value="CONCENTRIC">CONCENTRIC (Cylindrical)</option>
                    <option value="DISTANCE">DISTANCE (Offset)</option>
                    <option value="ANGLE">ANGLE (Orientation)</option>
                    <option value="PARALLEL">PARALLEL</option>
                    <option value="PERPENDICULAR">PERPENDICULAR</option>
                    <option value="LOCK">LOCK (Rigid)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Offset / Angle</label>
                  <input
                    type="number"
                    value={offsetMm}
                    onChange={e => setOffsetMm(Number(e.target.value))}
                    placeholder="Offset mm"
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Component A</label>
                  <select
                    value={compAId}
                    onChange={e => setCompAId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                  >
                    {components.map(c => <option key={c.instanceId} value={c.instanceId}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Component B</label>
                  <select
                    value={compBId}
                    onChange={e => setCompBId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                  >
                    {components.map(c => <option key={c.instanceId} value={c.instanceId}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
              >
                Apply Constraint & Solve
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Component Instances */}
      {activeTab === 'COMPONENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instantiated Components ({components.length})</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {components.map(comp => (
                <div
                  key={comp.instanceId}
                  onClick={() => setSelectedCompId(comp.instanceId)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                    comp.instanceId === selectedCompId ? 'bg-amber-950/20 border-amber-500/50' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: comp.colorHex }} />
                      <span className="text-xs font-bold text-slate-200">{comp.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {comp.fixed && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                          FIXED
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          assemblyCore.toggleInstanceVisibility(comp.instanceId);
                          refreshAssembly();
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        {comp.visible !== false ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 grid grid-cols-2 gap-1 border-t border-slate-900 pt-1.5">
                    <span>Part Ref: <strong className="text-slate-300">{comp.partId}</strong></span>
                    <span>Revision: <strong className="text-slate-300">v{comp.revision || 1}</strong></span>
                    <span>World X,Y,Z:</span>
                    <span className="text-slate-300 font-bold">
                      ({comp.worldTransform.position.x.toFixed(1)}, {comp.worldTransform.position.y.toFixed(1)}, {comp.worldTransform.position.z.toFixed(1)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Component Instance Form */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-3">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Instantiate from Part Blueprint
            </span>
            <form onSubmit={handleAddInstance} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Instance Name</label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={e => setNewInstanceName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Select Part Definition Template</label>
                <select
                  value={selectedPartId}
                  onChange={e => setSelectedPartId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                >
                  {assemblyCore.getAllParts().map(p => (
                    <option key={p.partId} value={p.partId}>{p.name} ({p.partId})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">X mm</label>
                  <input
                    type="number"
                    value={initX}
                    onChange={e => setInitX(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Y mm</label>
                  <input
                    type="number"
                    value={initY}
                    onChange={e => setInitY(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Z mm</label>
                  <input
                    type="number"
                    value={initZ}
                    onChange={e => setInitZ(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
              >
                Instantiate Component
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: OCCT Interference Engine */}
      {activeTab === 'INTERFERENCE' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pairwise B-Rep Boolean Collision Analysis (Real OCCT)
            </span>
            <button
              onClick={handleRunInterference}
              disabled={isCheckingInterference}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {isCheckingInterference ? 'Running OCCT Boolean Intersection...' : 'Check Assembly Interference'}
            </button>
          </div>

          {interferenceReport ? (
            <div className="flex flex-col gap-3">
              <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                interferenceReport.status === 'NO_INTERFERENCE' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' :
                interferenceReport.status === 'TOUCHING' ? 'bg-sky-950/20 border-sky-500/30 text-sky-400' :
                'bg-rose-950/30 border-rose-500/40 text-rose-400'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold uppercase px-2 py-1 bg-slate-900 rounded border border-current">
                    RESULT: {interferenceReport.status}
                  </span>
                  <span>Evaluated Pairs: <strong>{interferenceReport.evaluatedPairsCount}</strong></span>
                  <span>Clashes Detected: <strong>{interferenceReport.clashes.length}</strong></span>
                  <span>Total Interference Volume: <strong>{interferenceReport.totalClashVolumeMm3} mm³</strong></span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">Kernel: {interferenceReport.kernelUsed}</span>
              </div>

              {/* Clash items breakdown */}
              {interferenceReport.clashes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {interferenceReport.clashes.map(clash => (
                    <div key={clash.id} className="p-3 bg-slate-950 rounded-lg border border-rose-900/50 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-300">{clash.componentAName} &times; {clash.componentBName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded font-bold">
                          {clash.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{clash.clashDetails}</p>
                      <div className="font-mono text-[10px] text-slate-500 flex justify-between border-t border-slate-900 pt-1">
                        <span>Clash Volume: <strong className="text-slate-300">{clash.intersectionVolumeMm3} mm³</strong></span>
                        <span>Centroid: ({clash.intersectionLocation.x}, {clash.intersectionLocation.y}, {clash.intersectionLocation.z})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-emerald-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  Zero mechanical interference detected! Clearances nominal across all component instances.
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
              Click &quot;Check Assembly Interference&quot; to perform true 3D B-Rep Boolean Intersect on all active assembly component pairs using OpenCASCADE.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Kinematic Preview */}
      {activeTab === 'KINEMATICS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kinematic Mechanism Joints ({joints.length})</span>
            <div className="flex flex-col gap-2">
              {joints.map(joint => (
                <div
                  key={joint.jointId}
                  onClick={() => {
                    setSelectedJointId(joint.jointId);
                    setJointSliderPos(joint.currentPosition);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition flex flex-col gap-1 text-xs ${
                    joint.jointId === selectedJointId ? 'bg-amber-950/20 border-amber-500/50' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{joint.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-900 border border-slate-750 text-amber-400 rounded">
                      {joint.type} ({joint.dofRemaining} DOF)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Range: [{joint.motionRange.min}, {joint.motionRange.max}] | Pos: {joint.currentPosition.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Joint Playback & Scrubbing Controller */}
          <div className="lg:col-span-2 p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-slate-200">Joint Motion Control & Forward Kinematics</span>
              <button
                onClick={() => setIsKinematicsPlaying(!isKinematicsPlaying)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition ${
                  isKinematicsPlaying ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {isKinematicsPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isKinematicsPlaying ? 'Pause Mechanism' : 'Play Kinematics Loop'}
              </button>
            </div>

            {/* Slider */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Joint Displacement / Angle Scrub</span>
                <span className="font-mono text-amber-400 font-bold">{jointSliderPos.toFixed(1)} {selectedJointId.includes('rev') ? 'deg' : 'mm'}</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={jointSliderPos}
                onChange={e => {
                  const val = Number(e.target.value);
                  setJointSliderPos(val);
                  const activeJoint = joints.find(j => j.jointId === selectedJointId);
                  if (activeJoint) {
                    const parent = assemblyCore.getInstance(activeJoint.parentComponentId);
                    const child = assemblyCore.getInstance(activeJoint.childComponentId);
                    if (parent && child) {
                      AssemblyKinematicsEngine.evaluateJointState(activeJoint, val, parent, child);
                      setComponents([...assemblyCore.getAllInstances()]);
                    }
                  }
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-[11px] text-slate-400">
              Kinematics Engine evaluates forward kinematics, enforces joint limits, and maps relative spatial transformations across the component instance hierarchy in real time.
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Hard Acceptance Gate 043 */}
      {activeTab === 'GATE043' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Hard Acceptance Gate 043 Verification Suite</h3>
              <p className="text-xs text-slate-400 mt-0.5">Automated validation of all 13 core requirements for PATCH-SECP-043.</p>
            </div>
            <button
              onClick={handleRunGate043}
              disabled={isRunningGate}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" /> {isRunningGate ? 'Executing Verification...' : 'Execute Gate 043 Suite'}
            </button>
          </div>

          {gateReport && (
            <div className="flex flex-col gap-4 text-xs">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                gateReport.status === 'PASS' ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400' : 'bg-rose-950/30 border-rose-500/40 text-rose-400'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold px-3 py-1 bg-slate-900 rounded border border-current">
                    OVERALL STATUS: {gateReport.status}
                  </span>
                  <span>Kernel: <strong>{gateReport.kernel}</strong></span>
                  <span>Mock Fallback: <strong>{gateReport.mockFallback ? 'TRUE (FAIL)' : 'FALSE (PASS)'}</strong></span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">{gateReport.timestamp}</span>
              </div>

              {/* Grid of Verifications */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {Object.entries(gateReport.verifications).map(([key, val]) => (
                  <div key={key} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-mono">{key}</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      val === 'PASS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Verification Logs */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-1 max-h-[220px] overflow-y-auto font-mono text-[10px] text-slate-400">
                <span className="text-slate-300 font-bold border-b border-slate-900 pb-1 mb-1">Execution Stage Logs:</span>
                {gateReport.stagesLog.map((log, i) => (
                  <div key={i} className="leading-relaxed">{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
