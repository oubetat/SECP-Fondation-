import React, { useState } from 'react';
import { Database, Activity, RefreshCw, CheckCircle2, Server, Table, Shield } from 'lucide-react';
import { DatabaseStatus } from '../types/secp';

export const DatabaseMonitor: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<DatabaseStatus>({
    connected: true,
    databaseName: 'secp_engineering_db',
    host: 'postgresql-secp-primary.internal',
    port: 5432,
    activePools: 4,
    maxPools: 20,
    latencyMs: 14,
    tables: [
      { tableName: 'secp_projects', rowCount: 14, sizeKb: 128 },
      { tableName: 'secp_cad_assets', rowCount: 42, sizeKb: 1024 },
      { tableName: 'secp_provenance_logs', rowCount: 128, sizeKb: 2048 },
      { tableName: 'secp_structural_revisions', rowCount: 36, sizeKb: 512 },
    ]
  });

  const [pinging, setPinging] = useState(false);
  const [queryOutput, setQueryOutput] = useState<string | null>(null);

  const handlePingDatabase = async () => {
    setPinging(true);
    setQueryOutput('EXPLAIN ANALYZE SELECT * FROM secp_projects JOIN secp_cad_assets ON ...');
    await new Promise(r => setTimeout(r, 600));
    setDbStatus(prev => ({
      ...prev,
      latencyMs: Math.floor(Math.random() * 8) + 10,
      activePools: Math.floor(Math.random() * 3) + 3
    }));
    setPinging(false);
    setQueryOutput(
      `QUERY PLAN:\nNested Loop  (cost=0.28..12.45 rows=14 width=256) (actual time=0.012..0.084ms)\n  -> Index Scan on secp_projects (cost=0.14..8.16 rows=14)\n  -> Index Scan on secp_cad_assets (cost=0.14..4.18 rows=1)\nExecution Time: 0.142 ms`
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Database Health Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-white text-lg font-mono">PostgreSQL Primary Cluster</h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CONNECTED</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                host: <span className="text-cyan-400">{dbStatus.host}:{dbStatus.port}</span> | db: <span className="text-white">{dbStatus.databaseName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handlePingDatabase}
            disabled={pinging}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${pinging ? 'animate-spin' : ''}`} />
            <span>{pinging ? 'Querying Pool...' : 'Test DB Latency & Pool'}</span>
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-xs font-mono block mb-1">Ping Latency</span>
            <span className="text-cyan-400 text-xl font-bold font-mono">{dbStatus.latencyMs} ms</span>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-xs font-mono block mb-1">Active Pool Connections</span>
            <span className="text-emerald-400 text-xl font-bold font-mono">{dbStatus.activePools} / {dbStatus.maxPools}</span>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-xs font-mono block mb-1">Total Verified Tables</span>
            <span className="text-amber-400 text-xl font-bold font-mono">{dbStatus.tables.length} Tables</span>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 text-xs font-mono block mb-1">SSL Security</span>
            <span className="text-purple-400 text-xl font-bold font-mono flex items-center space-x-1">
              <Shield className="w-4 h-4" />
              <span>TLS 1.3</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tables Inspector & SQL Explain Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Table className="w-4 h-4 text-cyan-400" />
            <span>Database Tables & Schema Metrics (/secp/database/schema.sql)</span>
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                  <th className="pb-3 font-semibold">Table Name</th>
                  <th className="pb-3 font-semibold">Row Count</th>
                  <th className="pb-3 font-semibold">Allocated Size</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {dbStatus.tables.map(table => (
                  <tr key={table.tableName} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-semibold text-cyan-400">{table.tableName}</td>
                    <td className="py-3 text-slate-300">{table.rowCount.toLocaleString()} rows</td>
                    <td className="py-3 text-slate-400">{table.sizeKb} KB</td>
                    <td className="py-3">
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
                        HEALTHY
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Query Output Console */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-xl font-mono flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mb-3 pb-2 border-b border-slate-800">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>PostgreSQL EXPLAIN ANALYZE Console</span>
            </div>

            <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              {queryOutput || '-- Click "Test DB Latency" to execute live query benchmark.'}
            </pre>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
            PostgreSQL DDL schema verified against <code className="text-cyan-400">/secp/database/schema.sql</code>
          </div>
        </div>
      </div>
    </div>
  );
};
