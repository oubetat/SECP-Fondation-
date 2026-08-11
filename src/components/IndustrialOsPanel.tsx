import React, { useState } from 'react';
import {
  Layers,
  Box,
  Calculator,
  Activity,
  Wrench,
  Radio,
  Zap,
  Sparkles,
  Cpu,
  Globe,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Server,
  HardDrive,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { IndustrialOsEngine, OsSystemTelemetrySummary, OsSubsystemNode } from '../engine/industrialOsEngine';

interface Props {
  onNavigateTab?: (tabName: string) => void;
}

export const IndustrialOsPanel: React.FC<Props> = ({ onNavigateTab }) => {
  const [osState] = useState<OsSystemTelemetrySummary>(() => IndustrialOsEngine.getOsState());
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-cad');

  const selectedNode = osState.nodes.find(n => n.id === selectedNodeId) || osState.nodes[0];

  const getIcon = (cat: string) => {
    switch (cat) {
      case 'CAD': return <Box className="w-5 h-5 text-sky-400" />;
      case 'ENGINEERING': return <Calculator className="w-5 h-5 text-indigo-400" />;
      case 'SIMULATION': return <Activity className="w-5 h-5 text-emerald-400" />;
      case 'MANUFACTURING': return <Wrench className="w-5 h-5 text-amber-400" />;
      case 'TWIN': return <Radio className="w-5 h-5 text-rose-400" />;
      case 'TELEMETRY': return <Zap className="w-5 h-5 text-yellow-400" />;
      case 'AI': return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'OPTIMIZATION': return <Cpu className="w-5 h-5 text-cyan-400" />;
      case 'REAL_WORLD': return <Globe className="w-5 h-5 text-teal-400" />;
      default: return <Layers className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-bold tracking-tight">SECP Master Industrial Engineering OS Overview</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-sky-950 text-sky-400 border border-sky-800 rounded-full">
              PATCH-SECP-030
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Unified Industrial Operating System linking CAD → Physics → FEA Simulation → CAM Manufacturing → Digital Twin → Telemetry → AI Copilot → Generative Optimization → Real World.
          </p>
        </div>

        {/* System Kernel Badge */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-950 border border-slate-800 text-emerald-400 rounded-lg text-xs font-mono">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>{osState.kernelVersion}</span>
        </div>
      </div>

      {/* Telemetry Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">System Health</span>
          <span className="text-lg font-mono font-bold text-emerald-400">{osState.overallHealthScorePct}% Nominal</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Telemetry Bus Stream</span>
          <span className="text-lg font-mono font-bold text-sky-400">{osState.activeTelemetryDataRateHz} Hz Realtime</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Active Subsystem Modules</span>
          <span className="text-lg font-mono font-bold text-purple-400">{osState.totalSubsystems} / {osState.totalSubsystems} Online</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">AI Copilot Core Load</span>
          <span className="text-lg font-mono font-bold text-amber-400">{osState.aiCopilotLoadPct}% Active</span>
        </div>
      </div>

      {/* The Master OS Architecture Flow Graph */}
      <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" /> Unified Subsystem Architecture Pipeline
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {osState.nodes.map(node => {
            const isSelected = node.id === selectedNodeId;

            return (
              <div
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-sky-950/40 border-sky-500 shadow-lg shadow-sky-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getIcon(node.category)}
                    <span className="text-xs font-bold text-slate-100">{node.name}</span>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-emerald-400 border border-slate-800 rounded">
                    {node.status}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{node.description}</p>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800">
                  <span>Latency: <strong className="text-slate-300">{node.latencyMs} ms</strong></span>
                  <span>Memory: <strong className="text-slate-300">{node.memoryUsageMb} MB</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Selected Subsystem Inspector Detail */}
      <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 shrink-0">
            {getIcon(selectedNode.category)}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-sky-400">{selectedNode.category} MODULE</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                STATUS: {selectedNode.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100">{selectedNode.name}</h3>
            <p className="text-xs text-slate-400 max-w-2xl mt-0.5">{selectedNode.description}</p>
          </div>
        </div>

        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab(selectedNode.category.toLowerCase())}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-all shrink-0 shadow-lg shadow-sky-600/20"
          >
            Open Subsystem Workspace <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
