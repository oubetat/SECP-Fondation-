import React, { useState } from 'react';
import {
  MechanicsEngine,
  FluidsEngine,
  ThermodynamicsEngine,
  ElectricalCoreEngine
} from '../engine/engineeringCore';
import { Calculator, Cpu, Wind, Flame, Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface EngineeringCorePanelProps {
  canonicalDocument?: any;
  activeSolid?: any;
}

export const EngineeringCorePanel: React.FC<EngineeringCorePanelProps> = ({
  canonicalDocument,
  activeSolid
}) => {
  const hasCADGeometry = Boolean(activeSolid || (canonicalDocument?.features && canonicalDocument.features.length > 0));
  const modelName = activeSolid?.name || canonicalDocument?.documentId || (hasCADGeometry ? 'ACTIVE_CAD_MODEL' : 'EMPTY_CANVAS');
  const initialWidthM = activeSolid?.dimensions ? (activeSolid.dimensions.width / 1000) : (hasCADGeometry ? 0.05 : 0);
  const initialHeightM = activeSolid?.dimensions ? (activeSolid.dimensions.height / 1000) : (hasCADGeometry ? 0.05 : 0);
  const initialAreaM2 = initialWidthM * initialHeightM;

  const [subTab, setSubTab] = useState<'MECHANICS' | 'FLUIDS' | 'THERMO' | 'ELECTRICAL'>('MECHANICS');

  // Mechanics state - Use null to represent absence of canonical engineering data
  const [forceMass, setForceMass] = useState<number | null>(null); 
  const [forceAccel, setForceAccel] = useState<number | null>(null); 
  const [torqueForce, setTorqueForce] = useState<number | null>(null);
  const [torqueRadius, setTorqueRadius] = useState<number | null>(null);
  const [motorRpm, setMotorRpm] = useState<number | null>(null);
  const [beamForce, setBeamForce] = useState<number | null>(null);
  const [beamArea, setBeamArea] = useState<number | null>(null);
  const [youngModulus, setYoungModulus] = useState<number | null>(null); 

  // Fluids state
  const [fluidDiameter, setFluidDiameter] = useState<number | null>(null);
  const [fluidVel, setFluidVel] = useState<number | null>(null);
  const [fluidDensity, setFluidDensity] = useState<number | null>(null); 
  const [fluidViscosity, setFluidViscosity] = useState<number | null>(null); 
  const [pipeLength, setPipeLength] = useState<number | null>(null);
  const [frictionFactor, setFrictionFactor] = useState<number | null>(null);

  // Thermo state
  const [kCond, setKCond] = useState<number | null>(null); 
  const [areaThermo, setAreaThermo] = useState<number | null>(null);
  const [deltaTThermo, setDeltaTThermo] = useState<number | null>(null);
  const [thicknessThermo, setThicknessThermo] = useState<number | null>(null);
  const [alphaExpansion, setAlphaExpansion] = useState<number | null>(null);

  // Electrical state
  const [elecVoltage, setElecVoltage] = useState<number | null>(null);
  const [elecCurrent, setElecCurrent] = useState<number | null>(null);
  const [wireLen, setWireLen] = useState<number | null>(null);
  const [wireGaugeMm2, setWireGaugeMm2] = useState<number | null>(null);

  // Helper for safe calculations
  const isAvailable = (...vals: (number | null)[]) => vals.every(v => v !== null);

  // Calculated Mechanics
  const calcForceN = isAvailable(forceMass, forceAccel) ? MechanicsEngine.calculateForceFromAcceleration(forceMass!, forceAccel!) : null;
  const calcTorqueNm = isAvailable(torqueForce, torqueRadius) ? MechanicsEngine.calculateTorque(torqueForce!, torqueRadius!) : null;
  const calcPowerW = isAvailable(calcTorqueNm, motorRpm) ? MechanicsEngine.calculatePowerFromTorque(calcTorqueNm!, motorRpm!) : null;
  const calcStressMPa = isAvailable(beamForce, beamArea) ? MechanicsEngine.calculateStressMPa(beamForce!, beamArea!) : null;
  const calcStrain = isAvailable(calcStressMPa, youngModulus) ? MechanicsEngine.calculateStrain(calcStressMPa!, youngModulus!) : null;
  const boxInertia = isAvailable(forceMass) ? MechanicsEngine.calculateBoxInertia(forceMass!, 0.2, 0.1) : null;

  // Calculated Fluids
  const flowRateM3S = isAvailable(fluidDiameter, fluidVel) ? FluidsEngine.calculateFlowRate((Math.PI * Math.pow(fluidDiameter!, 2)) / 4, fluidVel!) : null;
  const reynoldsObj = isAvailable(fluidDensity, fluidVel, fluidDiameter, fluidViscosity) ? FluidsEngine.calculateReynoldsNumber(fluidDensity!, fluidVel!, fluidDiameter!, fluidViscosity!) : null;
  const pressDropPa = isAvailable(frictionFactor, pipeLength, fluidDiameter, fluidDensity, fluidVel) ? FluidsEngine.calculatePressureDropPa(frictionFactor!, pipeLength!, fluidDiameter!, fluidDensity!, fluidVel!) : null;

  // Calculated Thermo
  const qCondW = isAvailable(kCond, areaThermo, deltaTThermo, thicknessThermo) ? ThermodynamicsEngine.calculateConductionHeatWatts(kCond!, areaThermo!, deltaTThermo!, thicknessThermo!) : null;
  const thermoStressMPa = isAvailable(youngModulus, alphaExpansion, deltaTThermo) ? ThermodynamicsEngine.calculateThermalStressMPa(youngModulus!, alphaExpansion!, deltaTThermo!) : null;

  // Calculated Electrical
  const resistanceOhms = isAvailable(elecVoltage, elecCurrent) && ElectricalCoreEngine.calculateCurrent(elecVoltage!, elecCurrent!) > 0 ? elecVoltage! / elecCurrent! : null;
  const powerWatts = isAvailable(elecVoltage, elecCurrent) ? ElectricalCoreEngine.calculateDCPowerWatts(elecVoltage!, elecCurrent!) : null;
  const vDrop = isAvailable(wireLen, elecCurrent, wireGaugeMm2) ? ElectricalCoreEngine.calculateWireVoltageDrop(wireLen!, elecCurrent!, wireGaugeMm2!) : null;

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
                  value={forceMass ?? ''}
                  placeholder="UNAVAILABLE"
                  onChange={e => setForceMass(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Accel (m/s²)</label>
                <input
                  type="number"
                  value={forceAccel ?? ''}
                  placeholder="UNAVAILABLE"
                  onChange={e => setForceAccel(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Lever Arm Radius (m)</label>
                <input
                  type="number"
                  step="0.05"
                  value={torqueRadius ?? ''}
                  placeholder="UNAVAILABLE"
                  onChange={e => setTorqueRadius(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Motor Speed (RPM)</label>
                <input
                  type="number"
                  value={motorRpm ?? ''}
                  placeholder="UNAVAILABLE"
                  onChange={e => setMotorRpm(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg font-mono text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Calculated Force F = m·a:</span>
                <span className="font-bold text-emerald-400">{calcForceN !== null ? `${calcForceN.toFixed(1)} N` : 'UNAVAILABLE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Torque τ = F·r:</span>
                <span className="font-bold text-indigo-300">{calcTorqueNm !== null ? `${calcTorqueNm.toFixed(2)} N·m` : 'UNAVAILABLE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Shaft Mechanical Power P = τ·ω:</span>
                <span className="font-bold text-amber-400">
                  {calcPowerW !== null ? `${(calcPowerW / 1000).toFixed(2)} kW (${(calcPowerW / 745.7).toFixed(2)} HP)` : 'UNAVAILABLE'}
                </span>
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
                  value={beamForce ?? ''}
                  placeholder="UNAVAILABLE"
                  onChange={e => setBeamForce(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Cross Section Area (m²)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={beamArea ?? ''}
                  placeholder="UNAVAILABLE"
                  onChange={e => setBeamArea(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg font-mono text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Stress σ = F/A:</span>
                <span className="font-bold text-rose-400">{calcStressMPa !== null ? `${calcStressMPa.toFixed(2)} MPa` : 'UNAVAILABLE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Strain ε = σ/E:</span>
                <span className="font-bold text-cyan-300">{calcStrain !== null ? `${(calcStrain * 1e6).toFixed(1)} µm/m` : 'UNAVAILABLE'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Box Moment of Inertia I_zz:</span>
                <span className="font-bold text-purple-300">{boxInertia !== null ? `${boxInertia.toFixed(4)} kg·m²` : 'UNAVAILABLE'}</span>
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
                value={fluidDiameter ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setFluidDiameter(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Fluid Velocity (m/s)</label>
              <input
                type="number"
                step="0.1"
                value={fluidVel ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setFluidVel(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Fluid Density (kg/m³)</label>
              <input
                type="number"
                value={fluidDensity ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setFluidDensity(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Pipe Length (m)</label>
              <input
                type="number"
                value={pipeLength ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setPipeLength(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-cyan-800/40 rounded-lg font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Volumetric Flow Rate Q:</span>
              <span className="font-bold text-cyan-300">
                {flowRateM3S !== null ? `${(flowRateM3S * 1000).toFixed(2)} L/s (${(flowRateM3S * 3600).toFixed(2)} m³/h)` : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reynolds Number Re:</span>
              <span className="font-bold text-amber-300">
                {reynoldsObj !== null ? `${reynoldsObj.reynoldsNumber.toFixed(0)} (${reynoldsObj.flowType} FLOW)` : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Darcy Friction Pressure Drop ΔP:</span>
              <span className="font-bold text-emerald-400">
                {pressDropPa !== null ? `${(pressDropPa / 1000).toFixed(2)} kPa (${(pressDropPa / 100000).toFixed(3)} bar)` : 'UNAVAILABLE'}
              </span>
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
                value={kCond ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setKCond(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Transfer Area (m²)</label>
              <input
                type="number"
                step="0.05"
                value={areaThermo ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setAreaThermo(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Wall Thickness (m)</label>
              <input
                type="number"
                step="0.001"
                value={thicknessThermo ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setThicknessThermo(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Delta Temp ΔT (°C)</label>
              <input
                type="number"
                value={deltaTThermo ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setDeltaTThermo(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-amber-800/40 rounded-lg font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Conductive Heat Loss Q:</span>
              <span className="font-bold text-amber-300">{qCondW !== null ? `${(qCondW / 1000).toFixed(2)} kW` : 'UNAVAILABLE'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Constrained Thermal Stress σ_th:</span>
              <span className="font-bold text-rose-400">{thermoStressMPa !== null ? `${thermoStressMPa.toFixed(1)} MPa` : 'UNAVAILABLE'}</span>
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
                value={elecVoltage ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setElecVoltage(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Current Draw (A)</label>
              <input
                type="number"
                step="0.5"
                value={elecCurrent ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setElecCurrent(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Wire Run Length (m)</label>
              <input
                type="number"
                value={wireLen ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setWireLen(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Wire Gauge (mm²)</label>
              <input
                type="number"
                step="0.5"
                value={wireGaugeMm2 ?? ''}
                placeholder="UNAVAILABLE"
                onChange={e => setWireGaugeMm2(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-emerald-800/40 rounded-lg font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Circuit Resistance R = V/I:</span>
              <span className="font-bold text-emerald-300">{resistanceOhms !== null ? `${resistanceOhms.toFixed(2)} Ω` : 'UNAVAILABLE'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DC Electric Power P = V·I:</span>
              <span className="font-bold text-amber-300">{powerWatts !== null ? `${powerWatts.toFixed(1)} Watts` : 'UNAVAILABLE'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Wire Transmission Line Voltage Drop ΔV:</span>
              <span className="font-bold text-rose-400">
                {vDrop !== null && elecVoltage ? `${vDrop.toFixed(2)} Volts (${((vDrop / elecVoltage) * 100).toFixed(1)}%)` : 'UNAVAILABLE'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
