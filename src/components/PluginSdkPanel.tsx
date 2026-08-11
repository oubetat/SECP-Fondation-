import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Car,
  Plane,
  Anchor,
  Zap,
  Cpu,
  Database,
  CheckCircle2,
  Sliders,
  Play,
  Layers,
  Code2,
} from 'lucide-react';

import { SecpPluginRegistry, SecpPluginWorkbench } from '../sdk/secpPluginSdk';
import { AutomotivePlugin } from '../plugins/automotivePlugin';
import { AerospacePlugin } from '../plugins/aerospacePlugin';
import { MarinePlugin } from '../plugins/marinePlugin';
import { EnergyPlugin } from '../plugins/energyPlugin';
import { RoboticsPlugin } from '../plugins/roboticsPlugin';
import { OilGasPlugin } from '../plugins/oilGasPlugin';

export const PluginSdkPanel: React.FC = () => {
  // Ensure all 6 industry plugins are registered on mount
  useEffect(() => {
    SecpPluginRegistry.registerPlugin(AutomotivePlugin);
    SecpPluginRegistry.registerPlugin(AerospacePlugin);
    SecpPluginRegistry.registerPlugin(MarinePlugin);
    SecpPluginRegistry.registerPlugin(EnergyPlugin);
    SecpPluginRegistry.registerPlugin(RoboticsPlugin);
    SecpPluginRegistry.registerPlugin(OilGasPlugin);
  }, []);

  const [plugins, setPlugins] = useState<SecpPluginWorkbench[]>(() =>
    SecpPluginRegistry.getRegisteredPlugins()
  );

  const [activePluginId, setActivePluginId] = useState<string>('secp-plugin-automotive');
  const activePlugin = plugins.find(p => p.manifest.id === activePluginId) || plugins[0];

  // Dynamic state for inputs of selected tool
  const [paramInputs, setParamInputs] = useState<Record<string, number>>(
    () => activePlugin?.defaultParameters || {}
  );

  const [computedOutput, setComputedOutput] = useState<Record<string, number | string>>({});

  // Sync default parameters when switching active plugin
  useEffect(() => {
    if (activePlugin) {
      setParamInputs(activePlugin.defaultParameters);
      if (activePlugin.tools.length > 0) {
        setComputedOutput(activePlugin.tools[0].compute(activePlugin.defaultParameters));
      }
    }
  }, [activePluginId]);

  const handleTogglePlugin = (id: string, currentEnabled: boolean) => {
    SecpPluginRegistry.togglePlugin(id, !currentEnabled);
    setPlugins([...SecpPluginRegistry.getRegisteredPlugins()]);
  };

  const handleParamChange = (key: string, val: number) => {
    const updated = { ...paramInputs, [key]: val };
    setParamInputs(updated);
    if (activePlugin && activePlugin.tools.length > 0) {
      setComputedOutput(activePlugin.tools[0].compute(updated));
    }
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Car': return <Car className="w-5 h-5 text-rose-400" />;
      case 'Plane': return <Plane className="w-5 h-5 text-sky-400" />;
      case 'Anchor': return <Anchor className="w-5 h-5 text-cyan-400" />;
      case 'Zap': return <Zap className="w-5 h-5 text-amber-400" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-purple-400" />;
      case 'Database': return <Database className="w-5 h-5 text-emerald-400" />;
      default: return <Boxes className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">SECP Plugin SDK & Industry Workbenches</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
              PATCH-SECP-026
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Strategic extension architecture allowing third-party industries to embed custom calculation modules (Automotive, Aerospace, Marine, Energy, Robotics, Oil & Gas).
          </p>
        </div>
      </div>

      {/* Directory Structure Overview */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400">
        <span className="text-slate-300 font-bold flex items-center gap-1.5"><Code2 className="w-4 h-4 text-emerald-400" /> plugins/</span>
        <span className="hover:text-rose-400 cursor-pointer">├── automotive/</span>
        <span className="hover:text-sky-400 cursor-pointer">├── aerospace/</span>
        <span className="hover:text-cyan-400 cursor-pointer">├── marine/</span>
        <span className="hover:text-amber-400 cursor-pointer">├── energy/</span>
        <span className="hover:text-purple-400 cursor-pointer">├── robotics/</span>
        <span className="hover:text-emerald-400 cursor-pointer">└── oil-gas/</span>
      </div>

      {/* Main Grid: Industry Plugin Selector Cards & Active Workbench Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Plugin Registry Cards */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Registered Industry Workbenches ({plugins.length})
          </h3>

          <div className="flex flex-col gap-2.5">
            {plugins.map(p => {
              const isSelected = p.manifest.id === activePluginId;
              return (
                <div
                  key={p.manifest.id}
                  onClick={() => setActivePluginId(p.manifest.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-800 border-emerald-500/80 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 shrink-0 mt-0.5">
                      {getIconComponent(p.manifest.iconName)}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">{p.manifest.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">v{p.manifest.version}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{p.manifest.description}</p>
                    </div>
                  </div>

                  {/* Toggle Enable Switch */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePlugin(p.manifest.id, p.manifest.enabled);
                    }}
                    className={`w-8 h-4 rounded-full transition-all relative shrink-0 mt-1 ${
                      p.manifest.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`block w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${
                        p.manifest.enabled ? 'left-4' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Active Plugin Interactive Engineering Workbench */}
        {activePlugin && (
          <div className="lg:col-span-2 bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                  {getIconComponent(activePlugin.manifest.iconName)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{activePlugin.manifest.name}</h3>
                  <span className="text-xs text-slate-400">Author: {activePlugin.manifest.author}</span>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 text-xs font-mono rounded border font-semibold ${
                activePlugin.manifest.enabled
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {activePlugin.manifest.enabled ? 'WORKBENCH ACTIVE' : 'DISABLED'}
              </span>
            </div>

            {/* Plugin Tools & Interactive Calculation Parameters */}
            {activePlugin.tools.map(tool => (
              <div key={tool.id} className="flex flex-col gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" /> {tool.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{tool.description}</p>
                </div>

                {/* Input Sliders & Number Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 p-4 rounded-lg border border-slate-800">
                  {Object.entries(paramInputs).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span className="font-mono text-[11px]">{key}:</span>
                        <span className="font-mono text-emerald-400 font-bold">{value}</span>
                      </div>
                      <input
                        type="number"
                        value={value}
                        onChange={e => handleParamChange(key, Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>

                {/* Computed Output Telemetry Display */}
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
                  <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Computed Industry Results
                  </h5>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {Object.entries(computedOutput).map(([outKey, outVal]) => (
                      <div key={outKey} className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">{outKey}</span>
                        <span className="font-mono font-bold text-slate-100 text-sm mt-1">{String(outVal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
