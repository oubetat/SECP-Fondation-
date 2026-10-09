
import React, { useState } from 'react';
import { 
  PartDefinition 
} from '../engine/assembly/AssemblyCore';
import { Search, Box, Plus, Info, CheckCircle2, AlertCircle, History, Tag, Package, Layers } from 'lucide-react';

interface ComponentBrowserProps {
  parts: PartDefinition[];
  onInsert: (partId: string) => void;
}

export function ComponentBrowser({ parts, onInsert }: ComponentBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredParts = parts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.partId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800">
      <div className="p-3 border-b border-slate-800 bg-slate-900/30">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search Components / PLM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-blue-700 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredParts.length === 0 ? (
          <div className="p-8 text-center text-slate-700">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-10" />
            <div className="text-[10px] uppercase tracking-widest">No Components Found</div>
          </div>
        ) : (
          filteredParts.map(part => (
            <div 
              key={part.partId}
              className="p-3 bg-slate-900 border border-slate-800 rounded group hover:border-blue-800 transition-all cursor-default"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Box className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="font-bold text-slate-200 truncate text-[11px]">{part.name}</div>
                </div>
                <button 
                  onClick={() => onInsert(part.partId)}
                  className="p-1 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 transition-colors"
                  title="Insert into Assembly"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="flex items-center gap-1 text-[9px] text-slate-500">
                  <Tag className="w-3 h-3" />
                  ID: {part.partId}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-500">
                  <History className="w-3 h-3" />
                  REV: V{part.revision}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-slate-800/50">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[9px] text-emerald-600 font-bold">B-REP VALID</span>
                </div>
                <div className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-cyan-500" />
                  <span className="text-[9px] text-slate-400">RELEASED</span>
                </div>
              </div>

              <div className="mt-2 text-[8px] text-slate-600 font-mono overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                HASH: {part.geometryHash || 'NO_HASH'}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 border-t border-slate-800 bg-slate-900/20">
        <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2 font-bold uppercase tracking-widest">
          <History className="w-3.5 h-3.5" />
          Recently Used
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {parts.slice(0, 3).map(p => (
            <div key={p.partId} className="w-8 h-8 rounded bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 hover:border-blue-700 cursor-pointer transition-colors">
              <Box className="w-4 h-4 text-slate-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
