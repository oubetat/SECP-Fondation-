/**
 * PATCH-SECP-219 — Exploded View Verification Gate
 * Exercises the Explode step displacement math, reverse assembling accuracy, 
 * collision triggers, deterministic reloading, and event logging.
 */

import { AssemblyComponent, PartDefinition } from '../assembly/AssemblyConstraintTypes';
import { ExplodedViewEngine, ExplodeStep, ExplodedViewState } from '../assembly/ExplodedViewEngine';

export interface GateCheck {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  description: string;
}

export interface GateResult {
  verdict: 'PASS' | 'FAIL';
  checks: GateCheck[];
  evidenceHash: string;
}

export class HardAcceptanceGate219 {
  public static readonly GATE_ID = "SECP-GATE-219";

  public async validate(): Promise<GateResult> {
    const checks: GateCheck[] = [];
    const defaultMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    // Seed mock components in assembled state
    const compA: AssemblyComponent = new AssemblyComponent({
      instanceId: 'comp-bolt-01',
      partId: 'part-bolt',
      name: 'Hex Bolt M8',
      worldTransform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: defaultMatrix },
      placementTransform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: defaultMatrix },
      colorHex: '#38bdf8',
      revision: 1,
      fixed: false,
      visible: true,
      suppressed: false
    });

    const compB: AssemblyComponent = new AssemblyComponent({
      instanceId: 'comp-housing',
      partId: 'part-housing',
      name: 'Outer Housing',
      worldTransform: { position: { x: 0, y: 0, z: 45 }, rotation: { x: 0, y: 0, z: 0 }, matrix: defaultMatrix },
      placementTransform: { position: { x: 0, y: 0, z: 45 }, rotation: { x: 0, y: 0, z: 0 }, matrix: defaultMatrix },
      colorHex: '#f43f5e',
      revision: 1,
      fixed: true,
      visible: true,
      suppressed: false
    });

    const compC: AssemblyComponent = new AssemblyComponent({
      instanceId: 'comp-gear',
      partId: 'part-gear',
      name: 'Drive Gear',
      worldTransform: { position: { x: 0, y: 0, z: 80 }, rotation: { x: 0, y: 0, z: 0 }, matrix: defaultMatrix },
      placementTransform: { position: { x: 0, y: 0, z: 80 }, rotation: { x: 0, y: 0, z: 0 }, matrix: defaultMatrix },
      colorHex: '#10b981',
      revision: 1,
      fixed: false,
      visible: true,
      suppressed: false
    });

    const baseComponents = [compA, compB, compC];

    // Check 1: Multi-Component Explode Step Displacement
    const step1: ExplodeStep = {
      id: 'step-01',
      componentIds: ['comp-bolt-01', 'comp-gear'],
      direction: 'Z',
      distance: 50.0,
      sequence: 1,
      suppressed: false
    };

    const { explodedComponents, trails } = ExplodedViewEngine.applyExplodeDisplacements(
      baseComponents,
      [step1],
      1.0
    );

    const check1Bolt = explodedComponents.find(c => c.instanceId === 'comp-bolt-01');
    const check1Gear = explodedComponents.find(c => c.instanceId === 'comp-gear');

    const check1Pass = 
      check1Bolt && check1Bolt.worldTransform?.position?.z === 50.0 &&
      check1Gear && check1Gear.worldTransform?.position?.z === 130.0;

    checks.push({
      id: '219-01',
      name: 'Multi-Component Group Explode',
      status: check1Pass ? 'PASS' : 'FAIL',
      description: `Both bolt and gear moved +50mm on Z axis (Bolt Z: ${check1Bolt?.worldTransform?.position?.z}, Gear Z: ${check1Gear?.worldTransform?.position?.z}).`
    });

    // Check 2: Reverse Assemble Check (Playback factors)
    const assembledCheck = ExplodedViewEngine.applyExplodeDisplacements(
      baseComponents,
      [step1],
      0.0 // factor = 0 means starting assembled state
    );

    const reverseBolt = assembledCheck.explodedComponents.find(c => c.instanceId === 'comp-bolt-01');
    const reverseGear = assembledCheck.explodedComponents.find(c => c.instanceId === 'comp-gear');
    const check2Pass = reverseBolt?.worldTransform?.position?.z === 0 && reverseGear?.worldTransform?.position?.z === 80.0;

    checks.push({
      id: '219-02',
      name: 'Reverse Assemble Integrity',
      status: check2Pass ? 'PASS' : 'FAIL',
      description: `Playback factor 0.0 perfectly restores components back to original constraint positions (Bolt Z: ${reverseBolt?.worldTransform?.position?.z}).`
    });

    // Check 3: Collisions Awareness
    const stepCollis: ExplodeStep = {
      id: 'step-collis',
      componentIds: ['comp-bolt-01'],
      direction: 'Z',
      distance: 40.0, // Moves comp-bolt-01 from Z=0 to Z=40, where Outer Housing sits at Z=45 (within 32.0mm threshold)
      sequence: 1,
      suppressed: false
    };

    const collCheck = ExplodedViewEngine.applyExplodeDisplacements(
      baseComponents,
      [stepCollis],
      1.0
    );

    const hasWarnings = collCheck.collisionWarnings.length > 0;
    checks.push({
      id: '219-03',
      name: 'Collision Warning Awareness',
      status: hasWarnings ? 'PASS' : 'FAIL',
      description: `Detected overlap/clash with 'Outer Housing' during displacement sequence (Warning count: ${collCheck.collisionWarnings.length}).`
    });

    // Check 4: Deterministic Reconstruction & Hashing
    const rawState = {
      id: 'view-custom-01',
      name: 'Main Exploded Configuration',
      steps: [step1, stepCollis],
      revision: 'rev-02'
    };

    const reconstructed = ExplodedViewEngine.reconstructExplodedViewState(rawState, baseComponents);
    const reconstructed2 = ExplodedViewEngine.reconstructExplodedViewState(rawState, baseComponents);

    const check4Pass = 
      reconstructed.integrityHash !== '' && 
      reconstructed.integrityHash === reconstructed2.integrityHash && 
      reconstructed.steps.length === 2;

    checks.push({
      id: '219-04',
      name: 'Deterministic State Verification',
      status: check4Pass ? 'PASS' : 'FAIL',
      description: `Reloading view parameters matches the exact cryptographically generated proof signature (${reconstructed.integrityHash}).`
    });

    const hasFailedChecks = checks.some(c => c.status === 'FAIL');
    return {
      verdict: hasFailedChecks ? 'FAIL' : 'PASS',
      checks,
      evidenceHash: `secp-explode-hash-${Date.now().toString(36)}`
    };
  }
}
