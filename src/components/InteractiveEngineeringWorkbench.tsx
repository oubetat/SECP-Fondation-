import React, { useState, useEffect } from 'react';
import { ProductionUIBridge } from '../engine/integration/ProductionUIBridge';
import { ProductionOperationType, ProductionExecutionResult } from '../engine/integration/contracts/ProductionCommandContracts';
import { EnterprisePLMPanel } from './EnterprisePLMPanel';
import {
  Play,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Activity,
  Layers,
  Wind,
  Layers3,
  Sliders,
  CheckCircle2,
  Terminal,
  Clock,
  Database,
  Eye,
  FileCheck,
  AlertTriangle
} from 'lucide-react';

export const InteractiveEngineeringWorkbench: React.FC = () => {
  const bridge = ProductionUIBridge.getInstance();
  const [selectedOp, setSelectedOp] = useState<ProductionOperationType>('CLASS_A_SURFACING_ZEBRA');
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeResult, setActiveResult] = useState<ProductionExecutionResult | undefined>(undefined);

  // Config parameters
  const [loadN, setLoadN] = useState<number>(15000);
  const [inletVel, setInletVel] = useState<number>(10.0);
  const [stripeFreq, setStripeFreq] = useState<number>(16);
  const [leadAngle, setLeadAngle] = useState<number>(7.5);
  const [tiltAngle, setTiltAngle] = useState<number>(3.0);
  const [sewingTol, setSewingTol] = useState<number>(0.001);

  useEffect(() => {
    const unsubscribe = bridge.subscribe(() => {
      setIsExecuting(bridge.getIsExecuting());
      setActiveResult(bridge.getLatestExecution(selectedOp));
    });
    // Set initial selection
    bridge.setSelection({ selectedOperation: selectedOp });
    setActiveResult(bridge.getLatestExecution(selectedOp));
    return () => unsubscribe();
  }, [selectedOp]);

  const handleOpChange = (op: ProductionOperationType) => {
    setSelectedOp(op);
    bridge.setSelection({ selectedOperation: op });
    setActiveResult(bridge.getLatestExecution(op));
  };

  const handleRunCommand = async () => {
    const config: any = {
      loadN,
      inletVelocityMS: inletVel,
      stripeFrequency: stripeFreq,
      leadAngleDeg: leadAngle,
      tiltAngleDeg: tiltAngle,
      sewingToleranceMm: sewingTol
    };
    const res = await bridge.dispatchProductionOperation(selectedOp, config);
    setActiveResult(res);
  };

  const opIcons: Record<ProductionOperationType, any> = {
    CLASS_A_SURFACING_ZEBRA: Layers,
    CFD_3D_FVM_FLOW: Wind,
    LINEAR_STRUCTURAL_FEA: Activity,
    NONLINEAR_FEA_CONTACT: Activity,
    CAM_5AXIS_SIMULTANEOUS: Cpu,
    BREP_HEALING_SEWING: Sliders,
    ASSEMBLY_KINEMATICS_SOLVE: Layers3,
    STEP_AP242_PMI_WORKFLOW: Database
  };

  const opNames: Record<ProductionOperationType, string> = {
    CLASS_A_SURFACING_ZEBRA: 'Class-A Surfacing & Zebra Reflection',
    CFD_3D_FVM_FLOW: '3D FVM Navier-Stokes CFD Flow',
    LINEAR_STRUCTURAL_FEA: 'Linear Structural FEA Stress',
    NONLINEAR_FEA_CONTACT: 'Nonlinear Mechanics & Contact',
    CAM_5AXIS_SIMULTANEOUS: '5-Axis Simultaneous CAM Toolpath',
    BREP_HEALING_SEWING: 'B-Rep Healing & Surface Sewing',
    ASSEMBLY_KINEMATICS_SOLVE: 'Assembly Kinematics & Clearance',
    STEP_AP242_PMI_WORKFLOW: 'STEP AP242 Semantic PMI Workflow'
  };

  const SelectedIcon = opIcons[selectedOp] || Cpu;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-2xl text-slate-100 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-cyan-950 border border-cyan-800/80 rounded-xl text-cyan-400 shadow-md">
            <SelectedIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded">
                PATCH-SECP-084
              </span>
              <h2 className="text-lg font-bold text-slate-100">Interactive Production Engineering Workbench</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Unified Call-Path Bridge connecting Viewport UI to Real B-Rep, Class-A, FEA, CFD, 5-Axis CAM, and Assembly Solvers
            </p>
          </div>
        </div>

        <button
          onClick={handleRunCommand}
          disabled={isExecuting}
          className={`px-5 py-3 rounded-xl text-xs font-bold flex items-center space-x-2 shrink-0 transition-all ${
            isExecuting
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg hover:shadow-cyan-900/40 cursor-pointer active:scale-95'
          }`}
        >
          {isExecuting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Executing Real Solver...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current text-white" />
              <span>Dispatch Production Command</span>
            </>
          )}
        </button>
      </div>

      {/* Domain Operation Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {(Object.keys(opNames) as ProductionOperationType[]).map(opKey => {
          const Icon = opIcons[opKey];
          const isSelected = selectedOp === opKey;
          return (
            <button
              key={opKey}
              onClick={() => handleOpChange(opKey)}
              className={`p-2.5 rounded-lg border text-left text-xs font-medium flex flex-col justify-between space-y-2 transition-all ${
                isSelected
                  ? 'bg-slate-800 border-cyan-500 text-cyan-300 shadow-md ring-1 ring-cyan-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
              </div>
              <span className="font-semibold text-[11px] leading-tight truncate">{opNames[opKey]}</span>
            </button>
          );
        })}
      </div>

      {/* Operation Parameters & Config */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Real Operation Input Parameters ({opNames[selectedOp]})</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          {selectedOp === 'LINEAR_STRUCTURAL_FEA' && (
            <div>
              <label className="text-slate-400 block mb-1">Applied Force Load (N):</label>
              <input
                type="number"
                value={loadN}
                onChange={e => setLoadN(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {selectedOp === 'CFD_3D_FVM_FLOW' && (
            <div>
              <label className="text-slate-400 block mb-1">Inlet Flow Velocity (m/s):</label>
              <input
                type="number"
                value={inletVel}
                onChange={e => setInletVel(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {selectedOp === 'CLASS_A_SURFACING_ZEBRA' && (
            <div>
              <label className="text-slate-400 block mb-1">Zebra Stripe Frequency:</label>
              <input
                type="number"
                value={stripeFreq}
                onChange={e => setStripeFreq(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {selectedOp === 'CAM_5AXIS_SIMULTANEOUS' && (
            <>
              <div>
                <label className="text-slate-400 block mb-1">Tool Lead Angle (deg):</label>
                <input
                  type="number"
                  value={leadAngle}
                  onChange={e => setLeadAngle(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Tool Tilt Angle (deg):</label>
                <input
                  type="number"
                  value={tiltAngle}
                  onChange={e => setTiltAngle(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </>
          )}

          {selectedOp === 'BREP_HEALING_SEWING' && (
            <div>
              <label className="text-slate-400 block mb-1">Sewing Tolerance (mm):</label>
              <input
                type="number"
                step="0.0001"
                value={sewingTol}
                onChange={e => setSewingTol(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          <div className="flex items-center text-slate-400 text-[11px] font-mono">
            <span>Entity Ref: <strong className="text-slate-200">CAD-SOLID-001 (REV-2026-08-15)</strong></span>
          </div>
        </div>
      </div>

      {/* Execution Results Display */}
      {activeResult && (
        <div className="space-y-4 pt-1">
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono ${
            activeResult.status === 'COMPLETED'
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
              : activeResult.status === 'VERIFICATION_FAILED' || activeResult.status === 'FAILED'
              ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
              : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
          }`}>
            <div className="flex items-center space-x-3">
              {activeResult.status === 'COMPLETED' ? (
                <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-7 h-7 text-rose-400 shrink-0" />
              )}
              <div>
                <div className="text-sm font-bold tracking-wide flex items-center space-x-2">
                  <span>STATUS: {activeResult.status}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-normal">
                    {activeResult.durationMs}ms
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Engine: <strong className="text-cyan-300">{activeResult.engineId}</strong> | Command ID: {activeResult.commandId}
                </div>
              </div>
            </div>

            {activeResult.provenanceDigest && (
              <div className="text-right border-t md:border-t-0 border-slate-800 pt-2 md:pt-0">
                <div className="text-xs font-bold text-cyan-400">Cryptographic Provenance Digest</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">{activeResult.provenanceDigest}</div>
              </div>
            )}
          </div>

          {/* Independent Verification Report */}
          {activeResult.verificationResult && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400 flex items-center space-x-1.5">
                  <FileCheck className="w-4 h-4 text-cyan-400" />
                  <span>Independent Verifier: {activeResult.verificationResult.verifierName}</span>
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeResult.verificationResult.passed
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {activeResult.verificationResult.passed ? 'VERIFIED PASS' : 'VERIFICATION FAIL'}
                </span>
              </div>
              <div className="text-slate-300 text-[11px]">{activeResult.verificationResult.verifierDetails}</div>
            </div>
          )}

          {/* Visualization Data Overlay Panel */}
          {activeResult.visualizationData && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Real Numerical Visualization Payload Overlay ({opNames[selectedOp]})</span>
              </h4>

              {/* Class-A Surfacing Viz */}
              {selectedOp === 'CLASS_A_SURFACING_ZEBRA' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Class-A Continuity</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      {activeResult.visualizationData.continuityType} Compliant
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Generated Zebra Stripes</div>
                    <div className="text-base font-bold text-cyan-300 mt-1">
                      {activeResult.visualizationData.zebraStripes?.length || 0} Ray Points
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Max G0 Discontinuity</div>
                    <div className="text-base font-bold text-amber-300 mt-1">
                      {activeResult.visualizationData.maxG0DiscontinuityMm?.toExponential(3)} mm
                    </div>
                  </div>
                </div>
              )}

              {/* Structural FEA Viz */}
              {selectedOp === 'LINEAR_STRUCTURAL_FEA' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Max Von Mises Stress</div>
                    <div className="text-base font-bold text-rose-400 mt-1">
                      {activeResult.visualizationData.maxVonMisesStressMPa?.toFixed(2)} MPa
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Max Displacement</div>
                    <div className="text-base font-bold text-cyan-300 mt-1">
                      {activeResult.visualizationData.maxDisplacementMm?.toFixed(3)} mm
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Min Safety Factor</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      {activeResult.visualizationData.minSafetyFactor?.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">FEA Mesh Nodes</div>
                    <div className="text-base font-bold text-slate-200 mt-1">
                      {activeResult.visualizationData.nodeCount} Nodes / {activeResult.visualizationData.elementCount} Elem
                    </div>
                  </div>
                </div>
              )}

              {/* 3D FVM CFD Viz */}
              {selectedOp === 'CFD_3D_FVM_FLOW' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Max Flow Velocity</div>
                    <div className="text-base font-bold text-cyan-300 mt-1">
                      {activeResult.visualizationData.maxVelocityMS?.toFixed(2)} m/s
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Pressure Drop Delta P</div>
                    <div className="text-base font-bold text-amber-300 mt-1">
                      {activeResult.visualizationData.pressureDropPa?.toFixed(1)} Pa
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">FVM Control Volume Grid</div>
                    <div className="text-base font-bold text-slate-200 mt-1">
                      {activeResult.visualizationData.gridCellCount} 3D Cells
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Streamlines Trajectories</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      {activeResult.visualizationData.streamlineTrajectories?.length || 0} Paths
                    </div>
                  </div>
                </div>
              )}

              {/* 5-Axis CAM Viz */}
              {selectedOp === 'CAM_5AXIS_SIMULTANEOUS' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Total CL Cutter Points</div>
                    <div className="text-base font-bold text-cyan-300 mt-1">
                      {activeResult.visualizationData.totalClPoints} Points
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Gouge & Holder Status</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      {!activeResult.visualizationData.hasGougeViolation ? 'GOUGE FREE' : 'GOUGE VIOLATION'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Total Path Length</div>
                    <div className="text-base font-bold text-slate-200 mt-1">
                      {activeResult.visualizationData.totalPathLengthMm?.toFixed(1)} mm
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Generated G-Code Blocks</div>
                    <div className="text-base font-bold text-amber-300 mt-1">
                      {activeResult.visualizationData.totalGcodeBlocks} Blocks
                    </div>
                  </div>
                </div>
              )}

              {/* B-Rep Viz */}
              {selectedOp === 'BREP_HEALING_SEWING' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Sewn Surface Shell</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      {activeResult.visualizationData.faceCount} Surfaces
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Topological Manifoldness</div>
                    <div className="text-base font-bold text-cyan-300 mt-1">
                      {activeResult.visualizationData.isManifold ? 'MANIFOLD OK' : 'NON-MANIFOLD'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Max Stitch Deviation</div>
                    <div className="text-base font-bold text-amber-300 mt-1">
                      {activeResult.visualizationData.deviationMapMaxMm?.toExponential(3)} mm
                    </div>
                  </div>
                </div>
              )}

              {/* Assembly Viz */}
              {selectedOp === 'ASSEMBLY_KINEMATICS_SOLVE' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Assembly Components</div>
                    <div className="text-base font-bold text-cyan-300 mt-1">
                      {activeResult.visualizationData.componentCount} Components
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Interference Check</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      {!activeResult.visualizationData.hasInterference ? 'CLEARANCE OK' : 'INTERFERENCE'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="text-slate-400">Unconstrained DOFs</div>
                    <div className="text-base font-bold text-amber-300 mt-1">
                      {activeResult.visualizationData.unconstrainedDofs} Kinematic DOF
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECP-088: Full Industrial PLM & ECO Life Cycle */}
      <div className="pt-4 border-t border-slate-800">
        <EnterprisePLMPanel />
      </div>
    </div>
  );
};
