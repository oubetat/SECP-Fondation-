import React, { useState } from 'react';
import {
  MechanicsEngine,
  FluidsEngine,
  ThermodynamicsEngine,
  ElectricalCoreEngine
} from '../engine/engineeringCore';
import { Calculator, Cpu, Wind, Flame, Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const EngineeringCorePanel: React.FC = () => {
  const [subTab, setSubTab] = useState<'MECHANICS' | 'FLUIDS' | 'THERMO' | 'ELECTRICAL'>('MECHANICS');

  // Mechanics state
  const [forceMass, setForceMass] = useState(150); // kg
  const [forceAccel, setForceAccel] = useState(9.81); // m/s²
  const [torqueForce, setTorqueForce] = useState(2500); // N
  const [torqueRadius, setTorqueRadius] = useState(0.35); // m
  const [motorRpm, setMotorRpm] = useState(1750); // RPM
  const [beamForce, setBeamForce] = useState(12000); // N
  const [beamArea, setBeamArea] = useState(0.0004); // m² (400 mm²)
  const [youngModulus, setYoungModulus] = useState(200); // GPa

  // Fluids state
  const [fluidDiameter, setFluidDiameter] = useState(0.05); // 50 mm
  const [fluidVel, setFluidVel] = useState(2.5); // m/s
  const [fluidDensity, setFluidDensity] = useState(998); // kg/m³ water
  const [fluidViscosity, setFluidViscosity] = useState(0.001002); // Pa·s
  const [pipeLength, setPipeLength] = useState(15); // m
  const [frictionFactor, setFrictionFactor] = useState(0.02);

  // Thermo state
  const [kCond, setKCond] = useState(50); // W/mK steel
  const [areaThermo, setAreaThermo] = useState(0.25); // m²
  const [deltaTThermo, setDeltaTThermo] = useState(75); // °C
  const [thicknessThermo, setThicknessThermo] = useState(0.012); // 12 mm
  const [alphaExpansion, setAlphaExpansion] = useState(12e-6);

  // Electrical state
  const [elecVoltage, setElecVoltage] = useState(24); // V
  const [elecCurrent, setElecCurrent] = useState(8.5); // A
  const [wireLen, setWireLen] = useState(25); // m
  const [wireGaugeMm2, setWireGaugeMm2] = useState(2.5); // mm²

  // Calculated Mechanics
  const calcForceN = MechanicsEngine.calculateForceFromAcceleration(forceMass, forceAccel);
  const calcTorqueNm = MechanicsEngine.calculateTorque(torqueForce, torqueRadius);
  const calcPowerW = MechanicsEngine.calculatePowerFromTorque(calcTorqueNm, motorRpm);
  const calcStressMPa = MechanicsEngine.calculateStressMPa(beamForce, beamArea);
  const calcStrain = MechanicsEngine.calculateStrain(calcStressMPa, youngModulus);
  const boxInertia = MechanicsEngine.calculateBoxInertia(forceMass, 0.2, 0.1);

  // Calculated Fluids
  const flowRateM3S = FluidsEngine.calculateFlowRate((Math.PI * Math.pow(fluidDiameter, 2)) / 4, fluidVel);
  const reynoldsObj = FluidsEngine.calculateReynoldsNumber(fluidDensity, fluidVel, fluidDiameter, fluidViscosity);
  const pressDropPa = FluidsEngine.calculatePressureDropPa(frictionFactor, pipeLength, fluidDiameter, fluidDensity, fluidVel);

  // Calculated Thermo
  const qCondW = ThermodynamicsEngine.calculateConductionHeatWatts(kCond, areaThermo, deltaTThermo, thicknessThermo);
  const thermoStressMPa = ThermodynamicsEngine.calculateThermalStressMPa(youngModulus, alphaExpansion, deltaTThermo);

  // Calculated Electrical
  const resistanceOhms = ElectricalCoreEngine.calculateCurrent(elecVoltage, elecCurrent) > 0 ? elecVoltage / elecCurrent : 0;
  const powerWatts = ElectricalCoreEngine.calculateDCPowerWatts(elecVoltage, elecCurrent);
  const vDrop = ElectricalCoreEngine.calculateWireVoltageDrop(wireLen, elecCurrent, wireGaugeMm2);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <Calculator className="w-5 h-5" />
            PATCH-SECP-010 — Independent Engineering Calculation Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Core multi-physics solvers for Mechanics, Fluids, Thermodynamics, and Electrical engineering.
          </p>
        </div>
      </div>

      {/* Sub-workbench Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSubTab('MECHANICS')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            subTab === 'MECHANICS' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Mechanics
        </button>

        <button
          onClick={() => setSubTab('FLUIDS')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            subTab === 'FLUIDS' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-400 hover:text-white'
          }`}
        >
          <Wind className="w-4 h-4" />
          Fluids
        </button>

        <button
          onClick={() => setSubTab('THERMO')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            subTab === 'THERMO' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-400 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4" />
          Thermodynamics
        </button>

        <button
          onClick={() => setSubTab('ELECTRICAL')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            subTab === 'ELECTRICAL' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800/60 text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          Electrical
        </button>
      </div>

      {/* Mechanics Content */}
      {subTab === 'MECHANICS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-3">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Force, Torque & Shaft Power</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Mass (kg)</label>
                <input
                  type="number"
                  value={forceMass}
                  onChange={e => setForceMass(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Accel (m/s²)</label>
                <input
                  type="number"
                  value={forceAccel}
                  onChange={e => setForceAccel(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Lever Arm Radius (m)</label>
                <input
                  type="number"
                  step="0.05"
                  value={torqueRadius}
                  onChange={e => setTorqueRadius(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Motor Speed (RPM)</label>
                <input
                  type="number"
                  value={motorRpm}
                  onChange={e => setMotorRpm(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg font-mono text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Calculated Force F = m·a:</span>
                <span className="font-bold text-emerald-400">{calcForceN.toFixed(1)} N</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Torque τ = F·r:</span>
                <span className="font-bold text-indigo-300">{calcTorqueNm.toFixed(2)} N·m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Shaft Mechanical Power P = τ·ω:</span>
                <span className="font-bold text-amber-400">{(calcPowerW / 1000).toFixed(2)} kW ({(calcPowerW / 745.7).toFixed(2)} HP)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-3">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Stress, Strain & Mass Inertia</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Tensile Force (N)</label>
                <input
                  type="number"
                  value={beamForce}
                  onChange={e => setBeamForce(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Cross Section Area (m²)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={beamArea}
                  onChange={e => setBeamArea(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg font-mono text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Stress σ = F/A:</span>
                <span className="font-bold text-rose-400">{calcStressMPa.toFixed(2)} MPa</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Strain ε = σ/E:</span>
                <span className="font-bold text-cyan-300">{(calcStrain * 1e6).toFixed(1)} µm/m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Box Moment of Inertia I_zz:</span>
                <span className="font-bold text-purple-300">{boxInertia.toFixed(4)} kg·m²</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fluids Content */}
      {subTab === 'FLUIDS' && (
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-4">
          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">Hydrodynamics & Pipe Flow Mechanics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Pipe Inner Dia (m)</label>
              <input
                type="number"
                step="0.01"
                value={fluidDiameter}
                onChange={e => setFluidDiameter(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Fluid Velocity (m/s)</label>
              <input
                type="number"
                step="0.1"
                value={fluidVel}
                onChange={e => setFluidVel(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Fluid Density (kg/m³)</label>
              <input
                type="number"
                value={fluidDensity}
                onChange={e => setFluidDensity(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Pipe Length (m)</label>
              <input
                type="number"
                value={pipeLength}
                onChange={e => setPipeLength(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-cyan-800/40 rounded-lg font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Volumetric Flow Rate Q:</span>
              <span className="font-bold text-cyan-300">{(flowRateM3S * 1000).toFixed(2)} L/s ({(flowRateM3S * 3600).toFixed(2)} m³/h)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reynolds Number Re:</span>
              <span className="font-bold text-amber-300">{reynoldsObj.reynoldsNumber.toFixed(0)} ({reynoldsObj.flowType} FLOW)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Darcy Friction Pressure Drop ΔP:</span>
              <span className="font-bold text-emerald-400">{(pressDropPa / 1000).toFixed(2)} kPa ({(pressDropPa / 100000).toFixed(3)} bar)</span>
            </div>
          </div>
        </div>
      )}

      {/* Thermo Content */}
      {subTab === 'THERMO' && (
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-4">
          <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wide">Heat Transfer & Thermal Stress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Conductivity k (W/mK)</label>
              <input
                type="number"
                value={kCond}
                onChange={e => setKCond(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Transfer Area (m²)</label>
              <input
                type="number"
                step="0.05"
                value={areaThermo}
                onChange={e => setAreaThermo(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Wall Thickness (m)</label>
              <input
                type="number"
                step="0.001"
                value={thicknessThermo}
                onChange={e => setThicknessThermo(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Delta Temp ΔT (°C)</label>
              <input
                type="number"
                value={deltaTThermo}
                onChange={e => setDeltaTThermo(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-amber-800/40 rounded-lg font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Conductive Heat Loss Q:</span>
              <span className="font-bold text-amber-300">{(qCondW / 1000).toFixed(2)} kW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Constrained Thermal Stress σ_th:</span>
              <span className="font-bold text-rose-400">{thermoStressMPa.toFixed(1)} MPa</span>
            </div>
          </div>
        </div>
      )}

      {/* Electrical Content */}
      {subTab === 'ELECTRICAL' && (
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-4">
          <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wide">DC & Wire Transmission Calculations</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Supply Voltage (V)</label>
              <input
                type="number"
                value={elecVoltage}
                onChange={e => setElecVoltage(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Current Draw (A)</label>
              <input
                type="number"
                step="0.5"
                value={elecCurrent}
                onChange={e => setElecCurrent(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Wire Run Length (m)</label>
              <input
                type="number"
                value={wireLen}
                onChange={e => setWireLen(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Wire Gauge (mm²)</label>
              <input
                type="number"
                step="0.5"
                value={wireGaugeMm2}
                onChange={e => setWireGaugeMm2(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-emerald-800/40 rounded-lg font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Circuit Resistance R = V/I:</span>
              <span className="font-bold text-emerald-300">{resistanceOhms.toFixed(2)} Ω</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DC Electric Power P = V·I:</span>
              <span className="font-bold text-amber-300">{powerWatts.toFixed(1)} Watts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Wire Transmission Line Voltage Drop ΔV:</span>
              <span className="font-bold text-rose-400">{vDrop.toFixed(2)} Volts ({((vDrop / elecVoltage) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
