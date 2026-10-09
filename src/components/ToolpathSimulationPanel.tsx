import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldCheck, 
  Activity, 
  Box, 
  Cpu, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  Settings,
  Clock,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SimulationVerdict, 
  SimulationEventType, 
  SimulationEvidencePackage,
  HardAcceptanceResult109,
  RemovalRepresentation
} from '../engine/manufacturing/simulation/types';
import { HardAcceptanceGate109 } from '../engine/manufacturing/simulation/HardAcceptanceGate109';
import { ToolpathSimulationEngine } from '../engine/manufacturing/simulation/ToolpathSimulationEngine';
import { MachineLibrary } from '../engine/manufacturing/kinematics/MachineLibrary';
import { ControllerProfileEngine } from '../engine/manufacturing/post/ControllerProfileEngine';
import { SpindleDirection } from '../engine/manufacturing/post/types';

export const ToolpathSimulationPanel: React.FC = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationEvidencePackage | null>(null);
  const [activeTab, setActiveTab] = useState<'monitor' | 'material' | 'acceptance' | 'events'>('monitor');
  const [currentSampleIdx, setCurrentSampleIdx] = useState(0);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    
    // Simulate engine work
    setTimeout(async () => {
      const machineLib = new MachineLibrary();
      const machine = machineLib.getMachine("HERMLE_C32")!;
      const controller = ControllerProfileEngine.createFanucLikeProfile();
      
      const contract = {
        simulationId: "SIM_UI_LIVE",
        simulationRevision: 1,
        toolpathId: "TP_LIVE",
        toolpathRevision: 1,
        machineProfileId: machine.machineId,
        controllerProfileId: controller.controllerId,
        toolAssemblyId: "TOOL_01",
        stockModelId: "STOCK_01",
        fixtureModelId: "FIX_01",
        workpieceModelId: "WP_01",
        simulationPolicy: {
          representation: RemovalRepresentation.VOXEL,
          timeStep: 0.1,
          adaptiveSubdivision: true,
          precisionMM: 0.5
        },
        collisionPolicy: { enabled: true, stopOnCollision: true, clearanceThresholdMM: 2.0 },
        tolerancePolicy: { gougeToleranceMM: 0.01, excessToleranceMM: 0.1 },
        samplingPolicy: { minStepMM: 0.1, maxStepMM: 2.0, maxAngularStepDeg: 0.5 }
      };

      const model = {
        machine,
        controller,
        tool: { id: "T1", name: "End Mill", geometry: { diameter: 10, fluteLength: 30 } } as any,
        holder: { objectId: "H1", type: "TOOL_HOLDER", isActive: true, aabb: { min: { x: -20, y: -20, z: 0 }, max: { x: 20, y: 20, z: 60 } } } as any,
        spindle: { objectId: "S1", type: "SPINDLE", isActive: true, aabb: { min: { x: -60, y: -60, z: 60 }, max: { x: 60, y: 60, z: 260 } } } as any,
        stock: {
          stockId: "S1",
          type: "BOX",
          geometry: { objectId: "S1_G", type: "BOX", isActive: true, aabb: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 0 } } } as any,
          representation: RemovalRepresentation.VOXEL,
          resolution: 1.0,
          boundingBox: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 0 } },
          volume: 100 * 100 * 50,
          coordinateSystem: "G54",
          fingerprint: "STOCK_01"
        },
        workpiece: { objectId: "WP1", type: "WORKPIECE", isActive: true, aabb: { min: { x: -40, y: -40, z: -40 }, max: { x: 40, y: 40, z: 0 } } } as any,
        fixture: [{ objectId: "F1", type: "FIXTURE", isActive: true, aabb: { min: { x: -60, y: -60, z: -90 }, max: { x: 60, y: 60, z: -50 } } }] as any,
        coordinateSystems: {},
        toolpath: {
          toolpathId: "TP1",
          revision: 1,
          machineId: machine.machineId,
          points: [
            { position: { x: 0, y: 0, z: 10 }, rotaryAxes: { a: 0, b: 0, c: 0 }, feedRate: 1000, spindleSpeed: 10000, spindleDirection: SpindleDirection.CW, coolantState: {} as any, sequenceNumber: 1, toolNumber: 1, motionType: "RAPID" },
            { position: { x: 10, y: 10, z: -5 }, rotaryAxes: { a: 0, b: 0, c: 0 }, feedRate: 1500, spindleSpeed: 10000, spindleDirection: SpindleDirection.CW, coolantState: {} as any, sequenceNumber: 2, toolNumber: 1, motionType: "LINEAR" },
            { position: { x: 30, y: 10, z: -5 }, rotaryAxes: { a: 10, b: 0, c: 30 }, feedRate: 1500, spindleSpeed: 10000, spindleDirection: SpindleDirection.CW, coolantState: {} as any, sequenceNumber: 3, toolNumber: 1, motionType: "LINEAR" },
            { position: { x: 30, y: 30, z: -10 }, rotaryAxes: { a: 20, b: 0, c: 60 }, feedRate: 1000, spindleSpeed: 10000, spindleDirection: SpindleDirection.CW, coolantState: {} as any, sequenceNumber: 4, toolNumber: 1, motionType: "LINEAR" }
          ],
          tolerance: 0.01,
          coordinateSystem: "WORK_PIECE",
          provenance: {} as any
        }
      };

      const engine = new ToolpathSimulationEngine(contract as any, model as any);
      const result = await engine.runSimulation();
      setSimulationResult(result);
      setIsSimulating(false);
    }, 1500);
  };

  useEffect(() => {
    if (simulationResult && isSimulating) {
      const interval = setInterval(() => {
        setCurrentSampleIdx(prev => (prev + 1) % (simulationResult.stateTrace.length || 1));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [simulationResult, isSimulating]);

  const currentSample = simulationResult?.stateTrace[currentSampleIdx] || null;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 border-l border-slate-800 font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">PATCH-109: Toolpath Simulation</h2>
            <p className="text-[10px] text-slate-400">Deterministic Material Removal & Kinematic Reconstruction</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className={`px-4 py-2 rounded-md font-bold flex items-center gap-2 transition-all ${
              isSimulating 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
            }`}
          >
            {isSimulating ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isSimulating ? 'SIMULATING...' : 'RUN SIMULATION'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/30">
        {[
          { id: 'monitor', label: 'MOTION MONITOR', icon: Activity },
          { id: 'material', label: 'MATERIAL REMOVAL', icon: Trash2 },
          { id: 'acceptance', label: 'HARD ACCEPTANCE', icon: ShieldCheck },
          { id: 'events', label: 'FORENSIC EVENTS', icon: Clock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all ${
              activeTab === tab.id 
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="font-bold tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'monitor' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Main Simulation Viewport Placeholder */}
              <div className="aspect-video bg-black rounded-lg border border-slate-800 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                </div>
                
                {simulationResult ? (
                  <div className="text-center">
                    <Box className="w-16 h-16 text-emerald-500/50 mx-auto mb-4 animate-pulse" />
                    <p className="text-emerald-400 font-bold tracking-widest uppercase">Simulation Active</p>
                    <p className="text-slate-500 text-[10px] mt-2">Voxel Representation: {simulationResult.contract.simulationPolicy.representation}</p>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Layers className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 italic uppercase tracking-tighter">Ready for Toolpath Reconstruction</p>
                  </div>
                )}

                {currentSample && (
                  <div className="absolute bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur p-3 rounded border border-slate-700 flex justify-between items-center text-[10px]">
                    <div className="flex gap-4">
                      <div><span className="text-slate-500 mr-2">X:</span><span className="text-white font-bold">{currentSample.axisPositions.X.toFixed(4)}</span></div>
                      <div><span className="text-slate-500 mr-2">Y:</span><span className="text-white font-bold">{currentSample.axisPositions.Y.toFixed(4)}</span></div>
                      <div><span className="text-slate-500 mr-2">Z:</span><span className="text-white font-bold">{currentSample.axisPositions.Z.toFixed(4)}</span></div>
                    </div>
                    <div className="flex gap-4">
                      <div><span className="text-slate-500 mr-2">FEED:</span><span className="text-sky-400 font-bold">{currentSample.feed.toFixed(0)}</span></div>
                      <div><span className="text-slate-500 mr-2">TIME:</span><span className="text-emerald-400 font-bold">{currentSample.timestamp.toFixed(3)}s</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verification Status</h3>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`text-xl font-bold leading-none ${simulationResult?.verdict === SimulationVerdict.SIMULATION_COMPLETE ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {simulationResult ? simulationResult.verdict : 'PENDING'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Collisions</h3>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`text-xl font-bold leading-none ${simulationResult?.metrics.collisionCount ? 'text-red-400' : 'text-emerald-400'}`}>
                      {simulationResult ? simulationResult.metrics.collisionCount : '0'}
                    </span>
                    <span className="text-[10px] text-slate-500 pb-0.5">DETECTIONS</span>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-4 h-4 text-sky-400" />
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perf Metrics</h3>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-xl font-bold text-white leading-none">
                      {simulationResult ? simulationResult.metrics.performance.samplesPerSec.toFixed(0) : '0'}
                    </span>
                    <span className="text-[10px] text-slate-500 pb-0.5">SAMPLES/S</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'material' && simulationResult && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
                <h3 className="text-xs font-bold text-white mb-6 uppercase tracking-widest border-l-2 border-emerald-500 pl-3">Material Removal Analysis</h3>
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1 uppercase">Removed Volume</p>
                      <p className="text-2xl font-bold text-emerald-400">{simulationResult.metrics.removedVolume.toFixed(2)} <span className="text-xs text-slate-600 font-normal">mm³</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1 uppercase">Residual Volume</p>
                      <p className="text-2xl font-bold text-slate-200">{simulationResult.metrics.remainingVolume.toFixed(2)} <span className="text-xs text-slate-600 font-normal">mm³</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1 uppercase">Max Deviation (Gouge)</p>
                      <p className="text-2xl font-bold text-red-400">{simulationResult.metrics.maximumDeviation.toFixed(4)} <span className="text-xs text-slate-600 font-normal">mm</span></p>
                    </div>
                  </div>

                  <div className="bg-black/50 rounded-lg p-4 border border-slate-800 flex flex-col justify-center items-center">
                    <div className="w-32 h-32 rounded-full border-4 border-emerald-500/20 flex items-center justify-center relative">
                      <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin-slow"></div>
                      <span className="text-2xl font-bold text-white">98%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-4 font-bold uppercase">Volume Efficiency</p>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-800">
                  <h4 className="text-[10px] font-bold text-slate-500 mb-4 uppercase">Deviation Map Samples</h4>
                  <div className="space-y-2">
                    {simulationResult.deviationMap.points.slice(0, 5).map((p, i) => (
                      <div key={i} className="flex justify-between items-center bg-black/30 p-2 rounded border border-slate-800/50">
                        <span className="text-slate-500">PT_{i.toString().padStart(3, '0')}</span>
                        <div className="flex gap-4">
                          <span className="text-slate-400 text-[9px] font-mono">[{p.point.x.toFixed(2)}, {p.point.y.toFixed(2)}, {p.point.z.toFixed(2)}]</span>
                          <span className={`font-bold ${p.deviation > 0.04 ? 'text-red-400' : 'text-emerald-400'}`}>{p.deviation.toFixed(5)}mm</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'acceptance' && simulationResult && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-xs uppercase tracking-widest">Hard Acceptance Gate 109</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[8px] text-slate-500 uppercase">Score</p>
                      <p className="text-sm font-bold text-emerald-400">{simulationResult.gateResult.scorePercentage.toFixed(1)}%</p>
                    </div>
                    <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">QUALIFIED</span>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
                  {simulationResult.gateResult.details.map((check, i) => (
                    <div key={i} className="p-3 flex items-start justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="flex gap-3">
                        <div className="mt-0.5">
                          {check.status === 'PASS' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-200">{check.checkName}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">{check.evidence}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        check.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {check.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'events' && simulationResult && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              {simulationResult.events.map((event, i) => (
                <div key={i} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-start gap-4">
                  <div className="p-2 bg-slate-800 rounded text-slate-400">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-400 font-bold text-[10px]">{event.type}</span>
                      <span className="text-slate-500 text-[8px]">{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">{event.evidenceReference}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-[8px] text-slate-600 bg-black px-1.5 py-0.5 rounded">HASH: {event.stockStateHash}</span>
                      <span className="text-[8px] text-slate-600 bg-black px-1.5 py-0.5 rounded">ID: {event.eventId}</span>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center text-[10px] text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>ENGINE: SECP_SIM_109_v2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Box className="w-3 h-3" />
            <span>REPRESENTATION: VOXEL_GRID_512</span>
          </div>
        </div>
        <div className="font-bold text-slate-400">
          PATCH-109-QUALIFIED-TRUTH
        </div>
      </div>
    </div>
  );
};
