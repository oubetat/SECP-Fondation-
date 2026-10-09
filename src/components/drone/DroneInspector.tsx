import React from 'react';
import { Box, Layers, Hash, ShieldCheck, Activity } from 'lucide-react';
import { EngineeringDocument, AssemblyInstance } from '../../engine/cad-kernel/document/CADDocument';
import { IndustrialDroneAssemblyTreePanel } from '../IndustrialDroneAssemblyTreePanel';

interface Props {
  canonicalDocument: EngineeringDocument | null;
  selectedPartId: string | null;
  onSelectPartId: (id: string | null) => void;
  hiddenInstanceIds: string[];
  onToggleVisibility: (id: string) => void;
}

export const DroneInspector: React.FC<Props> = ({
  canonicalDocument,
  selectedPartId,
  onSelectPartId,
  hiddenInstanceIds,
  onToggleVisibility
}) => {
  const instances = canonicalDocument?.assembly?.instances || [];
  const selectedInstance = instances.find(i => i.instanceId === selectedPartId);

  return (
    <div className="flex h-full max-h-full overflow-hidden">
      <div className="w-96 border-r border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-800 bg-slate-900 shrink-0">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Assembly Explorer
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          <IndustrialDroneAssemblyTreePanel
            canonicalDocument={canonicalDocument}
            selectedPartId={selectedPartId}
            onSelectPartId={onSelectPartId}
            hiddenInstanceIds={hiddenInstanceIds}
            onToggleVisibility={onToggleVisibility}
            onResetView={() => onSelectPartId(null)}
          />
        </div>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto bg-slate-950">
        {selectedInstance ? (
          <PartPropertiesPanel instance={selectedInstance} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
            <Box className="w-12 h-12 text-slate-700" />
            <p className="text-sm font-medium">Select a component from the Assembly Explorer to inspect properties.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const PartPropertiesPanel: React.FC<{ instance: AssemblyInstance }> = ({ instance }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{instance.name}</h2>
          <div className="flex items-center gap-4 text-xs text-slate-400 font-mono mt-2">
            <span>Part ID: {instance.partId}</span>
            <span>Instance ID: {instance.instanceId}</span>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-md text-xs font-bold font-mono border bg-slate-950 border-slate-800 text-slate-300">
          REV: {instance.revision || '1.0.0'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <Activity className="w-4 h-4 text-sky-400" />
            Engineering Status
          </h3>
          <div className="space-y-3">
            <PropertyRow label="Geometry Status" value={instance.geometryStatus} highlight={instance.geometryStatus === 'MODELED'} />
            <PropertyRow label="Parent Assembly" value={instance.parentId || 'ROOT'} />
            <PropertyRow label="Material" value={instance.material?.name || 'NOT SPECIFIED'} />
            <PropertyRow label="Material ID" value={instance.material?.id || 'N/A'} />
            {instance.material?.density && (
              <PropertyRow label="Density" value={`${instance.material.density} kg/m³`} />
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Provenance & Hashes
          </h3>
          <div className="space-y-3">
            <PropertyRow label="Provenance" value={instance.provenance || 'CANONICAL_REFERENCE'} />
            <PropertyRow label="Geometry Hash" value={instance.geometryHash || 'PENDING_COMPUTATION'} mono />
            <PropertyRow label="Mesh Hash" value={instance.meshHash || 'PENDING_COMPUTATION'} mono />
          </div>
        </div>
      </div>
    </div>
  );
};

const PropertyRow = ({ label, value, mono = false, highlight = false }: { label: string, value: string, mono?: boolean, highlight?: boolean }) => (
  <div className="flex flex-col gap-1 pb-3 border-b border-slate-800/50 last:border-0 last:pb-0">
    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</span>
    <span className={`text-sm ${mono ? 'font-mono text-[11px]' : 'font-medium'} ${highlight ? 'text-emerald-400' : 'text-slate-300'}`}>
      {value}
    </span>
  </div>
);
