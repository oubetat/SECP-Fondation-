import React, { useState } from 'react';
import {
  FolderTree, ChevronDown, ChevronRight, Eye, EyeOff, Box, Cpu, Battery,
  Camera, Zap, Disc, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCcw, Info
} from 'lucide-react';
import { EngineeringDocument, AssemblyInstance } from '../engine/cad-kernel/document/CADDocument';

export interface IndustrialDroneAssemblyTreePanelProps {
  canonicalDocument: EngineeringDocument | null;
  selectedPartId: string | null;
  onSelectPartId: (partId: string | null) => void;
  hiddenInstanceIds?: string[];
  onToggleVisibility?: (instanceId: string) => void;
  onResetView?: () => void;
}

export const IndustrialDroneAssemblyTreePanel: React.FC<IndustrialDroneAssemblyTreePanelProps> = ({
  canonicalDocument,
  selectedPartId,
  onSelectPartId,
  hiddenInstanceIds = [],
  onToggleVisibility,
  onResetView
}) => {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const instances: AssemblyInstance[] = canonicalDocument?.assembly?.instances || [];
  const rootAssemblyId = canonicalDocument?.assembly?.assemblyId || 'DRONE-001';
  const rootAssemblyName = canonicalDocument?.assembly?.name || 'Industrial Quadcopter Drone Assembly';

  // Group instances by parentId
  const rootNodes = instances.filter(i => !i.parentId || i.parentId === rootAssemblyId);

  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => setCollapsedNodes({});
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    instances.filter(i => i.type === 'SUB_ASSEMBLY').forEach(i => {
      next[i.instanceId] = true;
    });
    setCollapsedNodes(next);
  };

  // Find currently selected instance
  const selectedInstance = instances.find(i => i.instanceId === selectedPartId);

  const getNodeIcon = (instance: AssemblyInstance) => {
    if (instance.type === 'SUB_ASSEMBLY') {
      return <FolderTree className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
    }
    if (instance.instanceId.includes('FC')) return <Cpu className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
    if (instance.instanceId.includes('MOTOR')) return <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
    if (instance.instanceId.includes('PROP')) return <Disc className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
    if (instance.instanceId.includes('BATTERY')) return <Battery className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />;
    if (instance.instanceId.includes('CAMERA') || instance.instanceId.includes('GIMBAL')) {
      return <Camera className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
    }
    return <Box className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
  };

  const renderNode = (instance: AssemblyInstance, depth: number = 0) => {
    const isSub = instance.type === 'SUB_ASSEMBLY';
    const isCollapsed = collapsedNodes[instance.instanceId];
    const childNodes = instances.filter(i => i.parentId === instance.instanceId);
    const isSelected = selectedPartId === instance.instanceId;
    const isHidden = hiddenInstanceIds.includes(instance.instanceId);
    const isPlanned = instance.geometryStatus === 'PLANNED_NOT_MODELED';

    return (
      <div key={instance.instanceId} className="select-none">
        <div
          onClick={() => onSelectPartId(instance.instanceId)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`flex items-center justify-between py-1.5 pr-2 rounded text-xs transition-all cursor-pointer border ${
            isSelected
              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200 font-medium shadow-[0_0_10px_-3px_rgba(6,182,212,0.3)]'
              : 'border-transparent text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            {isSub ? (
              <button
                onClick={(e) => toggleCollapse(instance.instanceId, e)}
                className="p-0.5 hover:bg-slate-700/50 rounded text-slate-400"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            ) : (
              <span className="w-4 flex-shrink-0" />
            )}

            {getNodeIcon(instance)}

            <span className="truncate font-sans tracking-wide text-[11px]">
              {instance.name || instance.instanceId}
            </span>

            {isPlanned && (
              <span className="px-1.5 py-0.2 text-[8px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                PLANNED
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[9px] font-mono text-slate-500 hidden sm:inline">
              {instance.instanceId}
            </span>

            {onToggleVisibility && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(instance.instanceId);
                }}
                className={`p-1 rounded hover:bg-slate-700/60 transition-colors ${
                  isHidden ? 'text-slate-600' : 'text-slate-300'
                }`}
                title={isHidden ? 'Show Component' : 'Hide Component'}
              >
                {isHidden ? <EyeOff className="w-3 h-3 text-red-400/80" /> : <Eye className="w-3 h-3 text-cyan-400/80" />}
              </button>
            )}
          </div>
        </div>

        {isSub && !isCollapsed && childNodes.length > 0 && (
          <div className="mt-0.5 space-y-0.5 border-l border-slate-800/80 ml-3">
            {childNodes.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-200">
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-cyan-400 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider text-slate-100 uppercase">
              Canonical Assembly Tree
            </span>
            <span className="text-[9px] font-mono text-cyan-400">
              {rootAssemblyId} • {instances.length} Nodes
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
          >
            Expand
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
          >
            Collapse
          </button>
          {onResetView && (
            <button
              onClick={onResetView}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded border border-slate-700 transition-colors"
              title="Reset Selection"
            >
              <RefreshCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Root Assembly Banner */}
      <div className="px-3 py-1.5 bg-cyan-950/30 border-b border-cyan-900/40 flex items-center justify-between text-[11px]">
        <span className="font-bold text-cyan-300 truncate">📦 {rootAssemblyName}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
          SOT: EngineeringDocument
        </span>
      </div>

      {/* Tree Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {rootNodes.map(node => renderNode(node, 0))}
      </div>

      {/* Part Information Inspector Panel */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 text-xs">
        {selectedInstance ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-slate-100">{selectedInstance.name || selectedInstance.instanceId}</span>
              </div>
              <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded ${
                selectedInstance.geometryStatus === 'PLANNED_NOT_MODELED'
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
              }`}>
                {selectedInstance.geometryStatus === 'PLANNED_NOT_MODELED' ? 'PLANNED / NOT_MODELED' : 'MODELED'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono text-slate-400">
              <div>
                <span className="text-slate-500">Instance ID:</span>{' '}
                <strong className="text-slate-200">{selectedInstance.instanceId}</strong>
              </div>
              <div>
                <span className="text-slate-500">Part ID:</span>{' '}
                <strong className="text-slate-200">{selectedInstance.partId || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Type:</span>{' '}
                <strong className="text-cyan-300">{selectedInstance.type || 'PART'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Parent ID:</span>{' '}
                <strong className="text-slate-200">{selectedInstance.parentId || 'ROOT'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Visibility:</span>{' '}
                <strong className={hiddenInstanceIds.includes(selectedInstance.instanceId) ? 'text-red-400' : 'text-emerald-400'}>
                  {hiddenInstanceIds.includes(selectedInstance.instanceId) ? 'HIDDEN' : 'VISIBLE'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Revision:</span>{' '}
                <strong className="text-slate-200">{selectedInstance.metadata?.revision || 1}</strong>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-800/80 space-y-1 text-[9.5px]">
              <div className="flex items-center justify-between text-slate-400 font-mono">
                <span>B-Rep Hash:</span>
                <span className="text-slate-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 truncate max-w-[180px]">
                  {selectedInstance.geometryStatus === 'PLANNED_NOT_MODELED'
                    ? 'N/A (PLANNED)'
                    : canonicalDocument?.derived?.mesh?.brepHash || 'CANONICAL_BREP_ACTIVE'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 font-mono">
                <span>Mesh Hash:</span>
                <span className="text-slate-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 truncate max-w-[180px]">
                  {selectedInstance.geometryStatus === 'PLANNED_NOT_MODELED'
                    ? 'N/A (PLANNED)'
                    : canonicalDocument?.derived?.mesh?.meshHash || 'CANONICAL_MESH_ACTIVE'}
                </span>
              </div>
              {selectedInstance.metadata?.provenance && (
                <div className="text-slate-400 font-sans text-[10px]">
                  <span className="text-slate-500">Provenance:</span> {selectedInstance.metadata.provenance}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-2 text-slate-500 text-[11px]">
            Click any part or sub-assembly in the tree above to view canonical B-Rep identity & properties.
          </div>
        )}
      </div>
    </div>
  );
};
