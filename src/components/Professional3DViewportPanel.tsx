/**
 * Professional 3D Viewport Panel (PATCH-276)
 * Industrial 3D Engineering Viewport Component for CAD, B-Rep, Assembly, FEM, CFD, CAM, and Digital Twin.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, Box, Layers, Scissors, Eye, EyeOff, Cpu, Activity, CheckCircle2, AlertTriangle, Camera, Play, Pause, Gauge, Compass, FileCheck2, ShieldCheck, Maximize2, Maximize, Grid, RefreshCw, StickyNote, Ruler, Plus, Trash2, Settings2 } from 'lucide-react';

import { Professional3DViewportEngine } from '../engine/viewport/Professional3DViewportEngine276';
import { HardAcceptanceGate276, GateReport276 } from '../engine/viewport/HardAcceptanceGate276';
import { HardAcceptanceGate277, SelectionGateReport } from '../engine/viewport/HardAcceptanceGate277';
import { HardAcceptanceGate278, GizmoGateReport } from '../engine/viewport/HardAcceptanceGate278';
import { HardAcceptanceGate279, SectionGateReport279 } from '../engine/viewport/HardAcceptanceGate279';
import { HardAcceptanceGate280, MeasurementGateReport280 } from '../engine/viewport/HardAcceptanceGate280';
import { HardAcceptanceGate281, PMIGateReport281 } from '../engine/viewport/HardAcceptanceGate281';
import { HardAcceptanceGate282, DrawingGateReport282 } from '../engine/viewport/HardAcceptanceGate282';
import { HardAcceptanceGate283, DimensionGateReport283 } from '../engine/dimensioning/HardAcceptanceGate283';
import { GDTSystem284 } from '../engine/gdt/GDTSystem284';
import { HardAcceptanceGate284, GDTGateReport284 } from '../engine/gdt/HardAcceptanceGate284';
import { GDCharacteristic284, GDModifier284, GDTStatus284, DatumFeature284, GDTFeatureControl284 } from '../engine/gdt/GDTTypes284';
import {
  DisplayMode,
  ProjectionMode,
  CameraPreset,
  CaeFieldType,
  PersistentEntityId,
  EvidenceSnapshot,
  SelectionType,
} from '../engine/viewport/ViewportTypes276';
import { EngineeringContourMapper } from '../engine/viewport/EngineeringContourMapper276';
import { EngineeringSelectionSystem } from '../engine/viewport/EngineeringSelectionSystem277';
import { EngineeringHitTester } from '../engine/viewport/EngineeringHitTester277';
import { SelectionMode, SelectionFilter } from '../engine/viewport/SelectionTypes277';
import { EngineeringGizmoSystem } from '../engine/viewport/EngineeringGizmoSystem278';
import { TransformMode, CoordinateSystem, GizmoState278 } from '../engine/viewport/GizmoTypes278';
import { EngineeringSectionSystem } from '../engine/viewport/EngineeringSectionSystem279';
import { SectionState279 } from '../engine/viewport/SectionTypes279';
import { EngineeringMeasureSystem } from '../engine/viewport/EngineeringMeasureSystem280';
import { MeasurementState280, MeasurementType280 } from '../engine/viewport/MeasurementTypes280';
import { EngineeringPMISystem } from '../engine/viewport/EngineeringPMISystem281';
import { PMIState281, PMIAnnotationType } from '../engine/viewport/PMITypes281';
import { EngineeringDrawingSystem } from '../engine/viewport/EngineeringDrawingSystem282';
import { DrawingState282, DrawingView282 } from '../engine/viewport/DrawingTypes282';
import { EngineeringDimensionSystem283 } from '../engine/dimensioning/EngineeringDimensionSystem283';
import { DimensionType283, DimensionSource283, ToleranceType283, EngineeringDimension283 } from '../engine/dimensioning/DimensionTypes283';
import { 
  Info, 
  ChevronRight
} from 'lucide-react';

import { EngineeringDocument } from '../engine/cad-kernel/document/CADDocument';
import { CanonicalRenderData } from '../engine/viewport/CanonicalRenderContract';
import {
  convertRenderDataToThreeBufferGeometry,
  convertCanonicalFaceToHighlightGeometry,
  convertCanonicalEdgeToHighlightGeometry,
  convertCanonicalVertexToHighlightGeometry,
  convertCanonicalPickToHighlightGeometry
} from '../engine/viewport/ThreeGeometryConverter';
import {
  CanonicalPickResult,
  CanonicalSelectionState,
  CanonicalTopologyType,
  createCanonicalSelection,
  createEmptyCanonicalSelection,
  resolveCanonicalTopologyFromTriangle
} from '../engine/viewport/CanonicalPickingContract';
import {
  classifyDerivedState,
  revalidateSelection,
  shouldDisplayHighlight,
  RevisionLifecycleState
} from '../engine/viewport/RevisionLifecycle';
import { CadSolidEntity } from '../engine/cadKernel';
import { AssemblyComponentItem } from '../engine/assembly';
import { ActiveProjectType } from './CadViewport3D';

export interface Professional3DViewportPanelProps {
  canonicalDocument?: EngineeringDocument | null;
  canonicalRenderData?: CanonicalRenderData;
  selectedCanonicalFace?: CanonicalPickResult | null;
  onCanonicalPick?: (pickResult: CanonicalPickResult | null) => void;
  activeProjectType?: ActiveProjectType;
  activePatchTab?: string;
  activeSolid?: CadSolidEntity | null;
  assemblyComponents?: AssemblyComponentItem[];
  explodedFactor?: number;
  activeUnit?: string;
  onSelectComponent?: (compName: string) => void;
  droneCamResult?: any;
}

export const Professional3DViewportPanel: React.FC<Professional3DViewportPanelProps> = ({
  canonicalDocument,
  canonicalRenderData,
  selectedCanonicalFace,
  onCanonicalPick,
  activeProjectType = 'BLANK',
  activePatchTab = 'PATCH-276',
  activeSolid,
  assemblyComponents,
  explodedFactor = 0,
  activeUnit = 'mm',
  onSelectComponent,
  droneCamResult,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Professional3DViewportEngine>(new Professional3DViewportEngine());
  const engine = engineRef.current;

  // PATCH-277 Selection Logic
  const selectionSystemRef = useRef<EngineeringSelectionSystem>(new EngineeringSelectionSystem('REV-276.1'));
  const hitTesterRef = useRef<EngineeringHitTester>(new EngineeringHitTester());
  const [selectedEntities, setSelectedEntities] = useState<PersistentEntityId[]>([]);
  const [preselectedEntity, setPreselectedEntity] = useState<PersistentEntityId | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('SINGLE');
  const [selectionFilter, setSelectionFilter] = useState<SelectionType[]>(['FACE', 'EDGE', 'BODY', 'PART', 'VERTEX']);

  // PATCH-278 Gizmo Logic
  const gizmoSystemRef = useRef<EngineeringGizmoSystem>(new EngineeringGizmoSystem());
  const [gizmoState, setGizmoState] = useState<GizmoState278>(gizmoSystemRef.current.getState());
  const [showGizmoGateModal, setShowGizmoGateModal] = useState(false);
  const [gizmoGateReport, setGizmoGateReport] = useState<GizmoGateReport | null>(null);

  // PATCH-279 Section View Logic
  const sectionSystemRef = useRef<EngineeringSectionSystem>(new EngineeringSectionSystem('REV-276.1'));
  const [sectionState, setSectionState] = useState<SectionState279>(sectionSystemRef.current.getState());
  const [showSectionGateModal, setShowSectionGateModal] = useState(false);
  const [sectionGateReport, setSectionGateReport] = useState<SectionGateReport279 | null>(null);

  // PATCH-280 Measurement Logic
  const measureSystemRef = useRef<EngineeringMeasureSystem>(new EngineeringMeasureSystem('REV-276.1'));
  const [measureState, setMeasureState] = useState<MeasurementState280>(measureSystemRef.current.getState());
  const [showMeasureGateModal, setShowMeasureGateModal] = useState(false);
  const [measureGateReport, setMeasureGateReport] = useState<MeasurementGateReport280 | null>(null);

  // PATCH-281 PMI Logic
  const pmiSystemRef = useRef<EngineeringPMISystem>(new EngineeringPMISystem('REV-276.1'));
  const [pmiState, setPMIState] = useState<PMIState281>(pmiSystemRef.current.getState());
  const [showPMIGateModal, setShowPMIGateModal] = useState(false);
  const [pmiGateReport, setPMIGateReport] = useState<PMIGateReport281 | null>(null);

  // PATCH-282 Engineering Drawing Logic
  const drawingSystemRef = useRef<EngineeringDrawingSystem>(new EngineeringDrawingSystem('MODEL-282', 'REV-276.1'));
  const [drawingState, setDrawingState] = useState<DrawingState282>(drawingSystemRef.current.getState());
  const [showDrawingGateModal, setShowDrawingGateModal] = useState(false);
  const [drawingGateReport, setDrawingGateReport] = useState<DrawingGateReport282 | null>(null);
  const [showDimensionGateModal, setShowDimensionGateModal] = useState(false);
  const [dimensionGateReport, setDimensionGateReport] = useState<DimensionGateReport283 | null>(null);
  
  // PATCH-283 Explicit Declarations
  const dimensionSystemRef = useRef<EngineeringDimensionSystem283>(new EngineeringDimensionSystem283());
  const [dimensions, setDimensions] = useState<EngineeringDimension283[]>([]);
  const [showDimensionSettings, setShowDimensionSettings] = useState<string | null>(null);

  // PATCH-284 GD&T Declarations
  const gdtSystemRef = useRef<GDTSystem284>(new GDTSystem284());
  const [datums, setDatums] = useState<DatumFeature284[]>(gdtSystemRef.current.getDatums());
  const [controls, setControls] = useState<GDTFeatureControl284[]>(gdtSystemRef.current.getControls());
  const [showGDTGateModal, setShowGDTGateModal] = useState(false);
  const [gdtGateReport, setGDTGateReport] = useState<GDTGateReport284 | null>(null);

  const [newFCFCharacteristic, setNewFCFCharacteristic] = useState<GDCharacteristic284>(GDCharacteristic284.POSITION);
  const [newFCFTolerance, setNewFCFTolerance] = useState<number>(0.05);
  const [newFCFModifier, setNewFCFModifier] = useState<GDModifier284>(GDModifier284.NONE);
  const [newFCFDatums, setNewFCFDatums] = useState<string[]>([]);
  const [datumLabelInput, setDatumLabelInput] = useState<string>('D');

  const [activeTab, setActiveTab] = useState<'3D' | 'DRAWING'>('3D');

  // Viewport Control States
  const [activeDisplayMode, setActiveDisplayMode] = useState<DisplayMode>('SHADED_WITH_EDGES');
  const [activeProjection, setActiveProjection] = useState<ProjectionMode>('PERSPECTIVE');
  const [activeBackend, setActiveBackend] = useState<'WebGPU' | 'WebGL'>('WebGPU');
  const [sectionEnabled, setSectionEnabled] = useState(false);
  const [sectionOffset, setSectionOffset] = useState(0);
  const [topologyFilter, setTopologyFilter] = useState<string>('ALL');

  // CAE / CAM Simulation Overlays
  const [activeCaeField, setActiveCaeField] = useState<CaeFieldType>('VON_MISES_STRESS');
  const [deformationFactor, setDeformationFactor] = useState(25);
  const [camOverlayEnabled, setCamOverlayEnabled] = useState(false);
  const [kinematicsActive, setKinematicsActive] = useState(true);

  // Selection & Info States
  const [selectedEntity, setSelectedEntity] = useState<PersistentEntityId | null>({
    entityId: 'FACE-F182',
    entityType: 'FACE',
    parentBodyId: 'BODY-B001',
    parentPartId: 'PART-P001',
  });
  const [revision, setRevision] = useState('REV-276.1');
  const [isStaleRevision, setIsStaleRevision] = useState(false);

  // Gate 276 & Snapshot Modals
  const [gateReport, setGateReport] = useState<GateReport276 | null>(null);
  const [selectionGateReport, setSelectionGateReport] = useState<SelectionGateReport | null>(null);
  const [showGateModal, setShowGateModal] = useState(false);
  const [showSelectionGateModal, setShowSelectionGateModal] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<EvidenceSnapshot | null>(null);

  const handleCreateDimension = (type: DimensionType283) => {
    if (selectedEntities.length === 0) return;
    
    try {
      const refs = selectedEntities.map(e => ({
        entityId: e.entityId,
        entityType: e.entityType as any
      }));
      
      const dim = dimensionSystemRef.current.createDimension(type, refs);
      
      // If we are in drawing mode, associate it with the active view or sheet
      if (activeTab === 'DRAWING' && (drawingState.activeDocument?.sheets?.[0]?.views?.length ?? 0) > 0) {
        dim.associatedViewId = drawingState.activeDocument?.sheets?.[0]?.views?.[0]?.id;
        dim.source = DimensionSource283.DRAWING;
      }
      
      setDimensions(dimensionSystemRef.current.getDimensions());
    } catch (err) {
      console.error('Failed to create dimension:', err);
    }
  };

  const handleDeleteDimension = (id: string) => {
    dimensionSystemRef.current.deleteDimension(id);
    setDimensions(dimensionSystemRef.current.getDimensions());
  };

  const handleRunGate283 = () => {
    const report = HardAcceptanceGate283.runVerification(dimensionSystemRef.current);
    setDimensionGateReport(report);
    setShowDimensionGateModal(true);
  };

  // PATCH-284 GD&T States and Handlers
  const [gdtError, setGdtError] = useState<string | null>(null);

  const handleCreateDatum = () => {
    if (selectedEntities.length === 0) return;
    const target = selectedEntities[0];
    setGdtError(null);
    try {
      gdtSystemRef.current.registerDatum(datumLabelInput, target.entityId, target.entityType as any);
      setDatums(gdtSystemRef.current.getDatums());
      if (datumLabelInput.length === 1) {
        const nextCharCode = datumLabelInput.charCodeAt(0) + 1;
        if (nextCharCode >= 65 && nextCharCode <= 90) {
          setDatumLabelInput(String.fromCharCode(nextCharCode));
        }
      }
    } catch (err: any) {
      setGdtError(`Datum Registration Error: ${err.message || err}`);
    }
  };

  const handleCreateFCF = () => {
    if (selectedEntities.length === 0) return;
    const target = selectedEntities[0];
    setGdtError(null);
    try {
      gdtSystemRef.current.createFeatureControl({
        characteristic: newFCFCharacteristic,
        controlledEntityId: target.entityId,
        controlledEntityType: target.entityType as any,
        toleranceZoneValue: newFCFTolerance,
        modifier: newFCFModifier,
        datumReferenceFrame: [...newFCFDatums],
      });
      setControls(gdtSystemRef.current.getControls());
      setNewFCFDatums([]);
    } catch (err: any) {
      setGdtError(`FCF Validation Failure: ${err.message || err}`);
    }
  };

  const handleDeleteDatum = (label: string) => {
    setGdtError(null);
    gdtSystemRef.current.deleteDatum(label);
    setDatums(gdtSystemRef.current.getDatums());
    setControls(gdtSystemRef.current.getControls());
  };

  const handleDeleteFCF = (id: string) => {
    setGdtError(null);
    gdtSystemRef.current.deleteControl(id);
    setControls(gdtSystemRef.current.getControls());
  };

  const handleRunGate284 = () => {
    const report = HardAcceptanceGate284.runVerification(gdtSystemRef.current);
    setGDTGateReport(report);
    setShowGDTGateModal(true);
  };

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Three.js Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16); // Industrial slate canvas
    sceneRef.current = scene;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight1.position.set(200, 300, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.0);
    dirLight2.position.set(-200, 150, -200);
    scene.add(dirLight2);

    // Grid & Coordinate Triad Helper
    const gridHelper = new THREE.GridHelper(600, 30, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -60;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(60);
    axesHelper.position.set(-200, -55, -200);
    scene.add(axesHelper);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
    camera.position.set(220, 160, 260);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Build 3D Engineering Mesh strictly from Canonical Render Data (SOT)
    const geometryGroup = new THREE.Group();
    geometryGroup.name = 'CanonicalGeometryGroup';

    let canonicalMesh: THREE.Mesh | null = null;

    if (canonicalRenderData && canonicalRenderData.hasGeometry) {
      const bufferGeom = convertRenderDataToThreeBufferGeometry(canonicalRenderData);
      const mainMat = new THREE.MeshStandardMaterial({
        color: activeCaeField !== 'NONE' ? 0x0284c7 : 0x334155,
        metalness: 0.6,
        roughness: 0.3,
        wireframe: activeDisplayMode === 'WIREFRAME',
        side: THREE.DoubleSide
      });
      canonicalMesh = new THREE.Mesh(bufferGeom, mainMat);
      canonicalMesh.userData = { isCanonicalMesh: true, renderData: canonicalRenderData };
      geometryGroup.add(canonicalMesh);

      // Edges
      if (activeDisplayMode === 'SHADED_WITH_EDGES' || activeDisplayMode === 'HIDDEN_LINE') {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(bufferGeom),
          new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 1.5 })
        );
        geometryGroup.add(edges);
      }
    } else {
      // Truthful Empty State: Grid & Datum Origin, NO fake fallback box or engine block
      // geometryGroup remains empty of meshes when no geometry is present in canonicalRenderData
    }

    // Highlighting Selected Canonical Topology
    if (selectedCanonicalFace && canonicalRenderData && shouldDisplayHighlight(selectedCanonicalFace, canonicalRenderData)) {
      const highlightGeom = convertCanonicalPickToHighlightGeometry(selectedCanonicalFace, canonicalRenderData);
      if (highlightGeom) {
        if (selectedCanonicalFace.entityType === 'VERTEX') {
          const hlMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false });
          const hlMesh = new THREE.Mesh(highlightGeom, hlMat);
          hlMesh.renderOrder = 999;
          geometryGroup.add(hlMesh);
        } else if (selectedCanonicalFace.entityType === 'EDGE') {
          const hlMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 3, depthTest: false });
          const hlLines = new THREE.LineSegments(highlightGeom, hlMat);
          hlLines.renderOrder = 999;
          geometryGroup.add(hlLines);
        } else {
          const hlMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.7 });
          const hlMesh = new THREE.Mesh(highlightGeom, hlMat);
          hlMesh.renderOrder = 999;
          geometryGroup.add(hlMesh);
        }
      }
    }

    // CAM Toolpath Waypoints Lines
    if (camOverlayEnabled && droneCamResult && droneCamResult.operations) {
      droneCamResult.operations.forEach((op: any) => {
        if (!op.trajectory || !op.trajectory.points) return;
        
        const points = op.trajectory.points.map((pt: any) => {
          const pos = pt.position || pt;
          return new THREE.Vector3(pos.x, pos.y, pos.z);
        });

        if (points.length === 0) return;

        const pathGeom = new THREE.BufferGeometry().setFromPoints(points);
        const color = op.strategy.includes('RAPID') ? 0xef4444 : 0x10b981;
        const pathMat = new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: 0.8 });
        const toolpathLine = new THREE.Line(pathGeom, pathMat);
        geometryGroup.add(toolpathLine);
      });
      
      // Render Stock Box if available
      if (droneCamResult.camSetup?.stock?.stockBoundingBox) {
        const min = droneCamResult.camSetup.stock.stockBoundingBox.min;
        const max = droneCamResult.camSetup.stock.stockBoundingBox.max;
        const w = max[0] - min[0];
        const h = max[1] - min[1];
        const d = max[2] - min[2];
        const cx = (min[0] + max[0]) / 2;
        const cy = (min[1] + max[1]) / 2;
        const cz = (min[2] + max[2]) / 2;
        
        const stockGeom = new THREE.BoxGeometry(w, h, d);
        const stockMat = new THREE.MeshBasicMaterial({ 
          color: 0xf59e0b, 
          wireframe: true,
          transparent: true,
          opacity: 0.3
        });
        const stockMesh = new THREE.Mesh(stockGeom, stockMat);
        stockMesh.position.set(cx, cy, cz);
        geometryGroup.add(stockMesh);
      }
    }

    scene.add(geometryGroup);

    // Mouse Interaction via Canonical Picking Contract
    const handleMouseMove = (event: MouseEvent) => {
      if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (gizmoSystemRef.current.getState().isDragging) {
        gizmoSystemRef.current.updatePreview([x * 50, 0, y * 50], [0, 0, 0, 1]);
        return;
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);
      const intersects = raycaster.intersectObjects(sceneRef.current.children, true);

      const canonicalHit = intersects.find(i => i.object.userData?.isCanonicalMesh);
      if (canonicalHit && canonicalHit.faceIndex !== undefined && canonicalRenderData) {
        const pickResult = resolveCanonicalTopologyFromTriangle(
          canonicalHit.faceIndex,
          canonicalRenderData,
          topologyFilter,
          { distance: canonicalHit.distance, hitPoint: [canonicalHit.point?.x ?? 0, canonicalHit.point?.y ?? 0, canonicalHit.point?.z ?? 0] }
        );

        if (pickResult) {
          if (onCanonicalPick) {
            onCanonicalPick(pickResult);
          }
          setSelectedEntities([{
            entityId: pickResult.canonicalEntityId,
            entityType: pickResult.entityType as any,
            parentBodyId: 'BODY-1',
            parentPartId: 'PART-1'
          }]);
          return;
        }
      }

      // Fallback hit tester for non-canonical demo objects
      const hit = hitTesterRef.current.test({ x, y }, cameraRef.current, sceneRef.current);
      if (hit) {
        selectionSystemRef.current.select(hit, event.ctrlKey || event.metaKey);
      } else {
        if (onCanonicalPick) onCanonicalPick(null);
        selectionSystemRef.current.clearSelection();
      }
    };

    const handleMouseUp = () => {
      if (gizmoSystemRef.current.getState().isDragging) {
        gizmoSystemRef.current.stopDragging(true);
      }
    };

    mountRef.current.addEventListener('mousemove', handleMouseMove);
    mountRef.current.addEventListener('mousedown', handleClick);
    window.addEventListener('mouseup', handleMouseUp);

    // Animation Loop
    let angle = 0;
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      if (kinematicsActive) {
        angle += 0.01;
        geometryGroup.rotation.y = Math.sin(angle * 0.5) * 0.15;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const nw = mountRef.current.clientWidth;
      const nh = mountRef.current.clientHeight || 540;
      if (nw === 0 || nh === 0) return;

      if (cameraRef.current instanceof THREE.PerspectiveCamera) {
        cameraRef.current.aspect = nw / nh;
        cameraRef.current.updateProjectionMatrix();
      }
      rendererRef.current.setSize(nw, nh);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [activeDisplayMode, activeCaeField, camOverlayEnabled, kinematicsActive, canonicalRenderData, selectedCanonicalFace, topologyFilter]);

  // Handle Preset View Switch
  const applyPresetView = (preset: CameraPreset) => {
    engine.getCamera().setPreset(preset);
    const camState = engine.getCamera().getState();

    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(...camState.position);
      controlsRef.current.target.set(...camState.target);
      controlsRef.current.update();
    }
  };

  // Run Hard Acceptance Gate 276
  const handleRunGate276 = () => {
    const report = HardAcceptanceGate276.runGate();
    setGateReport(report);
    setShowGateModal(true);
  };

  // Run Hard Acceptance Gate 277
  const handleRunGate277 = () => {
    const report = HardAcceptanceGate277.runGate();
    setSelectionGateReport(report);
    setShowSelectionGateModal(true);
  };

  // Run Hard Acceptance Gate 278
  const handleRunGate278 = () => {
    const report = HardAcceptanceGate278.runGate();
    setGizmoGateReport(report);
    setShowGizmoGateModal(true);
  };

  // Run Hard Acceptance Gate 279
  const handleRunGate279 = () => {
    const report = HardAcceptanceGate279.runGate();
    setSectionGateReport(report);
    setShowSectionGateModal(true);
  };

  // Run Hard Acceptance Gate 280
  const handleRunGate280 = () => {
    const report = HardAcceptanceGate280.runGate();
    setMeasureGateReport(report);
    setShowMeasureGateModal(true);
  };

  // Run Hard Acceptance Gate 281
  const handleRunGate281 = () => {
    const report = HardAcceptanceGate281.runGate();
    setPMIGateReport(report);
    setShowPMIGateModal(true);
  };

  // Run Hard Acceptance Gate 282
  const handleRunGate282 = () => {
    const report = HardAcceptanceGate282.runGate();
    setDrawingGateReport(report);
    setShowDrawingGateModal(true);
  };

  // Export Evidence Snapshot
  const handleCaptureSnapshot = () => {
    const snap = engine.createEvidenceSnapshot();
    setLastSnapshot(snap);
  };

  const currentOverlay = EngineeringContourMapper.createSampleSimulationOverlay(
    activeCaeField,
    revision
  );
  const legendBins = EngineeringContourMapper.generateLegendBins(currentOverlay.contourScale);

  return (
    <div className="w-full flex flex-col gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-100 font-sans shadow-2xl">
      {/* Viewport Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold tracking-tight text-white">
              SECP Industrial Viewport <span className="text-xs font-mono font-normal text-sky-400">(PHASE 25)</span>
            </h2>
            <div className="ml-4 flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('3D')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  activeTab === '3D' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                3D VIEWPORT
              </button>
              <button
                onClick={() => setActiveTab('DRAWING')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  activeTab === 'DRAWING' ? 'bg-sky-600 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                ENGINEERING DRAWING
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Backend:</span>
            <button
              onClick={() => {
                const b = activeBackend === 'WebGPU' ? 'WebGL' : 'WebGPU';
                setActiveBackend(b);
                engine.setBackend(b);
              }}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                activeBackend === 'WebGPU' ? 'bg-indigo-600 text-white' : 'bg-sky-600 text-white'
              }`}
            >
              {activeBackend} {activeBackend === 'WebGPU' ? '⚡' : '🔄'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Doc:</span>
            <span className="font-bold text-sky-400">{canonicalDocument?.id || 'DOC-CANONICAL'}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Rev:</span>
            <span className="font-bold text-amber-400">{canonicalDocument?.revision ?? canonicalRenderData?.revision ?? 1}</span>
            {selectedCanonicalFace && canonicalRenderData && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                classifyDerivedState(selectedCanonicalFace, canonicalRenderData).status === RevisionLifecycleState.STALE
                  ? 'bg-amber-950 text-amber-400 border-amber-800'
                  : 'bg-emerald-950 text-emerald-400 border-emerald-800'
              }`}>
                {classifyDerivedState(selectedCanonicalFace, canonicalRenderData).status}
              </span>
            )}
          </div>
        </div>

        {/* Gate 276 & Snapshot Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCaptureSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md"
          >
            <Camera className="w-3.5 h-3.5" /> Capture Evidence Snapshot
          </button>

          <button
            onClick={handleRunGate276}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 276
          </button>

          <button
            onClick={handleRunGate277}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 277
          </button>

          <button
            onClick={handleRunGate278}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 278
          </button>

          <button
            onClick={handleRunGate279}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 279
          </button>

          <button
            onClick={handleRunGate280}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 280
          </button>

          <button
            onClick={handleRunGate281}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 281
          </button>

          <button
            onClick={handleRunGate282}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 282
          </button>

          <button
            onClick={handleRunGate283}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 283
          </button>

          <button
            onClick={handleRunGate284}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-md"
          >
            <ShieldCheck className="w-4 h-4" /> Run Gate 284
          </button>
        </div>
      </div>

      {/* Main 3D Viewport Workspace Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Workspace Area (3 cols) */}
        <div className="lg:col-span-3 relative h-[640px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner flex flex-col">
          {activeTab === '3D' ? (
            <div className="w-full h-full relative">
          {/* Canvas Element */}
          <div ref={mountRef} className="w-full h-full cursor-crosshair" />

          {/* Section View Control Panel (Center Left) */}
          <div className="absolute top-20 left-3 z-20 flex flex-col gap-2">
            <div className="bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-rose-500/30 flex flex-col gap-3 w-64 shadow-2xl animate-in slide-in-from-left-4 duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Scissors className="w-3 h-3" /> Section Analysis
                </span>
                <button 
                  onClick={() => {
                    if (sectionState.activeSections.length === 0) {
                      sectionSystemRef.current.addPlane('Section A-A', [0, 0, 0], [1, 0, 0]);
                    } else {
                      sectionSystemRef.current.removePlane(sectionState.activeSections[0].id);
                    }
                  }}
                  className={`px-2 py-1 rounded text-[9px] font-bold transition ${
                    sectionState.activeSections.length > 0 ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {sectionState.activeSections.length > 0 ? 'DISABLE' : 'ENABLE'}
                </button>
              </div>

              {sectionState.activeSections.map((plane) => (
                <div key={plane.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">{plane.name}</span>
                    <button 
                      onClick={() => sectionSystemRef.current.updatePlane(plane.id, { flip: !plane.flip })}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Offset:</span>
                      <span className="text-white font-bold">{plane.offset} mm</span>
                    </div>
                    <input 
                      type="range"
                      min="-100"
                      max="100"
                      step="0.5"
                      value={plane.offset}
                      onChange={(e) => sectionSystemRef.current.updatePlane(plane.id, { offset: parseFloat(e.target.value) })}
                      className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {(['X', 'Y', 'Z'] as const).map((axis) => {
                      const normal: [number, number, number] = axis === 'X' ? [1, 0, 0] : axis === 'Y' ? [0, 1, 0] : [0, 0, 1];
                      const isActive = JSON.stringify(plane.normal) === JSON.stringify(normal);
                      return (
                        <button
                          key={axis}
                          onClick={() => sectionSystemRef.current.updatePlane(plane.id, { normal })}
                          className={`py-1 rounded text-[9px] font-bold border ${
                            isActive
                              ? 'bg-rose-900/30 text-rose-400 border-rose-500/50'
                              : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {axis}-Plane
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {sectionState.isStale && (
                <div className="bg-amber-950/40 border border-amber-900/50 p-2 rounded text-[9px] text-amber-300 flex items-center justify-between">
                  <span>REVISION STALE</span>
                  <button 
                    onClick={() => sectionSystemRef.current.resolveStale()}
                    className="underline hover:text-amber-200"
                  >
                    REFRESH
                  </button>
                </div>
              )}
            </div>

            {/* PMI / Annotation Manager (Top Right) */}
            <div className="absolute top-20 right-64 z-20 bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-amber-500/30 flex flex-col gap-3 w-64 shadow-2xl animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <StickyNote className="w-3 h-3" /> PMI & Annotations
                </span>
                <button 
                  onClick={() => pmiSystemRef.current.addAnnotation('NOTE', [], { text: 'New Manufacturing Note' })}
                  className="text-amber-500 hover:text-amber-400 text-[10px] font-bold"
                >
                  + ADD
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                {pmiState.annotations.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-[10px] italic">
                    No PMI annotations defined for this model revision.
                  </div>
                ) : (
                  pmiState.annotations.map((a) => (
                    <div key={a.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex flex-col gap-2 group relative">
                      <button 
                        onClick={() => pmiSystemRef.current.deleteAnnotation(a.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition"
                      >
                        ✕
                      </button>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-amber-500/70 uppercase font-bold tracking-tighter">{a.type}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                          a.status === 'VALID' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-200 font-medium">
                        {a.type === 'NOTE' ? a.semanticData.text : `PMI Reference: ${a.id.slice(0, 8)}`}
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-slate-600 font-mono">
                        <span>Rev: {a.revision}</span>
                        <button 
                          onClick={() => pmiSystemRef.current.setVisibility(a.id, !a.visibility)}
                          className={`font-bold ${a.visibility ? 'text-amber-500' : 'text-slate-700'}`}
                        >
                          {a.visibility ? 'VISIBLE' : 'HIDDEN'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                 <span className="text-[9px] text-slate-500 uppercase tracking-tighter">Standards Compliance</span>
                 <span className="text-[9px] text-slate-300 font-bold">ASME Y14.5 / ISO 1101</span>
              </div>
            </div>

            {/* Measurement Inspector (Bottom Right) */}
            <div className="absolute bottom-3 right-3 z-20 bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-emerald-500/30 flex flex-col gap-3 w-72 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Ruler className="w-3 h-3" /> Engineering Measures
                </span>
                <button 
                  onClick={() => measureSystemRef.current.clearAll()}
                  className="text-slate-500 hover:text-white text-[9px] uppercase font-bold"
                >
                  Clear All
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                {selectedEntities.length > 0 && (
                  <button
                    onClick={() => {
                      const type: MeasurementType280 = selectedEntities.length === 1 ? 'COORDINATES' : 'DISTANCE';
                      measureSystemRef.current.measure(type, selectedEntities);
                    }}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition shadow-sm"
                  >
                    MEASURE SELECTED ({selectedEntities.length})
                  </button>
                )}

                {measureState.activeMeasurements.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-[10px] italic">
                    Select entities and click Measure
                  </div>
                ) : (
                  measureState.activeMeasurements.map((m) => (
                    <div key={m.id} className="bg-slate-900 border border-slate-800 p-2 rounded flex flex-col gap-1 group relative">
                      <button 
                        onClick={() => measureSystemRef.current.removeMeasurement(m.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition"
                      >
                        ✕
                      </button>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 uppercase font-bold">{m.type}</span>
                        <span className={`text-[8px] px-1 rounded ${m.status === 'VALID' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                          {m.status}
                        </span>
                      </div>
                      <div className="text-sm font-mono font-bold text-slate-200">
                        {Array.isArray(m.value) 
                          ? `X: ${m.value[0].toFixed(3)} Y: ${m.value[1].toFixed(3)} Z: ${m.value[2].toFixed(3)}`
                          : `${m.value.toFixed(m.precision)} ${m.unit}`}
                      </div>
                      <div className="text-[8px] text-slate-600 truncate">
                        REF: {m.entities.map(e => e.entityId).join(', ')}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[9px] text-slate-500 font-mono">
                <span>Revision: {measureState.modelRevision}</span>
                <span>Unit: {measureState.unitSystem === 'METRIC' ? 'MM' : 'IN'}</span>
              </div>
            </div>

            {/* Gizmo Floating Control Card (Bottom Left) */}
            {gizmoState.activeEntity && (
              <div className="absolute top-20 right-3 z-20 bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-indigo-500/30 flex flex-col gap-3 w-56 shadow-2xl animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Maximize2 className="w-3 h-3" /> Transform Gizmo
                  </span>
                  <button 
                    onClick={() => selectionSystemRef.current.clearSelection()}
                    className="text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {(['TRANSLATE', 'ROTATE', 'TRANSFORM'] as TransformMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => gizmoSystemRef.current.setMode(mode)}
                      className={`px-2 py-1.5 rounded text-[9px] font-bold transition border ${
                        gizmoState.mode === mode 
                          ? 'bg-indigo-600 text-white border-indigo-400' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Coord System:</span>
                    <select 
                      value={gizmoState.coordinateSystem}
                      onChange={(e) => gizmoSystemRef.current.setCoordinateSystem(e.target.value as CoordinateSystem)}
                      className="bg-slate-900 border-none outline-none text-indigo-300 font-bold cursor-pointer"
                    >
                      <option value="GLOBAL">Global</option>
                      <option value="LOCAL">Local</option>
                      <option value="ASSEMBLY">Assembly</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 text-[10px] font-mono bg-slate-900 p-2 rounded border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ΔX:</span>
                      <span className="text-emerald-400 font-bold">{gizmoState.previewTransform.translation[0].toFixed(2)} mm</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ΔZ:</span>
                      <span className="text-sky-400 font-bold">{gizmoState.previewTransform.translation[2].toFixed(2)} mm</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${gizmoState.snap.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    <span className="text-[10px] text-slate-400">Snapping: <strong className="text-slate-200">{gizmoState.snap.enabled ? 'Active' : 'Off'}</strong></span>
                  </div>
                </div>

                {gizmoState.isDragging && (
                  <div className="bg-amber-950/40 border border-amber-900/50 p-2 rounded text-[9px] text-amber-300 font-bold animate-pulse">
                    TRANSACTION IN PROGRESS...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selection Filter Overlay (Top Center) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            <span className="text-slate-500 mr-2 uppercase tracking-widest font-bold">Filter:</span>
            {(['FACE', 'EDGE', 'VERTEX', 'BODY'] as SelectionType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  const newFilter = selectionFilter.includes(type)
                    ? selectionFilter.filter(t => t !== type)
                    : [...selectionFilter, type];
                  setSelectionFilter(newFilter);
                  selectionSystemRef.current.setFilter({
                    allowedTypes: newFilter,
                    allowMeshEntities: true,
                    allowSimulationRegions: true,
                    allowToolpathEntities: true
                  });
                }}
                className={`px-2 py-1 rounded transition ${
                  selectionFilter.includes(type) ? 'bg-sky-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {type.slice(0, 4)}
              </button>
            ))}
          </div>

          {/* Top Floating Viewport Control Toolbar */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-xs">
            {/* Projection Mode */}
            <button
              onClick={() => {
                const p = activeProjection === 'PERSPECTIVE' ? 'ORTHOGRAPHIC' : 'PERSPECTIVE';
                setActiveProjection(p);
                engine.getCamera().setProjectionMode(p);
              }}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 font-mono text-[11px] text-slate-200"
              title="Toggle Camera Projection Mode"
            >
              {activeProjection === 'PERSPECTIVE' ? 'Perspective' : 'Orthographic'}
            </button>

            {/* Display Modes */}
            <select
              value={activeDisplayMode}
              onChange={(e) => {
                const mode = e.target.value as DisplayMode;
                setActiveDisplayMode(mode);
                engine.setDisplayMode(mode);
              }}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border-none outline-none cursor-pointer"
            >
              <option value="SHADED_WITH_EDGES">Shaded With Edges</option>
              <option value="SHADED">Shaded</option>
              <option value="WIREFRAME">Wireframe</option>
              <option value="HIDDEN_LINE">Hidden Line</option>
              <option value="XRAY">X-Ray</option>
              <option value="SURFACE_NORMALS">Surface Normals</option>
            </select>

            {/* Section Plane Toggle */}
            <button
              onClick={() => {
                const s = !sectionEnabled;
                setSectionEnabled(s);
                engine.setSectionPlane(s, sectionOffset);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${
                sectionEnabled ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" /> Section Cut
            </button>

            {/* CAM Toolpath Toggle */}
            <button
              onClick={() => setCamOverlayEnabled(!camOverlayEnabled)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${
                camOverlayEnabled ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> CAM Toolpath
            </button>

            {/* Kinematics Toggle */}
            <button
              onClick={() => setKinematicsActive(!kinematicsActive)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${
                kinematicsActive ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {kinematicsActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} Motion
            </button>
          </div>

          {/* Camera View Presets (Top Right) */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            {(['ISOMETRIC', 'FRONT', 'TOP', 'RIGHT'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => applyPresetView(preset)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-600 hover:text-white transition text-slate-300"
              >
                {preset.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Section Depth Slider Bar */}
          {sectionEnabled && (
            <div className="absolute top-16 left-3 z-10 bg-slate-950/95 backdrop-blur-md p-2.5 rounded-lg border border-amber-500/40 text-xs text-slate-200 flex items-center gap-3">
              <span className="font-semibold text-amber-400">Section Plane Offset:</span>
              <input
                type="range"
                min="-100"
                max="100"
                value={sectionOffset}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSectionOffset(val);
                  engine.setSectionPlane(true, val);
                }}
                className="w-32 accent-amber-500 cursor-pointer"
              />
              <span className="font-mono">{sectionOffset} mm</span>
            </div>
          )}

          {/* Numerical CAE Contour Legend (Bottom Left) */}
          {activeCaeField !== 'NONE' && (
            <div className="absolute bottom-4 left-4 z-10 bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-sky-500/30 text-xs flex flex-col gap-1.5 w-48 shadow-2xl">
              <div className="flex items-center justify-between font-bold text-sky-400 border-b border-slate-800 pb-1">
                <span>{currentOverlay.fieldType.replace('_', ' ')}</span>
                <span className="text-[10px] text-slate-400 font-mono">({currentOverlay.contourScale.unit})</span>
              </div>

              <div className="flex flex-col gap-1">
                {legendBins.map((bin, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[10px] font-mono">
                    <div className="w-3 h-3 rounded-xs border border-slate-700" style={{ backgroundColor: bin.colorHex }} />
                    <span className="text-slate-200">{bin.label}</span>
                  </div>
                ))}
              </div>

              {currentOverlay.deformedGeometry && (
                <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-amber-300 font-mono">
                  Deformation Scale: {deformationFactor}x
                </div>
              )}
            </div>
          )}

          {/* Bottom Right Telemetry Overlay */}
              <div className="absolute bottom-4 right-4 z-10 bg-slate-950/95 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-3">
                <span>FPS: <strong className="text-emerald-400">60</strong></span>
                <span>Triangles: <strong className="text-slate-200">48,200</strong></span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-slate-900 overflow-hidden flex flex-col p-6 animate-in fade-in duration-500">
              {/* Drawing System UI */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Grid className="w-6 h-6 text-sky-400" /> Engineering Drawing System
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">Document: DRAW-282-001 • Revision: {drawingState.activeDocument?.revision || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      drawingSystemRef.current.addStandardViews();
                      setDrawingState(drawingSystemRef.current.getState());
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold"
                  >
                    + ADD STD VIEWS
                  </button>
                  <button 
                    onClick={handleRunGate282}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center gap-1"
                  >
                    <ShieldCheck className="w-3 h-3" /> RUN GATE 282
                  </button>
                </div>
              </div>

              {/* Drawing Sheet Area */}
              <div className="flex-1 bg-white rounded shadow-2xl flex items-center justify-center overflow-auto p-8 relative">
                <div className="bg-white border-2 border-black w-[800px] h-[560px] relative shadow-lg">
                  <div className="absolute inset-4 border border-black pointer-events-none" />
                  <div className="absolute bottom-4 right-4 border-l border-t border-black p-3 w-64 h-24 text-[10px] text-black font-serif flex flex-col justify-between">
                    <div className="border-b border-black font-bold text-[12px]">SECP ENGINEERING CORP</div>
                    <div>TITLE: EXPERIMENTAL ASSEMBLY</div>
                    <div className="flex justify-between">
                      <span>SIZE: A3</span>
                      <span>REV: {drawingState.activeDocument?.revision || '1.0'}</span>
                    </div>
                  </div>

                  {(!drawingState.activeDocument?.sheets?.[0]?.views || (drawingState.activeDocument?.sheets?.[0]?.views?.length ?? 0) === 0) ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300 italic text-sm">
                      No views projected. Click "+ ADD STD VIEWS" to generate from B-Rep.
                    </div>
                  ) : (
                    (drawingState.activeDocument?.sheets?.[0]?.views || []).map(view => (
                      <div 
                        key={view.id}
                        className="absolute border border-dashed border-sky-200 hover:border-sky-500 transition group p-2 cursor-move"
                        style={{ left: view.position[0], top: view.position[1], width: 140, height: 140 }}
                      >
                        <div className="absolute -top-4 left-0 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                          {view.type} • {view.status}
                        </div>
                        <div className="w-full h-full flex items-center justify-center relative">
                          {view.type === 'FRONT' && <Box className="w-20 h-20 text-slate-800" />}
                          {view.type === 'TOP' && <div className="w-20 h-12 border-2 border-slate-800" />}
                          {view.type === 'RIGHT' && <div className="w-12 h-20 border-2 border-slate-800" />}

                          {/* Render associated dimensions for this view */}
                          <div className="absolute inset-0 pointer-events-none">
                            {dimensions
                              .filter(d => d.associatedViewId === view.id)
                              .map(dim => (
                                <div 
                                  key={dim.id} 
                                  className="absolute text-[9px] font-mono text-black flex flex-col items-center"
                                  style={{ 
                                    left: 70 + dim.placement.textOffset[0], 
                                    top: 70 + dim.placement.textOffset[1],
                                    transform: 'translate(-50%, -50%)' 
                                  }}
                                >
                                  <div className="border-b border-black w-16 mb-0.5" />
                                  <div className="flex items-baseline gap-0.5 whitespace-nowrap bg-white px-0.5">
                                    <span>{dim.nominalValue.toFixed(dim.style.precision)}</span>
                                    {dim.tolerance.type !== ToleranceType283.NONE && (
                                      <span className="text-[7px]">±{dim.tolerance.upperDeviation}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Engineering Controls Inspector Sidebar (1 col) */}
        <div className="flex flex-col gap-4">
          {/* Simulation Field Selector Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
              <Gauge className="w-4 h-4" /> CAE / CFD Result Overlay
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-medium">Select Simulation Dataset:</label>
              <select
                value={activeCaeField}
                onChange={(e) => {
                  const val = e.target.value as CaeFieldType;
                  setActiveCaeField(val);
                  engine.setSimulationOverlay(val);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono focus:border-sky-500 outline-none"
              >
                <option value="NONE">None (CAD Geometry)</option>
                <option value="VON_MISES_STRESS">Von Mises Stress (FEM)</option>
                <option value="PRINCIPAL_STRESS">Principal Stress (FEM)</option>
                <option value="STRAIN">Strain Field (FEM)</option>
                <option value="DISPLACEMENT_MAGNITUDE">Displacement Field (FEM)</option>
                <option value="FACTOR_OF_SAFETY">Factor of Safety (FoS)</option>
                <option value="CFD_PRESSURE">Static Pressure (CFD)</option>
                <option value="CFD_VELOCITY_MAGNITUDE">Velocity Field (CFD)</option>
                <option value="CFD_TEMPERATURE">Thermal Contour (CFD)</option>
              </select>
            </div>

            {activeCaeField !== 'NONE' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Deformation Factor:</span>
                  <span className="font-mono font-bold text-amber-400">{deformationFactor}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={deformationFactor}
                  onChange={(e) => setDeformationFactor(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Topology Selection Details Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" /> Selection Stack
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => selectionSystemRef.current.clearSelection()}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 border border-slate-700 transition text-[9px] uppercase font-bold"
                >
                  Clear
                </button>
                <span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-[10px] border border-emerald-800">
                  {selectedEntities.length}
                </span>
              </div>
            </h3>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
              {selectedEntities.length > 0 ? (
                selectedEntities.map((entity, idx) => (
                  <div key={`${entity.entityId}-${idx}`} className="flex flex-col gap-1.5 text-[10px] font-mono bg-slate-900 p-2 rounded border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Type:</span>
                      <span className="font-bold text-emerald-400">{entity.entityType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ID:</span>
                      <span className="text-slate-200">{entity.entityId}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No entities selected.</p>
              )}
            </div>

            {preselectedEntity && (
              <div className="mt-2 pt-2 border-t border-slate-800">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Hovering Entity</div>
                <div className="flex items-center justify-between text-[10px] font-mono bg-slate-900/50 p-1.5 rounded text-sky-400 border border-sky-900/30">
                  <span>{preselectedEntity.entityType}</span>
                  <span>{preselectedEntity.entityId}</span>
                </div>
              </div>
            )}
          </div>

          {/* Dimensioning & Parametrics Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Dimension Stack
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleCreateDimension(DimensionType283.LINEAR)}
                  disabled={selectedEntities.length < 2}
                  className="p-1 hover:bg-slate-800 rounded text-amber-500 disabled:text-slate-700 transition"
                  title="Create Linear Dimension"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </h3>

            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {dimensions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No semantic dimensions defined.</p>
              ) : (
                dimensions.map((dim) => (
                  <div key={dim.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2 group relative">
                    <button 
                      onClick={() => handleDeleteDimension(dim.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-amber-500/70 uppercase font-bold tracking-tighter">{dim.type}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                        dim.status === 'VALID' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                      }`}>
                        {dim.status}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-mono font-bold text-slate-100">{dim.nominalValue.toFixed(dim.style.precision)}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{dim.unit}</span>
                      {dim.tolerance.type !== ToleranceType283.NONE && (
                        <span className="text-[10px] text-amber-400/80 font-mono">±{dim.tolerance.upperDeviation}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[8px] text-slate-600 font-mono border-t border-slate-800/50 pt-1.5">
                      <div className="flex items-center gap-2">
                        <span>Source: <strong className="text-slate-400">{dim.source}</strong></span>
                        <span>Rev: <strong className="text-slate-400">{dim.revision}</strong></span>
                      </div>
                      <button 
                        onClick={() => setShowDimensionSettings(showDimensionSettings === dim.id ? null : dim.id)}
                        className="text-slate-400 hover:text-sky-400"
                      >
                        <Settings2 className="w-3 h-3" />
                      </button>
                    </div>

                    {showDimensionSettings === dim.id && (
                      <div className="mt-1 pt-2 border-t border-slate-800 flex flex-col gap-2 animate-in slide-in-from-top-1 duration-200">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] uppercase text-slate-500 font-bold">Tolerance Mode</label>
                          <select 
                            className="bg-slate-950 border border-slate-800 rounded p-1 text-[9px] text-slate-300 outline-none"
                            value={dim.tolerance.type}
                            onChange={(e) => {
                              dimensionSystemRef.current.setTolerance(dim.id, { 
                                type: e.target.value as ToleranceType283,
                                upperDeviation: 0.02,
                                lowerDeviation: 0.02
                              });
                              setDimensions(dimensionSystemRef.current.getDimensions());
                            }}
                          >
                            <option value="NONE">None</option>
                            <option value="SYMMETRIC">Symmetric (±)</option>
                            <option value="BILATERAL">Bilateral (+/-)</option>
                            <option value="LIMITS">Limits</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-1 border-t border-slate-800 flex items-center justify-between">
               <button 
                 onClick={handleRunGate283}
                 className="text-[9px] text-amber-500 hover:text-amber-400 uppercase tracking-tighter flex items-center gap-1"
               >
                 <ShieldCheck className="w-3 h-3" /> Run Gate 283
               </button>
               <span className="text-[9px] text-slate-300 font-bold">ASME Y14.5-2018</span>
            </div>
          </div>

          {/* Semantic GD&T (ASME Y14.5) Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4" /> Semantic GD&T Engine
              </div>
              <span className="text-[9px] bg-sky-950 text-sky-400 px-1.5 py-0.5 rounded border border-sky-850">
                ASME Y14.5-2018
              </span>
            </h3>

            {/* Error Message Box */}
            {gdtError && (
              <div className="p-2 bg-rose-950/50 border border-rose-900 rounded text-[10px] text-rose-300 flex items-start gap-1.5 animate-in slide-in-from-top-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{gdtError}</span>
              </div>
            )}

            {/* Selection Info Hook */}
            <div className="text-[10px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 flex flex-col gap-1">
              <div>
                Selected Feature: <strong className="text-emerald-400">{selectedEntities.length > 0 ? selectedEntities[0].entityId : 'NONE'}</strong>
              </div>
              {selectedEntities.length > 0 && (
                <div className="text-[9px] text-slate-500 font-mono">
                  Type: {selectedEntities[0].entityType}
                </div>
              )}
            </div>

            {/* Datums Subsection */}
            <div className="flex flex-col gap-2 border-t border-slate-900 pt-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">1. Datum Register</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  maxLength={1}
                  className="w-12 bg-slate-900 border border-slate-800 rounded p-1 text-[11px] font-mono text-center uppercase text-white font-bold outline-none focus:border-sky-500"
                  value={datumLabelInput}
                  onChange={(e) => setDatumLabelInput(e.target.value.toUpperCase())}
                  placeholder="A"
                />
                <button
                  onClick={handleCreateDatum}
                  disabled={selectedEntities.length === 0}
                  className="flex-1 bg-sky-900/30 hover:bg-sky-900/50 disabled:bg-slate-900/30 text-sky-400 disabled:text-slate-600 border border-sky-800/40 hover:border-sky-700/60 disabled:border-slate-800/20 px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition"
                >
                  Register Datum
                </button>
              </div>

              {/* Registered Datums List */}
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                {datums.length === 0 ? (
                  <span className="text-[9px] text-slate-600 italic">No datums defined.</span>
                ) : (
                  datums.map((d) => (
                    <div key={d.label} className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono">
                      <span className="font-bold text-sky-400">[{d.label}]</span>
                      <span className="text-[8px] text-slate-500 truncate max-w-[60px]">{d.controlledEntityId}</span>
                      <span className={`text-[8px] px-1 rounded-sm ${
                        d.status === GDTStatus284.VALID ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                      }`}>
                        {d.status}
                      </span>
                      <button 
                        onClick={() => handleDeleteDatum(d.label)}
                        className="text-slate-500 hover:text-red-400 ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FCF Subsection */}
            <div className="flex flex-col gap-2 border-t border-slate-900 pt-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">2. Feature Control Frame (FCF)</h4>
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] uppercase text-slate-500 font-bold">Characteristic</label>
                    <select
                      className="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-slate-300 outline-none"
                      value={newFCFCharacteristic}
                      onChange={(e) => setNewFCFCharacteristic(e.target.value as GDCharacteristic284)}
                    >
                      <option value="POSITION">Position (⌖)</option>
                      <option value="FLATNESS">Flatness (⏥)</option>
                      <option value="STRAIGHTNESS">Straightness (⏤)</option>
                      <option value="CIRCULARITY">Circularity (◯)</option>
                      <option value="CYLINDRICITY">Cylindricity (⌱)</option>
                      <option value="PERPENDICULARITY">Perpendicularity (⟂)</option>
                      <option value="ANGULARITY">Angularity (∠)</option>
                      <option value="PROFILE_SURFACE">Profile Surface (⌓)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] uppercase text-slate-500 font-bold">Tol Value (mm)</label>
                    <input
                      type="number"
                      step={0.01}
                      min={0.001}
                      className="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-slate-300 outline-none"
                      value={newFCFTolerance}
                      onChange={(e) => setNewFCFTolerance(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] uppercase text-slate-500 font-bold">Material Modifier</label>
                    <select
                      className="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-slate-300 outline-none"
                      value={newFCFModifier}
                      onChange={(e) => setNewFCFModifier(e.target.value as GDModifier284)}
                    >
                      <option value="NONE">None (RFS)</option>
                      <option value="MMC">MMC (Ⓜ)</option>
                      <option value="LMC">LMC (Ⓛ)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] uppercase text-slate-500 font-bold">Datum Refs</label>
                    <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded border border-slate-800 min-h-[22px]">
                      {datums.length === 0 ? (
                        <span className="text-[8px] text-slate-600 italic">No Datums Registered</span>
                      ) : (
                        datums.map(d => {
                          const isSelected = newFCFDatums.includes(d.label);
                          return (
                            <button
                              key={d.label}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setNewFCFDatums(newFCFDatums.filter(label => label !== d.label));
                                } else {
                                  setNewFCFDatums([...newFCFDatums, d.label]);
                                }
                              }}
                              className={`px-1 rounded text-[8px] font-mono font-bold transition ${
                                isSelected ? 'bg-sky-500 text-slate-950 border border-sky-400' : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateFCF}
                  disabled={selectedEntities.length === 0}
                  className="w-full bg-emerald-900/30 hover:bg-emerald-900/50 disabled:bg-slate-900/30 text-emerald-400 disabled:text-slate-600 border border-emerald-800/40 hover:border-emerald-700/60 disabled:border-slate-800/20 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition"
                >
                  Create FCF Callout
                </button>
              </div>

              {/* FCF List */}
              <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                {controls.length === 0 ? (
                  <p className="text-[9px] text-slate-600 italic text-center">No feature control frames defined.</p>
                ) : (
                  controls.map((fc) => {
                    const symbolMap: Record<GDCharacteristic284, string> = {
                      [GDCharacteristic284.POSITION]: '⌖',
                      [GDCharacteristic284.FLATNESS]: '⏥',
                      [GDCharacteristic284.STRAIGHTNESS]: '⏤',
                      [GDCharacteristic284.CIRCULARITY]: '◯',
                      [GDCharacteristic284.CYLINDRICITY]: '⌱',
                      [GDCharacteristic284.PERPENDICULARITY]: '⟂',
                      [GDCharacteristic284.ANGULARITY]: '∠',
                      [GDCharacteristic284.PROFILE_SURFACE]: '⌓',
                    };
                    const modSymbol = fc.modifier === GDModifier284.MMC ? 'Ⓜ' : fc.modifier === GDModifier284.LMC ? 'Ⓛ' : '';
                    
                    // Dynamic MMC Bonus calculation display
                    let totalToleranceDisplay = `${fc.toleranceZoneValue.toFixed(2)}`;
                    let bonusDisplay = null;
                    if (fc.modifier === GDModifier284.MMC) {
                      const bonus = gdtSystemRef.current.calculateMMCBonus(fc.id);
                      if (bonus > 0) {
                        totalToleranceDisplay = `${(fc.toleranceZoneValue + bonus).toFixed(2)}`;
                        bonusDisplay = `Bonus: +${bonus.toFixed(2)} mm`;
                      }
                    }

                    return (
                      <div key={fc.id} className="bg-slate-900 border border-slate-800/80 rounded-lg p-2 flex flex-col gap-1 animate-in slide-in-from-top-1">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                            fc.status === GDTStatus284.VALID ? 'bg-emerald-950 text-emerald-400' :
                            fc.status === GDTStatus284.INVALID ? 'bg-rose-950 text-rose-400' : 'bg-amber-950 text-amber-400'
                          }`}>
                            {fc.status}
                          </span>
                          <button 
                            onClick={() => handleDeleteFCF(fc.id)}
                            className="text-slate-500 hover:text-red-400 text-xs"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Traditional FCF Feature Box Rendering */}
                        <div className="flex items-center self-center my-1 bg-slate-950 border border-slate-700 divide-x divide-slate-700 text-xs font-mono font-bold select-none text-white overflow-hidden rounded">
                          <div className="px-2.5 py-1 text-sky-400 text-sm">{symbolMap[fc.characteristic]}</div>
                          <div className="px-2 py-1 flex items-center gap-1">
                            <span>⌀{fc.toleranceZoneValue.toFixed(2)}</span>
                            {modSymbol && <span className="text-amber-400">{modSymbol}</span>}
                          </div>
                          {fc.datumReferenceFrame.map((ref, idx) => (
                            <div key={`${ref}-${idx}`} className="px-2.5 py-1 text-slate-300">
                              {ref}
                            </div>
                          ))}
                        </div>

                        {/* Engineering details */}
                        <div className="flex flex-col gap-0.5 text-[8px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                          <div className="flex justify-between">
                            <span>Target Feature:</span>
                            <span className="text-slate-400 truncate max-w-[120px]">{fc.controlledEntityId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Zone:</span>
                            <span className="text-amber-400 font-bold">{totalToleranceDisplay} mm</span>
                          </div>
                          {bonusDisplay && (
                            <div className="flex justify-between">
                              <span>MMC Bonus:</span>
                              <span className="text-emerald-400 font-bold">{bonusDisplay}</span>
                            </div>
                          )}
                          {fc.statusReason && (
                            <div className="text-rose-400 text-[8px] mt-0.5 text-right italic font-sans">
                              * {fc.statusReason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Model Rebuild / Revision Trigger & Run Gate */}
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <button
                onClick={() => {
                  setGdtError(null);
                  const revNum = parseInt(revision.split('.')[1] || '0', 10) + 1;
                  const newRev = `REV-284.${revNum}`;
                  gdtSystemRef.current.revalidate(newRev);
                  setRevision(newRev);
                  setDatums(gdtSystemRef.current.getDatums());
                  setControls(gdtSystemRef.current.getControls());
                }}
                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 py-1 rounded text-[9px] uppercase font-bold tracking-wider flex items-center justify-center gap-1.5 transition"
                title="Simulates an upstream CAD model rebuild/revision change. Generates a random probability of topology lost, testing SECP semantic revalidation durability."
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" /> Simulate Model Rebuild
              </button>

              <div className="flex items-center justify-between mt-1">
                <button 
                  onClick={handleRunGate284}
                  className="text-[10px] text-sky-400 hover:text-sky-300 uppercase tracking-tighter flex items-center gap-1 font-bold"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Run Gate 284
                </button>
                <span className="text-[8px] text-slate-500 font-mono font-bold">SECP-GDT-KERNEL</span>
              </div>
            </div>
          </div>

          {/* Last Evidence Snapshot Card */}
          {lastSnapshot && (
            <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 flex flex-col gap-2">
              <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4" /> Latest Evidence Snapshot
              </h3>
              <div className="text-[11px] font-mono text-slate-300 flex flex-col gap-1 bg-slate-900 p-2 rounded">
                <div>ID: {lastSnapshot.snapshotId}</div>
                <div>Rev: {lastSnapshot.modelRevision}</div>
                <div className="text-[9px] text-slate-500 truncate">{lastSnapshot.digitalSignatureSHA256}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gate 276 Modal */}
      {showGateModal && gateReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col gap-4 overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-sky-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">{gateReport.title}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {gateReport.patch} • Status: <strong className="text-sky-400">{gateReport.status}</strong> ({gateReport.scorePercentage}%)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGateModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-sm rounded bg-slate-900"
              >
                ✕
              </button>
            </div>

            {/* Test Results Battery */}
            <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[500px] custom-scrollbar">
              {gateReport.testResults.map((test) => (
                <div
                  key={test.id}
                  className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-500 font-bold">#{test.id}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">{test.name}</span>
                      <span className="text-[11px] text-slate-400">{test.details}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      test.passed ? 'bg-sky-950 text-sky-400 border border-sky-800' : 'bg-red-950 text-red-400'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              ))}
            </div>

            {/* Modal Footer Signature */}
            <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate max-w-md text-[10px] text-slate-500">{gateReport.digitalCertificateSHA256}</span>
              <button
                onClick={() => setShowGateModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selection Gate 277 Modal */}
      {showSelectionGateModal && selectionGateReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col gap-4 overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Hard Acceptance Gate 277 — Selection System</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    PATCH-SECP-277 • Status: <strong className="text-emerald-400">{selectionGateReport.status}</strong> ({selectionGateReport.score}%)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSelectionGateModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-sm rounded bg-slate-900"
              >
                ✕
              </button>
            </div>

            {/* Test Results Battery */}
            <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[500px] custom-scrollbar">
              {selectionGateReport.testResults.map((test) => (
                <div
                  key={test.id}
                  className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-500 font-bold">#{test.id}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">{test.name}</span>
                      <span className="text-[11px] text-slate-400">{test.details}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      test.passed ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              ))}
            </div>

            {/* Modal Footer Signature */}
            <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate max-w-md text-[10px] text-slate-500">{selectionGateReport.digitalSignature}</span>
              <button
                onClick={() => setShowSelectionGateModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Gate 279 Modal */}
      {showSectionGateModal && sectionGateReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col gap-4 overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-rose-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Hard Acceptance Gate 279 — Section View</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    PATCH-SECP-279 • Status: <strong className="text-rose-400">{sectionGateReport.status}</strong> ({sectionGateReport.score}%)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSectionGateModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-sm rounded bg-slate-900"
              >
                ✕
              </button>
            </div>

            {/* Test Results Battery */}
            <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[500px] custom-scrollbar">
              {sectionGateReport.testResults.map((test) => (
                <div
                  key={test.id}
                  className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-500 font-bold">#{test.id}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">{test.name}</span>
                      <span className="text-[11px] text-slate-400">{test.details}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      test.passed ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-red-950 text-red-400'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              ))}
            </div>

            {/* Modal Footer Signature */}
            <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate max-w-md text-[10px] text-slate-500">{sectionGateReport.digitalSignature}</span>
              <button
                onClick={() => setShowSectionGateModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurement Gate 280 Modal */}
      {showMeasureGateModal && measureGateReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col gap-4 overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Hard Acceptance Gate 280 — Measure System</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    PATCH-SECP-280 • Status: <strong className="text-emerald-400">{measureGateReport.status}</strong> ({measureGateReport.score}%)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMeasureGateModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-sm rounded bg-slate-900"
              >
                ✕
              </button>
            </div>

            {/* Test Results Battery */}
            <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[500px] custom-scrollbar">
              {measureGateReport.testResults.map((test) => (
                <div
                  key={test.id}
                  className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-500 font-bold">#{test.id}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">{test.name}</span>
                      <span className="text-[11px] text-slate-400">{test.details}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      test.passed ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              ))}
            </div>

            {/* Modal Footer Signature */}
            <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate max-w-md text-[10px] text-slate-500">{measureGateReport.digitalSignature}</span>
              <button
                onClick={() => setShowMeasureGateModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dimension Gate 283 Modal */}
      {showDimensionGateModal && dimensionGateReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col gap-4 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-amber-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Hard Acceptance Gate 283 — Dimensioning</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    PATCH-SECP-283 • Status: <strong className="text-amber-400">{dimensionGateReport.status}</strong> ({dimensionGateReport.score}%)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDimensionGateModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-sm rounded bg-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[500px] custom-scrollbar">
              {dimensionGateReport.testResults.map((test) => (
                <div key={test.id} className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-500 font-bold">#{test.id}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">{test.name}</span>
                      <span className="text-[11px] text-slate-400">{test.details}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    test.passed ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-red-950 text-red-400'
                  }`}>
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate max-w-md text-[10px] text-slate-500">{dimensionGateReport.digitalSignature}</span>
              <button
                onClick={() => setShowDimensionGateModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {showGDTGateModal && gdtGateReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col gap-4 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-sky-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Hard Acceptance Gate 284 — GD&T Verification Suite</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    PATCH-SECP-284 • Status: <strong className="text-sky-400">{gdtGateReport.status}</strong> ({gdtGateReport.score}%)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGDTGateModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-sm rounded bg-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[500px] custom-scrollbar">
              {gdtGateReport.testResults.map((test) => (
                <div key={test.id} className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-500 font-bold">#{test.id}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">{test.name}</span>
                      <span className="text-[11px] text-slate-400">{test.details}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    test.passed ? 'bg-sky-950 text-sky-400 border border-sky-850' : 'bg-red-950 text-red-400 border border-red-800'
                  }`}>
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate max-w-md text-[10px] text-slate-500">{gdtGateReport.digitalSignature}</span>
              <button
                onClick={() => setShowGDTGateModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};