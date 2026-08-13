/**
 * PATCH-SECP-007 — Feature Tree & Parametric Dependency Graph
 * Interactive Feature Tree graph (Sketch001 -> Pad001 -> Fillet001 -> Hole001 -> Pocket001)
 * Re-evaluates downstream DAG nodes when a parent feature parameter changes.
 */

import React, { useState } from 'react';
import { FeatureTreeEngine, FeatureTreeNode } from '../engine/featureTree';
import { CadSolidEntity } from '../engine/cadKernel';
import { GitCommit, GitMerge, RefreshCw, CheckCircle2, Layers, ChevronRight, Terminal } from 'lucide-react';

interface FeatureTreePanelProps {
  onSelectFeatureSolid: (solid: CadSolidEntity) => void;
}

export const FeatureTreePanel: React.FC<FeatureTreePanelProps> = ({ onSelectFeatureSolid }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('Pocket001');
  const [rebuildLogs, setRebuildLogs] = useState<string[]>([]);
  const [isRebuilding, setIsRebuilding] = useState<boolean>(false);
  const [tree, setTree] = useState<Record<string, FeatureTreeNode>>(() => FeatureTreeEngine.createDefaultFeatureTree());

  const handleParameterChange = async (nodeId: string, val: number) => {
    setIsRebuilding(true);
    try {
      const { updatedTree, rebuildLog } = await FeatureTreeEngine.rebuildFeatureTreeFromNode(
        tree,
        nodeId,
        val,
        (currentTree, currentLogs) => {
          setTree(currentTree);
          setRebuildLogs(currentLogs);
        }
      );
      setTree(updatedTree);
      setRebuildLogs(rebuildLog);
      
      if (updatedTree[selectedNodeId]) {
        onSelectFeatureSolid(updatedTree[selectedNodeId].outputSolid);
      }
    } catch (err: any) {
      console.error('[FeatureTreePanel] Rebuild failed', err);
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleSelectNode = (nodeId: string) => {
    if (isRebuilding) return; // Prevent selection jumps during processing
    setSelectedNodeId(nodeId);
    if (tree[nodeId]) {
      onSelectFeatureSolid(tree[nodeId].outputSolid);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-purple-400">
            <GitMerge className="w-5 h-5 text-purple-400" /> PATCH-SECP-040 — Parametric History & Real-Time DAG
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time visual caching, step-by-step downstream propagation, and production CAD kernel validations.
          </p>
        </div>
        <button
          onClick={() => {
            if (isRebuilding) return;
            const def = FeatureTreeEngine.createDefaultFeatureTree();
            setTree(def);
            setRebuildLogs([]);
          }}
          disabled={isRebuilding}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-slate-300 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isRebuilding ? 'animate-spin' : ''}`} /> Reset Tree
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Feature History Tree Inspector */}
        <div className="flex flex-col gap-3">
          <label className="text-xs text-slate-400 font-semibold">Parametric Tree Nodes</label>
          <div className="flex flex-col gap-2">
            {(Object.values(tree) as FeatureTreeNode[]).map(node => {
              const isSelected = node.id === selectedNodeId;
              return (
                <div
                  key={node.id}
                  onClick={() => handleSelectNode(node.id)}
                  className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between text-xs ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/60 text-white shadow-md shadow-purple-500/5'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  } ${isRebuilding ? 'opacity-80' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <GitCommit className={`w-4 h-4 ${
                        node.status === 'REBUILDING'
                          ? 'text-purple-400 animate-pulse'
                          : node.status === 'ERROR'
                          ? 'text-rose-500'
                          : node.status === 'OUT_OF_DATE'
                          ? 'text-amber-500'
                          : isSelected
                          ? 'text-purple-400'
                          : 'text-slate-500'
                      }`} />
                      {node.status === 'REBUILDING' && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold">{node.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {node.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                      node.status === 'UP_TO_DATE'
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                        : node.status === 'OUT_OF_DATE'
                        ? 'bg-amber-950/40 text-amber-400 border-amber-800/40 animate-pulse'
                        : node.status === 'REBUILDING'
                        ? 'bg-purple-950/40 text-purple-400 border-purple-800/40 animate-pulse'
                        : 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                    }`}>
                      {node.status === 'UP_TO_DATE' ? 'Cached / Ready' : node.status.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-purple-300">
                      Rev #{node.revisionNumber}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Node Details & Parameter Slider */}
        {tree[selectedNodeId] && (
          <div className="flex flex-col gap-4">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-purple-300">
                  Node Inspector: {tree[selectedNodeId].name}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                  tree[selectedNodeId].status === 'UP_TO_DATE'
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                    : tree[selectedNodeId].status === 'OUT_OF_DATE'
                    ? 'bg-amber-950/60 text-amber-400 border-amber-800'
                    : tree[selectedNodeId].status === 'REBUILDING'
                    ? 'bg-purple-950/60 text-purple-400 border-purple-800 animate-pulse'
                    : 'bg-rose-950/60 text-rose-400 border-rose-800'
                }`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${tree[selectedNodeId].status === 'REBUILDING' ? 'animate-spin' : ''}`} />
                  {tree[selectedNodeId].status === 'UP_TO_DATE' ? 'UP_TO_DATE (CACHED)' : tree[selectedNodeId].status}
                </span>
              </div>

              {tree[selectedNodeId].parameters[0] && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{tree[selectedNodeId].parameters[0].name}:</span>
                    <span className="font-mono text-purple-300 font-bold">
                      {tree[selectedNodeId].parameters[0].value} {tree[selectedNodeId].parameters[0].unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="400"
                    value={tree[selectedNodeId].parameters[0].value}
                    disabled={isRebuilding}
                    onChange={e => handleParameterChange(selectedNodeId, Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-[11px] text-slate-500">
                    Modifying this parent feature triggers automatic downstream recalculation in the Parametric DAG.
                  </p>
                </div>
              )}
            </div>

            {/* Rebuild Console Logs */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col gap-1.5 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                <Terminal className="w-3.5 h-3.5 text-purple-400" /> DAG Propagation Build Terminal
              </div>
              <div className="bg-slate-900 rounded p-2 text-slate-400 max-h-32 overflow-y-auto space-y-1">
                {rebuildLogs.length > 0 ? (
                  rebuildLogs.map((log, i) => {
                    let color = 'text-slate-400';
                    if (log.includes('Bypassing')) {
                      color = 'text-amber-400/90 font-semibold';
                    } else if (log.includes('Actively evaluating')) {
                      color = 'text-purple-400 font-semibold';
                    } else if (log.includes('SUCCESS')) {
                      color = 'text-emerald-400 font-bold';
                    } else if (log.includes('ERROR') || log.includes('FAILED')) {
                      color = 'text-rose-400 font-bold';
                    }
                    return (
                      <div key={i} className={color}>{log}</div>
                    );
                  })
                ) : (
                  <div className="text-slate-600">DAG tree is up to date. Adjust a parameter to view live build events.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
