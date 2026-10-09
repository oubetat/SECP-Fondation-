import React, { useState } from 'react';
import { MonorepoNode } from '../types/secp';
import { SECP_MONOREPO_TREE } from '../data/monorepoData';
import { Folder, FolderOpen, FileCode, FileText, ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

export const MonorepoExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<MonorepoNode | null>(
    SECP_MONOREPO_TREE.children?.[0]?.children?.[0]?.children?.[0] || null
  );
  const [copied, setCopied] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'secp': true,
    'secp/apps': true,
    'secp/packages': true,
    'secp/engines': true,
    'secp/services': true,
    'secp/database': true,
    'secp/tests': true,
    'secp/docs': true,
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderTree = (node: MonorepoNode, depth: number = 0) => {
    const isFolder = node.type === 'directory';
    const isExpanded = expandedFolders[node.path];

    return (
      <div key={node.path} className="select-none">
        <div
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.path);
            } else {
              setSelectedFile(node);
            }
          }}
          className={`flex items-center space-x-2 py-1.5 px-2 rounded-md text-xs font-mono cursor-pointer transition-colors ${
            selectedFile?.path === node.path
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
              : 'text-slate-300 hover:bg-slate-800/60'
          }`}
        >
          {isFolder ? (
            <>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              {isExpanded ? <FolderOpen className="w-4 h-4 text-cyan-400" /> : <Folder className="w-4 h-4 text-slate-400" />}
            </>
          ) : (
            <>
              <span className="w-3.5" />
              {node.language === 'cpp' || node.language === 'cmake' ? (
                <FileCode className="w-4 h-4 text-blue-400" />
              ) : node.language === 'typescript' ? (
                <FileCode className="w-4 h-4 text-amber-400" />
              ) : node.language === 'sql' ? (
                <FileCode className="w-4 h-4 text-emerald-400" />
              ) : (
                <FileText className="w-4 h-4 text-slate-400" />
              )}
            </>
          )}

          <span className="truncate">{node.name}</span>
        </div>

        {isFolder && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
      {/* Sidebar Tree View */}
      <div className="md:col-span-4 lg:col-span-3 border-r border-slate-800 bg-slate-950/80 p-3 overflow-y-auto max-h-[600px]">
        <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider px-2 py-2 mb-1 border-b border-slate-800/80 flex items-center justify-between">
          <span>secp Directory Tree</span>
          <span className="text-[10px] text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-900">
            PATCH-SECP-000
          </span>
        </div>
        <div className="mt-2">{renderTree(SECP_MONOREPO_TREE)}</div>
      </div>

      {/* Main File Content Viewer */}
      <div className="md:col-span-8 lg:col-span-9 flex flex-col bg-slate-900">
        {selectedFile ? (
          <>
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">{selectedFile.path}</span>
                {selectedFile.language && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 uppercase">
                    {selectedFile.language}
                  </span>
                )}
              </div>

              <button
                onClick={() => selectedFile.content && handleCopyCode(selectedFile.content)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy File'}</span>
              </button>
            </div>

            <div className="p-4 flex-1 overflow-x-auto bg-slate-950/40">
              <pre className="font-mono text-xs text-slate-200 leading-relaxed whitespace-pre font-normal selection:bg-cyan-900 select-text">
                {selectedFile.content || '// Empty file or binary blob'}
              </pre>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
            Select a file from the secp/ tree to view its content
          </div>
        )}
      </div>
    </div>
  );
};
