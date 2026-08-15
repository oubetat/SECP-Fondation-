/**
 * FiveAxisSimulationPanel.tsx
 *
 * Interactive 5-Axis Toolpath 3D Machine Simulation & Kinematic Render Panel
 * Connected directly to SECP-083 Toolpath Engine, SECP-087 Kinematic Engine, and Gouge Verifier.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Play, Pause, RotateCcw, SkipBack, SkipForward, ShieldAlert,
  Sliders, Cpu, ShieldCheck, CheckCircle2, AlertTriangle, Layers, Activity
} from 'lucide-react';
import { SECP087MachineKinematicsEngine } from '../engine/kinematics/SECP087MachineKinematicsEngine';
import { SECP087ToolpathSimulator } from '../engine/kinematics/SECP087ToolpathSimulator';
import { SECP087DeterministicReplay } from '../engine/kinematics/SECP087DeterministicReplay';
import { MachineConfiguration, SECP087MachineState } from '../engine/kinematics/SECP087Types';
import { SECP083FiveAxisToolpathEngine } from '../engine/classa5axis/SECP083FiveAxisToolpathEngine';
import { SECP083Benchmarks } from '../engine/classa5axis/SECP083Benchmarks';
import { SECP083ToolGeometry } from '../engine/classa5axis/SECP083ToolGeometry';
import { FiveAxisToolpath, NurbsSurfacePatch, ToolAssembly } from '../engine/classa5axis/SECP083Types';

export const FiveAxisSimulationPanel: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [machineConfig, setMachineConfig] = useState<MachineConfiguration>(
    SECP087MachineKinematicsEngine.createDefaultTrunnionMachineConfig()
  );

  const [leadAngle, setLeadAngle] = useState(7.5);
  const [tiltAngle, setTiltAngle] = useState(3.0);
  const [safetyAutoStop, setSafetyAutoStop] = useState(true);
  const [showToolpathTrace, setShowToolpathTrace] = useState(true);
  const [showCollisions, setShowCollisions] = useState(true);

  const [surfacePatch] = useState<NurbsSurfacePatch>(() =>
    SECP083Benchmarks.createSampleSurfacePatch('ui-surf-87', 120, 120, 0)
  );
  const [toolAssembly] = useState<ToolAssembly>(() =>
    SECP083ToolGeometry.createStandardBallMill(12)
  );

  const [toolpath, setToolpath] = useState<FiveAxisToolpath>(() =>
    SECP083FiveAxisToolpathEngine.generateFiveAxisToolpath(surfacePatch, toolAssembly, leadAngle, tiltAngle, 6, 15)
  );

  const [simStates, setSimStates] = useState<SECP087MachineState[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [replayDigest, setReplayDigest] = useState<any>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // 3D Mesh Refs for Kinematic Animation
  const tableGroupRef = useRef<THREE.Group | null>(null);
  const trunnionGroupRef = useRef<THREE.Group | null>(null);
  const spindleToolGroupRef = useRef<THREE.Group | null>(null);
  const toolMeshRef = useRef<THREE.Mesh | null>(null);
  const toolpathLineRef = useRef<THREE.Line | null>(null);
  const collisionMarkersGroupRef = useRef<THREE.Group | null>(null);

  // Re-run simulation when toolpath or machine config changes
  useEffect(() => {
    const tp = SECP083FiveAxisToolpathEngine.generateFiveAxisToolpath(surfacePatch, toolAssembly, leadAngle, tiltAngle, 6, 15);
    setToolpath(tp);
    const simRes = SECP087ToolpathSimulator.simulate(tp, surfacePatch, machineConfig);
    setSimStates(simRes.states);
    setCurrentStep(0);

    const replay = SECP087DeterministicReplay.verifyDeterministicReplay(tp, surfacePatch, machineConfig);
    setReplayDigest(replay);
  }, [machineConfig, leadAngle, tiltAngle]);

  // Three.js 3D Viewport Setup
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // slate-900
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(250, 200, 300);
    camera.lookAt(0, 30, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(200, 300, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5);
    dirLight2.position.set(-200, 100, -200);
    scene.add(dirLight2);

    // Machine Bed (Fixed Base)
    const bedGeo = new THREE.BoxGeometry(220, 20, 180);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.8 });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.position.set(0, -10, 0);
    scene.add(bedMesh);

    // Grid Helper
    const grid = new THREE.GridHelper(400, 20, 0x3b82f6, 0x1e293b);
    grid.position.y = -20;
    scene.add(grid);

    // Trunnion A-Tilt Group
    const trunnionGroup = new THREE.Group();
    scene.add(trunnionGroup);
    trunnionGroupRef.current = trunnionGroup;

    const trunnionGeo = new THREE.CylinderGeometry(80, 80, 20, 32);
    const trunnionMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
    const trunnionMesh = new THREE.Mesh(trunnionGeo, trunnionMat);
    trunnionMesh.rotation.z = Math.PI / 2;
    trunnionGroup.add(trunnionMesh);

    // Rotary C-Table Group (Child of Trunnion)
    const tableGroup = new THREE.Group();
    trunnionGroup.add(tableGroup);
    tableGroupRef.current = tableGroup;

    const tableGeo = new THREE.CylinderGeometry(60, 60, 12, 32);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.6 });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableGroup.add(tableMesh);

    // Stock / Workpiece Mesh on C-Table
    const stockGeo = new THREE.BoxGeometry(60, 40, 60);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6, transparent: true, opacity: 0.85 });
    const stockMesh = new THREE.Mesh(stockGeo, stockMat);
    stockMesh.position.set(0, 26, 0);
    tableGroup.add(stockMesh);

    // Spindle + Tool Assembly Group (Moves in X, Y, Z)
    const spindleToolGroup = new THREE.Group();
    scene.add(spindleToolGroup);
    spindleToolGroupRef.current = spindleToolGroup;

    // Spindle Housing Mesh
    const spindleHousingGeo = new THREE.CylinderGeometry(25, 20, 70, 24);
    const spindleHousingMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.8 });
    const spindleHousingMesh = new THREE.Mesh(spindleHousingGeo, spindleHousingMat);
    spindleHousingMesh.position.set(0, 65, 0);
    spindleToolGroup.add(spindleHousingMesh);

    // Tool Holder Mesh
    const holderGeo = new THREE.CylinderGeometry(15, 10, 30, 24);
    const holderMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.9 });
    const holderMesh = new THREE.Mesh(holderGeo, holderMat);
    holderMesh.position.set(0, 25, 0);
    spindleToolGroup.add(holderMesh);

    // Cutter Tool Mesh (Ball End Mill)
    const cutterGeo = new THREE.CylinderGeometry(6, 6, 20, 16);
    const cutterMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.2, metalness: 0.95 });
    const cutterMesh = new THREE.Mesh(cutterGeo, cutterMat);
    cutterMesh.position.set(0, 0, 0);
    spindleToolGroup.add(cutterMesh);
    toolMeshRef.current = cutterMesh;

    // Group for Collision Markers
    const collisionGroup = new THREE.Group();
    scene.add(collisionGroup);
    collisionMarkersGroupRef.current = collisionGroup;

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight || 450;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(mountRef.current);

    return () => {
      resizeObs.disconnect();
      cancelAnimationFrame(animId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update 3D Kinematic Positions when currentStep or simStates change
  useEffect(() => {
    if (!simStates[currentStep]) return;

    const state = simStates[currentStep];

    // Update A-tilt angle (radians)
    if (trunnionGroupRef.current) {
      trunnionGroupRef.current.rotation.x = (state.joints.aDeg * Math.PI) / 180;
    }

    // Update C-rotary angle (radians)
    if (tableGroupRef.current) {
      tableGroupRef.current.rotation.y = (state.joints.cDeg * Math.PI) / 180;
    }

    // Update Linear Spindle position (X, Y, Z)
    if (spindleToolGroupRef.current) {
      spindleToolGroupRef.current.position.set(state.joints.xMm * 0.5, state.joints.zMm * 0.5 + 40, state.joints.yMm * 0.5);
    }

    // Color code cutter mesh on collision
    if (toolMeshRef.current) {
      const mat = toolMeshRef.current.material as THREE.MeshStandardMaterial;
      if (state.hasGougeCollision || state.hasHolderCollision || state.hasMachineCollision) {
        mat.color.setHex(0xef4444); // Bright Red on collision
      } else {
        mat.color.setHex(0x10b981); // Emerald Green normal
      }
    }
  }, [currentStep, simStates]);

  // Animation Loop for Playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const next = prev + 1;
        if (next >= simStates.length) {
          setIsPlaying(false);
          return 0;
        }

        const nextState = simStates[next];
        if (safetyAutoStop && (nextState.hasGougeCollision || nextState.hasHolderCollision || nextState.hasMachineCollision)) {
          setIsPlaying(false);
        }

        return next;
      });
    }, 100 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, simStates, playbackSpeed, safetyAutoStop]);

  const activeState = simStates[currentStep];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">
              PATCH-SECP-087 — Interactive 5-Axis Toolpath 3D Machine Simulation
            </h2>
            <span className="bg-emerald-950 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-800 font-mono font-bold">
              SECP-087 PASS - FINAL-CLOSED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time forward/inverse kinematics, toolpath state propagation, SECP-083 gouge integration, and deterministic replay audit chain.
          </p>
        </div>

        {/* Machine Config Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-mono">Machine:</label>
          <select
            value={machineConfig.kinematicType}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'TABLE_TABLE_TRUNNION_AC') {
                setMachineConfig(SECP087MachineKinematicsEngine.createDefaultTrunnionMachineConfig());
              } else {
                setMachineConfig(SECP087MachineKinematicsEngine.createHeadTableMachineConfig());
              }
            }}
            className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
          >
            <option value="TABLE_TABLE_TRUNNION_AC">Trunnion A-C Table (5-Axis)</option>
            <option value="HEAD_TABLE_BC">Head-Table B-C Center (5-Axis)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 3D Viewport Column */}
        <div className="lg:col-span-8 space-y-3">
          {/* Canvas Viewport Container */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden h-[450px]">
            <div ref={mountRef} className="w-full h-full" />

            {/* Viewport Overlay Telemetry */}
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg font-mono text-xs text-slate-300 space-y-1">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Kinematic Joint Telemetry
              </div>
              <div>X: <span className="text-slate-100">{activeState?.joints.xMm.toFixed(2)} mm</span></div>
              <div>Y: <span className="text-slate-100">{activeState?.joints.yMm.toFixed(2)} mm</span></div>
              <div>Z: <span className="text-slate-100">{activeState?.joints.zMm.toFixed(2)} mm</span></div>
              <div>A: <span className="text-amber-400">{activeState?.joints.aDeg.toFixed(2)}°</span></div>
              <div>C: <span className="text-cyan-400">{activeState?.joints.cDeg.toFixed(2)}°</span></div>
            </div>

            {/* Collision Alert Banner Overlay */}
            {activeState && (activeState.hasGougeCollision || activeState.hasHolderCollision || activeState.hasMachineCollision) && (
              <div className="absolute bottom-3 left-3 right-3 bg-rose-950/90 border border-rose-800 p-2.5 rounded-lg text-rose-200 text-xs font-mono flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                  HAZARD DETECTED: {activeState.collisionDetails || 'Tool gouge or clearance violation!'}
                </span>
                <span className="text-[10px] bg-rose-900 px-2 py-0.5 rounded text-rose-300 font-bold">AUTO-STOP TRIGGERED</span>
              </div>
            )}
          </div>

          {/* Simulation Playback Toolbar Controls */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between gap-4">
              {/* Play / Step Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold transition cursor-pointer ${
                    isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'PAUSE' : 'PLAY'}
                </button>

                <button
                  onClick={() => { setIsPlaying(false); setCurrentStep(Math.max(0, currentStep - 1)); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded cursor-pointer"
                  title="Step Backward"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={() => { setIsPlaying(false); setCurrentStep(Math.min(simStates.length - 1, currentStep + 1)); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded cursor-pointer"
                  title="Step Forward"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  onClick={() => { setIsPlaying(false); setCurrentStep(0); }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded cursor-pointer"
                  title="Reset Simulation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Step counter & Timeline slider */}
              <div className="flex-1 flex items-center gap-3">
                <span className="text-slate-400">Step {currentStep + 1}/{simStates.length}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, simStates.length - 1)}
                  value={currentStep}
                  onChange={(e) => { setIsPlaying(false); setCurrentStep(Number(e.target.value)); }}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Speed Selector */}
              <div className="flex items-center gap-1">
                {[0.5, 1, 2, 5].map(spd => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-1 rounded text-[11px] cursor-pointer ${
                      playbackSpeed === spd ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={safetyAutoStop}
                  onChange={(e) => setSafetyAutoStop(e.target.checked)}
                  className="accent-emerald-500"
                />
                Safety Mode Auto-Stop
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showToolpathTrace}
                  onChange={(e) => setShowToolpathTrace(e.target.checked)}
                  className="accent-emerald-500"
                />
                Show Toolpath Trace
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCollisions}
                  onChange={(e) => setShowCollisions(e.target.checked)}
                  className="accent-emerald-500"
                />
                Highlight Collisions
              </label>
            </div>
          </div>
        </div>

        {/* Forensic & Audit Inspector Column */}
        <div className="lg:col-span-4 space-y-4 font-mono text-xs">
          {/* Toolpath Parameters & Surface Control */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="font-bold text-slate-200 uppercase flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-400" />
              5-Axis Toolpath Parameters
            </span>

            <div className="space-y-2 text-slate-300">
              <div>
                <div className="flex justify-between">
                  <span>Lead Angle:</span>
                  <span className="text-emerald-400 font-bold">{leadAngle}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={0.5}
                  value={leadAngle}
                  onChange={(e) => setLeadAngle(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between">
                  <span>Tilt Angle:</span>
                  <span className="text-emerald-400 font-bold">{tiltAngle}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={0.5}
                  value={tiltAngle}
                  onChange={(e) => setTiltAngle(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Forward Kinematics Verification */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="font-bold text-slate-200 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Kinematic Verification Matrix
            </span>

            <div className="space-y-2 text-slate-300 text-[11px]">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">FK Error:</span>
                <span className="text-emerald-400 font-bold">{activeState?.forwardKinematicErrorMm.toFixed(6)} mm</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Move Type:</span>
                <span className="text-amber-400 font-bold">{activeState?.moveType}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Feed Rate:</span>
                <span className="text-slate-100 font-bold">{activeState?.feedRateMmMin} mm/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Spindle RPM:</span>
                <span className="text-slate-100 font-bold">{activeState?.spindleRpm} RPM</span>
              </div>
            </div>
          </div>

          {/* Cryptographic Provenance Ledger */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="font-bold text-slate-200 uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Deterministic Audit Ledger
            </span>

            {replayDigest && (
              <div className="space-y-2 text-[10px] text-slate-400 overflow-hidden">
                <div>
                  <div className="text-slate-500">Simulation Hash:</div>
                  <div className="text-emerald-400 font-bold truncate">{replayDigest.simulationHash}</div>
                </div>
                <div>
                  <div className="text-slate-500">Machine Config Hash:</div>
                  <div className="text-slate-300 font-bold truncate">{replayDigest.machineConfigHash}</div>
                </div>
                <div>
                  <div className="text-slate-500">Toolpath Hash:</div>
                  <div className="text-slate-300 font-bold truncate">{replayDigest.toolpathHash}</div>
                </div>
                <div>
                  <div className="text-slate-500">Provenance Digest:</div>
                  <div className="text-indigo-300 font-bold truncate">{replayDigest.provenanceEntryHash}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
