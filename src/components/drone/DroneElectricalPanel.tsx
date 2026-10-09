import React, { useState } from 'react';
import { Zap, Power, ShieldAlert, Cpu, Activity, RefreshCw, Layers, CheckCircle2, AlertTriangle, Battery, Gauge, Sliders, Wind } from 'lucide-react';

interface MotorStatus {
  id: string;
  name: string;
  position: string;
  rotation: 'CW' | 'CCW';
  currentAmps: number;
  rpm: number;
  thrustGrams: number;
  tempCelsius: number;
}

export const DroneElectricalPanel: React.FC = () => {
  const [isMasterPowerOn, setIsMasterPowerOn] = useState<boolean>(true);
  const [isArmed, setIsArmed] = useState<boolean>(false);
  const [throttlePercent, setThrottlePercent] = useState<number>(35); // 35% hover default
  const [fuseBlown, setFuseBlown] = useState<boolean>(false);
  const [rotorStallFault, setRotorStallFault] = useState<boolean>(false);

  // Battery specs (6S 4500mAh 100C LiPo)
  const nominalCellVolts = 3.7;
  const fullCellVolts = 4.2;
  const numCells = 6;
  const packCapacityAh = 4.5;
  const internalResistanceOhms = 0.012; // 12 mOhm total pack Ri

  // Motor & ESC simulation parameters
  const kvRating = 920; // RPM / Volt
  const motorResistance = 0.085; // Ohms per motor phase
  const idleCurrentAmps = 0.6; // Amps per motor at idle

  // Electrical computations
  const restingVoltage = fuseBlown || !isMasterPowerOn ? 0 : numCells * fullCellVolts;

  // Calculate current per motor based on throttle and arming
  const getMotorCurrent = (isFaultedMotor: boolean) => {
    if (!isMasterPowerOn || fuseBlown) return 0;
    if (!isArmed) return 0.05; // ESC standby current
    if (isFaultedMotor && rotorStallFault) {
      return 38.5; // High stall short-circuit current
    }
    const throttleRatio = throttlePercent / 100;
    // Current scales quadratically with throttle: I = I_idle + I_max * (throttle)^2.2
    return idleCurrentAmps + 22.0 * Math.pow(throttleRatio, 2.2);
  };

  const motorFRCurrent = getMotorCurrent(false);
  const motorFLCurrent = getMotorCurrent(rotorStallFault); // Motor 2 simulated fault
  const motorRLCurrent = getMotorCurrent(false);
  const motorRRCurrent = getMotorCurrent(false);

  const avionicsCurrent = isMasterPowerOn && !fuseBlown ? 1.2 : 0; // Flight controller, GPS, Gimbal
  const totalCurrent = motorFRCurrent + motorFLCurrent + motorRLCurrent + motorRRCurrent + avionicsCurrent;

  // Voltage sag under load: V_load = V_rest - I_total * R_internal
  const effectiveVoltage = Math.max(0, restingVoltage - totalCurrent * internalResistanceOhms);
  const totalPowerWatts = effectiveVoltage * totalCurrent;

  // Motor RPM & Thrust
  const getMotorRpm = (current: number, isFaulted: boolean) => {
    if (!isMasterPowerOn || fuseBlown || !isArmed) return 0;
    if (isFaulted && rotorStallFault) return 120; // Stalled rotor
    return Math.round((throttlePercent / 100) * (kvRating * effectiveVoltage * 0.88));
  };

  const getMotorThrustGrams = (rpm: number) => {
    if (rpm <= 500) return 0;
    // 10x4.5 prop thrust curve: T ≈ k * RPM^2
    const k = 0.0000086;
    return Math.min(1280, Math.round(k * Math.pow(rpm, 2)));
  };

  const motors: MotorStatus[] = [
    {
      id: 'M1',
      name: 'Motor 1 (Front-Right)',
      position: 'FR',
      rotation: 'CCW',
      currentAmps: Number(motorFRCurrent.toFixed(1)),
      rpm: getMotorRpm(motorFRCurrent, false),
      thrustGrams: getMotorThrustGrams(getMotorRpm(motorFRCurrent, false)),
      tempCelsius: Math.round(28 + (motorFRCurrent / 22) * 26)
    },
    {
      id: 'M2',
      name: 'Motor 2 (Front-Left)',
      position: 'FL',
      rotation: 'CW',
      currentAmps: Number(motorFLCurrent.toFixed(1)),
      rpm: getMotorRpm(motorFLCurrent, true),
      thrustGrams: getMotorThrustGrams(getMotorRpm(motorFLCurrent, true)),
      tempCelsius: rotorStallFault ? 88 : Math.round(28 + (motorFLCurrent / 22) * 26)
    },
    {
      id: 'M3',
      name: 'Motor 3 (Rear-Left)',
      position: 'RL',
      rotation: 'CCW',
      currentAmps: Number(motorRLCurrent.toFixed(1)),
      rpm: getMotorRpm(motorRLCurrent, false),
      thrustGrams: getMotorThrustGrams(getMotorRpm(motorRLCurrent, false)),
      tempCelsius: Math.round(28 + (motorRLCurrent / 22) * 26)
    },
    {
      id: 'M4',
      name: 'Motor 4 (Rear-Right)',
      position: 'RR',
      rotation: 'CW',
      currentAmps: Number(motorRRCurrent.toFixed(1)),
      rpm: getMotorRpm(motorRRCurrent, false),
      thrustGrams: getMotorThrustGrams(getMotorRpm(motorRRCurrent, false)),
      tempCelsius: Math.round(28 + (motorRRCurrent / 22) * 26)
    }
  ];

  const totalThrustKg = (motors.reduce((acc, m) => acc + m.thrustGrams, 0) / 1000).toFixed(2);
  const droneMassKg = 1.675; // Total drone AUW
  const thrustToWeightRatio = (Number(totalThrustKg) / droneMassKg).toFixed(2);

  const handleTripFuse = () => {
    setFuseBlown(true);
    setIsArmed(false);
  };

  const handleResetFuse = () => {
    setFuseBlown(false);
    setRotorStallFault(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Industrial Drone Electrical & Propulsion Power Workbench
            </h1>
            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs font-mono font-bold">
              6S 22.2V BUS · 120A PDB
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time multi-channel electrical circuit solver, BLHeli_32 ESC telemetry, 100A overcurrent fuse protection & motor thrust dynamics.
          </p>
        </div>

        {/* Master Switches */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMasterPowerOn(!isMasterPowerOn)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition flex items-center gap-2 border ${
              isMasterPowerOn
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30'
            }`}
          >
            <Power className="w-4 h-4" />
            {isMasterPowerOn ? 'MASTER POWER: ON' : 'MASTER POWER: OFF'}
          </button>

          <button
            onClick={() => {
              if (fuseBlown || !isMasterPowerOn) return;
              setIsArmed(!isArmed);
            }}
            disabled={fuseBlown || !isMasterPowerOn}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition flex items-center gap-2 border disabled:opacity-40 ${
              isArmed
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {isArmed ? 'ARMED (HOT ROTORS)' : 'DISARMED (SAFE)'}
          </button>
        </div>
      </div>

      {/* Main Grid: Power Telemetry + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Battery & Bus Gauges */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Battery className="w-4 h-4 text-emerald-400" />
            6S Power Source Telemetry
          </h2>

          <div className="space-y-3">
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 uppercase">Bus Voltage</div>
                <div className="text-2xl font-mono font-bold text-emerald-400">
                  {effectiveVoltage.toFixed(2)} <span className="text-xs font-normal text-slate-400">V</span>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-400 font-mono">
                <div>Cell: {(effectiveVoltage / 6).toFixed(2)} V</div>
                <div>Sag: -{(restingVoltage - effectiveVoltage).toFixed(2)} V</div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 uppercase">Total Current Draw</div>
                <div className="text-2xl font-mono font-bold text-amber-400">
                  {totalCurrent.toFixed(1)} <span className="text-xs font-normal text-slate-400">A</span>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-400 font-mono">
                <div>Peak: 120 A</div>
                <div>Fuse: 100 A</div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 uppercase">Electrical Power</div>
                <div className="text-2xl font-mono font-bold text-sky-400">
                  {Math.round(totalPowerWatts)} <span className="text-xs font-normal text-slate-400">W</span>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-400 font-mono">
                <div>{((totalPowerWatts / 745.7)).toFixed(2)} hp</div>
                <div>Eff: 88.4%</div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-400">100A Master Circuit Fuse:</span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  fuseBlown 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}>
                  {fuseBlown ? 'FUSE BLOWN (OPEN)' : 'INTACT (CLOSED)'}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleTripFuse}
                  disabled={fuseBlown}
                  className="flex-1 py-1 px-2 rounded bg-red-950/40 hover:bg-red-900/40 border border-red-800/40 text-red-300 text-[10px] font-mono transition disabled:opacity-40"
                >
                  Trip Fuse (110A)
                </button>
                <button
                  onClick={handleResetFuse}
                  className="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-mono transition flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right 3 Columns: Throttle & ESC/Motor Telemetry */}
        <div className="lg:col-span-3 space-y-6">
          {/* Throttle & Flight Control Dynamics */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Throttle Command & Flight Controller DShot600 Bus
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-slate-400">Hover Throttle: <strong className="text-emerald-400">~35%</strong></span>
                <span className="text-slate-400">TWR: <strong className="text-amber-400">{thrustToWeightRatio} : 1</strong></span>
                <span className="text-slate-400">Total Lift: <strong className="text-sky-400">{totalThrustKg} kg</strong></span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Main Propulsion Throttle: {throttlePercent}%</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {throttlePercent === 0 ? 'CUTOFF' : throttlePercent < 40 ? 'HOVER / TAXI' : throttlePercent < 75 ? 'CLIMB / TRANSIT' : 'MAX THRUST'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={throttlePercent}
                onChange={(e) => setThrottlePercent(Number(e.target.value))}
                disabled={!isArmed || fuseBlown || !isMasterPowerOn}
                className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-950 rounded-lg disabled:opacity-40"
              />
            </div>

            {/* Quick Fault Simulation Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300 font-medium">Fault Injection:</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRotorStallFault(!rotorStallFault)}
                  className={`px-3 py-1 rounded text-xs font-mono font-bold transition border ${
                    rotorStallFault
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {rotorStallFault ? '⚠ Motor 2 Rotor Stalled (Short)' : 'Inject Motor 2 Stall Fault'}
                </button>
              </div>
            </div>
          </div>

          {/* 4x ESC & Motor Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {motors.map((m) => {
              const isStalled = m.id === 'M2' && rotorStallFault;
              return (
                <div
                  key={m.id}
                  className={`bg-slate-900 border rounded-xl p-4 transition ${
                    isStalled
                      ? 'border-rose-500/80 bg-rose-950/20 shadow-lg shadow-rose-900/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        isStalled 
                          ? 'bg-rose-500 animate-ping' 
                          : isArmed 
                          ? 'bg-emerald-500' 
                          : 'bg-slate-600'
                      }`} />
                      <span className="font-bold text-white text-xs">{m.name}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                      {m.rotation} · BLHeli_32
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-slate-950 border border-slate-800/80 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-500 uppercase">RPM</div>
                      <div className="text-sm font-mono font-bold text-sky-400">{m.rpm}</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800/80 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-500 uppercase">Current</div>
                      <div className={`text-sm font-mono font-bold ${isStalled ? 'text-rose-400 font-extrabold' : 'text-amber-400'}`}>
                        {m.currentAmps} A
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800/80 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-500 uppercase">Lift Thrust</div>
                      <div className="text-sm font-mono font-bold text-emerald-400">{m.thrustGrams} g</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400">
                    <span>Winding Temp: <strong className={m.tempCelsius > 70 ? 'text-rose-400' : 'text-slate-300'}>{m.tempCelsius}°C</strong></span>
                    <span>Status: <strong className={isStalled ? 'text-rose-400' : isArmed ? 'text-emerald-400' : 'text-slate-500'}>
                      {isStalled ? 'OVERLOAD TRIP' : isArmed ? 'ACTIVE' : 'STANDBY'}
                    </strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Low-Voltage BEC & Telemetry Regulators */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="font-bold text-white">Dual Linear/Switching Regulators (BEC)</div>
                <div className="text-[11px] text-slate-400">5.0V 3A (Avionics, GNSS, IMUs) & 12.0V 2A (Gimbal, 4K Camera)</div>
              </div>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 5V Rail: 5.04V (Stable)
              </span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 12V Rail: 12.01V (Stable)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
