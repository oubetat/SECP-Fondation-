/**
 * SECP Industrial OS - PATCH-304 HPC Scheduler Workbench Panel
 * Cluster Topology, Queue Management, Resource-Aware Placement,
 * Backfill, Preemption, Checkpoints, Telemetry & 73-Assertion Acceptance Gate
 */

import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, Download, Layers, Play, RefreshCw, RotateCcw, Server, Shield, Terminal, Wifi, Workflow, Zap } from 'lucide-react';
import { HPCScheduler } from '../engine/engineering_hpc/HPCScheduler';
import {
  GpuType,
  HPCJob,
  HPCSchedulerTelemetry,
  NodeTopologyManifest,
  PreemptionClass,
  QueueClass,
  WorkloadType,
} from '../engine/engineering_hpc/HPCSchedulerTypes304';
import { GateResult304, HardAcceptanceGate304 } from '../engine/engineering_hpc/HardAcceptanceGate304';

export const HPCSchedulerWorkbenchPanel: React.FC = () => {
  const [scheduler] = useState(() => new HPCScheduler());
  const [activeTab, setActiveTab] = useState<'nodes' | 'queue' | 'telemetry' | 'quarantine' | 'gate'>('nodes');

  const [nodes, setNodes] = useState<NodeTopologyManifest[]>([]);
  const [telemetry, setTelemetry] = useState<HPCSchedulerTelemetry | null>(null);

  // Job Submission Form State
  const [selectedWorkload, setSelectedWorkload] = useState<WorkloadType>('CFD_SOLVE');
  const [selectedQueue, setSelectedQueue] = useState<QueueClass>('HIGH_PRIORITY');
  const [requestedCpus, setRequestedCpus] = useState<number | null>(null);
  const [requestedMemory, setRequestedMemory] = useState<number | null>(null);
  const [requestedGpus, setRequestedGpus] = useState<number | null>(null);
  const [selectedGpuType, setSelectedGpuType] = useState<GpuType>('NVIDIA_A100');
  const [preemptionClass, setPreemptionClass] = useState<PreemptionClass>('CHECKPOINTABLE');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [lastSubmittedJob, setLastSubmittedJob] = useState<HPCJob | null>(null);
  const [gateResult, setGateResult] = useState<GateResult304 | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setNodes(scheduler.getAllNodes());
    setTelemetry(scheduler.getTelemetry());
  };

  const handleJobSubmitAndRun = async () => {
    setIsSubmitting(true);
    addLog(`Submitting ${selectedWorkload} job to ${selectedQueue} queue...`);

    try {
      const job = scheduler.submitJob({
        projectId: 'PROJ_AEROSPACE',
        workloadType: selectedWorkload,
        queueClass: selectedQueue,
        preemptionClass,
        resourceRequest: {
          cpus: requestedCpus,
          memoryGb: requestedMemory,
          gpus: requestedGpus,
          gpuType: selectedGpuType,
          gpuMemoryGb: selectedGpuType === 'NVIDIA_A100' ? 80 : 16,
          wasmWorkers: 8,
          nodes: 1,
          storageGb: 100,
          requestedWallTimeSec: 3600,
        },
      });

      setLastSubmittedJob({ ...job });
      refreshData();

      addLog(`Job ${job.jobId} submitted. Executing multi-physics HPC solver...`);
      const completedJob = await scheduler.executeScheduledJob(job.jobId);

      setLastSubmittedJob({ ...completedJob });
      refreshData();
      addLog(`Job ${completedJob.jobId} COMPLETED in ${completedJob.actualRuntimeSec}s. OutputHash: ${completedJob.outputHash}`);
    } catch (err: any) {
      addLog(`Error executing job: ${err?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitJobArray = () => {
    addLog(`Submitting Design Space Exploration Parameter Sweep Job Array (5 tasks)...`);
    const arrayJobs = scheduler.submitJobArray(
      { workloadType: 'DESIGN_SPACE_SWEEP', queueClass: 'BATCH' },
      [{ alpha: 0.1 }, { alpha: 0.2 }, { alpha: 0.3 }, { alpha: 0.4 }, { alpha: 0.5 }]
    );
    refreshData();
    addLog(`Created Array Job ${arrayJobs[0].arrayJobId} with ${arrayJobs.length} tasks.`);
  };

  const handleQuarantineNode = (nodeId: string) => {
    scheduler.quarantineNode(nodeId, 'Manual quarantine triggered from UI workbench');
    refreshData();
    addLog(`QUARANTINED node ${nodeId}`);
  };

  const handleRejoinNode = (nodeId: string) => {
    scheduler.rejoinNode(nodeId);
    refreshData();
    addLog(`REJOINED node ${nodeId} as HEALTHY`);
  };

  const handleRunGate = () => {
    const result = HardAcceptanceGate304.runGate();
    setGateResult(result);
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-100 space-y-6 shadow-2xl font-sans">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Server className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                PATCH-304
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                High-Performance Computing (HPC) Scheduler
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Resource-Aware Placement, Fair-Share Quotas, Backfill, Preemption & Digital Thread Provenance
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-slate-300 font-medium">Scheduler: READY</span>
            <span className="text-slate-500 font-mono">({nodes.filter((n) => n.status === 'HEALTHY').length}/{nodes.length} Nodes)</span>
          </div>

          <button
            onClick={handleRunGate}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-lg shadow-emerald-950"
          >
            <Shield className="w-4 h-4" />
            <span>Run 73-Assertion Gate</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'nodes' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Cluster Topology ({nodes.length} Nodes)</span>
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'queue' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Workflow className="w-4 h-4" />
          <span>Queue & Placement Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'telemetry' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Resource & Telemetry Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('quarantine')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'quarantine' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Node Quarantine & Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('gate')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'gate' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Production Gate (73)</span>
        </button>
      </div>

      {/* TAB 1: CLUSTER TOPOLOGY */}
      {activeTab === 'nodes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">HPC Cluster Topology Manifest</h3>
            <button onClick={refreshData} className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Topology</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {nodes.map((node) => (
              <div
                key={node.nodeId}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-200 truncate">{node.nodeId}</span>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      node.status === 'HEALTHY'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : node.status === 'QUARANTINED'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {node.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>CPU Cores:</span>
                    <span className="text-emerald-400 font-bold">{node.cpusAvailable} / {node.cpusTotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RAM Available:</span>
                    <span className="text-slate-200">{node.memoryGbAvailable} / {node.memoryGbTotal} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GPU Topology:</span>
                    <span className="text-indigo-400 font-bold">{node.gpusTotal > 0 ? `${node.gpusAvailable}/${node.gpusTotal} (${node.gpuType})` : 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GPU VRAM:</span>
                    <span className="text-slate-300">{node.gpuMemoryGb > 0 ? `${node.gpuMemoryGb} GB` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>WASM Workers:</span>
                    <span className="text-sky-400">{node.wasmWorkersAvailable} Threads</span>
                  </div>
                  <div className="flex justify-between">
                    <span>NUMA Sockets:</span>
                    <span className="text-slate-300">{node.numaNodes} Sockets</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rack / Bandwidth:</span>
                    <span className="text-slate-300">{node.rackId} ({node.networkBandwidthGbps} Gbps)</span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-[10px]">
                  {node.status === 'HEALTHY' ? (
                    <button onClick={() => handleQuarantineNode(node.nodeId)} className="text-amber-400 hover:underline">
                      Quarantine
                    </button>
                  ) : (
                    <button onClick={() => handleRejoinNode(node.nodeId)} className="text-emerald-400 hover:underline">
                      Rejoin Cluster
                    </button>
                  )}
                  {node.leaseId && <span className="text-indigo-400 font-mono truncate">{node.leaseId}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: QUEUE & PLACEMENT ENGINE */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {/* Workload Submission Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Submit HPC Multi-Physics Workload</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Workload Domain</label>
                <select
                  value={selectedWorkload}
                  onChange={(e) => setSelectedWorkload(e.target.value as WorkloadType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="CFD_SOLVE">💨 HPC Distributed CFD Solver</option>
                  <option value="FEM_SOLVE">⚙️ HPC Distributed FEM Structural</option>
                  <option value="MESH_PARTITION">🕸️ HPC Parallel Mesh Partitioning</option>
                  <option value="DESIGN_SPACE_SWEEP">🎯 Design Space Exploration Sweep (PATCH-275)</option>
                  <option value="CAM_TOOLPATH_BATCH">🛠️ CAM Feedrate Batch Verification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Queue</label>
                <select
                  value={selectedQueue}
                  onChange={(e) => setSelectedQueue(e.target.value as QueueClass)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="HIGH_PRIORITY">⚡ HIGH_PRIORITY (Priority 100)</option>
                  <option value="INTERACTIVE">💻 INTERACTIVE (Priority 80)</option>
                  <option value="HPC">🏢 HPC (Priority 50)</option>
                  <option value="NORMAL">📊 NORMAL (Priority 50)</option>
                  <option value="BATCH">📦 BATCH (Priority 20)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">CPU Cores Requested</label>
                <input
                  type="number"
                  value={requestedCpus}
                  onChange={(e) => setRequestedCpus(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">RAM Requested (GB)</label>
                <input
                  type="number"
                  value={requestedMemory}
                  onChange={(e) => setRequestedMemory(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">GPUs Requested</label>
                <input
                  type="number"
                  value={requestedGpus}
                  onChange={(e) => setRequestedGpus(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">GPU Architecture Type</label>
                <select
                  value={selectedGpuType}
                  onChange={(e) => setSelectedGpuType(e.target.value as GpuType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="NVIDIA_A100">NVIDIA A100 Tensor Core (80GB)</option>
                  <option value="WEBGPU_GENERIC">WebGPU Accelerated Adapter</option>
                  <option value="NONE">None (CPU Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Preemption Safety Class</label>
                <select
                  value={preemptionClass}
                  onChange={(e) => setPreemptionClass(e.target.value as PreemptionClass)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="CHECKPOINTABLE">CHECKPOINTABLE (Safe State Snapshot)</option>
                  <option value="PREEMPTIBLE">PREEMPTIBLE (Immediate Eviction)</option>
                  <option value="NON_PREEMPTIBLE">NON_PREEMPTIBLE (Atomic Completion)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={handleSubmitJobArray}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2 rounded-lg transition-all"
              >
                Submit Parameter Sweep Job Array (PATCH-275)
              </button>

              <button
                onClick={handleJobSubmitAndRun}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-lg flex items-center space-x-2 transition-all shadow-lg shadow-emerald-950"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{isSubmitting ? 'Scheduling & Executing...' : 'Schedule & Execute HPC Job'}</span>
              </button>
            </div>
          </div>

          {/* Last Submitted Job Display */}
          {lastSubmittedJob && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-400">{lastSubmittedJob.jobId}</span>
                  <div className="text-xs text-slate-400">
                    Workload: <span className="text-slate-200">{lastSubmittedJob.workloadType}</span> | Queue:{' '}
                    <span className="text-slate-200">{lastSubmittedJob.queueClass}</span>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono font-bold px-3 py-1 rounded-lg border ${
                    lastSubmittedJob.status === 'COMPLETED'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : lastSubmittedJob.status === 'RUNNING'
                      ? 'bg-indigo-950 text-indigo-400 border-indigo-800 animate-pulse'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  {lastSubmittedJob.status}
                </span>
              </div>

              {/* Execution Manifest */}
              {lastSubmittedJob.executionManifest && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs font-mono">
                  <h4 className="font-bold text-slate-300">Execution & Placement Manifest</h4>
                  <div className="text-slate-400">
                    Assigned Nodes: <span className="text-emerald-400">{lastSubmittedJob.executionManifest.allocatedNodes.join(', ')}</span>
                  </div>
                  <div className="text-slate-400">
                    Decision Reason: <span className="text-slate-200">{lastSubmittedJob.executionManifest.schedulingDecisionReason}</span>
                  </div>
                  <div className="text-slate-400">
                    Locality Score: <span className="text-indigo-400">{lastSubmittedJob.executionManifest.topologyLocalityScore.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESOURCE & TELEMETRY DASHBOARD */}
      {activeTab === 'telemetry' && telemetry && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">CPU Utilization</span>
              <div className="text-2xl font-bold font-mono text-emerald-400">{telemetry.cpuUtilizationPercent.toFixed(1)}%</div>
              <span className="text-[10px] text-slate-500">Across 96 Cluster Cores</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">GPU Utilization</span>
              <div className="text-2xl font-bold font-mono text-indigo-400">{telemetry.gpuUtilizationPercent.toFixed(1)}%</div>
              <span className="text-[10px] text-slate-500">A100 / WebGPU Cluster</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Scheduling Decision Latency</span>
              <div className="text-2xl font-bold font-mono text-sky-400">{telemetry.schedulingDecisionLatencyMs.toFixed(1)} ms</div>
              <span className="text-[10px] text-slate-500">Resource Matching Speed</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Backfill Efficiency</span>
              <div className="text-2xl font-bold font-mono text-amber-400">{telemetry.backfillEfficiencyPercent.toFixed(1)}%</div>
              <span className="text-[10px] text-slate-500">Cluster Gap Utilization</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: QUARANTINE & AUDIT */}
      {activeTab === 'quarantine' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">HPC Scheduler Audit Trail</h3>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-400 h-64 overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">No activity recorded yet. Submit jobs or run the acceptance suite.</div>
              ) : (
                logs.map((log, idx) => <div key={idx}>{log}</div>)
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PRODUCTION GATE (73 ASSERTIONS) */}
      {activeTab === 'gate' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-slate-100">PATCH-304 Production Acceptance Gate</h3>
              <p className="text-xs text-slate-400">73 Hard Assertions verifying HPCScheduler, Admission, Placement, Backfill & Preemption</p>
            </div>

            <button
              onClick={handleRunGate}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Shield className="w-4 h-4" />
              <span>Run Acceptance Suite</span>
            </button>
          </div>

          {gateResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400">Total Assertions</span>
                  <div className="text-2xl font-bold font-mono text-slate-100">{gateResult.totalAssertions}</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400">Success Rate</span>
                  <div className="text-2xl font-bold font-mono text-emerald-400">{gateResult.successRatePercent.toFixed(1)}%</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-xs text-slate-400">Passed / Failed</span>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {gateResult.passedCount} / {gateResult.failedCount}
                  </div>
                </div>
              </div>

              {/* Capability Matrix */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Production Capability Status (26 Categories)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {gateResult.productionMatrix.map((item, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{item.capability}</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
