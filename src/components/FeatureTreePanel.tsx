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
  const [tree, setTree] = useState<Record<string, FeatureTreeNode>>(() => FeatureTreeEngine.createDefaultFeatureTree());
  const [selectedNodeId, setSelectedNodeId] = useState<string>('Pocket001');
  const [rebuildLogs, setRebuildLogs] = useState<string[]>([]);

  const handleParameterChange = (nodeId: string, val: number) => {
    const { updatedTree, rebuildLog } = FeatureTreeEngine.rebuildFeatureTreeFromNode(tree, nodeId, val);
    setTree(updatedTree);
    setRebuildLogs(rebuildLog);

    if (updatedTree[selectedNodeId]) {
      onSelectFeatureSolid(updatedTree[selectedNodeId].outputSolid);
    }
  };

  const handleSelectNode = (nodeId: string) => {
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
            <GitMerge className="w-5 h-5 text-purple-400" /> PATCH-SECP-007 — Feature Tree & Parametric DAG
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Parametric History Tree (Sketch → Pad → Fillet → Hole → Pocket). Downstream features auto-rebuild on change.
          </p>
        </div>
        <button
          onClick={() => {
            const def = FeatureTreeEngine.createDefaultFeatureTree();
            setTree(def);
            setRebuildLogs([]);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5 text-purple-400" /> Reset Tree
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
                      ? 'bg-purple-950/60 border-purple-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <GitCommit className={`w-4 h-4 ${isSelected ? 'text-purple-400' : 'text-slate-500'}`} />
                    <span className="font-semibold">{node.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
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
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {tree[selectedNodeId].status}
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
                    onChange={e => handleParameterChange(selectedNodeId, Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
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
                  rebuildLogs.map((log, i) => (
                    <div key={i} className="text-emerald-400/90">{log}</div>
                  ))
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
