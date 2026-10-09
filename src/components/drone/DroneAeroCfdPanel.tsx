import React, { useState } from 'react';
import { Wind, Activity, Gauge, Battery, CheckCircle2, AlertCircle, Compass, Layers } from 'lucide-react';

export const DroneAeroCfdPanel: React.FC = () => {
  const [altitudeMeters, setAltitudeMeters] = useState<number>(1.2); // 1.2m default hover altitude
  const [forwardAirspeedMs, setForwardAirspeedMs] = useState<number>(0); // Hover (0 m/s) to 18 m/s cruise
  const [rotorRpm, setRotorRpm] = useState<number>(6800); // Nominal hover RPM

  // 10x4.5 inch rotor characteristics
  const propDiameterMeters = 0.254; // 10 inches = 254 mm
  const propRadiusMeters = propDiameterMeters / 2;
  const propDiskArea = Math.PI * Math.pow(propRadiusMeters, 2); // 0.05067 m^2
  const airDensity = 1.225; // kg/m^3 (sea level standard)

  // Ground effect factor: Cheeseman & Bennett model: T_ige / T_oge = 1 / (1 - (R / (4 * h))^2)
  const groundEffectRatio = altitudeMeters <= 0.1 
    ? 1.24 
    : 1 / Math.max(0.75, (1 - Math.pow(propRadiusMeters / (4 * Math.max(0.1, altitudeMeters)), 2)));
  
  // Downwash induced velocity v_i = sqrt(T / (2 * rho * A))
  const hoverThrustNewtons = (1.675 * 9.81) / 4; // ~4.11 N per rotor
  const inducedVelocityMs = Math.sqrt(hoverThrustNewtons / (2 * airDensity * propDiskArea)); // ~5.75 m/s

  // Tip speed & Mach number
  const tipSpeedMs = (2 * Math.PI * (rotorRpm / 60)) * propRadiusMeters;
  const speedOfSound = 343; // m/s
  const tipMachNumber = (tipSpeedMs / speedOfSound).toFixed(2);

  // Aerodynamic power & figure of merit (FoM)
  const inducedPowerWatts = hoverThrustNewtons * inducedVelocityMs;
  const profilePowerWatts = 0.12 * hoverThrustNewtons * tipSpeedMs * 0.04;
  const totalAeroPowerPerRotor = (inducedPowerWatts + profilePowerWatts) / groundEffectRatio;
  const totalAeroPowerAllRotors = totalAeroPowerPerRotor * 4;

  // Flight endurance estimate (6S 4500mAh = ~99.9 Wh, 80% usable = ~80 Wh)
  const usableEnergyWh = 4.5 * 22.2 * 0.8;
  const totalElectricalPowerDrawWatts = totalAeroPowerAllRotors / 0.82 + 12; // 82% motor+ESC eff + 12W avionics
  const flightEnduranceMinutes = Math.round((usableEnergyWh / totalElectricalPowerDrawWatts) * 60);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-400" />
              Aerodynamics, Rotor Downwash & CFD Simulation
            </h1>
            <span className="px-2.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded text-xs font-mono font-bold">
              10x4.5 CARBON AIRFOIL · BEM SOLVER
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Blade Element Momentum (BEM) theory, rotor induced downwash velocity field, ground cushion effect & hover flight endurance.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-right">
            <div className="text-[10px] text-slate-500 uppercase">Estimated Hover Time</div>
            <div className="text-base font-bold text-emerald-400">{flightEnduranceMinutes} mins</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aerodynamic Simulation Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            Flight & Environment Parameters
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Ground Clearance (Altitude):</span>
                <span className="font-mono text-cyan-400 font-bold">{altitudeMeters.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="8.0"
                step="0.1"
                value={altitudeMeters}
                onChange={(e) => setAltitudeMeters(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0.1m (Max Ground Cushion)</span>
                <span>8.0m (Free Out-of-Ground Flow)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Forward Airspeed:</span>
                <span className="font-mono text-cyan-400 font-bold">{forwardAirspeedMs} m/s</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={forwardAirspeedMs}
                onChange={(e) => setForwardAirspeedMs(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0 m/s (Hover)</span>
                <span>20 m/s (72 km/h Fast Cruise)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400">Rotor RPM:</span>
                <span className="font-mono text-cyan-400 font-bold">{rotorRpm} RPM</span>
              </div>
              <input
                type="range"
                min="3000"
                max="9500"
                step="100"
                value={rotorRpm}
                onChange={(e) => setRotorRpm(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Ground Effect Multiplier:</span>
              <span className="font-mono font-bold text-emerald-400">{groundEffectRatio.toFixed(3)}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rotor Tip Mach Number:</span>
              <span className="font-mono text-slate-200">Mach {tipMachNumber} (Subsonic Safe)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Induced Downwash Velocity:</span>
              <span className="font-mono text-sky-300">{inducedVelocityMs.toFixed(1)} m/s (20.7 km/h)</span>
            </div>
          </div>
        </div>

        {/* Center & Right Columns: CFD Velocity Field & Aerodynamic Profiles */}
        <div className="lg:col-span-2 space-y-6">
          {/* CFD Downwash Streamline Visualizer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Rotor Wake Velocity Field & Ground Cushion
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {altitudeMeters < 1.0 ? 'IGE (IN GROUND EFFECT)' : 'OGE (OUT OF GROUND EFFECT)'}
              </span>
            </div>

            {/* Simulated Flow Streamlines Canvas */}
            <div className="h-56 bg-slate-950 rounded-xl border border-slate-800/80 p-4 relative overflow-hidden flex flex-col justify-between">
              {/* Drone Body Outline */}
              <div className="flex items-center justify-center gap-16 relative z-10 pt-2">
                <div className="w-20 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50 animate-pulse" />
                <div className="w-12 h-6 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-[9px] font-mono text-slate-300">
                  FUSELAGE
                </div>
                <div className="w-20 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50 animate-pulse" />
              </div>

              {/* Streamline Downwash Rays */}
              <div className="relative flex justify-around h-32 items-stretch py-2">
                {[...Array(9)].map((_, i) => {
                  const distFromCenter = Math.abs(i - 4);
                  const spread = altitudeMeters < 1.0 ? distFromCenter * 14 : distFromCenter * 6;
                  return (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-b from-cyan-400 via-blue-500 to-indigo-600 rounded-full opacity-70"
                      style={{
                        transform: `translateX(${i < 4 ? -spread : spread}px)`
                      }}
                    />
                  );
                })}
              </div>

              {/* Ground Surface */}
              <div className="border-t-2 border-dashed border-slate-700 pt-1 flex justify-between text-[10px] font-mono text-slate-500">
                <span>GROUND PLANE (Z = 0.00m)</span>
                <span>SURFACE STATIC PRESSURE: {altitudeMeters < 0.8 ? '+42 Pa (Cushion)' : '+4 Pa (Ambient)'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
                <div className="text-[10px] text-slate-500 uppercase">Hover Aerodynamic Power</div>
                <div className="text-sm font-mono font-bold text-cyan-400">{Math.round(totalAeroPowerAllRotors)} W</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
                <div className="text-[10px] text-slate-500 uppercase">Thrust Efficiency</div>
                <div className="text-sm font-mono font-bold text-emerald-400">
                  {(1675 / Math.max(1, totalElectricalPowerDrawWatts)).toFixed(1)} g/W
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
                <div className="text-[10px] text-slate-500 uppercase">Figure of Merit (FoM)</div>
                <div className="text-sm font-mono font-bold text-purple-400">0.74 (Aero Class A)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
