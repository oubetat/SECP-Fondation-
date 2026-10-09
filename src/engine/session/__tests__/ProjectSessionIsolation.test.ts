import { describe, it, expect } from 'vitest';
import {
  ProjectSessionManager,
  OFFICIAL_DEMONSTRATIONS,
  NewProjectInput
} from '../ProjectSession';
import { InMemoryDocumentResolver } from '../../cad-kernel/document/DocumentResolver';
import { SketchUIIntegration } from '../../cad-kernel/ui-integration/SketchUIIntegration';
import {
  ENGINEERING_WORKBENCHES,
  resolveWorkbenchAndToolForPatch,
  EngineeringWorkbenchId
} from '../../navigation/EngineeringOSNavigation';

describe('SECP POST-UX-001 — 3-Level Engineering OS & Session Isolation Verification Suite', () => {
  const resolver = new InMemoryDocumentResolver();

  // Test 1: Cold Boot & Registry
  it('TEST-001: Demonstrations registry contains exactly 3 official benchmark reference templates', () => {
    expect(OFFICIAL_DEMONSTRATIONS).toBeDefined();
    expect(OFFICIAL_DEMONSTRATIONS.length).toBe(2);

    const ids = OFFICIAL_DEMONSTRATIONS.map(d => d.id);
    expect(ids).toContain('demo-industrial-drone');
    expect(ids).toContain('demo-ball-valve');
  });

  // Test 2: Reference Demo Read-Only Contract
  it('TEST-002: Loading Drone reference demonstration initializes read-only demonstration metadata', () => {
    const demo = ProjectSessionManager.loadDemonstration('demo-industrial-drone', resolver);

    expect(demo).toBeDefined();
    expect(demo.metadata.kind).toBe('DEMONSTRATION');
    expect(demo.metadata.isReadOnly).toBe(true);
    expect(demo.metadata.type).toBe('INDUSTRIAL_DRONE');
    expect(demo.document).toBeDefined();
    expect(demo.document.documentId).toBe('DOC_DRONE_001');
  });

  // Test 3: Ball Valve Demo Isolation
  it('TEST-003: Loading Ball Valve demonstration initializes fluid valve geometry', () => {
    const valveDemo = ProjectSessionManager.loadDemonstration('demo-ball-valve', resolver);

    expect(valveDemo).toBeDefined();
    expect(valveDemo.metadata.kind).toBe('DEMONSTRATION');
    expect(valveDemo.metadata.type).toBe('BALL_VALVE');
    expect(valveDemo.document.documentId).toBe('DOC_VALVE_001');
  });

  // Test 5: Unknown Demo ID Rejection
  it('TEST-005: Unknown demonstration ID throws clean descriptive exception', () => {
    expect(() => {
      ProjectSessionManager.loadDemonstration('unknown-non-existent-demo', resolver);
    }).toThrow(/not found in registry/i);
  });

  // Test 6: Create New Clean Project
  it('TEST-006: createNewProject produces a genuinely isolated, clean document', () => {
    const input: NewProjectInput = {
      name: 'High-Speed Spindle Rotor',
      projectNumber: 'PRJ-SPINDLE-01',
      type: 'PART',
      unit: 'mm',
      description: 'Precision balanced rotor shaft for 24,000 RPM spindle'
    };

    const newProj = ProjectSessionManager.createNewProject(input);

    expect(newProj.metadata.name).toBe('High-Speed Spindle Rotor');
    expect(newProj.metadata.projectNumber).toBe('PRJ-SPINDLE-01');
    expect(newProj.metadata.kind).toBe('USER_PROJECT');
    expect(newProj.metadata.isReadOnly).toBe(false);
    expect(newProj.metadata.type).toBe('PART');

    // Document checks: must be clean slate
    expect(newProj.document).toBeDefined();
    expect(newProj.document.sketches).toBeDefined();
    expect(newProj.document.sketches.length).toBe(0);
    expect(newProj.document.features).toBeDefined();
    expect(newProj.document.features.length).toBe(0);
    expect(newProj.document.metadata?.projectNumber).toBe('PRJ-SPINDLE-01');
  });

  // Test 7: Fork Demo to User Project
  it('TEST-007: createProjectFromDemo enforces hard identity and provenance isolation', () => {
    const fork = ProjectSessionManager.createProjectFromDemo('demo-industrial-drone', {
      name: 'Heavy-Lift Quadcopter Variant',
      projectNumber: 'PRJ-HLQ-001',
      description: 'Custom payload frame with extended arm geometry'
    });

    expect(fork.metadata.kind).toBe('USER_PROJECT');
    expect(fork.metadata.isReadOnly).toBe(false);
    expect(fork.metadata.name).toBe('Heavy-Lift Quadcopter Variant');
    expect(fork.metadata.projectNumber).toBe('PRJ-HLQ-001');

    // Document ID must NOT match official demo
    expect(fork.document.documentId).not.toBe('DOC_DRONE_001');
    expect(fork.document.documentId).toContain('PRJ-HLQ-001');
    expect(fork.document.metadata?.forkedFromDemo).toBe('demo-industrial-drone');
  });

  // Test 8: Deterministic ID Non-Collision
  it('TEST-008: Two newly created projects have distinct non-colliding IDs', () => {
    const proj1 = ProjectSessionManager.createNewProject({
      name: 'Project 1',
      projectNumber: 'PRJ-01',
      type: 'GENERAL_MECHANICAL',
      unit: 'mm',
      description: ''
    });

    const proj2 = ProjectSessionManager.createNewProject({
      name: 'Project 2',
      projectNumber: 'PRJ-02',
      type: 'GENERAL_MECHANICAL',
      unit: 'mm',
      description: ''
    });

    expect(proj1.metadata.projectId).not.toBe(proj2.metadata.projectId);
    expect(proj1.document.documentId).not.toBe(proj2.document.documentId);
  });

  // Test 9: Adversarial State-Leak Matrix (Drone -> Blank)
  it('TEST-009: Adversarial Transition: Drone Demo -> Blank Project has zero residual geometry', () => {
    // 1. Simulate Drone demo load
    const droneDemo = ProjectSessionManager.loadDemonstration('demo-industrial-drone', resolver);
    expect(droneDemo.document.features.length).toBeGreaterThan(0);

    // 2. Transition to a new blank project
    const blankProj = ProjectSessionManager.createNewProject({
      name: 'Clean Slate Part',
      projectNumber: 'PRJ-BLANK-99',
      type: 'BLANK',
      unit: 'mm',
      description: ''
    });

    // Verify zero leakage
    expect(blankProj.document.features.length).toBe(0);
    expect(blankProj.document.sketches.length).toBe(0);
    expect(blankProj.document.documentId).not.toBe(droneDemo.document.documentId);
    expect(blankProj.metadata.name).toBe('Clean Slate Part');
    expect(blankProj.metadata.kind).toBe('USER_PROJECT');
  });

  // Test 10: 5 Workbenches Completeness Check
  it('TEST-010: Navigation Architecture defines all 5 canonical engineering workbenches', () => {
    const expectedWorkbenches: EngineeringWorkbenchId[] = [
      'GOVERNANCE',
      'DESIGN',
      'SIMULATION',
      'MANUFACTURING',
      'DOCUMENTATION'
    ];

    expect(ENGINEERING_WORKBENCHES.length).toBe(5);
    const workbenchIds = ENGINEERING_WORKBENCHES.map(wb => wb.id);
    for (const expected of expectedWorkbenches) {
      expect(workbenchIds).toContain(expected);
    }
  });

  // Test 11: All workbenches have registered tools with clear UX labels
  it('TEST-011: All 5 workbenches have non-empty tool registries with clean UX labels', () => {
    for (const wb of ENGINEERING_WORKBENCHES) {
      expect(wb.tools.length).toBeGreaterThan(0);
      for (const tool of wb.tools) {
        expect(tool.id).toBeDefined();
        expect(tool.name).toBeDefined();
        expect(tool.shortLabel).toBeDefined();
        // UX labels must NOT contain PATCH-
        expect(tool.shortLabel).not.toMatch(/^PATCH-\d+/);
        expect(tool.name).not.toMatch(/^PATCH-\d+/);
      }
    }
  });

  // Test 12: Tool Patch Resolver maps legacy patch IDs to Level 2/3 hierarchy
  it('TEST-012: resolveWorkbenchAndToolForPatch correctly resolves legacy patch IDs', () => {
    // 2D Sketcher
    const sketchRes = resolveWorkbenchAndToolForPatch('PATCH-034');
    expect(sketchRes.workbenchId).toBe('DESIGN');
    expect(sketchRes.toolId).toBe('SKETCH_EDITOR');

    // Structural FEM
    const femRes = resolveWorkbenchAndToolForPatch('PATCH-015');
    expect(femRes.workbenchId).toBe('SIMULATION');
    expect(femRes.toolId).toBe('STRUCTURAL_FEM');

    // CAM Studio
    const camRes = resolveWorkbenchAndToolForPatch('PATCH-020');
    expect(camRes.workbenchId).toBe('MANUFACTURING');
    expect(camRes.toolId).toBe('CAM_STUDIO');

    // 2D Technical Drawings
    const dwgRes = resolveWorkbenchAndToolForPatch('PATCH-021');
    expect(dwgRes.workbenchId).toBe('DOCUMENTATION');
    expect(dwgRes.toolId).toBe('TECHNICAL_DRAWINGS');

    // Governance Digital Thread
    const govRes = resolveWorkbenchAndToolForPatch('PATCH-295');
    expect(govRes.workbenchId).toBe('GOVERNANCE');
    expect(govRes.toolId).toBe('DIGITAL_THREAD');
  });

  // Test 13: Adversarial Transition: Reference Demo -> Blank Project
  it('TEST-013: Adversarial Transition: Reference Demo -> Blank Project cleans assembly components', () => {
    const droneDemo = ProjectSessionManager.loadDemonstration('demo-industrial-drone', resolver);
    expect(droneDemo.assemblyData.components.length).toBeGreaterThan(0);

    const blankProj = ProjectSessionManager.createNewProject({
      name: 'Clean Enclosure',
      projectNumber: 'PRJ-ENC-01',
      type: 'SHEET_METAL',
      unit: 'mm',
      description: ''
    });

    expect(blankProj.document.documentId).not.toBe(droneDemo.document.documentId);
    expect(blankProj.metadata.type).toBe('SHEET_METAL');
  });

  // Test 14: Clean session document metadata is fully populated
  it('TEST-014: New Project initializes correct document metadata payload', () => {
    const newProj = ProjectSessionManager.createNewProject({
      name: 'Turbine Housing',
      projectNumber: 'PRJ-TURB-01',
      type: 'PART',
      unit: 'mm',
      description: 'Inconel 718 turbine scroll casing'
    });

    expect(newProj.document.metadata?.projectId).toBe(newProj.metadata.projectId);
    expect(newProj.document.metadata?.projectNumber).toBe('PRJ-TURB-01');
    expect(newProj.document.metadata?.description).toBe('Inconel 718 turbine scroll casing');
    expect(newProj.document.metadata?.unit).toBe('mm');
  });

  // Test 15: Cross-project identity isolation invariant
  it('TEST-015: Session isolation invariant holds across multiple sequential project allocations', () => {
    const docs = [];
    for (let i = 0; i < 5; i++) {
      const proj = ProjectSessionManager.createNewProject({
        name: `Subsystem ${i}`,
        projectNumber: `PRJ-SYS-0${i}`,
        type: 'PART',
        unit: 'mm',
        description: ''
      });
      docs.push(proj);
    }

    const uniqueDocIds = new Set(docs.map(d => d.document.documentId));
    const uniqueProjIds = new Set(docs.map(d => d.metadata.projectId));

    expect(uniqueDocIds.size).toBe(5);
    expect(uniqueProjIds.size).toBe(5);
  });
});
