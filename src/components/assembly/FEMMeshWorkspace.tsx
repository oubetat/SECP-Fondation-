/**
 * PATCH-SECP-231 — General FEM Mesh Workspace
 *
 * Sophisticated, high-fidelity engineering workspace supporting real-time Mesh generation,
 * interactive 2D & rotating 3D canvas rendering with click-selection, quality diagnostics,
 * global/local element refinement, and the Hard Acceptance Gate 231 qualification battery.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Layers, Cpu, ShieldCheck, CheckCircle, AlertTriangle, RefreshCw,
  Search, Sliders, ChevronRight, BarChart2, Zap, Download, ZoomIn, ZoomOut,
  MousePointer, Eye, Trash2, Code, Info
} from 'lucide-react';

import { FEMMeshGenerator, MeshGenerationParams } from '../../engine/fem/mesh/FEMMeshGenerator';
import { FEMMeshValidator, ValidationReport } from '../../engine/fem/mesh/FEMMeshValidator';
import { FEMMeshRefiner } from '../../engine/fem/mesh/FEMMeshRefiner';
import { FEMMeshSerializer } from '../../engine/fem/mesh/FEMMeshSerializer';
import { FEMNode } from '../../engine/fem/mesh/FEMNode';
import { FEMElement } from '../../engine/fem/mesh/FEMElement';
import { FEMMesh } from '../../engine/fem/mesh/FEMMesh';
import { HardAcceptanceGate231, Gate231Evidence } from '../../engine/fem/mesh/HardAcceptanceGate231';
import { FEMMeshQualityCalculator } from '../../engine/fem/mesh/FEMMeshQuality';

export const FEMMeshWorkspace: React.FC = () => {
  // Input parameters state
  const [geometryType, setGeometryType] = useState<'RECTANGLE' | 'CIRCLE' | 'PLATE_WITH_HOLE' | 'BOX' | 'CYLINDER'>('PLATE_WITH_HOLE');
  const [elementType, setElementType] = useState<'TRI' | 'QUAD' | 'TET' | 'HEX'>('TRI');
  const [elementSize, setElementSize] = useState<number | null>(null);
  
  // Dimensions state
  const [width, setWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [holeRadius, setHoleRadius] = useState<number | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [dx, setDx] = useState<number | null>(null);
  const [dy, setDy] = useState<number | null>(null);
  const [dz, setDz] = useState<number | null>(null);
  const [cylRadius, setCylRadius] = useState<number | null>(null);
  const [cylHeight, setCylHeight] = useState<number | null>(null);

  // Active workspace state
  const [mesh, setMesh] = useState<FEMMesh | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [activeTab, setActiveTab] = useState<'GENERATOR' | 'QUALITY' | 'REFINEMENT' | 'GATE231'>('GENERATOR');
  
  // Selection states
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Visual options
  const [showNodes, setShowNodes] = useState<boolean>(true);
  const [showElements, setShowElements] = useState<boolean>(true);
  const [showBoundaries, setShowBoundaries] = useState<boolean>(true);
  const [showPoorElements, setShowPoorElements] = useState<boolean>(true);

  // 3D Rotation Angles for interactive Box/Cylinder dragging
  const [rotX, setRotX] = useState<number>(-0.5); // Radians
  const [rotY, setRotY] = useState<number>(0.6);  // Radians
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Gate evaluation state
  const [gateEvidence, setGateEvidence] = useState<Gate231Evidence | null>(null);
  const [isEvaluatingGate, setIsEvaluatingGate] = useState<boolean>(false);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-generate mesh effect removed for clean zero state
  useEffect(() => {
    // Await user action
  }, [geometryType, elementType]);

  // Handle Mesh Generation
  const handleGenerateMesh = () => {
    if (elementSize === null) return;
    
    // Validate required dimensions based on geometry type
    if (geometryType === 'RECTANGLE' && (width === null || height === null)) return;
    if (geometryType === 'CIRCLE' && radius === null) return;
    if (geometryType === 'PLATE_WITH_HOLE' && (width === null || height === null || holeRadius === null)) return;
    if (geometryType === 'BOX' && (dx === null || dy === null || dz === null)) return;
    if (geometryType === 'CYLINDER' && (cylRadius === null || cylHeight === null)) return;

    // Coerce elementType based on dimensions/dimension-space constraints
    let finalType = elementType;
    if (geometryType === 'BOX' && elementType !== 'TET' && elementType !== 'HEX') {
      finalType = 'TET';
      setElementType('TET');
    } else if (geometryType === 'CYLINDER') {
      finalType = 'TET';
      setElementType('TET');
    } else if (geometryType === 'CIRCLE') {
      finalType = 'TRI';
      setElementType('TRI');
    } else if (geometryType === 'RECTANGLE' || geometryType === 'PLATE_WITH_HOLE') {
      if (elementType !== 'TRI' && elementType !== 'QUAD') {
        finalType = 'TRI';
        setElementType('TRI');
      }
    }

    const dims: Record<string, number> = {};
    if (geometryType === 'RECTANGLE') {
      dims.width = width;
      dims.height = height;
    } else if (geometryType === 'CIRCLE') {
      dims.radius = radius;
    } else if (geometryType === 'PLATE_WITH_HOLE') {
      dims.width = width;
      dims.height = height;
      dims.holeRadius = holeRadius;
    } else if (geometryType === 'BOX') {
      dims.dx = dx;
      dims.dy = dy;
      dims.dz = dz;
    } else if (geometryType === 'CYLINDER') {
      dims.radius = cylRadius;
      dims.height = cylHeight;
    }

    try {
      const generated = FEMMeshGenerator.generate({
        geometryType,
        dimensions: dims,
        elementSize,
        elementType: finalType,
      });

      const report = FEMMeshValidator.validate(generated);
      setMesh(generated);
      setValidationReport(report);
      setSelectedNodeId(null);
      setSelectedElementId(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Global Refinement
  const handleGlobalRefinement = () => {
    if (!mesh) return;
    const refined = FEMMeshRefiner.refineGlobal(mesh);
    const report = FEMMeshValidator.validate(refined);
    setMesh(refined);
    setValidationReport(report);
    setSelectedNodeId(null);
    setSelectedElementId(null);
  };

  // Local Region Refinement
  const handleRegionRefinement = () => {
    if (!mesh) return;
    const refined = FEMMeshRefiner.refineRegion(mesh, 'REG_CORE');
    const report = FEMMeshValidator.validate(refined);
    setMesh(refined);
    setValidationReport(report);
    setSelectedNodeId(null);
    setSelectedElementId(null);
  };

  // Evaluate Hard Acceptance Gate 231
  const handleEvaluateGate = () => {
    setIsEvaluatingGate(true);
    setTimeout(() => {
      const result = HardAcceptanceGate231.evaluate();
      setGateEvidence(result);
      setIsEvaluatingGate(false);
    }, 400);
  };

  // Export Mesh to Clipboard
  const handleExportMesh = () => {
    if (!mesh) return;
    const json = FEMMeshSerializer.exportToJSON(mesh);
    navigator.clipboard.writeText(json);
    alert('Mesh JSON exported to clipboard successfully!');
  };

  // Selected components details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !mesh) return null;
    return mesh.nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, mesh]);

  const selectedElement = useMemo(() => {
    if (!selectedElementId || !mesh) return null;
    return mesh.elements.find(e => e.id === selectedElementId) || null;
  }, [selectedElementId, mesh]);

  const elementQualityMetrics = useMemo(() => {
    if (!selectedElementId || !validationReport?.qualityCheck?.summary) return null;
    return validationReport.qualityCheck.summary.elementQualities.get(selectedElementId) || null;
  }, [selectedElementId, validationReport]);

  // ==========================================
  // CANVAS INTERACTION & RENDERING LOGIC
  // ==========================================
  // Mouse Drag to rotate 3D wireframe
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dxMouse = e.clientX - lastMousePosRef.current.x;
    const dyMouse = e.clientY - lastMousePosRef.current.y;
    setRotX(prev => prev + dyMouse * 0.01);
    setRotY(prev => prev + dxMouse * 0.01);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Click on Canvas to Select Node or Element
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !mesh) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // We search the closest node to select
    const widthCanvas = canvasRef.current.width;
    const heightCanvas = canvasRef.current.height;
    const centerCanvasX = widthCanvas / 2;
    const centerCanvasY = heightCanvas / 2;

    // Scale calculation
    const coordsX = mesh.nodes.map(n => n.x);
    const coordsY = mesh.nodes.map(n => n.y);
    const coordsZ = mesh.nodes.map(n => n.z);

    const minX = Math.min(...coordsX, -0.5);
    const maxX = Math.max(...coordsX, 0.5);
    const minY = Math.min(...coordsY, -0.5);
    const maxY = Math.max(...coordsY, 0.5);

    const rangeX = maxX - minX || 1.0;
    const rangeY = maxY - minY || 1.0;
    const scale = Math.min(widthCanvas * 0.6 / rangeX, heightCanvas * 0.6 / rangeY);

    // Coordinate projection functions (supporting 3D rotations)
    const project = (node: FEMNode) => {
      let rx = node.x;
      let ry = node.y;
      let rz = node.z;

      if (geometryType === 'BOX' || geometryType === 'CYLINDER') {
        // Rotate 3D points
        // Around Y axis
        const x1 = node.x * Math.cos(rotY) - node.z * Math.sin(rotY);
        const z1 = node.x * Math.sin(rotY) + node.z * Math.cos(rotY);
        // Around X axis
        const y2 = node.y * Math.cos(rotX) - z1 * Math.sin(rotX);
        
        rx = x1;
        ry = y2;
      }

      // Convert 3D rotated coordinates to 2D Canvas pixels
      const px = centerCanvasX + rx * scale;
      const py = centerCanvasY - ry * scale; // invert Y
      return { px, py };
    };

    let closestNodeId: string | null = null;
    let minDistance = 15; // Selection radius in pixels

    for (const node of mesh.nodes) {
      const { px, py } = project(node);
      const d = Math.hypot(clickX - px, clickY - py);
      if (d < minDistance) {
        minDistance = d;
        closestNodeId = node.id;
      }
    }

    if (closestNodeId) {
      setSelectedNodeId(closestNodeId);
      setSelectedElementId(null);
      return;
    }

    // Otherwise find element clicked (check if click sits inside projected element polygon)
    const isPointInPoly = (px: number, py: number, polygon: { x: number; y: number }[]) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const nodesMap = new Map<string, FEMNode>(mesh.nodes.map(n => [n.id, n]));
    let clickedElementId: string | null = null;

    for (const elem of mesh.elements) {
      const poly = elem.nodeIds.map(nid => {
        const nd = nodesMap.get(nid)!;
        const { px, py } = project(nd);
        return { x: px, y: py };
      });
      if (isPointInPoly(clickX, clickY, poly)) {
        clickedElementId = elem.id;
        break;
      }
    }

    setSelectedElementId(clickedElementId);
    if (clickedElementId) setSelectedNodeId(null);
  };

  // Draw Mesh on Canvas
  useEffect(() => {
    if (!canvasRef.current || !mesh) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const widthCanvas = canvas.width;
    const heightCanvas = canvas.height;
    ctx.clearRect(0, 0, widthCanvas, heightCanvas);

    // Deep grid background
    ctx.fillStyle = '#0F172A'; // Dark slate theme
    ctx.fillRect(0, 0, widthCanvas, heightCanvas);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    for (let x = 0; x < widthCanvas; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, heightCanvas);
      ctx.stroke();
    }
    for (let y = 0; y < heightCanvas; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(widthCanvas, y);
      ctx.stroke();
    }

    // Scale calculation
    const coordsX = mesh.nodes.map(n => n.x);
    const coordsY = mesh.nodes.map(n => n.y);

    const minX = Math.min(...coordsX, -0.5);
    const maxX = Math.max(...coordsX, 0.5);
    const minY = Math.min(...coordsY, -0.5);
    const maxY = Math.max(...coordsY, 0.5);

    const rangeX = maxX - minX || 1.0;
    const rangeY = maxY - minY || 1.0;
    const scale = Math.min(widthCanvas * 0.65 / rangeX, heightCanvas * 0.65 / rangeY);

    const centerCanvasX = widthCanvas / 2;
    const centerCanvasY = heightCanvas / 2;

    const project = (node: FEMNode) => {
      let rx = node.x;
      let ry = node.y;
      let rz = node.z;

      if (geometryType === 'BOX' || geometryType === 'CYLINDER') {
        // Rotate 3D points
        // Around Y axis
        const x1 = node.x * Math.cos(rotY) - node.z * Math.sin(rotY);
        const z1 = node.x * Math.sin(rotY) + node.z * Math.cos(rotY);
        // Around X axis
        const y2 = node.y * Math.cos(rotX) - z1 * Math.sin(rotX);
        
        rx = x1;
        ry = y2;
      }

      const px = centerCanvasX + rx * scale;
      const py = centerCanvasY - ry * scale;
      return { px, py };
    };

    const nodesMap = new Map<string, FEMNode>(mesh.nodes.map(n => [n.id, n]));

    // Draw Elements
    if (showElements) {
      for (const elem of mesh.elements) {
        const poly = elem.nodeIds.map(nid => project(nodesMap.get(nid)!));
        
        ctx.beginPath();
        ctx.moveTo(poly[0].px, poly[0].py);
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].px, poly[i].py);
        }
        ctx.closePath();

        // Color coding elements based on quality / selection
        const isSelected = selectedElementId === elem.id;
        const qualityMetric = validationReport?.qualityCheck?.summary?.elementQualities?.get(elem.id);
        const classification = qualityMetric?.classification || 'VALID';

        if (isSelected) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.35)'; // Blue translucent for selection
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2;
        } else if (showPoorElements && classification === 'POOR') {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.25)'; // Orange translucent for poor quality
          ctx.strokeStyle = '#F97316';
          ctx.lineWidth = 1.5;
        } else if (classification === 'INVALID') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Red translucent for invalid
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
        } else {
          ctx.fillStyle = 'rgba(30, 41, 59, 0.7)'; // Default slate grey
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1;
        }

        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw Boundary Supports / Loads
    if (showBoundaries) {
      for (const node of mesh.nodes) {
        if (node.boundaryTags.length > 0) {
          const { px, py } = project(node);

          if (node.boundaryTags.includes('FIXED_SUPPORT')) {
            // Draw support triangle icon
            ctx.fillStyle = '#EF4444'; // Red for fixed
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - 6, py + 10);
            ctx.lineTo(px + 6, py + 10);
            ctx.closePath();
            ctx.fill();
          }

          if (node.boundaryTags.includes('LOAD_FACE') || node.boundaryTags.includes('PRESSURE_FACE')) {
            // Draw force load arrow
            ctx.strokeStyle = '#3B82F6'; // Blue force vector
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(px, py - 15);
            ctx.lineTo(px, py);
            ctx.moveTo(px - 4, py - 6);
            ctx.lineTo(px, py);
            ctx.lineTo(px + 4, py - 6);
            ctx.stroke();
          }

          if (node.boundaryTags.includes('CONTACT')) {
            // Draw contact circle highlight
            ctx.strokeStyle = '#10B981'; // Green for contact
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }
      }
    }

    // Draw Nodes
    if (showNodes) {
      for (const node of mesh.nodes) {
        const { px, py } = project(node);
        const isSelected = selectedNodeId === node.id;

        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 5 : 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = isSelected ? '#60A5FA' : '#94A3B8';
        ctx.fill();
        
        if (isSelected) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // 3D drag instructions
    if (geometryType === 'BOX' || geometryType === 'CYLINDER') {
      ctx.fillStyle = '#64748B';
      ctx.font = '11px monospace';
      ctx.fillText('Drag on canvas to rotate 3D view', 12, heightCanvas - 15);
    }
  }, [mesh, showNodes, showElements, showBoundaries, showPoorElements, rotX, rotY, selectedNodeId, selectedElementId]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 h-full bg-slate-950 p-4 select-none">
      {/* LEFT: Controls and configurations (5 Columns) */}
      <div className="xl:col-span-5 flex flex-col space-y-4 overflow-y-auto pr-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl">
          <div className="flex items-center space-x-2 text-amber-400 mb-4">
            <Sliders className="w-5 h-5" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">CAD Geometry Input</h2>
          </div>

          <div className="space-y-4">
            {/* Geometry Select */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Geometry Shell Profile</label>
              <select
                value={geometryType}
                onChange={(e) => setGeometryType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded p-2 focus:outline-none focus:border-amber-500"
              >
                <option value="RECTANGLE">2D Plate Rectangle (2D)</option>
                <option value="CIRCLE">2D Circular Diaphragm (2D)</option>
                <option value="PLATE_WITH_HOLE">2D Tension Plate with Center Hole (2D)</option>
                <option value="BOX">3D Prism Box Solid (3D Volume)</option>
                <option value="CYLINDER">3D Cylindrical Extrusion (3D Volume)</option>
              </select>
            </div>

            {/* Geometry Parameters */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950 border border-slate-800/60 rounded p-3">
              {geometryType === 'RECTANGLE' && (
                <>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Width (m)</label>
                    <input
                      type="number" step="0.1" value={width ?? ''} placeholder="UNASSIGNED" onChange={(e) => setWidth(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Height (m)</label>
                    <input
                      type="number" step="0.1" value={height ?? ''} placeholder="UNASSIGNED" onChange={(e) => setHeight(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </>
              )}

              {geometryType === 'CIRCLE' && (
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-0.5">Radius (m)</label>
                  <input
                    type="number" step="0.05" value={radius ?? ''} placeholder="UNASSIGNED" onChange={(e) => setRadius(e.target.value === '' ? null : parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {geometryType === 'PLATE_WITH_HOLE' && (
                <>
                  <div className="col-span-2 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">Width (m)</label>
                      <input
                        type="number" step="0.1" value={width ?? ''} placeholder="UNASSIGNED" onChange={(e) => setWidth(e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">Height (m)</label>
                      <input
                        type="number" step="0.1" value={height ?? ''} placeholder="UNASSIGNED" onChange={(e) => setHeight(e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">Hole Radius (m)</label>
                      <input
                        type="number" step="0.05" value={holeRadius ?? ''} placeholder="UNASSIGNED" onChange={(e) => setHoleRadius(e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {geometryType === 'BOX' && (
                <div className="col-span-2 grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Length X (m)</label>
                    <input
                      type="number" step="0.1" value={dx ?? ''} placeholder="UNASSIGNED" onChange={(e) => setDx(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Width Y (m)</label>
                    <input
                      type="number" step="0.1" value={dy ?? ''} placeholder="UNASSIGNED" onChange={(e) => setDy(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Height Z (m)</label>
                    <input
                      type="number" step="0.1" value={dz ?? ''} placeholder="UNASSIGNED" onChange={(e) => setDz(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              {geometryType === 'CYLINDER' && (
                <>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Radius (m)</label>
                    <input
                      type="number" step="0.05" value={cylRadius ?? ''} placeholder="UNASSIGNED" onChange={(e) => setCylRadius(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Height (m)</label>
                    <input
                      type="number" step="0.1" value={cylHeight ?? ''} placeholder="UNASSIGNED" onChange={(e) => setCylHeight(e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs p-1.5 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Element Types and Sizes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Element Formulation</label>
                <select
                  value={elementType}
                  onChange={(e) => setElementType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded p-2 focus:outline-none focus:border-amber-500"
                >
                  {(geometryType === 'RECTANGLE' || geometryType === 'PLATE_WITH_HOLE') && (
                    <>
                      <option value="TRI">Triangle (2D TRI)</option>
                      <option value="QUAD">Quadrilateral (2D QUAD)</option>
                    </>
                  )}
                  {geometryType === 'CIRCLE' && (
                    <option value="TRI">Triangle (2D TRI)</option>
                  )}
                  {geometryType === 'BOX' && (
                    <>
                      <option value="TET">Tetrahedron (3D TET)</option>
                      <option value="HEX">Hexahedron (3D HEX)</option>
                    </>
                  )}
                  {geometryType === 'CYLINDER' && (
                    <option value="TET">Tetrahedron (3D TET)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Mesh Element Size</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range" min="0.10" max="0.50" step="0.05"
                    value={elementSize ?? ''}
                    placeholder="—"
                    onChange={(e) => setElementSize(e.target.value === '' ? null : parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-xs text-slate-300 font-mono w-12 text-right">{(elementSize || 0).toFixed(2)}m</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateMesh}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-2.5 px-4 rounded shadow-lg transition-colors flex items-center justify-center space-x-2 text-sm uppercase tracking-wider"
            >
              <RefreshCw className="w-4 h-4 animate-spin-hover" />
              <span>Generate General Mesh</span>
            </button>
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900 rounded-t-lg">
          <button
            onClick={() => setActiveTab('GENERATOR')}
            className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase border-b-2 text-center transition-colors ${
              activeTab === 'GENERATOR' ? 'border-amber-500 text-amber-400 bg-slate-950/40' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('QUALITY')}
            className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase border-b-2 text-center transition-colors ${
              activeTab === 'QUALITY' ? 'border-amber-500 text-amber-400 bg-slate-950/40' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Quality Summary
          </button>
          <button
            onClick={() => setActiveTab('REFINEMENT')}
            className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase border-b-2 text-center transition-colors ${
              activeTab === 'REFINEMENT' ? 'border-amber-500 text-amber-400 bg-slate-950/40' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Mesh Refiner
          </button>
          <button
            onClick={() => setActiveTab('GATE231')}
            className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase border-b-2 text-center transition-colors ${
              activeTab === 'GATE231' ? 'border-amber-500 text-amber-400 bg-slate-950/40' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Gate 231
          </button>
        </div>

        {/* Tab Contents */}
        <div className="bg-slate-900 border border-slate-800 rounded-b-lg p-4 flex-1 shadow-lg">
          {activeTab === 'GENERATOR' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Mesh Core Statistics</span>
                {validationReport?.isValid ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[11px] font-bold tracking-widest flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>VALID_MESH</span>
                  </span>
                ) : (
                  <span className="bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded text-[11px] font-bold tracking-widest flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>INVALIDATED</span>
                  </span>
                )}
              </div>

              {mesh && (
                <div className="grid grid-cols-2 gap-3 text-slate-300 font-mono text-xs">
                  <div className="bg-slate-950 border border-slate-800/80 rounded p-2.5">
                    <span className="block text-[10px] text-slate-500 uppercase">Nodes Count</span>
                    <span className="text-base text-slate-200 font-bold">{mesh.nodes.length}</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800/80 rounded p-2.5">
                    <span className="block text-[10px] text-slate-500 uppercase">Elements Count</span>
                    <span className="text-base text-slate-200 font-bold">{mesh.elements.length}</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800/80 rounded p-2.5">
                    <span className="block text-[10px] text-slate-500 uppercase">Boundary Sets</span>
                    <span className="text-base text-slate-200 font-bold">{mesh.boundaries.length}</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800/80 rounded p-2.5">
                    <span className="block text-[10px] text-slate-500 uppercase">Material Regions</span>
                    <span className="text-base text-slate-200 font-bold">{mesh.regions.length}</span>
                  </div>
                  <div className="col-span-2 bg-slate-950 border border-slate-800/80 rounded p-2.5 space-y-1">
                    <span className="block text-[10px] text-slate-500 uppercase">Industrial OS Provenance Fingerprint</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div><span className="text-slate-500">Geometry:</span> <span className="text-amber-400">{mesh.geometryHash}</span></div>
                      <div><span className="text-slate-500">Topology:</span> <span className="text-blue-400">{mesh.topologyHash}</span></div>
                      <div><span className="text-slate-500">Quality:</span> <span className="text-emerald-400">{mesh.qualityHash}</span></div>
                      <div><span className="text-slate-500">Combined:</span> <span className="text-purple-400">{mesh.meshHash}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selection cards details */}
              {selectedNode && (
                <div className="border border-blue-500/20 bg-blue-500/5 rounded p-3 text-xs font-mono space-y-1">
                  <span className="text-blue-400 font-bold block border-b border-blue-500/10 pb-1 uppercase">Node Metadata Selected</span>
                  <div>ID: <span className="text-slate-100 font-bold">{selectedNode.id}</span></div>
                  <div>Coords: <span className="text-slate-100 font-bold">X: {selectedNode.x.toFixed(4)}, Y: {selectedNode.y.toFixed(4)}, Z: {selectedNode.z.toFixed(4)}</span></div>
                  <div>Boundary Tags: <span className="text-amber-400">{selectedNode.boundaryTags.join(', ') || 'NONE (INTERIOR)'}</span></div>
                </div>
              )}

              {selectedElement && (
                <div className="border border-amber-500/20 bg-amber-500/5 rounded p-3 text-xs font-mono space-y-1">
                  <span className="text-amber-400 font-bold block border-b border-amber-500/10 pb-1 uppercase">Element Metadata Selected</span>
                  <div>ID: <span className="text-slate-100 font-bold">{selectedElement.id}</span></div>
                  <div>Type: <span className="text-slate-100 font-bold">{selectedElement.type}</span></div>
                  <div>Connected Nodes: <span className="text-blue-400">{selectedElement.nodeIds.join(', ')}</span></div>
                  <div>Region Mapping: <span className="text-slate-300">{selectedElement.regionId} ({selectedElement.materialId})</span></div>
                  {elementQualityMetrics && (
                    <div className="mt-1 pt-1 border-t border-slate-800">
                      <span className="text-[10px] text-slate-500 block">QUALITY STATS</span>
                      <div className="grid grid-cols-2 gap-x-2 text-[11px]">
                        <div>Class: <span className={`font-bold ${elementQualityMetrics.classification === 'VALID' ? 'text-emerald-400' : 'text-orange-400'}`}>{elementQualityMetrics.classification}</span></div>
                        {elementQualityMetrics.metrics.area !== undefined && <div>Area: <span className="text-slate-200">{elementQualityMetrics.metrics.area.toFixed(6)}m²</span></div>}
                        {elementQualityMetrics.metrics.volume !== undefined && <div>Volume: <span className="text-slate-200">{elementQualityMetrics.metrics.volume.toFixed(8)}m³</span></div>}
                        <div>Aspect Ratio: <span className="text-slate-200">{elementQualityMetrics.metrics.aspectRatio?.toFixed(4)}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'QUALITY' && validationReport?.qualityCheck?.summary && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Quality Grading Summary</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                  validationReport.qualityCheck.summary.overallClassification === 'VALID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                }`}>
                  {validationReport.qualityCheck.summary.overallClassification}
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded flex justify-between">
                  <span className="text-slate-500">Average Aspect Ratio:</span>
                  <span className="font-bold text-slate-200">{validationReport.qualityCheck.summary.averageAspectRatio.toFixed(4)}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded flex justify-between">
                  <span className="text-slate-500">Max Aspect Ratio:</span>
                  <span className="font-bold text-slate-200">{validationReport.qualityCheck.summary.maxAspectRatio.toFixed(4)}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-2.5 rounded flex justify-between">
                  <span className="text-slate-500">Min Element Size:</span>
                  <span className="font-bold text-slate-200">{validationReport.qualityCheck.summary.minAreaVolume.toFixed(8)}</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded p-3 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Element Classification Bands</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-1">
                      <div className="text-[10px] text-emerald-400 font-bold uppercase">Valid</div>
                      <div className="text-sm font-bold text-slate-100">
                        {mesh!.elements.length - validationReport.qualityCheck.summary.warningCount - validationReport.qualityCheck.summary.poorCount - validationReport.qualityCheck.summary.invalidCount}
                      </div>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-1">
                      <div className="text-[10px] text-yellow-400 font-bold uppercase">Warning</div>
                      <div className="text-sm font-bold text-slate-100">{validationReport.qualityCheck.summary.warningCount}</div>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded p-1">
                      <div className="text-[10px] text-orange-400 font-bold uppercase">Poor</div>
                      <div className="text-sm font-bold text-slate-100">{validationReport.qualityCheck.summary.poorCount}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'REFINEMENT' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Mesh Subdivision & Refinement</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Refining divides elements into smaller shapes using high-performance midpoint-projection algorithms, doubling resolution and preserving topological connectivity.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleGlobalRefinement}
                  className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-2 px-3 rounded flex items-center justify-between text-xs transition-all"
                >
                  <span>1. Global Element Subdivision</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={handleRegionRefinement}
                  className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-2 px-3 rounded flex items-center justify-between text-xs transition-all"
                >
                  <span>2. Local Core Region Refinement</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'GATE231' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hard Acceptance Gate 231</span>
                {gateEvidence?.passed ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>GATE_PASSED</span>
                  </span>
                ) : (
                  <span className="text-slate-500 text-[10px]">UNCHECKED</span>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Runs 8 comprehensive tests (conforming, plate hole boundary conformities, 3D Tet, corruption checkers, and determinism) to certify truth provenance.
              </p>

              <button
                onClick={handleEvaluateGate}
                disabled={isEvaluatingGate}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-bold py-2 px-4 rounded text-xs uppercase tracking-wider flex items-center justify-center space-x-2"
              >
                {isEvaluatingGate ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Evaluating System Gate...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Run Verification Suite</span>
                  </>
                )}
              </button>

              {gateEvidence && (
                <div className="space-y-2 border-t border-slate-800/80 pt-3 font-mono text-[11px]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Automated Reports:</span>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Test 1 — Simple Rectangle:</span>
                      <span className={gateEvidence.tests.test1_simpleRectangle ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {gateEvidence.tests.test1_simpleRectangle ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Test 2 — Plate With Hole:</span>
                      <span className={gateEvidence.tests.test2_plateWithHole ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {gateEvidence.tests.test2_plateWithHole ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Test 3 — 3D Tetrahedralized Solid:</span>
                      <span className={gateEvidence.tests.test3_solid3D ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {gateEvidence.tests.test3_solid3D ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Test 4 — Quality Metric Range:</span>
                      <span className={gateEvidence.tests.test4_meshQuality ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {gateEvidence.tests.test4_meshQuality ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Test 5 — Corruption Rejection:</span>
                      <span className={gateEvidence.tests.test5_corruptedMesh ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {gateEvidence.tests.test5_corruptedMesh ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Test 6 — Deterministic Refinement:</span>
                      <span className={gateEvidence.tests.test6_refinement ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {gateEvidence.tests.test6_refinement ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Test 7 — Hashing Determinism:</span>
                      <span className={gateEvidence.tests.test7_determinism ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {gateEvidence.tests.test7_determinism ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Test 8 — Parametric Invalidation:</span>
                      <span className={gateEvidence.tests.test8_geometryChange ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {gateEvidence.tests.test8_geometryChange ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Visual Canvas (7 Columns) */}
      <div className="xl:col-span-7 flex flex-col space-y-4">
        {/* Canvas Visual Container */}
        <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-900 flex-1 min-h-[450px] flex flex-col">
          {/* Header Controls */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs">
            <div className="flex items-center space-x-2 text-slate-300">
              <Eye className="w-4 h-4 text-amber-500" />
              <span className="font-bold uppercase tracking-wider">Holographic Grid Mesh Engine View</span>
            </div>

            {/* Display filters */}
            <div className="flex items-center space-x-4 text-slate-400 font-semibold select-none">
              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-200">
                <input
                  type="checkbox" checked={showNodes} onChange={(e) => setShowNodes(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0"
                />
                <span>Nodes</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-200">
                <input
                  type="checkbox" checked={showElements} onChange={(e) => setShowElements(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0"
                />
                <span>Elements</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-200">
                <input
                  type="checkbox" checked={showBoundaries} onChange={(e) => setShowBoundaries(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0"
                />
                <span>Supports</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-200">
                <input
                  type="checkbox" checked={showPoorElements} onChange={(e) => setShowPoorElements(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0"
                />
                <span>Quality Warns</span>
              </label>
            </div>
          </div>

          {/* Actual canvas */}
          <div className="flex-1 relative flex items-center justify-center bg-slate-950">
            <canvas
              ref={canvasRef}
              width={700}
              height={500}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onClick={handleCanvasClick}
              className="w-full h-full block cursor-crosshair"
            />
          </div>

          {/* Action buttons (Export Mesh) */}
          <div className="border-t border-slate-800 bg-slate-950 p-2 flex justify-between items-center text-xs px-4">
            <span className="text-slate-500 font-mono">SECP CAD Kernel Boundary conformer active</span>
            <div className="flex space-x-2">
              <button
                onClick={handleExportMesh}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-1 px-3 rounded flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Mesh JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
