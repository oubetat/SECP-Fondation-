import React, { useState, useEffect } from 'react';
import { 
  GitMerge, 
  Search, 
  ArrowRight, 
  Layers, 
  Cpu, 
  FileText, 
  ShieldCheck, 
  RefreshCw,
  Share2
} from 'lucide-react';
import { ADSEWorkbenchBridge } from '../../engine/adse/workbench/ADSEWorkbenchBridge';

interface Props {
  initialNodeId?: string;
  onSelectEntity?: (canonicalId: string) => void;
}

export const EngineeringTraceView: React.FC<Props> = ({ initialNodeId, onSelectEntity }) => {
  const bridge = ADSEWorkbenchBridge.getInstance();
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialNodeId || '');
  const [traceResult, setTraceResult] = useState<any>(null);

  const loadThread = () => {
    const allNodes = bridge.p4.registry.getAllNodes();
    const allEdges = bridge.p4.registry.getAllEdges();
    setNodes(allNodes);
    setEdges(allEdges);
    if (allNodes.length > 0 && !selectedNodeId) {
      setSelectedNodeId(allNodes[0].nodeId);
    }
  };

  useEffect(() => {
    loadThread();
  }, []);

  useEffect(() => {
    if (selectedNodeId) {
      const traces = bridge.p4.traceability.getTracesForNode(selectedNodeId);
      setTraceResult(traces);
    } else {
      setTraceResult(null);
    }
  }, [selectedNodeId]);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden font-sans">
      {/* Node Search & Selection List */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-xs uppercase tracking-wider">Digital Thread Nodes</span>
          </div>
          <button onClick={loadThread} className="p-1 text-slate-400 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {nodes.map(n => {
            const isSelected = selectedNodeId === n.nodeId;
            return (
              <button
                key={n.nodeId}
                onClick={() => setSelectedNodeId(n.nodeId)}
                className={`p-2.5 rounded-lg text-left transition border flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-emerald-600/15 border-emerald-500 text-white shadow-sm'
                    : 'border-transparent hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-400">{n.nodeId}</span>
                  <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400 uppercase">
                    {n.nodeType}
                  </span>
                </div>
                <div className="text-xs font-medium truncate">{n.displayName || n.canonicalId}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bidirectional Trace Flow Matrix */}
      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto flex flex-col gap-6">
        {selectedNodeId ? (
          <>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Active Trace Root</div>
                <div className="font-mono text-lg font-extrabold text-emerald-400">{selectedNodeId}</div>
              </div>

              <div className="text-right text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Thread Edges</span>
                <div className="font-mono text-white font-bold">{edges.length} Total</div>
              </div>
            </div>

            {/* Trace Visualization Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Upstream Traces */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400 rotate-180" /> Upstream Dependencies (Inputs)
                </div>

                <div className="flex flex-col gap-2">
                  {edges.filter(e => e.targetNodeId === selectedNodeId).length === 0 ? (
                    <div className="text-xs text-slate-500">Root node (no upstream edges)</div>
                  ) : (
                    edges.filter(e => e.targetNodeId === selectedNodeId).map(e => (
                      <div key={e.edgeId} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-mono text-blue-400 font-semibold">{e.sourceNodeId}</span>
                        <span className="text-[9px] font-mono text-slate-500 uppercase">{e.edgeType}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Downstream Allocations */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" /> Downstream Allocations (Outputs)
                </div>

                <div className="flex flex-col gap-2">
                  {edges.filter(e => e.sourceNodeId === selectedNodeId).length === 0 ? (
                    <div className="text-xs text-slate-500">Terminal leaf (no downstream edges)</div>
                  ) : (
                    edges.filter(e => e.sourceNodeId === selectedNodeId).map(e => (
                      <div key={e.edgeId} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-mono text-emerald-400 font-semibold">{e.targetNodeId}</span>
                        <span className="text-[9px] font-mono text-slate-500 uppercase">{e.edgeType}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Select a thread node to inspect bidirectional cryptographic trace paths.
          </div>
        )}
      </div>
    </div>
  );
};
