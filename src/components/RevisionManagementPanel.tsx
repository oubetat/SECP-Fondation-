import React, { useState, useEffect } from 'react';
import { RefreshCw, Layers, ShieldCheck, AlertTriangle, CheckCircle2, Activity, GitBranch, Plus, Lock, Unlock, Search, Clock, ArrowRight, Check, X, Download, Upload, ChevronRight, HelpCircle, FileText, Cpu, Settings, AlertCircle, FileSpreadsheet, Trash2, ListFilter, Layers3 } from 'lucide-react';
import { RevisionEngine, RevisionPolicy } from '../engine/revision/RevisionEngine';
import { 
  Revision, 
  RevisionLifecycleState, 
  RevisionEntityType, 
  EngineeringSnapshot, 
  EngineeringBaseline, 
  DependencySnapshot 
} from '../engine/revision/types';
import { RevisionDiffEngine } from '../engine/revision/RevisionDiffEngine';
import { RevisionImpactAnalyzer, ImpactedItem } from '../engine/revision/RevisionImpactAnalyzer';
import { RevisionIntegrityChecker } from '../engine/revision/RevisionIntegrityChecker';

export const RevisionManagementPanel: React.FC = () => {
  // Core revision engine
  const [engine] = useState(() => new RevisionEngine());
  
  // Component states
  const [objects, setObjects] = useState<{ id: string; name: string; type: RevisionEntityType; desc: string }[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>('');
  
  // Compare state
  const [compareRevA, setCompareRevA] = useState<string>('');
  const [compareRevB, setCompareRevB] = useState<string>('');
  const [diffResult, setDiffResult] = useState<any>(null);
  
  // Baselines state
  const [baselines, setBaselines] = useState<EngineeringBaseline[]>([]);
  const [newBaselineId, setNewBaselineId] = useState('BASE-001');
  const [newBaselineName, setNewBaselineName] = useState('Critical Design Review Baseline');
  const [newBaselineDesc, setNewBaselineDesc] = useState('Frozen set of released CAD, drawing, and structural FEA revisions.');
  const [selectedBaselineA, setSelectedBaselineA] = useState('');
  const [selectedBaselineB, setSelectedBaselineB] = useState('');
  const [baselineDiffResult, setBaselineDiffResult] = useState<any>(null);

  // Active Users for Permissions simulation
  const [currentUser, setCurrentUser] = useState<string>('DESIGNER_ENG_1');
  const [userRole, setUserRole] = useState<'DESIGNER' | 'REVIEWER_ADMIN'>('DESIGNER');

  // Input States
  const [newChangeReason, setNewChangeReason] = useState('DESIGN_CHANGE');
  const [newChangeDescription, setNewChangeDescription] = useState('Enlarge shaft hub diameter to accommodate increased torsional load.');
  const [paramHoleDiameter, setParamHoleDiameter] = useState<number>(10);
  const [paramHubWidth, setParamHubWidth] = useState<number>(45);
  const [paramDensity, setParamDensity] = useState<number>(2700);
  
  // Dependencies editing
  const [showAddDep, setShowAddDep] = useState(false);
  const [depTargetObj, setDepTargetObj] = useState('');
  const [depTargetRev, setDepTargetRev] = useState('LATEST'); // or specific revision
  const [depType, setDepType] = useState('DERIVES_FROM');

  // Comment input
  const [commentText, setCommentText] = useState('');

  // Import / Export
  const [exportPackageString, setExportPackageString] = useState('');
  const [importPackageString, setImportPackageString] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Active sub tab
  const [workbenchTab, setWorkbenchTab] = useState<'INTEGRATED_WORKSPACE' | 'COMPARE_DIFFERENCES' | 'DOWNSTREAM_IMPACT' | 'BASELINES' | 'IMPORT_EXPORT'>('INTEGRATED_WORKSPACE');

  // Policy Settings
  const [activePolicy, setActivePolicy] = useState<string>('DEFAULT_ALPHABETIC');

  // Diagnostic alert states (e.g. manual tampering trigger)
  const [tamperTriggered, setTamperTriggered] = useState(false);

  // Demo data loader
  const handleLoadDemoPackage = () => {
    setObjects([
      { id: 'CAD-ACT-101', name: 'Actuator Joint Casting CAD', type: RevisionEntityType.CAD_MODEL, desc: 'B-Rep geometry with parametric feature tree' },
      { id: 'DRW-ACT-201', name: 'ASME Detail Projection Sheet', type: RevisionEntityType.DRAWING, desc: 'ASME Y14.5 dimensioning & tolerance layout' },
      { id: 'FEM-ACT-301', name: 'Actuator Torsional Stress Study', type: RevisionEntityType.FEM_STUDY, desc: 'FEA mesh constraints & von Mises safety factor' },
      { id: 'CAM-ACT-401', name: '5-Axis CNC Pocket Mill Setup', type: RevisionEntityType.CAM_JOB, desc: 'G-code toolpath roughing and continuous cycle cycles' },
      { id: 'MAT-ALU-001', name: 'Aluminium 6061-T6 Specification', type: RevisionEntityType.MATERIAL, desc: 'Physical properties and composition source credentials' }
    ]);
    setSelectedObjectId('CAD-ACT-101');

    // 1. Create ALU Material revision
    const matA = engine.createRevision({
      revisionId: 'MAT-ALU-001:REV-A',
      entityId: 'MAT-ALU-001',
      entityType: RevisionEntityType.MATERIAL,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      createdBy: 'MATERIALS_ENG',
      releasedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      releasedBy: 'BYPASS_ADMIN',
      effectivity: [],
      configurationScope: [],
      dependencies: [],
      approvals: [{
        approvalId: 'APP-MAT-1',
        revisionId: 'MAT-ALU-001:REV-A',
        role: 'METALLURGIST',
        actorId: 'BYPASS_ADMIN',
        decision: 'APPROVED',
        timestamp: new Date().toISOString(),
        reason: 'Material properties verified with ASTM mill reports'
      }],
      comments: [],
      changeReason: 'INITIAL_BASELINE',
      changeDescription: 'Standard properties for aerospace-grade 6061-T6 plate.',
      changeSummary: {},
      validationState: 'PROVEN',
      evidenceReferences: ['EVID-MAT-99'],
      content: { densityKgM3: 2700, youngsModulusGpa: 68.9, yieldStrengthMpa: 276 },
      snapshot: {
        materials: { densityKgM3: 2700, youngsModulusGpa: 68.9, poissonsRatio: 0.33, yieldStrengthMpa: 276, thermalConductivity: 167 }
      }
    });

    // 2. Create CAD Revision A (Released)
    const cadA = engine.createRevision({
      revisionId: 'CAD-ACT-101:REV-A',
      entityId: 'CAD-ACT-101',
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      createdBy: 'DESIGNER_ENG_1',
      releasedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      releasedBy: 'REVIEWER_ADMIN_1',
      effectivity: [],
      configurationScope: [],
      dependencies: [
        { entityId: 'MAT-ALU-001', revisionId: 'MAT-ALU-001:REV-A', type: 'REFERENCES_MATERIAL' }
      ],
      approvals: [{
        approvalId: 'APP-CAD-1',
        revisionId: 'CAD-ACT-101:REV-A',
        role: 'CHIEF_ENGINEER',
        actorId: 'REVIEWER_ADMIN_1',
        decision: 'APPROVED',
        timestamp: new Date().toISOString(),
        reason: 'Hole configurations and thicknesses meet torsional limits.'
      }],
      comments: [{ commentId: 'COM-1', author: 'REVIEWER_ADMIN_1', text: 'Checked assembly clearance, looking great.', timestamp: new Date().toISOString() }],
      changeReason: 'INITIAL_DESIGN',
      changeDescription: 'Primary structural joint casting shell layout.',
      changeSummary: { volumeMm3: 145000 },
      validationState: 'PROVEN',
      evidenceReferences: ['EVID-CAD-044-SUCCESS'],
      content: { holeDiameter: 10, length: 150 },
      snapshot: {
        geometryState: {
          parameters: { holeDiameter: 10, length: 150 },
          features: ['ExtrudeBase', 'FilletCorners', 'BoreHole'],
          topologyHash: 'TOPO-9a8f3c',
          geometryHash: 'GEOM-3b5f2c'
        }
      }
    });

    // 3. Create CAD Revision B (Draft checkout of A)
    const cadB = engine.createRevision({
      revisionId: 'CAD-ACT-101:REV-B',
      entityId: 'CAD-ACT-101',
      entityType: RevisionEntityType.CAD_MODEL,
      revisionCode: 'B',
      parentRevisionId: 'CAD-ACT-101:REV-A',
      revisionNumber: 2,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      createdBy: 'DESIGNER_ENG_1',
      effectivity: [],
      configurationScope: [],
      dependencies: [
        { entityId: 'MAT-ALU-001', revisionId: 'MAT-ALU-001:REV-A', type: 'REFERENCES_MATERIAL' }
      ],
      approvals: [],
      comments: [],
      changeReason: 'PERFORMANCE_IMPROVEMENT',
      changeDescription: 'HOLE DIAMETER 10 mm ➔ 12 mm. Enlarge standard shaft coupling aperture for safety factor requirements.',
      changeSummary: {},
      validationState: 'UNPROVEN',
      evidenceReferences: [],
      content: { holeDiameter: 12, length: 150 },
      snapshot: {
        geometryState: {
          parameters: { holeDiameter: 12, length: 150 },
          features: ['ExtrudeBase', 'FilletCorners', 'BoreHole'],
          topologyHash: 'TOPO-9a8f3c', // geometric equivalence representation
          geometryHash: 'GEOM-3b5f2c_MODIFIED'
        }
      }
    });

    // 4. Create Drawing Revision A (Released, pinned to CAD Rev A)
    const drwA = engine.createRevision({
      revisionId: 'DRW-ACT-201:REV-A',
      entityId: 'DRW-ACT-201',
      entityType: RevisionEntityType.DRAWING,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      createdBy: 'DRAFTSMAN_1',
      releasedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      releasedBy: 'REVIEWER_ADMIN_1',
      effectivity: [],
      configurationScope: [],
      dependencies: [
        { entityId: 'CAD-ACT-101', revisionId: 'CAD-ACT-101:REV-A', type: 'DRAWS' }
      ],
      approvals: [{
        approvalId: 'APP-DRW-1',
        revisionId: 'DRW-ACT-201:REV-A',
        role: 'QA_CHECKER',
        actorId: 'REVIEWER_ADMIN_1',
        decision: 'APPROVED',
        timestamp: new Date().toISOString(),
        reason: 'Projection margins and ASME title block fully verified.'
      }],
      comments: [],
      changeReason: 'INITIAL_DRAWING',
      changeDescription: 'Multiview projection drawing with fully applied ASME Y14.5 feature tolerance control frames.',
      changeSummary: {},
      validationState: 'PROVEN',
      evidenceReferences: ['EVID-DRW-001'],
      content: { sheetSize: 'A3', views: 4 },
      snapshot: {
        drawingReferences: [{ viewId: 'VIEW-FRONT', sheetSize: 'A3', scale: '1:1', gdtApplied: true }]
      }
    });

    // 5. Create FEM Revision A (Released, pinned to CAD Rev A)
    const femA = engine.createRevision({
      revisionId: 'FEM-ACT-301:REV-A',
      entityId: 'FEM-ACT-301',
      entityType: RevisionEntityType.FEM_STUDY,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      createdBy: 'ANALYST_B',
      releasedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      releasedBy: 'REVIEWER_ADMIN_1',
      effectivity: [],
      configurationScope: [],
      dependencies: [
        { entityId: 'CAD-ACT-101', revisionId: 'CAD-ACT-101:REV-A', type: 'SIMULATES' }
      ],
      approvals: [{
        approvalId: 'APP-FEM-1',
        revisionId: 'FEM-ACT-301:REV-A',
        role: 'LEAD_ANALYST',
        actorId: 'REVIEWER_ADMIN_1',
        decision: 'APPROVED',
        timestamp: new Date().toISOString(),
        reason: 'Static structural mesh counts and 120Nm payload convergence bounds verified.'
      }],
      comments: [],
      changeReason: 'INITIAL_ANALYSIS',
      changeDescription: 'FEA stress analysis assessing torsional limits and structural safety factors.',
      changeSummary: { safetyFactor: 1.8 },
      validationState: 'PROVEN',
      evidenceReferences: ['EVID-FEM-221'],
      content: { elements: 84000, safetyFactor: 1.8 },
      snapshot: {
        simulationReferences: [{ meshSizeMm: 2.5, boundaryConditions: ['FixedSupport_Base', 'Torque_Coupling'], solver: 'Direct_Sparse', materials: ['AL-6061-T6'] }]
      }
    });

    // 6. Create CAM Revision A (Released, pinned to CAD Rev A)
    const camA = engine.createRevision({
      revisionId: 'CAM-ACT-401:REV-A',
      entityId: 'CAM-ACT-401',
      entityType: RevisionEntityType.CAM_JOB,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      createdBy: 'MFG_ENG',
      releasedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      releasedBy: 'REVIEWER_ADMIN_1',
      effectivity: [],
      configurationScope: [],
      dependencies: [
        { entityId: 'CAD-ACT-101', revisionId: 'CAD-ACT-101:REV-A', type: 'MANUFACTURES' }
      ],
      approvals: [{
        approvalId: 'APP-CAM-1',
        revisionId: 'CAM-ACT-401:REV-A',
        role: 'SHOP_SUPERVISOR',
        actorId: 'REVIEWER_ADMIN_1',
        decision: 'APPROVED',
        timestamp: new Date().toISOString(),
        reason: 'Feeds and speeds optimal. G-code coordinates free of collision warnings.'
      }],
      comments: [],
      changeReason: 'INITIAL_TOOLPATH',
      changeDescription: 'Five-axis pocket clearing toolpaths.',
      changeSummary: {},
      validationState: 'PROVEN',
      evidenceReferences: ['EVID-CAM-401'],
      content: { cycles: 3, timeSeconds: 512 },
      snapshot: {
        camReferences: [{ toolpathId: 'PATH-ROUGH-01', cycleTimeSec: 512, toolCount: 4 }]
      }
    });

    // 7. Create Demo baseline
    engine.createBaseline({
      baselineId: 'BASE-CDR-01',
      name: 'CDR Approved Configuration',
      description: 'Standard product design state as approved at the Critical Design Review.',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      createdBy: 'REVIEWER_ADMIN_1',
      isReleased: true,
      revisions: {
        'MAT-ALU-001': 'MAT-ALU-001:REV-A',
        'CAD-ACT-101': 'CAD-ACT-101:REV-A',
        'DRW-ACT-201': 'DRW-ACT-201:REV-A',
        'FEM-ACT-301': 'FEM-ACT-301:REV-A',
        'CAM-ACT-401': 'CAM-ACT-401:REV-A'
      },
      baselineHash: ''
    });

    // Select the CAD model revision by default
    setSelectedRevisionId('CAD-ACT-101:REV-B');
    setCompareRevA('CAD-ACT-101:REV-A');
    setCompareRevB('CAD-ACT-101:REV-B');
    syncBaselines();
    handleCompare();
  };

  useEffect(() => {
    syncBaselines();
  }, []);

  const syncBaselines = () => {
    setBaselines(engine.getBaselines());
  };

  // Helper selectors
  const activeHistory = engine.getRevisionHistory(selectedObjectId);
  const activeRevision = engine.getRevision(selectedRevisionId);
  const selectedObject = objects.find(o => o.id === selectedObjectId);

  // Sync parameters inside inputs when active revision changes
  useEffect(() => {
    if (activeRevision) {
      if (activeRevision.entityType === RevisionEntityType.CAD_MODEL) {
        setParamHoleDiameter(activeRevision.content?.holeDiameter || 10);
        setParamHubWidth(activeRevision.content?.length || 150);
      } else if (activeRevision.entityType === RevisionEntityType.MATERIAL) {
        setParamDensity(activeRevision.content?.densityKgM3 || 2700);
      }
    }
  }, [selectedRevisionId]);

  // Operations
  const handleUpdateParams = () => {
    if (!activeRevision) return;
    try {
      let updatedContent = { ...activeRevision.content };
      let updatedSnapshot = { ...activeRevision.snapshot };

      if (activeRevision.entityType === RevisionEntityType.CAD_MODEL) {
        updatedContent.holeDiameter = Number(paramHoleDiameter);
        updatedContent.length = Number(paramHubWidth);
        updatedSnapshot.geometryState = {
          parameters: { holeDiameter: Number(paramHoleDiameter), length: Number(paramHubWidth) },
          features: activeRevision.snapshot?.geometryState?.features || ['ExtrudeBase', 'FilletCorners', 'BoreHole'],
          topologyHash: activeRevision.snapshot?.geometryState?.topologyHash || 'TOPO-9a8f3c',
          geometryHash: `GEOM-${Date.now().toString(16)}`
        };
      } else if (activeRevision.entityType === RevisionEntityType.MATERIAL) {
        updatedContent.densityKgM3 = Number(paramDensity);
        updatedSnapshot.materials = {
          densityKgM3: Number(paramDensity),
          youngsModulusGpa: activeRevision.snapshot?.materials?.youngsModulusGpa || 68.9,
          poissonsRatio: activeRevision.snapshot?.materials?.poissonsRatio || 0.33,
          yieldStrengthMpa: activeRevision.snapshot?.materials?.yieldStrengthMpa || 276,
          thermalConductivity: activeRevision.snapshot?.materials?.thermalConductivity || 167
        };
      }

      engine.updateContent(
        activeRevision.revisionId,
        updatedContent,
        currentUser,
        updatedSnapshot,
        { lastChangeUser: currentUser }
      );
      
      // Clear sandbox tamper state if parameters are updated through normal interface
      setTamperTriggered(false);
      
      // Refresh
      setSelectedRevisionId(activeRevision.revisionId);
      handleCompare();
    } catch (e: any) {
      alert(`Update Error: ${e.message}`);
    }
  };

  const handleCreateRevision = () => {
    try {
      const { code, number } = engine.generateNextRevisionCode(selectedObjectId, activePolicy);
      const newId = `${selectedObjectId}:REV-${code}`;
      
      let baseContent = {};
      let baseSnapshot = {};
      
      // Clone from latest if available
      const latest = engine.getLatestRevision(selectedObjectId);
      if (latest) {
        baseContent = JSON.parse(JSON.stringify(latest.content));
        baseSnapshot = JSON.parse(JSON.stringify(latest.snapshot));
      }

      const rev = engine.createRevision({
        revisionId: newId,
        entityId: selectedObjectId,
        entityType: selectedObject!.type,
        revisionCode: code,
        revisionNumber: number,
        parentRevisionId: latest?.revisionId,
        lifecycleState: RevisionLifecycleState.DRAFT,
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        effectivity: [],
        configurationScope: [],
        dependencies: latest ? latest.dependencies.map(d => ({ ...d })) : [],
        approvals: [],
        comments: [],
        changeReason: newChangeReason,
        changeDescription: newChangeDescription,
        changeSummary: {},
        validationState: 'UNPROVEN',
        evidenceReferences: [],
        content: baseContent,
        snapshot: baseSnapshot
      });

      setSelectedRevisionId(rev.revisionId);
    } catch (e: any) {
      alert(`Registration Failed: ${e.message}`);
    }
  };

  const handleCheckout = () => {
    if (!activeRevision) return;
    try {
      const copy = engine.checkoutRevision(
        activeRevision.revisionId,
        currentUser,
        `Working Copy checked out from ${activeRevision.revisionCode}`
      );
      setSelectedRevisionId(copy.revisionId);
    } catch (e: any) {
      alert(`Checkout Error: ${e.message}`);
    }
  };

  const handleAddApproval = (decision: 'APPROVED' | 'REJECTED') => {
    if (!activeRevision) return;
    try {
      engine.addApproval(activeRevision.revisionId, {
        approvalId: `APP-${Date.now()}`,
        revisionId: activeRevision.revisionId,
        role: userRole === 'REVIEWER_ADMIN' ? 'CHIEF_ENGINEER' : 'PEER_REVIEWER',
        actorId: currentUser,
        decision,
        timestamp: new Date().toISOString(),
        reason: decision === 'APPROVED' ? 'Torsional safety margins fully verified on FEM solver iteration.' : 'Geometry dimensions exceed assembly clearances.'
      });
      // Refresh
      setSelectedRevisionId(activeRevision.revisionId);
    } catch (e: any) {
      alert(`Approval Failed: ${e.message}`);
    }
  };

  const handleTransition = (state: RevisionLifecycleState) => {
    if (!activeRevision) return;
    try {
      engine.transitionState(activeRevision.revisionId, state, currentUser, `Workflow request: Transition to ${state}`);
      setSelectedRevisionId(activeRevision.revisionId);
    } catch (e: any) {
      alert(`Transition Blocked: ${e.message}`);
    }
  };

  const handleAddComment = () => {
    if (!activeRevision || !commentText.trim()) return;
    try {
      engine.addComment(activeRevision.revisionId, currentUser, commentText);
      setCommentText('');
      setSelectedRevisionId(activeRevision.revisionId);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCompare = () => {
    if (!compareRevA || !compareRevB) return;
    try {
      const res = engine.compareRevisions(compareRevA, compareRevB);
      setDiffResult(res);
    } catch (e) {
      setDiffResult(null);
    }
  };

  const handleAddDependency = () => {
    if (!activeRevision || !depTargetObj) return;
    try {
      const newDeps = [...activeRevision.dependencies];
      const targetRevId = depTargetRev === 'LATEST' 
        ? `${depTargetObj}:REV-LATEST_FLOATING` 
        : depTargetRev;
        
      newDeps.push({
        entityId: depTargetObj,
        revisionId: targetRevId,
        type: depType,
        isFloating: depTargetRev === 'LATEST'
      });

      engine.updateDependencies(activeRevision.revisionId, newDeps, currentUser);
      setShowAddDep(false);
      setSelectedRevisionId(activeRevision.revisionId);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRemoveDependency = (index: number) => {
    if (!activeRevision) return;
    try {
      const newDeps = [...activeRevision.dependencies];
      newDeps.splice(index, 1);
      engine.updateDependencies(activeRevision.revisionId, newDeps, currentUser);
      setSelectedRevisionId(activeRevision.revisionId);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateBaseline = () => {
    try {
      // Pin current released revisions of each object
      const pinnedRevs: Record<string, string> = {};
      for (const obj of objects) {
        const latestReleased = engine.getLatestReleasedRevision(obj.id);
        if (latestReleased) {
          pinnedRevs[obj.id] = latestReleased.revisionId;
        }
      }

      if (Object.keys(pinnedRevs).length === 0) {
        throw new Error('No released revisions exist to form a baseline configuration package.');
      }

      engine.createBaseline({
        baselineId: newBaselineId,
        name: newBaselineName,
        description: newBaselineDesc,
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        isReleased: true,
        revisions: pinnedRevs,
        baselineHash: ''
      });

      setNewBaselineId(`BASE-${Date.now().toString().substring(8)}`);
      syncBaselines();
    } catch (e: any) {
      alert(`Baseline Creation Blocked: ${e.message}`);
    }
  };

  const handleCompareBaselines = () => {
    if (!selectedBaselineA || !selectedBaselineB) return;
    try {
      const diff = engine.compareBaselines(selectedBaselineA, selectedBaselineB);
      setBaselineDiffResult(diff);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const triggerMaliciousTampering = () => {
    if (!activeRevision) return;
    // Bypassing engine logic and silently mutating the state outside standard workflows
    activeRevision.content.holeDiameter = 999; 
    setTamperTriggered(true);
    setSelectedRevisionId(activeRevision.revisionId); // force re-render
  };

  const handleExport = () => {
    if (!activeRevision) return;
    const pkg = engine.exportRevisionPackage(activeRevision.revisionId);
    setExportPackageString(pkg);
  };

  const handleImport = () => {
    if (!importPackageString.trim()) return;
    try {
      const imported = engine.importRevisionPackage(importPackageString, currentUser);
      setImportStatus({ success: true, msg: `Import succeeded! Registered ${imported.entityId} revision '${imported.revisionCode}'` });
      setSelectedObjectId(imported.entityId);
      setSelectedRevisionId(imported.revisionId);
    } catch (e: any) {
      setImportStatus({ success: false, msg: e.message });
    }
  };

  // Integrity Check result for the selected active revision
  const integrityReport = activeRevision ? engine.getDetailedIntegrityReport(activeRevision.revisionId) : null;

  // Global project health stats calculation
  const getGlobalStats = () => {
    const all = engine.getAllRevisions();
    const released = all.filter(r => r.lifecycleState === RevisionLifecycleState.RELEASED).length;
    const pending = all.filter(r => r.lifecycleState === RevisionLifecycleState.IN_REVIEW || r.lifecycleState === RevisionLifecycleState.UNDER_REVIEW as any).length;
    
    // Check all revisions for health
    let warningCount = 0;
    let brokenCount = 0;
    let corruptedCount = 0;

    for (const r of all) {
      const report = engine.getDetailedIntegrityReport(r.revisionId);
      if (report.health === 'CORRUPTED') corruptedCount++;
      else if (report.health === 'BROKEN') brokenCount++;
      else if (report.health === 'WARNING') warningCount++;
    }

    let projectStatus: 'HEALTHY' | 'WARNING' | 'BLOCKED' = 'HEALTHY';
    if (corruptedCount > 0 || brokenCount > 0) projectStatus = 'BLOCKED';
    else if (warningCount > 0) projectStatus = 'WARNING';

    return {
      total: all.length,
      released,
      pending,
      warningCount,
      brokenCount,
      corruptedCount,
      projectStatus
    };
  };

  const stats = getGlobalStats();

  // Run downstream impact analysis for CAD change
  const cadRevBImpact = engine.getRevision('CAD-ACT-101:REV-B') 
    ? engine.getImpact('CAD-ACT-101:REV-B') 
    : [];

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900/30 to-slate-900 border-b border-slate-800 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider font-semibold rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase">
              PLM Phase 26
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-slate-400 text-xs font-mono">PATCH-287</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-teal-400 animate-spin-slow" />
            Traceable Engineering Revision Workbench
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            "Revisions are not arbitrary files; they represent cryptographic, fully frozen, and completely reproducible engineering states of design parameters, sketches, drawings, and meshes."
          </p>
        </div>

        {/* Global Health Indicator */}
        <div className="flex gap-4">
          <div className="bg-slate-900/60 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-3">
            <div className="relative">
              <span className={`flex h-3 w-3 rounded-full ${
                stats.projectStatus === 'HEALTHY' ? 'bg-emerald-500' :
                stats.projectStatus === 'WARNING' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                stats.projectStatus === 'HEALTHY' ? 'bg-emerald-500' :
                stats.projectStatus === 'WARNING' ? 'bg-amber-500' : 'bg-rose-500'
              }`} style={{ top: 0, left: 0 }} />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">System Status</div>
              <div className={`text-xs font-bold ${
                stats.projectStatus === 'HEALTHY' ? 'text-emerald-400' :
                stats.projectStatus === 'WARNING' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {stats.projectStatus === 'HEALTHY' && 'PROVEN HEALTHY'}
                {stats.projectStatus === 'WARNING' && 'WARNING ENCOUNTERED'}
                {stats.projectStatus === 'BLOCKED' && 'CORRUPTION / BLOCKER'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI dashboard bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 border-b border-slate-800 bg-slate-900/30 text-slate-300">
        <div className="p-4 border-r border-slate-800 flex flex-col justify-center">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Total Revisions</span>
          <span className="text-xl font-bold font-mono text-slate-200 mt-0.5">{stats.total}</span>
        </div>
        <div className="p-4 border-r border-slate-800 flex flex-col justify-center">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Released State</span>
          <span className="text-xl font-bold font-mono text-teal-400 mt-0.5">{stats.released}</span>
        </div>
        <div className="p-4 border-r border-slate-800 flex flex-col justify-center col-span-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Under Review</span>
          <span className="text-xl font-bold font-mono text-sky-400 mt-0.5">{stats.pending}</span>
        </div>
        <div className="p-4 border-r border-slate-800 flex flex-col justify-center col-span-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Warnings</span>
          <span className="text-xl font-bold font-mono text-amber-500 mt-0.5">{stats.warningCount}</span>
        </div>
        <div className="p-4 flex flex-col justify-center">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Tamper/Corrupt</span>
          <span className={`text-xl font-bold font-mono mt-0.5 ${stats.corruptedCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`}>
            {stats.corruptedCount}
          </span>
        </div>
      </div>

      {/* Top Workspaces Toggles */}
      <div className="flex border-b border-slate-800 bg-slate-900/40 p-1">
        <button
          onClick={() => setWorkbenchTab('INTEGRATED_WORKSPACE')}
          className={`flex-1 py-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            workbenchTab === 'INTEGRATED_WORKSPACE' 
              ? 'bg-slate-800 text-teal-400 border border-slate-700 shadow-inner' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Layers className="h-4 w-5" />
          Interactive Lineage Explorer
        </button>
        <button
          onClick={() => setWorkbenchTab('COMPARE_DIFFERENCES')}
          className={`flex-1 py-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            workbenchTab === 'COMPARE_DIFFERENCES' 
              ? 'bg-slate-800 text-teal-400 border border-slate-700 shadow-inner' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <GitBranch className="h-4 w-5" />
          Semantic Difference Engine
        </button>
        <button
          onClick={() => setWorkbenchTab('DOWNSTREAM_IMPACT')}
          className={`flex-1 py-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            workbenchTab === 'DOWNSTREAM_IMPACT' 
              ? 'bg-slate-800 text-teal-400 border border-slate-700 shadow-inner' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Activity className="h-4 w-5" />
          Downstream Impact Analyzer
        </button>
        <button
          onClick={() => setWorkbenchTab('BASELINES')}
          className={`flex-1 py-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            workbenchTab === 'BASELINES' 
              ? 'bg-slate-800 text-teal-400 border border-slate-700 shadow-inner' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Layers3 className="h-4 w-5" />
          Config Baselines
        </button>
        <button
          onClick={() => setWorkbenchTab('IMPORT_EXPORT')}
          className={`flex-1 py-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            workbenchTab === 'IMPORT_EXPORT' 
              ? 'bg-slate-800 text-teal-400 border border-slate-700 shadow-inner' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Download className="h-4 w-5" />
          Cryptographic Portability
        </button>
      </div>

      {/* Main workspace panels */}
      <div className="p-6">
        
        {/* TAB 1: INTEGRATED WORKSPACE */}
        {workbenchTab === 'INTEGRATED_WORKSPACE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Engineering Objects & Lineages (Column span 4) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Object Registry Card */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Engineering Objects</span>
                  <Settings className="h-3.5 w-3.5 text-slate-600" />
                </h3>
                <div className="space-y-2">
                  {objects.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center space-y-3">
                      <p className="text-xs text-slate-500">No objects registered in active project.</p>
                      <button
                        onClick={handleLoadDemoPackage}
                        className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-semibold"
                      >
                        Load Demo Engineering Package
                      </button>
                    </div>
                  ) : (
                    objects.map(obj => {
                      const isSelected = selectedObjectId === obj.id;
                      const latestReleased = engine.getLatestReleasedRevision(obj.id);
                      return (
                        <button
                          key={obj.id}
                          onClick={() => {
                            setSelectedObjectId(obj.id);
                            const hist = engine.getRevisionHistory(obj.id);
                            if (hist.length > 0) {
                              setSelectedRevisionId(hist[hist.length - 1].revisionId);
                            } else {
                              setSelectedRevisionId('');
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            isSelected 
                              ? 'bg-teal-950/20 border-teal-500/40 text-teal-200 shadow-md' 
                              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold">{obj.id}</span>
                            <span className="text-[9px] px-1.5 py-0.25 font-mono rounded bg-slate-800 text-slate-400 uppercase">
                              {obj.type}
                            </span>
                          </div>
                          <div className="text-xs font-medium mt-1 truncate">{obj.name}</div>
                          {latestReleased && (
                            <div className="text-[10px] text-teal-400/80 font-mono mt-1.5 flex items-center gap-1.5">
                              <Check className="h-3 w-3" /> Released: {latestReleased.revisionCode}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Revision History Tree Card */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Revision Lineage Line</span>
                  <GitBranch className="h-3.5 w-3.5 text-slate-500" />
                </h3>
                
                {activeHistory.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">
                    No registered revisions found for this object.
                  </div>
                ) : (
                  <div className="relative pl-4 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
                    {activeHistory.map((rev) => {
                      const isSelected = selectedRevisionId === rev.revisionId;
                      
                      let statusBadgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
                      if (rev.lifecycleState === RevisionLifecycleState.RELEASED) {
                        statusBadgeColor = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
                      } else if (rev.lifecycleState === RevisionLifecycleState.IN_REVIEW || rev.lifecycleState === RevisionLifecycleState.UNDER_REVIEW as any) {
                        statusBadgeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                      } else if (rev.lifecycleState === RevisionLifecycleState.APPROVED) {
                        statusBadgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      } else if (rev.lifecycleState === RevisionLifecycleState.SUPERSEDED) {
                        statusBadgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                      } else if (rev.lifecycleState === RevisionLifecycleState.OBSOLETE) {
                        statusBadgeColor = 'bg-slate-700/10 text-slate-500 border-slate-700/20';
                      }

                      return (
                        <div key={rev.revisionId} className="relative flex items-start gap-3">
                          {/* Circle marker */}
                          <div className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-teal-500 border-teal-400 shadow-lg scale-110' 
                              : 'bg-slate-900 border-slate-700'
                          }`}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-slate-950 stroke-[3px]" />}
                          </div>

                          <button
                            onClick={() => setSelectedRevisionId(rev.revisionId)}
                            className={`flex-1 text-left p-3 rounded-lg border transition-all ml-4 ${
                              isSelected 
                                ? 'bg-slate-900 border-slate-700 shadow-inner' 
                                : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-900/20 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1">
                                REV-{rev.revisionCode}
                                {rev.parentRevisionId && (
                                  <span className="text-[9px] text-slate-600 font-normal">
                                    ← {rev.parentRevisionId.split(':')[1]}
                                  </span>
                                )}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-mono font-medium ${statusBadgeColor}`}>
                                {rev.lifecycleState}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{rev.changeReason || 'Initial registration'}</div>
                            <div className="text-[9px] text-slate-500 mt-1.5 flex items-center justify-between font-mono">
                              <span>By: {rev.createdBy}</span>
                              <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Right: Selected Revision Details Panel (Column span 8) */}
            <div className="lg:col-span-8 space-y-6">
              
              {activeRevision ? (
                <div className="space-y-6">
                  
                  {/* Primary card heading */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-mono font-bold text-teal-400">{activeRevision.entityId}</span>
                          <span className="text-slate-600 font-mono text-xs">/</span>
                          <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-800 text-slate-200 border border-slate-700">
                            REV-{activeRevision.revisionCode}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-100">{selectedObject?.name}</h3>
                      </div>
                      
                      {/* Lifecycle control workflow states */}
                      <div className="flex flex-wrap items-center gap-2">
                        {activeRevision.lifecycleState === RevisionLifecycleState.DRAFT && (
                          <button
                            onClick={() => handleTransition(RevisionLifecycleState.IN_REVIEW)}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <Clock className="h-3.5 w-3.5" /> Submit for Review
                          </button>
                        )}
                        {activeRevision.lifecycleState === RevisionLifecycleState.IN_REVIEW && (
                          <>
                            <button
                              onClick={() => handleAddApproval('APPROVED')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Peer Approve
                            </button>
                            <button
                              onClick={() => handleTransition(RevisionLifecycleState.APPROVED)}
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" /> Promote to Approved
                            </button>
                          </>
                        )}
                        {activeRevision.lifecycleState === RevisionLifecycleState.APPROVED && (
                          <button
                            onClick={() => handleTransition(RevisionLifecycleState.RELEASED)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Release State
                          </button>
                        )}
                        {activeRevision.lifecycleState === RevisionLifecycleState.RELEASED && (
                          <div className="flex gap-2">
                            <button
                              onClick={handleCheckout}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <Plus className="h-3.5 w-3.5" /> Checkout Working Copy
                            </button>
                            <button
                              onClick={() => handleTransition(RevisionLifecycleState.OBSOLETE)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-400 border border-rose-950/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Mark Obsolete
                            </button>
                          </div>
                        )}
                        
                        {/* If locked/immutable banner */}
                        {(activeRevision.lifecycleState === RevisionLifecycleState.RELEASED || 
                          activeRevision.lifecycleState === RevisionLifecycleState.SUPERSEDED || 
                          activeRevision.lifecycleState === RevisionLifecycleState.OBSOLETE) && (
                          <span className="px-2.5 py-1 text-slate-400 bg-slate-950/80 border border-slate-800 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 uppercase">
                            <Lock className="h-3 w-3 text-amber-500" /> Immutable Released State
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900 text-slate-300 mb-6">
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Author / Creator</div>
                        <div className="text-xs font-semibold mt-0.5">{activeRevision.createdBy}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Created At</div>
                        <div className="text-xs font-semibold mt-0.5 font-mono">{new Date(activeRevision.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Change Reason</div>
                        <div className="text-xs font-semibold mt-0.5 text-teal-400 font-mono">{activeRevision.changeReason || 'INITIAL_REGISTRY'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase">Verification Gate</div>
                        <div className="text-xs font-semibold mt-0.5 flex items-center gap-1">
                          <span className={`inline-block h-2 w-2 rounded-full ${
                            activeRevision.validationState === 'PROVEN' ? 'bg-emerald-500' :
                            activeRevision.validationState === 'PARTIAL' ? 'bg-amber-500' : 'bg-slate-600'
                          }`} />
                          <span className="font-mono">{activeRevision.validationState || 'UNPROVEN'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="text-[10px] text-slate-500 font-mono uppercase">Change Description</div>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/10 p-3 border border-slate-900 rounded-lg">
                        {activeRevision.changeDescription || 'No detailed change notes.'}
                      </p>
                    </div>

                    {/* Cryptographic hash inspector */}
                    <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl space-y-2">
                      <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Cryptographic Signature Signatures (Merkle Roots)</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                          <div className="text-[9px] text-slate-500 font-mono">Content Hash</div>
                          <div className="text-[10px] font-mono font-bold text-slate-300 truncate mt-1">
                            {activeRevision.contentHash ? activeRevision.contentHash : 'Uncalculated'}
                          </div>
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                          <div className="text-[9px] text-slate-500 font-mono">Dependency Signature</div>
                          <div className="text-[10px] font-mono font-bold text-slate-300 truncate mt-1">
                            {activeRevision.dependencyHash ? activeRevision.dependencyHash : 'Uncalculated'}
                          </div>
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                          <div className="text-[9px] text-slate-500 font-mono">Unified Revision Hash</div>
                          <div className="text-[10px] font-mono font-bold text-teal-400 truncate mt-1">
                            {activeRevision.revisionHash ? activeRevision.revisionHash : 'Uncalculated'}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Sandbox / Parameter Editing Workbench (DRAFT ONLY) */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
                      <span>Parametric CAD Sandbox & Representation Editor</span>
                      <Settings className="h-4 w-4 text-slate-500" />
                    </h4>

                    {activeRevision.lifecycleState === RevisionLifecycleState.DRAFT ? (
                      <div className="space-y-6">
                        
                        {activeRevision.entityType === RevisionEntityType.CAD_MODEL && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] text-slate-500 font-mono uppercase mb-1.5">Aperture Diameter (HOLE_DIAMETER)</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="8"
                                  max="20"
                                  value={paramHoleDiameter}
                                  onChange={(e) => setParamHoleDiameter(Number(e.target.value))}
                                  className="flex-1 accent-teal-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="font-mono text-xs text-teal-400 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                                  {paramHoleDiameter} mm
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-500 font-mono uppercase mb-1.5">Housing Hub Width (LENGTH)</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="100"
                                  max="200"
                                  value={paramHubWidth}
                                  onChange={(e) => setParamHubWidth(Number(e.target.value))}
                                  className="flex-1 accent-teal-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="font-mono text-xs text-teal-400 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                                  {paramHubWidth} mm
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeRevision.entityType === RevisionEntityType.MATERIAL && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] text-slate-500 font-mono uppercase mb-1.5">Density (kg/m³)</label>
                              <input
                                type="number"
                                value={paramDensity}
                                onChange={(e) => setParamDensity(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs text-slate-200 font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {activeRevision.entityType !== RevisionEntityType.CAD_MODEL && activeRevision.entityType !== RevisionEntityType.MATERIAL && (
                          <div className="text-slate-500 text-xs italic">
                            This revision wraps non-parametric structural setups (drawing sheet sheets, FEA simulation constraints, boundary constraints).
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 gap-4">
                          {/* Malicious external tamper sim button */}
                          <button
                            onClick={triggerMaliciousTampering}
                            className="text-[10px] text-slate-600 hover:text-slate-500 flex items-center gap-1"
                            title="Simulate direct, non-standard file modification outside standard PLM APIs to test cryptographic corruption detection"
                          >
                            <AlertTriangle className="h-3 w-3" /> Force Hex-level File Tamper (Integrity Breaker)
                          </button>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                // Simulate analytical validation pass
                                engine.setValidationState(activeRevision.revisionId, 'PROVEN', `VAL-${Date.now()}`);
                                setSelectedRevisionId(activeRevision.revisionId);
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300"
                            >
                              Run CAD Geometry Validation Gate
                            </button>
                            <button
                              onClick={handleUpdateParams}
                              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold rounded-lg text-xs"
                            >
                              Save Sandbox Coordinates
                            </button>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-xl space-y-3">
                        <p className="text-xs text-slate-400">
                          Released or locked engineering states are completely frozen. Direct coordinate, parameter or geometry modification is blocked in this view.
                        </p>
                        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                          <span>Aperture Diameter: <strong className="text-slate-200">{activeRevision.content?.holeDiameter || 10} mm</strong></span>
                          <span>Hub Width: <strong className="text-slate-200">{activeRevision.content?.length || 150} mm</strong></span>
                        </div>
                        <button
                          onClick={handleCheckout}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded font-semibold text-teal-400 flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Spawn Working Copy to Modify Parameters
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dependency Pinning Management */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-sky-400" />
                        Exact Dependency Pinned Reference Set
                      </h4>
                      {activeRevision.lifecycleState === RevisionLifecycleState.DRAFT && (
                        <button
                          onClick={() => {
                            setShowAddDep(!showAddDep);
                            const other = objects.filter(o => o.id !== selectedObjectId)[0];
                            setDepTargetObj(other ? other.id : '');
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-semibold text-slate-300 flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Pin Dependency
                        </button>
                      )}
                    </div>

                    {showAddDep && (
                      <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl mb-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Target Object</label>
                            <select
                              value={depTargetObj}
                              onChange={(e) => setDepTargetObj(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-xs text-slate-300 font-mono"
                            >
                              {objects.filter(o => o.id !== selectedObjectId).map(o => (
                                <option key={o.id} value={o.id}>{o.id} - {o.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Pin Revision</label>
                            <select
                              value={depTargetRev}
                              onChange={(e) => setDepTargetRev(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-xs text-slate-300 font-mono"
                            >
                              <option value="LATEST">LATEST (FLOATING REFERENCE - NOT RECOMMENDED)</option>
                              {engine.getRevisionHistory(depTargetObj).map(r => (
                                <option key={r.revisionId} value={r.revisionId}>REV-{r.revisionCode} ({r.lifecycleState})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Relationship Type</label>
                            <select
                              value={depType}
                              onChange={(e) => setDepType(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-xs text-slate-300 font-mono"
                            >
                              <option value="DERIVES_FROM">DERIVES_FROM</option>
                              <option value="SIMULATES">SIMULATES</option>
                              <option value="DRAWS">DRAWS</option>
                              <option value="MANUFACTURES">MANUFACTURES</option>
                              <option value="REFERENCES_MATERIAL">REFERENCES_MATERIAL</option>
                              <option value="CONTAINS">CONTAINS</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setShowAddDep(false)} className="px-3 py-1 bg-slate-900 rounded text-slate-400">Cancel</button>
                          <button onClick={handleAddDependency} className="px-3 py-1 bg-sky-600 rounded font-semibold text-white">Save Pinned Ref</button>
                        </div>
                      </div>
                    )}

                    {activeRevision.dependencies.length === 0 ? (
                      <p className="text-slate-500 text-xs italic">No pinned dependencies configured.</p>
                    ) : (
                      <div className="space-y-2">
                        {activeRevision.dependencies.map((dep, idx) => {
                          const targetObj = objects.find(o => o.id === dep.entityId);
                          const isFloating = dep.revisionId === 'LATEST' || dep.isFloating;
                          return (
                            <div key={idx} className="bg-slate-950/40 p-3 border border-slate-900 rounded-lg flex items-center justify-between text-xs">
                              <div>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <strong className="text-slate-300">{dep.entityId}</strong>
                                  <span className="text-slate-600">➔</span>
                                  {isFloating ? (
                                    <span className="px-2 py-0.25 text-[9px] font-bold font-mono rounded bg-amber-500/10 text-amber-500 border border-amber-500/25">
                                      LATEST (FLOATING - WILL BLOCK RELEASE GATE)
                                    </span>
                                  ) : (
                                    <span className="font-bold text-teal-400">
                                      {dep.revisionId.split(':')[1]}
                                    </span>
                                  )}
                                  <span className="text-slate-500 text-[10px] bg-slate-900 px-1.5 py-0.25 rounded font-mono font-medium">
                                    {dep.type || 'REFERENCES'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{targetObj?.name}</div>
                              </div>
                              {activeRevision.lifecycleState === RevisionLifecycleState.DRAFT && (
                                <button
                                  onClick={() => handleRemoveDependency(idx)}
                                  className="p-1.5 text-slate-600 hover:text-rose-400 rounded transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Integrity Checker Diagnostic Output Card */}
                  <div className={`border rounded-xl p-6 ${
                    integrityReport?.health === 'VALID' ? 'bg-slate-900/40 border-slate-800' :
                    integrityReport?.health === 'WARNING' ? 'bg-amber-950/10 border-amber-500/20' :
                    'bg-rose-950/10 border-rose-500/25'
                  }`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
                      <span>Revision Integrity Diagnostic Report</span>
                      <Activity className="h-4 w-4 text-slate-500" />
                    </h4>

                    {integrityReport && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {integrityReport.health === 'VALID' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                            {integrityReport.health === 'WARNING' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                            {(integrityReport.health === 'BROKEN' || integrityReport.health === 'CORRUPTED') && <AlertCircle className="h-5 w-5 text-rose-500" />}
                            <span className="text-xs font-mono">Calculated Health Status: <strong className={`font-bold ${
                              integrityReport.health === 'VALID' ? 'text-emerald-400' :
                              integrityReport.health === 'WARNING' ? 'text-amber-400' : 'text-rose-400'
                            }`}>{integrityReport.health}</strong></span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">CHECKS RUN: 6/6</span>
                        </div>

                        {integrityReport.errors.length === 0 ? (
                          <div className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/15">
                            Deterministic Hash Signatures Match perfectly. Parent lineage links, approvals, and snapshots verified as authentic and completely healthy.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {integrityReport.errors.map((err: any, idx: number) => (
                              <div key={idx} className={`p-3 rounded-lg text-xs border ${
                                err.severity === 'CRITICAL' 
                                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/15' 
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/15'
                              }`}>
                                <div className="font-mono font-bold uppercase flex items-center gap-1">
                                  <span>[{err.severity}]</span>
                                  <span>{err.field}</span>
                                </div>
                                <p className="mt-1 font-mono text-[11px] leading-relaxed">{err.message}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {tamperTriggered && (
                          <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                            <span className="text-xs text-slate-400 font-mono italic">Tamper active! Restore to clear mismatch</span>
                            <button
                              onClick={() => {
                                handleUpdateParams();
                              }}
                              className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/25 rounded hover:bg-emerald-600/30 font-semibold text-xs transition-all"
                            >
                              Run Repair Routine (Recalculate Hash Signatures)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Comments Timeline */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1">
                      <Clock className="h-4 w-4 text-teal-400" />
                      Immutable Engineering Comment Log & Activity Audit
                    </h4>
                    
                    <div className="space-y-4 mb-4">
                      {activeRevision.comments && activeRevision.comments.length > 0 ? (
                        activeRevision.comments.map((com: any) => (
                          <div key={com.commentId} className="bg-slate-950/40 p-3.5 border border-slate-900 rounded-lg text-xs leading-relaxed">
                            <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 mb-1">
                              <span className="font-bold text-slate-300">{com.author}</span>
                              <span>{new Date(com.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-slate-300">{com.text}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-500 text-xs italic">No comments recorded.</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add review feedback notes..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 p-2.5 rounded text-xs text-slate-200 font-mono"
                      />
                      <button
                        onClick={handleAddComment}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-slate-200"
                      >
                        Log Entry
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                  Select an engineering object and a corresponding revision state to edit properties or promote states.
                </div>
              )}

            </div>

          </div>
        )}

        {/* TAB 2: SEMANTIC DIFFERENCE ENGINE */}
        {workbenchTab === 'COMPARE_DIFFERENCES' && (
          <div className="space-y-6">
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
                <span>Select Revisions to Compare</span>
                <GitBranch className="h-4 w-4 text-teal-400" />
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                  <label className="block text-[11px] text-slate-500 font-mono uppercase mb-1.5">Revision A (Reference State)</label>
                  <select
                    value={compareRevA}
                    onChange={(e) => setCompareRevA(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-xs text-slate-300 font-mono"
                  >
                    {engine.getAllRevisions().map(r => (
                      <option key={r.revisionId} value={r.revisionId}>{r.entityId} / REV-{r.revisionCode} ({r.lifecycleState})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 font-mono uppercase mb-1.5">Revision B (Target State)</label>
                  <select
                    value={compareRevB}
                    onChange={(e) => setCompareRevB(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded text-xs text-slate-300 font-mono"
                  >
                    {engine.getAllRevisions().map(r => (
                      <option key={r.revisionId} value={r.revisionId}>{r.entityId} / REV-{r.revisionCode} ({r.lifecycleState})</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCompare}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Run Semantic Diff Engine Comparison
                </button>
              </div>
            </div>

            {diffResult ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-6">
                
                {/* Visual Status match headers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    diffResult.identityMatch ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-950/10 border-rose-500/20 text-rose-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-mono">Identity Match</div>
                      <div className="text-xs font-bold font-mono mt-0.5">{diffResult.identityMatch ? 'SAME OBJECT LINEAGE' : 'MISMATCH (CROSS-OBJECT)'}</div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    diffResult.contentMatch ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-950/10 border-amber-500/20 text-amber-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-mono">Geometric Content Match</div>
                      <div className="text-xs font-bold font-mono mt-0.5">{diffResult.contentMatch ? 'IDENTICAL PROPERTIES' : 'SEMANTIC MODIFICATIONS'}</div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    diffResult.dependencyMatch ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-950/10 border-amber-500/20 text-amber-400'
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-mono">Dependency Pinned Matches</div>
                      <div className="text-xs font-bold font-mono mt-0.5">{diffResult.dependencyMatch ? 'IDENTICAL ANCHORS' : 'DEPENDENCY CHANGES'}</div>
                    </div>
                  </div>
                </div>

                {/* Diff classification tags */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 font-mono">Semantic Classifications Detected:</h4>
                  <div className="flex flex-wrap gap-2">
                    {diffResult.differences.length === 0 ? (
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-semibold font-mono border border-emerald-500/20">
                        GEOMETRIC_EQUIVALENCE (No design changes)
                      </span>
                    ) : (
                      diffResult.differences.map((diffStr: string) => (
                        <span key={diffStr} className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-semibold font-mono border border-amber-500/20">
                          {diffStr}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Detailed descriptions */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Engineering Change Breakdown:</h4>
                  <div className="bg-slate-950/80 p-4 border border-slate-900 rounded-xl space-y-2">
                    {diffResult.semanticDetails.length === 0 ? (
                      <p className="text-slate-500 text-xs italic">Identical engineering states. No differences detected.</p>
                    ) : (
                      diffResult.semanticDetails.map((detail: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 font-mono leading-relaxed">
                          <span className="text-teal-400">•</span>
                          <span>{detail}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                Choose any two revisions in the database and click comparison to see geometric or topological differences.
              </div>
            )}

          </div>
        )}

        {/* TAB 3: DOWNSTREAM IMPACT ANALYZER */}
        {workbenchTab === 'DOWNSTREAM_IMPACT' && (
          <div className="space-y-6">
            
            {/* Context Explanation */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>Transitive Downstream Impact Analyzer</span>
                <Activity className="h-4 w-4 text-rose-400" />
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                "Modifying core B-Rep shapes or material characteristics causes immediate staleness across downstream projection sheets, finite element stress simulations, and CNC G-code parameters."
              </p>

              <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded font-bold">CAD-ACT-101:REV-B</span>
                  <span className="text-slate-500">represents</span>
                  <span className="text-slate-300 font-bold">HOLE DIAMETER 12 mm</span>
                  <span className="text-slate-600">(changed from 10 mm)</span>
                </div>
                <div className="text-slate-500 leading-relaxed">
                  Below is the automated impact trace computed by analyzing dependency trees in the PLM:
                </div>
              </div>
            </div>

            {/* Impact Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-900/40 text-xs font-bold uppercase tracking-wider text-slate-400">
                Downstream Dependency Traces (Transitive impact of CAD REV-B)
              </div>
              <div className="divide-y divide-slate-800 text-xs">
                {cadRevBImpact.length === 0 ? (
                  <p className="p-6 text-slate-500 italic text-center">No downstream dependents found.</p>
                ) : (
                  cadRevBImpact.map((item, idx) => (
                    <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/10">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-mono">
                          <strong className="text-slate-200">{item.entityId}</strong>
                          <span className="text-slate-600">/</span>
                          <span className="text-slate-400">REV-{item.revisionCode}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">{item.entityType}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 max-w-xl">{item.reason}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[9px] text-slate-500 font-mono">SEVERITY</div>
                          <div className={`text-xs font-mono font-bold ${
                            item.severity === 'CRITICAL' ? 'text-rose-400' :
                            item.severity === 'HIGH' ? 'text-amber-400' : 'text-sky-400'
                          }`}>
                            {item.severity}
                          </div>
                        </div>

                        <div className="bg-slate-950 px-3 py-2 rounded border border-slate-900 flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                          </span>
                          <span className="text-rose-400 font-mono font-bold uppercase tracking-wider text-[10px]">
                            {item.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Benchmark manual re-referencing illustration */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                Manual Staleness Resolution (No Silent Autoupdates)
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                The drawing sheet sheet `DRW-ACT-201:REV-A` still safely references `CAD-ACT-101:REV-A` so manufacturing remains validated. In order to adopt the enlarged aperture, the manufacturing engineer must explicitly spawn a new revision and update its pinned references:
              </p>
              <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <span className="text-xs font-mono text-slate-400">
                  Select <strong className="text-slate-200">ASME Detail Projection Sheet</strong>, click checkout, and pin it to CAD <strong className="text-teal-400">REV-B</strong>.
                </span>
                <button
                  onClick={() => {
                    setSelectedObjectId('DRW-ACT-201');
                    setWorkbenchTab('INTEGRATED_WORKSPACE');
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white rounded-lg transition-all"
                >
                  Adopt in Workbench
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: CONFIGURATION BASELINES */}
        {workbenchTab === 'BASELINES' && (
          <div className="space-y-6">
            
            {/* Baseline generator */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
                <span>Freeze Engineering Baseline Package</span>
                <Layers3 className="h-4 w-4 text-teal-400" />
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="col-span-1">
                  <label className="block text-[11px] text-slate-500 font-mono uppercase mb-1">Baseline ID</label>
                  <input
                    type="text"
                    value={newBaselineId}
                    onChange={(e) => setNewBaselineId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs text-slate-200 font-mono"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] text-slate-500 font-mono uppercase mb-1">Baseline Name</label>
                  <input
                    type="text"
                    value={newBaselineName}
                    onChange={(e) => setNewBaselineName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs text-slate-200 font-mono"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[11px] text-slate-500 font-mono uppercase mb-1">Notes / Description</label>
                  <input
                    type="text"
                    value={newBaselineDesc}
                    onChange={(e) => setNewBaselineDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs text-slate-200 font-mono"
                  />
                </div>
                <button
                  onClick={handleCreateBaseline}
                  className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Freeze Baseline
                </button>
              </div>
            </div>

            {/* List of active baselines */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              <div className="lg:col-span-6 bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Active Frozen Baselines</h4>
                <div className="space-y-3">
                  {baselines.map((base) => (
                    <div key={base.baselineId} className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <strong className="text-teal-400 font-mono text-xs">{base.baselineId}</strong>
                        <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 text-[10px] font-mono border border-teal-500/20 uppercase font-bold">
                          FROZEN IMMUTABLE
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{base.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{base.description}</div>
                      </div>
                      
                      <div className="bg-slate-900/40 p-2.5 rounded border border-slate-900/80 space-y-1 text-[11px] font-mono text-slate-400">
                        {Object.entries(base.revisions).map(([entity, revId]) => (
                          <div key={entity} className="flex justify-between">
                            <span>{entity}:</span>
                            <span className="text-slate-300 font-bold">{revId.split(':')[1]}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                        <span>Sign: {base.createdBy}</span>
                        <span>{new Date(base.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Baseline comparison engine */}
              <div className="lg:col-span-6 bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Baseline Comparison Engine</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Baseline A</label>
                    <select
                      value={selectedBaselineA}
                      onChange={(e) => setSelectedBaselineA(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs text-slate-300 font-mono"
                    >
                      <option value="">-- Choose A --</option>
                      {baselines.map(b => (
                        <option key={b.baselineId} value={b.baselineId}>{b.baselineId}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-mono uppercase mb-1">Baseline B</label>
                    <select
                      value={selectedBaselineB}
                      onChange={(e) => setSelectedBaselineB(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs text-slate-300 font-mono"
                    >
                      <option value="">-- Choose B --</option>
                      {baselines.map(b => (
                        <option key={b.baselineId} value={b.baselineId}>{b.baselineId}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleCompareBaselines}
                  disabled={!selectedBaselineA || !selectedBaselineB}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 rounded text-xs font-semibold text-white transition-all"
                >
                  Run Baseline Comparison
                </button>

                {baselineDiffResult ? (
                  <div className="bg-slate-950/80 p-4 border border-slate-900 rounded-xl text-xs font-mono space-y-3">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Baseline Delta Output:</div>
                    
                    {Object.keys(baselineDiffResult.added).length > 0 && (
                      <div>
                        <div className="text-teal-400 font-bold">Added Objects:</div>
                        {Object.entries(baselineDiffResult.added).map(([k, v]: any) => (
                          <div key={k} className="pl-3 mt-1 text-slate-300">• {k} @ {v.split(':')[1]}</div>
                        ))}
                      </div>
                    )}

                    {Object.keys(baselineDiffResult.changed).length > 0 && (
                      <div>
                        <div className="text-amber-400 font-bold">Modified Revisions:</div>
                        {Object.entries(baselineDiffResult.changed).map(([k, v]: any) => (
                          <div key={k} className="pl-3 mt-1 text-slate-300">
                            • {k}: <span className="line-through text-slate-500">{v.from.split(':')[1]}</span> ➔ <span className="text-teal-400 font-bold">{v.to.split(':')[1]}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {Object.keys(baselineDiffResult.removed).length > 0 && (
                      <div>
                        <div className="text-rose-400 font-bold">Removed Objects:</div>
                        {Object.entries(baselineDiffResult.removed).map(([k, v]: any) => (
                          <div key={k} className="pl-3 mt-1 text-slate-300">• {k}</div>
                        ))}
                      </div>
                    )}

                    {Object.keys(baselineDiffResult.added).length === 0 && 
                     Object.keys(baselineDiffResult.changed).length === 0 && 
                     Object.keys(baselineDiffResult.removed).length === 0 && (
                      <p className="text-slate-500 italic">Baselines are structurally identical.</p>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs italic py-10 text-center">
                    Select two frozen baselines above to evaluate product configuration updates.
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 5: IMPORT / EXPORT */}
        {workbenchTab === 'IMPORT_EXPORT' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Export Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <span>Cryptographic Exporter</span>
                  <Download className="h-4 w-4 text-teal-400" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  "Exporting a revision creates a self-contained package including full parametric values, structural dependency pins, metadata and cryptographic Merkle checksums to verify provenance."
                </p>

                <div className="space-y-3 mb-4">
                  <div className="text-xs text-slate-300 font-mono bg-slate-950 p-3 rounded border border-slate-900">
                    Selected: <strong className="text-teal-400">{activeRevision?.revisionId || 'None'}</strong>
                  </div>
                  {activeRevision && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold rounded-lg text-xs"
                      >
                        Generate Encrypted Export Package
                      </button>
                      <button
                        id="btn-export-step-plm"
                        onClick={() => {
                          const doc = {
                            documentId: activeRevision.entityId,
                            revision: activeRevision.revisionNumber,
                            units: { length: 'mm', mass: 'kg', time: 's' }
                          };
                          const stp = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('SECP B-Rep CAD Export'),'2;1');\nFILE_NAME('${activeRevision.entityId}.stp','${new Date().toISOString()}',('SECP'),('Industrial OS'),'SECP AP214 Exporter','SECP CAD','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\nENDSEC;\nDATA;\n#10=MANIFOLD_SOLID_BREP('${activeRevision.entityId}',#20);\nENDSEC;\nEND-ISO-10303-21;`;
                          setExportPackageString(stp);
                        }}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Export STEP AP214
                      </button>
                    </div>
                  )}
                </div>

                {exportPackageString && (
                  <textarea
                    readOnly
                    value={exportPackageString}
                    className="w-full bg-slate-950 border border-slate-900 p-3 rounded-lg text-[10px] font-mono text-slate-400 h-64 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                )}
              </div>
            </div>

            {/* Import Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <span>Authenticating Importer</span>
                  <Upload className="h-4 w-4 text-sky-400" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  "When importing, the PLM system recalulates the content hashes to ensure the geometry hasn't been corrupted. Revisions with invalid hashes or ID conflicts are strictly rejected."
                </p>

                <textarea
                  value={importPackageString}
                  onChange={(e) => setImportPackageString(e.target.value)}
                  placeholder="Paste exported revision JSON package here..."
                  className="w-full bg-slate-950 border border-slate-900 p-3 rounded-lg text-[10px] font-mono text-slate-400 h-48 focus:outline-none focus:ring-1 focus:ring-sky-500 mb-4"
                />

                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs"
                >
                  Validate & Mount Imported Revision
                </button>

                {importStatus && (
                  <div className={`mt-4 p-3 rounded text-xs font-mono border ${
                    importStatus.success 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {importStatus.msg}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
      
      {/* Simulation Persona controls footer */}
      <div className="bg-slate-900/50 border-t border-slate-800 p-4 px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-slate-600" />
          <span>Active Workshop Persona:</span>
          <select
            value={currentUser}
            onChange={(e) => {
              setCurrentUser(e.target.value);
              setUserRole(e.target.value === 'REVIEWER_ADMIN_1' ? 'REVIEWER_ADMIN' : 'DESIGNER');
            }}
            className="bg-slate-950 border border-slate-800 p-1 px-2 rounded text-xs text-slate-300 font-mono focus:outline-none"
          >
            <option value="DESIGNER_ENG_1">DESIGNER_ENG_1 (Designer)</option>
            <option value="REVIEWER_ADMIN_1">REVIEWER_ADMIN_1 (Approver / Release Officer)</option>
            <option value="BYPASS_ADMIN">BYPASS_ADMIN (PLM System Admin)</option>
          </select>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span>Numbering Policy Scheme:</span>
          <select
            value={activePolicy}
            onChange={(e) => setActivePolicy(e.target.value)}
            className="bg-slate-950 border border-slate-800 p-1 rounded text-slate-300 focus:outline-none"
          >
            <option value="DEFAULT_ALPHABETIC">A, B, C... (ALPHABETIC)</option>
            <option value="DEFAULT_NUMERIC">01, 02, 03... (NUMERIC)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
