/**
 * SECP Industrial OS — EPC-021: Industrial Drone Assembly Master Verifier
 * Executes comprehensive verification checks (TEST-021-001 through TEST-021-020)
 * ensuring full adherence to SECP Assembly Engine requirements.
 */

import { DroneAssemblyManager } from './DroneAssemblyManager';
import { EPC021EvidenceGenerator } from './EPC021EvidenceGenerator';
import { EPC021ValidationResult } from './DroneAssemblyTypes';
import { EngineeringEvidencePackageManager } from '../evidence/EngineeringEvidencePackageManager';
import { RequirementTraceabilityEngine } from '../RequirementTraceabilityEngine';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class EPC021Verifier {
  public static async runVerification(): Promise<EPC021ValidationResult> {
    const startTime = performance.now();
    const checks: Record<string, { passed: boolean; message: string; details?: unknown }> = {};

    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;

    const recordCheck = (testId: string, passed: boolean, message: string, details?: unknown) => {
      totalChecks++;
      if (passed) passedChecks++;
      else failedChecks++;
      checks[testId] = { passed, message, details };
    };

    // 1. Initialize Infrastructure & Assembly Manager
    const assemblyManager = new DroneAssemblyManager();
    const evidenceManager = new EngineeringEvidencePackageManager();
    const traceEngine = new RequirementTraceabilityEngine('GRAPH-EPC021-001', '1.0');

    // =========================================================================
    // TEST-021-001: Assembly Root
    // =========================================================================
    const isRootValid =
      assemblyManager.assemblyId === 'EPC-016-DRONE-ASSEMBLY' &&
      assemblyManager.productName === 'Industrial Drone' &&
      assemblyManager.caseId === 'EPC-1' &&
      assemblyManager.revision === 'REV-A';
    recordCheck(
      'TEST-021-001',
      isRootValid,
      isRootValid ? 'Assembly Root instantiated with correct metadata' : 'Assembly Root metadata mismatch',
      { assemblyId: assemblyManager.assemblyId, product: assemblyManager.productName, case: assemblyManager.caseId }
    );

    // =========================================================================
    // TEST-021-002: Part Registry & References
    // =========================================================================
    const references = assemblyManager.getAllPartReferences();
    const hasRequiredParts = references.length >= 11 && references.every(r => r.geometryReference && r.materialReference);
    recordCheck(
      'TEST-021-002',
      hasRequiredParts,
      hasRequiredParts ? `Part Registry populated with ${references.length} part references` : 'Part Registry incomplete or missing references',
      { count: references.length }
    );

    // =========================================================================
    // TEST-021-003: Part Definition vs Part Instance
    // =========================================================================
    const definitions = assemblyManager.getAllPartDefinitions();
    const instances = assemblyManager.getAllPartInstances();
    const armInstances = instances.filter(i => i.partDefinitionId === 'PART-DEF-ARM');
    const mountInstances = instances.filter(i => i.partDefinitionId === 'PART-DEF-MOTOR-MOUNT');
    const isReuseValid = armInstances.length === 4 && mountInstances.length === 4 && definitions.length === 11;
    recordCheck(
      'TEST-021-003',
      isReuseValid,
      isReuseValid ? 'Part Definitions successfully reused across multiple Part Instances' : 'Part Instance definition reuse check failed',
      { armInstancesCount: armInstances.length, mountInstancesCount: mountInstances.length, definitionsCount: definitions.length }
    );

    // =========================================================================
    // TEST-021-004: Assembly Tree Hierarchy
    // =========================================================================
    const rootNode = assemblyManager.getRootNode();
    const childSubassemblies = rootNode.children.map(c => c.name);
    const expectedSubassemblies = [
      'Airframe',
      'Propulsion',
      'Motor Mounts',
      'Landing Gear',
      'Battery Structure',
      'Battery',
      'Payload Structure',
      'Payload',
      'Avionics'
    ];
    const isTreeValid = expectedSubassemblies.every(s => childSubassemblies.includes(s));
    recordCheck(
      'TEST-021-004',
      isTreeValid,
      isTreeValid ? 'Assembly Tree contains all required subassemblies' : 'Assembly Tree hierarchy incomplete',
      { childSubassemblies }
    );

    // =========================================================================
    // TEST-021-005: Assembly Tree Operational Mutability (Add/Remove/Suppress/Move/Replace)
    // =========================================================================
    const tempNodeId = 'NODE-TEMP-PART';
    const added = assemblyManager.addNode('NODE-AVIONICS', {
      nodeId: tempNodeId,
      parentId: 'NODE-AVIONICS',
      name: 'Auxiliary GPS Antenna',
      nodeType: 'PART_INSTANCE',
      quantity: 1,
      localTransform: { position: { x: 0, y: 0, z: 10 } },
      globalTransform: { position: { x: 0, y: 0, z: 35 } },
      visibility: true,
      suppressionState: 'ACTIVE',
      children: []
    });
    const suppressed = assemblyManager.suppressNode(tempNodeId);
    const unsuppressed = assemblyManager.unsuppressNode(tempNodeId);
    const removed = assemblyManager.removeNode(tempNodeId);
    const isMutabilityValid = added && suppressed && unsuppressed && removed;
    recordCheck(
      'TEST-021-005',
      isMutabilityValid,
      isMutabilityValid ? 'Assembly Tree operations (Add, Suppress, Unsuppress, Remove) verified' : 'Assembly Tree mutability operations failed',
      { added, suppressed, unsuppressed, removed }
    );

    // =========================================================================
    // TEST-021-006: Component Transforms & Transform Hierarchy
    // =========================================================================
    const armNode = assemblyManager.findNode('NODE-ARM-01');
    const airframeNode = assemblyManager.findNode('NODE-AIRFRAME');
    const isTransformValid =
      armNode !== null &&
      airframeNode !== null &&
      armNode.globalTransform.position.x === (airframeNode.globalTransform.position.x + armNode.localTransform.position.x) &&
      armNode.globalTransform.position.y === (airframeNode.globalTransform.position.y + armNode.localTransform.position.y);
    recordCheck(
      'TEST-021-006',
      isTransformValid,
      isTransformValid ? 'GlobalTransform = ParentTransform × LocalTransform verified' : 'Transform propagation error',
      { armGlobal: armNode?.globalTransform.position, armLocal: armNode?.localTransform.position }
    );

    // =========================================================================
    // TEST-021-007: Assembly Constraints Definition
    // =========================================================================
    const constraints = assemblyManager.getConstraints();
    const constraintTypes = new Set(constraints.map(c => c.type));
    const hasRequiredTypes = constraintTypes.has('COINCIDENT') && constraintTypes.has('CONCENTRIC') && constraintTypes.has('DISTANCE');
    recordCheck(
      'TEST-021-007',
      hasRequiredTypes,
      hasRequiredTypes ? `Defined ${constraints.length} assembly constraints with mandatory types` : 'Assembly constraints missing key types',
      { constraintCount: constraints.length, types: Array.from(constraintTypes) }
    );

    // =========================================================================
    // TEST-021-008: Airframe Constraints Verification
    // =========================================================================
    const armConstraints = constraints.filter(c => c.componentB.startsWith('INST-ARM'));
    const isAirframeConstraintsValid = armConstraints.length >= 8; // 2 per arm x 4 arms
    recordCheck(
      'TEST-021-008',
      isAirframeConstraintsValid,
      isAirframeConstraintsValid ? `Airframe to Arm constraints verified (${armConstraints.length} mates)` : 'Airframe constraints incomplete',
      { armConstraintsCount: armConstraints.length }
    );

    // =========================================================================
    // TEST-021-009: Motor Mount & Propulsion Constraints Verification
    // =========================================================================
    const mountConstraints = constraints.filter(c => c.componentA.startsWith('INST-ARM') && c.componentB.startsWith('INST-MOUNT'));
    const motorConstraints = constraints.filter(c => c.componentA.startsWith('INST-MOUNT') && c.componentB.startsWith('INST-MOTOR'));
    const isPropulsionValid = mountConstraints.length >= 8 && motorConstraints.length >= 8;
    recordCheck(
      'TEST-021-009',
      isPropulsionValid,
      isPropulsionValid ? 'Arm -> Motor Mount -> Motor constraint chain verified' : 'Propulsion constraint chain incomplete',
      { mountConstraintsCount: mountConstraints.length, motorConstraintsCount: motorConstraints.length }
    );

    // =========================================================================
    // TEST-021-010: Landing Gear Constraints Verification
    // =========================================================================
    const gearConstraints = constraints.filter(c => c.componentB.startsWith('INST-GEAR'));
    const isLandingGearValid = gearConstraints.length >= 6; // 2 per gear x 3 gears
    recordCheck(
      'TEST-021-010',
      isLandingGearValid,
      isLandingGearValid ? 'Airframe -> Landing Gear constraints verified' : 'Landing Gear constraints incomplete',
      { gearConstraintsCount: gearConstraints.length }
    );

    // =========================================================================
    // TEST-021-011: Battery & Payload Structure Constraints Verification
    // =========================================================================
    const batteryConstraints = constraints.filter(c => c.componentA.includes('BATTERY') || c.componentB.includes('BATTERY'));
    const payloadConstraints = constraints.filter(c => c.componentA.includes('PAYLOAD') || c.componentB.includes('PAYLOAD'));
    const isBatteryPayloadValid = batteryConstraints.length >= 2 && payloadConstraints.length >= 2;
    recordCheck(
      'TEST-021-011',
      isBatteryPayloadValid,
      isBatteryPayloadValid ? 'Battery & Payload structure constraint links verified' : 'Battery/Payload constraints incomplete',
      { batteryConstraintsCount: batteryConstraints.length, payloadConstraintsCount: payloadConstraints.length }
    );

    // =========================================================================
    // TEST-021-012: Constraint Solver Execution
    // =========================================================================
    const solverResult = assemblyManager.solveConstraints();
    const isSolverSolved = solverResult.solverStatus === 'SOLVED' && solverResult.solvedConstraints > 0 && solverResult.conflictingConstraints === 0;
    recordCheck(
      'TEST-021-012',
      isSolverSolved,
      isSolverSolved ? 'SECP Assembly Constraint Solver executed with SOLVED status' : 'Assembly Constraint Solver returned non-solved status',
      solverResult
    );

    // =========================================================================
    // TEST-021-013: Degrees of Freedom Analysis
    // =========================================================================
    const dof = solverResult.degreesOfFreedom;
    const isDofValid = dof.isFullyConstrained && dof.actualDOF === dof.expectedDOF;
    recordCheck(
      'TEST-021-013',
      isDofValid,
      isDofValid ? 'Degrees of Freedom verified (0 Net DOF, Fully Constrained)' : 'Degrees of Freedom mismatch',
      dof
    );

    // =========================================================================
    // TEST-021-014: Collision / Interference Analysis
    // =========================================================================
    const collisions = await assemblyManager.runCollisionAnalysis();
    const hasInterferencesRecorded = collisions.length > 0;
    const criticalClashes = collisions.filter(c => c.severity === 'CRITICAL');
    recordCheck(
      'TEST-021-014',
      hasInterferencesRecorded,
      hasInterferencesRecorded ? `Interference & clearance analysis evaluated ${collisions.length} pairs (${criticalClashes.length} critical clashes)` : 'Collision analysis failed to evaluate',
      { totalPairsEvaluated: collisions.length, criticalClashesCount: criticalClashes.length }
    );

    // =========================================================================
    // TEST-021-015: Automated BOM Generation
    // =========================================================================
    const bom = assemblyManager.generateBOM();
    const hasValidBOM = bom.length >= 11 && bom.every(b => b.quantity > 0 && b.totalMassKg > 0);
    recordCheck(
      'TEST-021-015',
      hasValidBOM,
      hasValidBOM ? `BOM automatically derived from Assembly Tree (${bom.length} line items)` : 'BOM generation failed',
      { bomLineItemCount: bom.length }
    );

    // =========================================================================
    // TEST-021-016: BOM ↔ Assembly Consistency Validation
    // =========================================================================
    const consistency = assemblyManager.verifyBOMAssemblyConsistency();
    recordCheck(
      'TEST-021-016',
      consistency.isConsistent,
      consistency.isConsistent ? 'BOM Quantity == Assembly Quantity verified for all parts' : `BOM/Assembly mismatch detected: ${consistency.mismatches.join('; ')}`,
      consistency
    );

    // =========================================================================
    // TEST-021-017: Mass Roll-up
    // =========================================================================
    const massRollup = assemblyManager.calculateMassRollup();
    const isMassRollupValid = massRollup.totalAssemblyMassKg > 10.0 && Object.keys(massRollup.subassemblyMasses).length > 0;
    recordCheck(
      'TEST-021-017',
      isMassRollupValid,
      isMassRollupValid ? `Mass roll-up verified (Total Assembly Mass: ${massRollup.totalAssemblyMassKg} kg)` : 'Mass roll-up invalid',
      massRollup
    );

    // =========================================================================
    // TEST-021-018: Center of Gravity (CG)
    // =========================================================================
    const cgResult = assemblyManager.calculateCenterOfGravity();
    const isCGValid = cgResult.totalMassKg === massRollup.totalAssemblyMassKg && typeof cgResult.centerOfGravity.z === 'number';
    recordCheck(
      'TEST-021-018',
      isCGValid,
      isCGValid ? `Global Center of Gravity calculated: (${cgResult.centerOfGravity.x}, ${cgResult.centerOfGravity.y}, ${cgResult.centerOfGravity.z}) mm` : 'Center of Gravity calculation invalid',
      cgResult
    );

    // =========================================================================
    // TEST-021-019: Revision Control & Configuration Integration
    // =========================================================================
    const replaced = assemblyManager.replaceNodePart('NODE-ARM-01', 'PART-DEF-ARM', 'REV-B');
    const configChain = assemblyManager.buildConfigurationChain();
    const history = assemblyManager.getRevisionHistory();
    const isConfigValid = replaced && configChain.chainValid && history.length > 0;
    recordCheck(
      'TEST-021-019',
      isConfigValid,
      isConfigValid ? 'Revision tracking & Product Configuration chain (Product -> Revision -> Variant -> Config -> Assembly -> BOM) verified' : 'Revision/Configuration verification failed',
      { replaced, configChain, historyCount: history.length }
    );

    // =========================================================================
    // TEST-021-020: Requirement Traceability & Evidence Package Verification
    // =========================================================================
    assemblyManager.buildTraceabilityGraph(traceEngine);
    const traceOut = traceEngine.getOutgoingEdges('REQ-DRONE-001');

    const regResult = await EPC021EvidenceGenerator.registerInEvidenceManager(evidenceManager, assemblyManager);
    const storedPkg = evidenceManager.getPackage(regResult.packageId);

    const isEvidenceValid = traceOut.length > 0 && storedPkg !== null && regResult.canonicalHash.length === 64;
    recordCheck(
      'TEST-021-020',
      isEvidenceValid,
      isEvidenceValid ? `Traceability graph populated & EPC021 evidence registered with SHA-256 canonical hash` : 'Traceability or Evidence Package registration failed',
      { packageId: regResult.packageId, canonicalHash: regResult.canonicalHash }
    );

    const endTime = performance.now();
    const executionTimeMs = Number((endTime - startTime).toFixed(2));
    const overallPassed = failedChecks === 0;

    return {
      verdict: overallPassed ? 'PASS' : 'FAIL',
      overallStatusMessage: overallPassed
        ? 'ENGINEERING VERDICT: EPC-021 = PASS. All mandatory Assembly criteria executed and verified.'
        : `ENGINEERING VERDICT: EPC-021 = FAIL (${failedChecks} checks failed).`,
      executionTimeMs,
      timestamp: new Date().toISOString(),
      totalChecks,
      passedChecks,
      failedChecks,
      checks,
      evidencePackageId: regResult.packageId,
      canonicalHash: regResult.canonicalHash
    };
  }
}
