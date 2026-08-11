import React, { useState, useEffect, useRef } from 'react';
import { KinematicsEngine, KinematicJoint, MechanismSimulationResult } from '../engine/kinematics';
import { Play, Pause, RotateCcw, Activity, Cpu, Sliders, Gauge, Zap } from 'lucide-react';

export const KinematicsPanel: React.FC = () => {
  const [joints, setJoints] = useState<KinematicJoint[]>(() => KinematicsEngine.getDefaultJoints());
  const [crankRadiusMm, setCrankRadiusMm] = useState<number>(60);
  const [connectingRodMm, setConnectingRodMm] = useState<number>(180);
  const [motorRpm, setMotorRpm] = useState<number>(1500);
  const [loadForceN, setLoadForceN] = useState<number>(750);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [animTime, setAnimTime] = useState<number>(0);

  const simulation: MechanismSimulationResult = KinematicsEngine.simulateSliderCrank(
    crankRadiusMm,
    connectingRodMm,
    motorRpm,
    loadForceN
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation Loop
  useEffect(() => {
    let animId: number;
    if (isPlaying) {
      const loop = () => {
        setAnimTime(prev => (prev + 0.01) % simulation.durationS);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, simulation.durationS]);

  // Render Mechanism Canvas Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Origin Center
    const originX = width * 0.28;
    const originY = height * 0.5;

    // Angle at animTime
    const omega = (2 * Math.PI * motorRpm) / 60;
    const thetaRad = omega * animTime;

    const rScale = 1.3;
    const rPx = crankRadiusMm * rScale;
    const lPx = connectingRodMm * rScale;

    // Crank Pin Position
    const crankX = originX + rPx * Math.cos(thetaRad);
    const crankY = originY - rPx * Math.sin(thetaRad);

    // Piston Wrist Pin Position
    const lambda = crankRadiusMm / connectingRodMm;
    const pistonOffsetPx = rPx * ((1 - Math.cos(thetaRad)) + (lambda / 2) * Math.pow(Math.sin(thetaRad), 2));
    const pistonX = originX + rPx + lPx - pistonOffsetPx;
    const pistonY = originY;

    // Draw Cylinder Guide Walls
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(originX + rPx, originY - 35);
    ctx.lineTo(originX + rPx + lPx + 60, originY - 35);
    ctx.moveTo(originX + rPx, originY + 35);
    ctx.lineTo(originX + rPx + lPx + 60, originY + 35);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Crank Center Anchor (Ground Joint)
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(originX, originY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw Crank Arm
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(crankX, crankY);
    ctx.stroke();

    // Draw Crank Pin Joint
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(crankX, crankY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw Connecting Rod
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(crankX, crankY);
    ctx.lineTo(pistonX, pistonY);
    ctx.stroke();

    // Draw Piston Head
    ctx.fillStyle = '#10b981';
    ctx.fillRect(pistonX - 25, pistonY - 25, 50, 50);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.strokeRect(pistonX - 25, pistonY - 25, 50, 50);

    // Piston Wrist Pin
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pistonX, pistonY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('Revolute Motor Axis', originX - 45, originY + 28);
    ctx.fillText(`Piston: ${pistonOffsetPx.toFixed(1)}mm`, pistonX - 30, pistonY + 42);
  }, [animTime, crankRadiusMm, connectingRodMm, motorRpm]);

  // Interpolate Current Telemetry
  const currFrameIndex = Math.floor((animTime / simulation.durationS) * simulation.sampleCount) % simulation.timeSeries.length;
  const currentFrame = simulation.timeSeries[currFrameIndex] || simulation.timeSeries[0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <Activity className="w-5 h-5" />
            PATCH-SECP-011 — Motion & Kinematics Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Actuator → Kinematic Joint → Mechanism → Dynamic Motion Solver (Position, Velocity, Acceleration, Torque).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-kinematic-anim"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Pause Simulation' : 'Run Kinematics'}
          </button>

          <button
            onClick={() => setAnimTime(0)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
            title="Reset Time t=0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Joint Classification Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Supported Kinematic Joint Workbench</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {joints.map(j => (
            <div key={j.id} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs">
              <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                {j.type}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 truncate">{j.name}</div>
              <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Axis [{j.axis.x},{j.axis.y},{j.axis.z}]</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Controls & Live Canvas Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controls Column */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-indigo-400" />
            Mechanism Parameters
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Crank Radius r:</span>
                <span className="font-mono text-indigo-300 font-bold">{crankRadiusMm} mm</span>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                value={crankRadiusMm}
                onChange={e => setCrankRadiusMm(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Connecting Rod L:</span>
                <span className="font-mono text-purple-300 font-bold">{connectingRodMm} mm</span>
              </div>
              <input
                type="range"
                min="100"
                max="300"
                value={connectingRodMm}
                onChange={e => setConnectingRodMm(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Motor Drive RPM:</span>
                <span className="font-mono text-emerald-300 font-bold">{motorRpm} RPM</span>
              </div>
              <input
                type="range"
                min="100"
                max="3000"
                step="50"
                value={motorRpm}
                onChange={e => setMotorRpm(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Compressor Resistance Force:</span>
                <span className="font-mono text-rose-300 font-bold">{loadForceN} N</span>
              </div>
              <input
                type="range"
                min="0"
                max="2500"
                step="50"
                value={loadForceN}
                onChange={e => setLoadForceN(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Peak Velocity:</span>
              <span className="font-bold text-emerald-400">{simulation.peakVelocityMS.toFixed(2)} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Peak Acceleration:</span>
              <span className="font-bold text-amber-400">{simulation.peakAccelM2S.toFixed(1)} m/s²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Peak Motor Torque:</span>
              <span className="font-bold text-rose-400">{simulation.peakTorqueNm.toFixed(2)} N·m</span>
            </div>
          </div>
        </div>

        {/* Canvas & Real-time Telemetry Column */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 relative overflow-hidden">
            <div className="text-[11px] font-mono text-slate-400 mb-2 flex justify-between items-center">
              <span>Mechanism Motion Rendering (Motor → Joint → Motion)</span>
              <span className="text-indigo-400 font-bold">t = {animTime.toFixed(3)}s</span>
            </div>
            <canvas
              ref={canvasRef}
              width={520}
              height={220}
              className="w-full h-52 bg-slate-900 rounded border border-slate-800/80"
            />
          </div>

          {/* Telemetry Real-time Digital Indicators */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Position</span>
              <span className="text-base font-bold font-mono text-indigo-300">
                {currentFrame.pistonPositionMm.toFixed(1)} mm
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Velocity</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {currentFrame.velocityMS.toFixed(2)} m/s
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Acceleration</span>
              <span className="text-base font-bold font-mono text-amber-400">
                {currentFrame.accelM2S.toFixed(0)} m/s²
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Motor Torque</span>
              <span className="text-base font-bold font-mono text-rose-400">
                {currentFrame.torqueNm.toFixed(2)} N·m
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
