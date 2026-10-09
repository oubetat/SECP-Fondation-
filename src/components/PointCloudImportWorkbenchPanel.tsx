import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Upload, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  FileCode, 
  Layers, 
  Check, 
  Cpu, 
  Sliders, 
  Database, 
  RefreshCw, 
  Plus, 
  BarChart2 
} from 'lucide-react';
import { PointCloudImportService } from '../engine/reverse_engineering/point_cloud/PointCloudImportService';
import { PointCloudParsers315 } from '../engine/reverse_engineering/point_cloud/PointCloudParsers315';
import { PointCloudDataset, Point3D } from '../engine/reverse_engineering/point_cloud/PointCloudTypes315';
import { HardAcceptanceGate315, GateTestResult315 } from '../engine/reverse_engineering/point_cloud/HardAcceptanceGate315';

export const PointCloudImportWorkbenchPanel: React.FC = () => {
  const [service] = useState(() => new PointCloudImportService());
  const [activeTab, setActiveTab] = useState<'DATASETS' | 'PARSER' | 'INSPECTOR' | 'GATE315'>('DATASETS');

  const [activeDatasetId, setActiveDatasetId] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [gateResults, setGateResults] = useState<GateTestResult315[] | null>(null);

  const [tick, setTick] = useState<number>(0);
  const refresh = () => setTick(t => t + 1);

  const datasets = useMemo(() => service.getAllPointClouds(), [service, tick]);
  const activeDataset = useMemo(() => datasets.find(d => d.datasetId === activeDatasetId) || (datasets.length > 0 ? datasets[0] : null), [datasets, activeDatasetId]);

  const handleLoadSamplePointCloud = () => {
    // Generate synthetic 3D point cloud scan of a cylindrical housing (5,000 pts)
    const points: Point3D[] = [];
    const radius = 25.0;
    const height = 60.0;
    for (let i = 0; i < 5000; i++) {
      const angle = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * height;
      const r = radius + (Math.random() - 0.5) * 0.05; // 50 micron scanner noise
      points.push({
        x: Number((r * Math.cos(angle)).toFixed(4)),
        y: Number((r * Math.sin(angle)).toFixed(4)),
        z: Number(z.toFixed(4)),
        intensity: Math.random(),
        confidence: 0.98
      });
    }

    const ds = service.importFromMemory({
      datasetName: 'OPTICAL-SCAN-CYLINDER-HOUSING-01',
      sourceFormat: 'PCD',
      points,
      unit: 'MM',
      sensorModel: 'GOM_ATOS_5_SCANNER'
    });

    setActiveDatasetId(ds.datasetId);
    setFeedback(`Imported point cloud ${ds.datasetId} with ${points.length.toLocaleString()} 3D scanner points.`);
    refresh();
  };

  const handleRunGate315 = () => {
    const gate = new HardAcceptanceGate315();
    const results = gate.runTestBattery();
    setGateResults(results);
    setActiveTab('GATE315');
    const passed = results.every(r => r.passed);
    setFeedback(`Gate 315 evaluated: ${passed ? 'PASSED (100%)' : 'FAILED'} (${results.filter(r => r.passed).length}/${results.length} assertions).`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Box className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight">Point Cloud Import & Spatial Indexing</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-full">
              PATCH-SECP-315
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Reverse engineering point cloud ingest: multi-format parsers (PTS, XYZ, PLY, PCD, LAS), spatial bounding boxes, and precision verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunGate315}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs rounded-lg transition shadow-md flex items-center gap-2 font-mono"
          >
            <ShieldCheck className="w-4 h-4" />
            Evaluate Gate 315
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-slate-950/80 border border-indigo-500/30 rounded-lg text-xs font-mono text-indigo-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
            {feedback}
          </span>
          <button onClick={() => setFeedback('')} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
        </div>
      )}

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-medium space-x-2">
        <button
          onClick={() => setActiveTab('DATASETS')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'DATASETS' ? 'border-indigo-500 text-indigo-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" /> Point Cloud Datasets ({datasets.length})
        </button>

        <button
          onClick={() => setActiveTab('INSPECTOR')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'INSPECTOR' ? 'border-cyan-500 text-cyan-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" /> Spatial Bounds & Density
        </button>

        <button
          onClick={() => setActiveTab('GATE315')}
          className={`pb-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
            activeTab === 'GATE315' ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gate 315 Report
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'DATASETS' && (
        <div className="space-y-4">
          {datasets.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
              <Box className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No point cloud datasets loaded in current session.</p>
              <button
                onClick={handleLoadSamplePointCloud}
                className="px-4 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Load Sample 3D Point Cloud (5,000 pts)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {datasets.map(ds => (
                <div
                  key={ds.datasetId}
                  onClick={() => {
                    setActiveDatasetId(ds.datasetId);
                    setActiveTab('INSPECTOR');
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    ds.datasetId === activeDatasetId ? 'bg-indigo-950/20 border-indigo-500/50 text-slate-200' : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-200">{ds.datasetName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {ds.sourceFormat}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-slate-400 space-y-1 font-mono">
                    <div>Point Count: <strong className="text-indigo-400">{ds.points.length.toLocaleString()}</strong></div>
                    <div>Units: <strong className="text-slate-300">{ds.unit}</strong></div>
                    <div>Sensor: <span className="text-slate-300">{ds.sensorModel || 'Generic Optical'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'INSPECTOR' && activeDataset && (
        <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-slate-200 text-sm">Point Cloud Spatial Properties</h3>
            <span className="text-indigo-400">{activeDataset.datasetId}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Bounding Box X</span>
              <strong className="text-slate-200">[{activeDataset.bounds.minX.toFixed(2)}, {activeDataset.bounds.maxX.toFixed(2)}] mm</strong>
            </div>
            <div className="p-3 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Bounding Box Y</span>
              <strong className="text-slate-200">[{activeDataset.bounds.minY.toFixed(2)}, {activeDataset.bounds.maxY.toFixed(2)}] mm</strong>
            </div>
            <div className="p-3 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Bounding Box Z</span>
              <strong className="text-slate-200">[{activeDataset.bounds.minZ.toFixed(2)}, {activeDataset.bounds.maxZ.toFixed(2)}] mm</strong>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Raw Point Sample (First 5 Points)</h4>
            <div className="space-y-1">
              {activeDataset.points.slice(0, 5).map((p, idx) => (
                <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-800 flex justify-between text-[11px]">
                  <span>P[{idx}]: X={p.x}, Y={p.y}, Z={p.z}</span>
                  <span className="text-slate-500">Intensity: {(p.intensity || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'GATE315' && gateResults && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            gateResults.every(r => r.passed) ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center gap-3">
              {gateResults.every(r => r.passed) ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-rose-400" />}
              <div>
                <h3 className="font-bold text-sm">Hard Acceptance Gate 315: {gateResults.every(r => r.passed) ? 'PASSED (100%)' : 'FAILED'}</h3>
                <p className="text-xs text-slate-400">Verified {gateResults.filter(r => r.passed).length} of {gateResults.length} point cloud parser and spatial indexing assertions.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {gateResults.map(r => (
              <div key={r.assertionId} className="p-3 bg-slate-950/60 border border-slate-850 rounded-lg flex items-start gap-3 text-xs">
                {r.passed ? <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <div className="font-semibold text-slate-200">Assertion #{r.assertionId}: {r.description}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
