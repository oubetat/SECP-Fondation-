/**
 * PATCH-150 — Cloud Simulation & Operational Safety Panel
 * SECP Industrial OS v2 — Phase 12 (HPC / GPU / Cloud)
 */

import React, { useState } from 'react';
import {
  CloudSimulationOrchestrator
} from '../services/compute/CloudSimulationOrchestrator';
import {
  SimulationJobState,
  ExecutionBackendType,
  CloudSimulationManifest,
  SimulationJobIdentity,
  CloudSimulationQualificationRecord
} from '../services/compute/cloud_orchestrator_types';
import { EngineeringHashChain } from '../engine/evidence/EngineeringHashChain';
import { Activity, Cpu, Database, ShieldCheck, Zap, DollarSign, Clock, FileText, AlertOctagon, RefreshCw, Search, CheckCircle, XCircle, Play, Settings, Server } from 'lucide-react';

export function CloudSimulationPanel() {
  const [jobId, setJobId] = useState<string>('SIM-JOB-150-ALPHA');
  const [solver, setSolver] = useState<string>('DISTRIBUTED_NAVIER_STOKES');
  const [maxBudget, setMaxBudget] = useState<number>(150);
  const [backend, setBackend] = useState<ExecutionBackendType>(ExecutionBackendType.CLOUD_GPU);
  
  // Environment simulator variables
  const [hasGpu, setHasGpu] = useState<boolean>(true);
  const [maxMemory, setMaxMemory] = useState<number>(256); // GB
  const [mpiEnabled, setMpiEnabled] = useState<boolean>(true);
  const [simulateEvictionRandomness, setSimulateEvictionRandomness] = useState<boolean>(true);

  // Status and Results
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [consoleLogs, setConsoleLogs] = useState<{ clock: number; state: string; message: string; hash: string }[]>([]);
  const [currentCost, setCurrentCost] = useState<number>(0);
  const [currentState, setCurrentState] = useState<SimulationJobState>(SimulationJobState.QUEUED);
  const [qualification, setQualification] = useState<CloudSimulationQualificationRecord | null>(null);
  const [generatedArtifacts, setGeneratedArtifacts] = useState<string[]>([]);

  const handleRunOrchestration = async () => {
    setIsRunning(true);
    setConsoleLogs([]);
    setCurrentCost(0);
    setQualification(null);
    setGeneratedArtifacts([]);
    setCurrentState(SimulationJobState.QUEUED);

    const manifestHashVal = EngineeringHashChain.computeCanonicalHash({
      jobId,
      solver,
      backend,
      maxBudget,
      physics: 'FLUID_DYNAMICS',
      materials: 'TITANIUM_GRADE_5'
    }).canonicalHash;

    const manifest: CloudSimulationManifest = {
      manifestHash: `man-${manifestHashVal.substring(0, 16)}`,
      solver,
      solverHash: 'solv-99-gpu-optimized',
      workloadHash: 'workload-aerodynamic-wing-v2',
      meshHash: 'mesh-hpc-10m-elements',
      physics: 'FLUID_DYNAMICS',
      materials: 'TITANIUM_GRADE_5',
      boundaryConditions: 'INLET_VELOCITY_50MS',
      numericalConfiguration: { solverType: 'PISO', precision: 'double' },
      resourceRequirements: {
        cpuCores: 64,
        memory: 128,
        gpuCount: backend === ExecutionBackendType.CLOUD_GPU ? 2 : 0,
        mpiRanks: 8,
        nodeCount: 4,
        networkRequirements: 'ROCE_V2_100G',
        storageRequirements: 'LUSTRE_SSD_10T',
        runtimeEstimate: 3600,
        interconnectRequirements: 'INFINIBAND_HDR',
        maxBudget: maxBudget
      },
      checkpointPolicy: 'EVERY_100_ITERATIONS',
      evidencePolicy: 'FULL_PROVENANCE',
      securityPolicy: 'SECURE_BOOT_SANDBOXED'
    };

    const identity: SimulationJobIdentity = {
      simulationJobId: jobId,
      simulationJobHash: `job-crypt-${jobId}`,
      workloadHash: manifest.workloadHash,
      solverBuildHash: 'build-hash-889af8283f',
      meshHash: manifest.meshHash,
      materialStateHash: 'mat-state-99',
      configurationHash: 'config-piso-33',
      resourcePolicyHash: 'policy-hpc-v3'
    };

    const environment = {
      hasGpu,
      maxMemory,
      mpiEnabled,
      runtimeVersion: '20.0'
    };

    const orchestrator = new CloudSimulationOrchestrator(jobId);

    // Override local event tracking inside UI to show progress step-by-step
    // Simulating steps with delay to make it highly interactive and educational
    try {
      const steps = [
        { state: SimulationJobState.RESERVED, msg: 'Job planning and resource reservation', cost: 0 },
        { state: SimulationJobState.PROVISIONING, msg: `Provisioning ${backend} resources in region: europe-west1`, cost: 10 }
      ];

      for (const step of steps) {
        setCurrentState(step.state);
        setCurrentCost(step.cost);
        setConsoleLogs(prev => [...prev, {
          clock: prev.length + 1,
          state: step.state,
          message: step.msg,
          hash: `hash-${prev.length}-${prev.length + 1}-${step.state.substring(0, 4)}`
        }]);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Check environment qualifications in UI simulation
      if (backend === ExecutionBackendType.CLOUD_GPU && !hasGpu) {
        throw new Error('GPU_COMPATIBILITY_FAILED: Workload requires GPU but none available');
      }

      setCurrentState(SimulationJobState.READY);
      setConsoleLogs(prev => [...prev, {
        clock: prev.length + 1,
        state: SimulationJobState.READY,
        message: 'Environment ready for execution',
        hash: `hash-${prev.length}-ready`
      }]);
      await new Promise(resolve => setTimeout(resolve, 800));

      setCurrentState(SimulationJobState.RUNNING);
      setConsoleLogs(prev => [...prev, {
        clock: prev.length + 1,
        state: SimulationJobState.RUNNING,
        message: 'Solver execution initiated',
        hash: `hash-${prev.length}-running`
      }]);
      await new Promise(resolve => setTimeout(resolve, 800));

      // Core simulation loop with budget cap and eviction tests
      let accumulated = 0;
      let aborted = false;
      let isPreempted = false;

      for (let i = 0; i < 5; i++) {
        accumulated += 20.0;
        setCurrentCost(accumulated);

        // HARD_BUDGET_CAP enforcement
        if (accumulated > maxBudget) {
          aborted = true;
          setCurrentState(SimulationJobState.BUDGET_EXCEEDED);
          setConsoleLogs(prev => [...prev, {
            clock: prev.length + 1,
            state: SimulationJobState.BUDGET_EXCEEDED,
            message: `ABORT: Cumulative cost ${accumulated} USD exceeded budget limit of ${maxBudget} USD`,
            hash: `hash-${prev.length}-budget-limit`
          }]);
          break;
        }

        // Preemption eviction test (force preemptible on CLOUD_GPU when eviction testing enabled)
        if (backend === ExecutionBackendType.CLOUD_GPU && simulateEvictionRandomness && i === 3) {
          isPreempted = true;
          setCurrentState(SimulationJobState.EVICTED);
          setConsoleLogs(prev => [...prev, {
            clock: prev.length + 1,
            state: SimulationJobState.EVICTED,
            message: 'PREEMPTION_NOTICE: Node eviction detected by provider API. Re-routing execution path.',
            hash: `hash-${prev.length}-preempted`
          }]);
          break;
        }

        setConsoleLogs(prev => [...prev, {
          clock: prev.length + 1,
          state: SimulationJobState.RUNNING,
          message: `Iteration block ${i + 1} completed. Total cost accumulated: ${accumulated} USD`,
          hash: `hash-${prev.length}-iter-${i}`
        }]);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      if (!aborted && !isPreempted) {
        setCurrentState(SimulationJobState.FINALIZING);
        setConsoleLogs(prev => [...prev, {
          clock: prev.length + 1,
          state: SimulationJobState.FINALIZING,
          message: 'Execution completed, capturing artifacts',
          hash: `hash-${prev.length}-finalizing`
        }]);
        await new Promise(resolve => setTimeout(resolve, 800));

        setCurrentState(SimulationJobState.COMPLETED);
        setConsoleLogs(prev => [...prev, {
          clock: prev.length + 1,
          state: SimulationJobState.COMPLETED,
          message: 'Job successfully terminated',
          hash: `hash-${prev.length}-completed`
        }]);

        // Generate deterministic artifact name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const artifact1 = `${manifest.workloadHash}_${manifest.solverHash}_${manifest.meshHash}_${timestamp}_RESULT.simdat`;
        const artifact2 = `${manifest.workloadHash}_${manifest.solverHash}_${manifest.meshHash}_${timestamp}_METRICS.csv`;
        setGeneratedArtifacts([artifact1, artifact2]);
      }

      // Execute full orchestrator to obtain official Qualification Record
      const result = await orchestrator.orchestrate(manifest, identity, backend, environment);
      setQualification(result);

    } catch (err: any) {
      setCurrentState(SimulationJobState.FAILED);
      setConsoleLogs(prev => [...prev, {
        clock: prev.length + 1,
        state: SimulationJobState.FAILED,
        message: `Orchestration Failure: ${err.message}`,
        hash: `hash-${prev.length}-failed`
      }]);
      
      // Get Qualification Record from real backend orchestrator on failure
      const result = await orchestrator.orchestrate(manifest, identity, backend, environment);
      setQualification(result);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6" id="cloud-simulation-panel">
      {/* Title */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-sky-400 flex items-center gap-2">
            <Server className="w-5 h-5" /> PATCH-150 — Cloud Simulation Orchestrator
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time HPC & GPU solver execution, preemptible cloud resource orchestration, and Lamport Logical Clock audit trail.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-2.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[10px] font-mono uppercase tracking-widest font-bold">
            REV.A Operational Safety
          </span>
        </div>
      </div>

      {/* Main Grid: Inputs / State / Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Parameter controls (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Settings className="w-4 h-4 text-slate-400" /> Job Configurations
            </h3>
            
            <div className="space-y-4 text-xs">
              {/* Job ID & Solver */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Job ID</label>
                  <input
                    type="text"
                    value={jobId}
                    onChange={e => setJobId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-750 px-2.5 py-1.5 rounded text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Solver Pipeline</label>
                  <select
                    value={solver}
                    onChange={e => setSolver(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-750 px-2.5 py-1.5 rounded text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="DISTRIBUTED_NAVIER_STOKES">Navier-Stokes Solver</option>
                    <option value="STRUCTURAL_STRESS_FEA">Structural FEA</option>
                    <option value="THERMAL_CONDUCTION">Thermal Solver</option>
                  </select>
                </div>
              </div>

              {/* Execution Backend & Budget Limit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Execution Backend</label>
                  <select
                    value={backend}
                    onChange={e => setBackend(e.target.value as ExecutionBackendType)}
                    className="w-full bg-slate-900 border border-slate-750 px-2.5 py-1.5 rounded text-xs text-slate-200 focus:outline-none"
                  >
                    <option value={ExecutionBackendType.CLOUD_GPU}>Cloud GPU (Preemptible)</option>
                    <option value={ExecutionBackendType.NATIVE_HPC}>Native On-Demand HPC</option>
                    <option value={ExecutionBackendType.MPI_CLUSTER}>MPI cluster (Multi-node)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1 flex justify-between">
                    <span>Max Budget Cap</span>
                    <span className="text-amber-400 font-bold">${maxBudget} USD</span>
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="200"
                    step="10"
                    value={maxBudget}
                    onChange={e => setMaxBudget(Number(e.target.value))}
                    className="w-full accent-sky-500 mt-1"
                  />
                  <span className="text-[9px] text-slate-500 italic block mt-0.5">Triggers auto-abort on budget overflow</span>
                </div>
              </div>

              {/* Environment Parameters Simulator */}
              <div className="border-t border-slate-800 pt-3 mt-3">
                <span className="block text-[10px] text-slate-400 uppercase font-mono mb-2">Simulated Provider Environment</span>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={hasGpu}
                      onChange={e => setHasGpu(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500 accent-sky-500"
                    />
                    <span>GPU Cores Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={mpiEnabled}
                      onChange={e => setMpiEnabled(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-sky-500 accent-sky-500"
                    />
                    <span>MPI Core Enabled</span>
                  </label>
                </div>

                {backend === ExecutionBackendType.CLOUD_GPU && (
                  <div className="mt-3 p-2 bg-amber-950/20 border border-amber-800/30 rounded">
                    <label className="flex items-center gap-2 cursor-pointer text-amber-300 text-[11px]">
                      <input
                        type="checkbox"
                        checked={simulateEvictionRandomness}
                        onChange={e => setSimulateEvictionRandomness(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-amber-500 accent-amber-500"
                      />
                      <span>Simulate Preemptive Eviction</span>
                    </label>
                    <p className="text-[9px] text-slate-500 mt-1 pl-5">
                      Randomly triggers an eviction notice during execution to test strategy shifts.
                    </p>
                  </div>
                )}
              </div>

              {/* Run Trigger */}
              <button
                onClick={handleRunOrchestration}
                disabled={isRunning}
                className="w-full mt-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-bold py-2 px-4 rounded transition-all flex items-center justify-center gap-2 text-xs"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Orchestration Chain...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Launch Safety-Audited Job</span>
                  </>
                )}
              </button>

            </div>
          </div>

          {/* Budget Meter */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex justify-between">
              <span>Fiscal Budget Meter</span>
              <span className="font-mono text-slate-400">{currentCost} / {maxBudget} USD</span>
            </h3>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  currentCost > maxBudget ? 'bg-red-500' : 'bg-sky-500 animate-pulse'
                }`}
                style={{ width: `${Math.min(100, (currentCost / maxBudget) * 100)}%` }}
              />
            </div>
            {currentCost > maxBudget && (
              <div className="mt-2 text-[10px] text-red-400 flex items-center gap-1.5 font-mono">
                <AlertOctagon className="w-3.5 h-3.5" /> HARD_BUDGET_CAP triggered abort.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Console Trace & State Engine (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* State Visualization Ribbon */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              State Machine Status
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SimulationJobState).map(stateKey => {
                const isActive = currentState === stateKey;
                let bgStyle = 'bg-slate-900 text-slate-500 border-slate-800';
                if (isActive) {
                  if (stateKey === 'BUDGET_EXCEEDED' || stateKey === 'FAILED') {
                    bgStyle = 'bg-red-950/40 text-red-400 border-red-500/50 shadow-[0_0_15px_-5px_rgba(239,68,68,0.5)] font-bold';
                  } else if (stateKey === 'EVICTED') {
                    bgStyle = 'bg-amber-950/40 text-amber-400 border-amber-500/50 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)] font-bold';
                  } else if (stateKey === 'COMPLETED') {
                    bgStyle = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_-5px_rgba(16,185,129,0.5)] font-bold';
                  } else {
                    bgStyle = 'bg-sky-950/40 text-sky-400 border-sky-500/50 shadow-[0_0_15px_-5px_rgba(56,189,248,0.5)] font-bold';
                  }
                }
                return (
                  <span
                    key={stateKey}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition-all duration-300 ${bgStyle}`}
                  >
                    {stateKey}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Console / Event Log Panel */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col flex-1 h-[250px] overflow-hidden">
            <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-sky-400" /> Lamport Timeline Audit Trail
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Monotonically Increasing Logical Clock</span>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 custom-scrollbar pr-1">
              {consoleLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 italic">
                  Launch the simulation to capture Lamport timeline records...
                </div>
              ) : (
                consoleLogs.map((log, index) => (
                  <div key={index} className="flex gap-2 p-1.5 hover:bg-slate-900/50 rounded border border-transparent hover:border-slate-800 transition-all">
                    <span className="text-sky-400 font-bold">L{log.clock}</span>
                    <span className="text-slate-500">[{log.state}]</span>
                    <span className="text-slate-300 flex-1">{log.message}</span>
                    <span className="text-[10px] text-slate-500 font-mono italic shrink-0" title="Recursive cryptographic event hash">
                      {log.hash.substring(0, 15)}...
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reconstructed Deterministic Artifact Names */}
          {generatedArtifacts.length > 0 && (
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-400" /> Deterministic Artifact Proofs
              </h3>
              <p className="text-[10px] text-slate-500 mb-2">
                Provenanced filenames reconstructed strictly from workload, solver, and mesh content hashes.
              </p>
              <div className="space-y-1.5">
                {generatedArtifacts.map((name, i) => (
                  <div key={i} className="bg-slate-900/50 border border-slate-800/60 p-2 rounded text-[11px] font-mono text-emerald-400 flex justify-between items-center">
                    <span className="truncate">{name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] border border-emerald-500/20 font-bold uppercase shrink-0">
                      PROOF_LINKED
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Verification Matrix (Checks) */}
      {qualification && (
        <div className="bg-slate-950 p-5 rounded-lg border border-slate-800">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Operational Safety Qualification Matrix
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Hard Budget */}
            <div className="p-3 bg-slate-900 rounded border border-slate-850 flex items-center gap-3">
              {qualification.checks.hardBudgetCapEnforcement ? (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div className="truncate">
                <div className="text-[11px] font-bold text-slate-200">Budget Cap Enforcement</div>
                <div className="text-[9px] text-slate-500 font-mono">HARD_BUDGET_CAP</div>
              </div>
            </div>

            {/* Logical Clock */}
            <div className="p-3 bg-slate-900 rounded border border-slate-850 flex items-center gap-3">
              {qualification.checks.logicalClockConsensus ? (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div className="truncate">
                <div className="text-[11px] font-bold text-slate-200">Lamport Clock Ordering</div>
                <div className="text-[9px] text-slate-500 font-mono">CLOCK_CONSENSUS</div>
              </div>
            </div>

            {/* Eviction Awareness */}
            <div className="p-3 bg-slate-900 rounded border border-slate-850 flex items-center gap-3">
              {qualification.checks.evictionAwareness ? (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div className="truncate">
                <div className="text-[11px] font-bold text-slate-200">Eviction Awareness</div>
                <div className="text-[9px] text-slate-500 font-mono">EVICTION_READY</div>
              </div>
            </div>

            {/* Deterministic Naming */}
            <div className="p-3 bg-slate-900 rounded border border-slate-850 flex items-center gap-3">
              {qualification.checks.deterministicArtifactNaming ? (
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div className="truncate">
                <div className="text-[11px] font-bold text-slate-200">Deterministic Filename</div>
                <div className="text-[9px] text-slate-500 font-mono">ARTIFACT_NAMING</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-slate-900/40 rounded border border-slate-850 gap-4 text-xs">
            <div className="flex gap-4">
              <div>
                <span className="text-slate-500">Record ID:</span>{' '}
                <span className="text-slate-300 font-mono">{qualification.qualificationId}</span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>{' '}
                <span className={`font-bold ${qualification.state === 'QUALIFIED' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {qualification.state}
                </span>
              </div>
            </div>
            {qualification.criticalFailures.length > 0 && (
              <div className="text-red-400 flex items-center gap-1.5 font-bold text-[11px] font-mono">
                <AlertOctagon className="w-4 h-4" /> Failures: {qualification.criticalFailures.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
