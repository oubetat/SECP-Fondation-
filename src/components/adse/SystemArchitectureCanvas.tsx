import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Layers, 
  Cpu, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  Sliders, 
  Info,
  ShieldCheck,
  GitBranch
} from 'lucide-react';
import { 
  ADSEWorkbenchBridge, 
  ArchitectureCanvasNode, 
  ArchitectureCanvasEdge 
} from '../../engine/adse/workbench/ADSEWorkbenchBridge';

interface Props {
  systemId?: string;
  configurationId?: string;
  onSelectEntity?: (canonicalId: string) => void;
}

export const SystemArchitectureCanvas: React.FC<Props> = ({
  systemId = 'SYS-AVIONICS-P9',
  configurationId = 'CONF-BASELINE',
  onSelectEntity
}) => {
  const bridge = ADSEWorkbenchBridge.getInstance();
  const [nodes, setNodes] = useState<ArchitectureCanvasNode[]>(() => {
    return bridge.getArchitectureTopology(configurationId).nodes;
  });
  const [edges, setEdges] = useState<ArchitectureCanvasEdge[]>(() => {
    return bridge.getArchitectureTopology(configurationId).edges;
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationName, setMutationName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const loadTopology = () => {
    const topo = bridge.getArchitectureTopology(configurationId);
    setNodes(topo.nodes);
    setEdges(topo.edges);
  };

  useEffect(() => {
    loadTopology();
  }, [systemId, configurationId]);

  const handleSelectNode = (node: ArchitectureCanvasNode) => {
    setSelectedNodeId(node.id);
    if (onSelectEntity) {
      onSelectEntity(node.canonicalId);
    }
  };

  const handleAddSubsystem = async () => {
    if (!mutationName.trim()) return;
    setIsMutating(true);
    try {
      const subId = `SUB-${Date.now().toString().slice(-4)}`;
      const revId = `REV-R${Date.now().toString().slice(-3)}`;
      await bridge.mutateArchitectureElement({
        systemId,
        subsystemId: subId,
        name: mutationName.trim(),
        configurationId,
        newRevisionId: revId
      });
      setMutationName('');
      setNotice(`Canonical Subsystem '${subId}' registered under Revision '${revId}'. Impact invalidation propagated.`);
      loadTopology();
    } catch (err: any) {
      setNotice(`Mutation rejected by authority: ${err.message}`);
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden font-sans">
      {/* Canvas Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-blue-400" />
          <span className="font-bold text-sm">System Architecture Canvas (P3/P4 Bound)</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
            {configurationId}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTopology}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
            title="Refresh from Digital Thread"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="bg-blue-950/40 border-b border-blue-800/40 px-4 py-2 text-xs text-blue-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* Canvas Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Visual Graph Viewport */}
        <div className="flex-1 bg-slate-950 relative overflow-auto p-6 flex flex-col justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map(node => {
              const isSelected = selectedNodeId === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => handleSelectNode(node)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-800 text-blue-400 border border-slate-700">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white truncate max-w-[140px]">{node.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{node.canonicalId}</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {node.type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <GitBranch className="w-3 h-3 text-emerald-400" /> {node.revisionId}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-mono">
                      <ShieldCheck className="w-3 h-3" /> Core Bound
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controlled Mutation Bar (Direct P3 Core Action) */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="New Subsystem Name..."
                value={mutationName}
                onChange={e => setMutationName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddSubsystem}
                disabled={isMutating || !mutationName.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Mutate Architecture
              </button>
            </div>

            <div className="text-[10px] text-slate-400">
              Mutations enforce immediate <span className="text-amber-400 font-mono font-semibold">P3 Impact Invalidation</span> in Core.
            </div>
          </div>
        </div>

        {/* Selected Element Quick Inspector */}
        {selectedNodeId && (
          <div className="w-72 bg-slate-900 border-l border-slate-800 p-4 flex flex-col gap-3 shrink-0 overflow-y-auto">
            <div className="text-xs font-bold text-white uppercase tracking-wider">Canvas Element Truth</div>
            {(() => {
              const node = nodes.find(n => n.id === selectedNodeId);
              if (!node) return null;
              return (
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Display Name</span>
                    <span className="font-bold text-white">{node.label}</span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Canonical ID</span>
                    <span className="font-mono text-cyan-400 text-[11px]">{node.canonicalId}</span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Digital Thread ID</span>
                    <span className="font-mono text-slate-300 text-[11px]">{node.p4NodeId}</span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Revision</span>
                    <span className="font-mono text-emerald-400 font-semibold">{node.revisionId}</span>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Authority</span>
                    <span className="font-mono text-blue-400 font-semibold">{node.authorityState}</span>
                  </div>

                  <button
                    onClick={() => onSelectEntity && onSelectEntity(node.canonicalId)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition shadow-sm mt-2"
                  >
                    Open Engineering Truth View <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
