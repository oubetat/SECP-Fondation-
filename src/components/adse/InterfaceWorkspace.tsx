import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Search, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  Flame, 
  Zap, 
  Radio, 
  RefreshCw 
} from 'lucide-react';
import { ADSEWorkbenchBridge } from '../../engine/adse/workbench/ADSEWorkbenchBridge';

interface Props {
  onSelectEntity?: (canonicalId: string) => void;
}

export const InterfaceWorkspace: React.FC<Props> = ({ onSelectEntity }) => {
  const bridge = ADSEWorkbenchBridge.getInstance();
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [selectedInterfaceId, setSelectedInterfaceId] = useState<string | null>(null);

  const loadInterfaces = () => {
    const archIfaces = bridge.p3.interfaces.getAll();
    setInterfaces(archIfaces);
    if (archIfaces.length > 0 && !selectedInterfaceId) {
      setSelectedInterfaceId(archIfaces[0].id);
    }
  };

  useEffect(() => {
    loadInterfaces();
  }, []);

  const selectedIface = interfaces.find(i => i.id === selectedInterfaceId);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden font-sans">
      {/* Interfaces List Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs uppercase tracking-wider">System Interfaces</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
            {interfaces.length} Total
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {interfaces.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">No canonical interfaces registered.</div>
          ) : (
            interfaces.map(iface => {
              const isSelected = selectedInterfaceId === iface.id;
              return (
                <button
                  key={iface.id}
                  onClick={() => setSelectedInterfaceId(iface.id)}
                  className={`p-2.5 rounded-lg text-left transition border flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-cyan-600/15 border-cyan-500 text-white shadow-sm'
                      : 'border-transparent hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-400">{iface.id}</span>
                    <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400 uppercase">
                      {iface.type || 'PHYSICAL'}
                    </span>
                  </div>
                  <div className="text-xs font-medium truncate">{iface.name || iface.id}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Interface Inspector */}
      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto flex flex-col gap-6">
        {selectedIface ? (
          <>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-extrabold text-cyan-400">{selectedIface.id}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                    {selectedIface.type || 'INTER-SUBSYSTEM'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-200 mt-1">{selectedIface.name || 'Canonical Interface'}</div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                  Core Validated
                </span>
              </div>
            </div>

            {/* Endpoints & Source/Target Coupling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Source Entity</span>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
                  <div className="text-cyan-400 font-bold">{selectedIface.sourceElementId || 'SOURCE_NODE'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Origin Architecture Subsystem</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Entity</span>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
                  <div className="text-emerald-400 font-bold">{selectedIface.targetElementId || 'TARGET_NODE'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Destination Architecture Subsystem</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Select an interface to inspect its physical, electrical, and data flow coupling.
          </div>
        )}
      </div>
    </div>
  );
};
