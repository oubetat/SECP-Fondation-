import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Terminal, Play, RotateCcw, Box, Layers, CheckCircle2 } from 'lucide-react';
import { Point3D, BoundingBox } from '../types/secp';

export const CadKernelInspector: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([
    '-- SECP C++ CMake Build Pipeline initialized.',
    '-- Found CXX compiler: /usr/bin/c++ (g++ 12.2.0 -std=c++20)',
    '-- Configuring secp::cad (engines/cad-core)...',
    '-- [SECP C++ CadKernel] Target static library created: libcad-core.a',
    '-- Configuring secp::simulation (engines/simulation-core)...',
    '-- Configuring secp::manufacturing (engines/manufacturing-core)...',
    '-- Build files written to: /secp/engines/build',
  ]);

  const [nodes, setNodes] = useState<Point3D[]>([
    { x: -5, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 0, y: 8, z: 2 },
    { x: 0, y: 0, z: 6 },
  ]);

  const [newNode, setNewNode] = useState<Point3D>({ x: 2, y: 4, z: 1 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute bounding box using Geometry API math
  const bbox: BoundingBox = (() => {
    if (nodes.length === 0) return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const p of nodes) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
  })();

  const handleAddNode = () => {
    setNodes(prev => [...prev, { ...newNode }]);
    setLogs(prev => [
      ...prev,
      `[C++ CadKernel Bridge] Node added at (${newNode.x}, ${newNode.y}, ${newNode.z}). Recalculating B-Rep BoundingBox...`
    ]);
  };

  const handleTriggerCmakeBuild = () => {
    setLogs(prev => [
      ...prev,
      `[cmake] Re-running CMake generation for SECP_Engines...`,
      `[g++] Compiling cad_kernel.cpp -O3 -flto -std=c++20...`,
      `[g++] Compiling simulation_kernel.cpp...`,
      `[g++] Compiling gcode_generator.cpp...`,
      `[ld] Linking C++ static archive secp_engines_static.a SUCCESS`
    ]);
  };

  // Render 2D isometric projection of nodes and bounding box on HTML canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 + 20;
    const scale = 18;

    // Simple isometric projection mapping (x, y, z) -> (screenX, screenY)
    const project = (p: Point3D) => {
      const isoX = centerX + (p.x - p.y) * Math.cos(Math.PI / 6) * scale;
      const isoY = centerY + (p.x + p.y) * Math.sin(Math.PI / 6) * scale - p.z * scale * 0.8;
      return { x: isoX, y: isoY };
    };

    // Draw coordinate axes
    const origin = project({ x: 0, y: 0, z: 0 });
    const xAxis = project({ x: 8, y: 0, z: 0 });
    const yAxis = project({ x: 0, y: 8, z: 0 });
    const zAxis = project({ x: 0, y: 0, z: 8 });

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ef4444'; // X Red
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(xAxis.x, xAxis.y); ctx.stroke();
    ctx.strokeStyle = '#10b981'; // Y Green
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(yAxis.x, yAxis.y); ctx.stroke();
    ctx.strokeStyle = '#3b82f6'; // Z Blue
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(zAxis.x, zAxis.y); ctx.stroke();

    // Draw lines connecting structural nodes
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p1 = project(nodes[i]);
        const p2 = project(nodes[j]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // Draw nodes as spheres
    nodes.forEach((node, idx) => {
      const p = project(node);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = idx === nodes.length - 1 ? '#a855f7' : '#00f0ff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`N${idx} (${node.x},${node.y},${node.z})`, p.x + 8, p.y - 4);
    });
  }, [nodes]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* C++ CadKernel Engine Status & Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-cyan-950 text-cyan-400 rounded-lg border border-cyan-800">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base font-mono">C++20 CAD Core Engine</h3>
                  <p className="text-xs text-slate-400 font-mono">secp/engines/cad-core (Native/WASM)</p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CMake Ready</span>
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Kernel Version:</span>
                  <span className="text-cyan-400 font-semibold">SECP-CAD-Kernel v0.1.0-alpha</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">CXX Standard:</span>
                  <span className="text-white font-semibold">C++20 (GCC 12 / Clang 15)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">CMake Targets:</span>
                  <span className="text-emerald-400 font-semibold">cad-core, simulation-core</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">BoundingBox Calculation:</span>
                  <span className="text-amber-400 font-semibold">O(N) Vector3D Spatial Sweep</span>
                </div>
              </div>

              <button
                onClick={handleTriggerCmakeBuild}
                className="w-full inline-flex items-center justify-center space-x-2 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-cyan-400" />
                <span>Re-trigger CMake Engine Compilation</span>
              </button>
            </div>
          </div>

          {/* Geometry Node Input Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
            <h4 className="font-bold text-slate-200 text-xs font-mono uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Box className="w-4 h-4 text-cyan-400" />
              <span>Interactive Geometry Nodes</span>
            </h4>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">X Coord</label>
                <input
                  type="number"
                  value={newNode.x}
                  onChange={e => setNewNode({ ...newNode, x: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Y Coord</label>
                <input
                  type="number"
                  value={newNode.y}
                  onChange={e => setNewNode({ ...newNode, y: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Z Coord</label>
                <input
                  type="number"
                  value={newNode.z}
                  onChange={e => setNewNode({ ...newNode, z: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleAddNode}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              + Add Node to CAD Mesh
            </button>

            <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-xs space-y-1">
              <div className="text-slate-400 flex justify-between">
                <span>Active Nodes Count:</span>
                <span className="text-white font-bold">{nodes.length}</span>
              </div>
              <div className="text-slate-400 flex justify-between">
                <span>BoundingBox Min:</span>
                <span className="text-cyan-400">({bbox.min.x}, {bbox.min.y}, {bbox.min.z})</span>
              </div>
              <div className="text-slate-400 flex justify-between">
                <span>BoundingBox Max:</span>
                <span className="text-cyan-400">({bbox.max.x}, {bbox.max.y}, {bbox.max.z})</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Viewport Canvas & Terminal Output */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>3D Wireframe CAD Viewport (SECP B-Rep Kernel)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Isometric Projection</span>
            </div>

            <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center p-2">
              <canvas ref={canvasRef} width={480} height={280} className="w-full max-w-full h-auto bg-slate-950" />
            </div>
          </div>

          {/* C++ Build Log Terminal */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-xl font-mono">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>CMake & C++ Engine Terminal Stream</span>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Clear Log
              </button>
            </div>

            <div className="h-36 overflow-y-auto text-xs space-y-1 font-mono text-slate-300">
              {logs.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  <span className="text-cyan-600 mr-2">&gt;</span>
                  <span className={log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : ''}>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
