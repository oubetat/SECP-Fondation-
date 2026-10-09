/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — G-Code Verification Engine
 * 
 * Master orchestrator proving that:
 * Toolpath -> Kinematics -> Post-Processing -> G-Code -> Parser -> Reconstructed Motion
 * preserves geometric, kinematic, and manufacturing truth without loss or distortion.
 */

import {
  VerificationContract,
  VerificationResult,
  VerificationStatus,
  VerificationIssue,
  VerificationTolerances,
  DEFAULT_VERIFICATION_TOLERANCES,
  NCBlockTokens,
  NCExecutionState
} from './GCodeVerificationTypes';
import { GCodeTokenizer } from './GCodeTokenizer';
import { GCodeParser } from './GCodeParser';
import { ModalStateTracker } from './ModalStateTracker';
import { MotionReconstructor } from './MotionReconstructor';
import { MachineLimitChecker } from './MachineLimitChecker';
import { ToolStateChecker } from './ToolStateChecker';
import { FeedSpindleChecker } from './FeedSpindleChecker';
import { CoordinateSystemChecker } from './CoordinateSystemChecker';
import { BackKinematicVerifier } from './BackKinematicVerifier';
import { ToolpathComparator } from './ToolpathComparator';
import { SemanticValidator } from './SemanticValidator';
import { StockCollisionBridge } from './StockCollisionBridge';
import { VerificationEvidenceGenerator } from './VerificationEvidenceGenerator';

export class GCodeVerificationEngine {
  /**
   * Main verification entry point. Accepts a strict VerificationContract and executes
   * multi-stage lexical, syntactic, semantic, kinematic, dynamic, and geometric audits.
   */
  public static async verify(contract: VerificationContract): Promise<VerificationResult> {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    // 0. Merge Tolerances
    const tolerances: VerificationTolerances = {
      ...DEFAULT_VERIFICATION_TOLERANCES,
      ...(contract.tolerances || {})
    };

    // 1. Contract Validation (Reject Insufficient Context)
    if (!contract.ncProgramText || contract.ncProgramText.trim().length === 0) {
      issues.push({
        id: `ISSUE-CONTEXT-${issueCounter++}`,
        code: 'CONTEXT_INSUFFICIENT',
        severity: 'CRITICAL',
        lineIndex: 0,
        message: 'No NC program text provided for verification.'
      });
    }

    if (!contract.machine) {
      issues.push({
        id: `ISSUE-CONTEXT-${issueCounter++}`,
        code: 'CONTEXT_INSUFFICIENT',
        severity: 'CRITICAL',
        lineIndex: 0,
        message: 'Missing machine definition contract. Machine limits cannot be verified.'
      });
    }

    if (!contract.controllerDialect) {
      issues.push({
        id: `ISSUE-CONTEXT-${issueCounter++}`,
        code: 'CONTEXT_INSUFFICIENT',
        severity: 'CRITICAL',
        lineIndex: 0,
        message: 'Target controller dialect not specified. NC commands cannot be parsed deterministically.'
      });
    }

    // 2. Tokenize Program
    const tokenizedBlocks: NCBlockTokens[] = contract.ncProgramText
      ? GCodeTokenizer.tokenizeProgram(contract.ncProgramText, contract.controllerDialect)
      : [];

    // 3. Syntactic & Dialect Validation
    const syntaxResult = GCodeParser.parseAndValidate(tokenizedBlocks, contract.controllerDialect);
    issues.push(...syntaxResult.issues);

    // 4. Modal State Tracking & Motion Reconstruction
    const initialUnits = contract.machine?.defaultUnits || 'METRIC_MM';
    const modalTracker = new ModalStateTracker(
      contract.controllerDialect,
      initialUnits,
      contract.toolSnapshots || []
    );

    const motion = MotionReconstructor.reconstruct(
      tokenizedBlocks,
      modalTracker,
      tolerances,
      issues
    );

    // Collect snapshots of states across blocks
    const executionStates: NCExecutionState[] = [];
    const trackerForSnapshots = new ModalStateTracker(
      contract.controllerDialect,
      initialUnits,
      contract.toolSnapshots || []
    );
    for (const b of tokenizedBlocks) {
      const state = trackerForSnapshots.updateWithBlock(b, []);
      executionStates.push(state);
    }

    // 5. Machine Physical Travel & Envelope Limits Checker
    if (contract.machine) {
      const machineIssues = MachineLimitChecker.verifyMachineLimits(motion, contract.machine, tolerances);
      issues.push(...machineIssues);
    }

    // 6. Tool State, Magazine Capacity, and Double Compensation Checker
    if (contract.machine) {
      const expectedToolNumbers = (contract.toolSnapshots || []).map(s => s.toolNumber).filter(Boolean) as number[];
      const toolIssues = ToolStateChecker.verifyToolStates(
        executionStates,
        contract.machine,
        contract.toolSnapshots || [],
        expectedToolNumbers
      );
      issues.push(...toolIssues);
    }

    // 7. Feed, Spindle, and Safety Sequence Checker
    if (contract.machine) {
      const feedSpindleIssues = FeedSpindleChecker.verifyFeedAndSpindle(executionStates, contract.machine);
      issues.push(...feedSpindleIssues);
    }

    // 8. Coordinate System & Units Checker
    if (contract.machine) {
      const coordIssues = CoordinateSystemChecker.verifyCoordinatesAndUnits(
        executionStates,
        contract.machine,
        contract.machine.defaultUnits || 'METRIC_MM'
      );
      issues.push(...coordIssues);
    }

    // 9. Kinematic Back-Verification (4/5-Axis)
    let kinematicReport;
    if (contract.machine) {
      const kinResult = BackKinematicVerifier.verifyKinematics(
        motion,
        contract.machine,
        contract.referenceKinematicPoses,
        tolerances
      );
      kinematicReport = kinResult.report;
      issues.push(...kinResult.issues);
    }

    // 10. Toolpath Geometric Comparison & Missing/Extra Motion
    let toolpathReport;
    if (contract.referenceToolpaths && contract.referenceToolpaths.length > 0) {
      const toolpathResult = ToolpathComparator.compareToolpaths(
        motion,
        contract.referenceToolpaths,
        contract.sourceMap,
        tolerances
      );
      toolpathReport = toolpathResult.report;
      issues.push(...toolpathResult.issues);
    }

    // 11. Semantic & Precision Audit
    const semanticResult = SemanticValidator.validateSemantics(
      tokenizedBlocks,
      executionStates,
      contract.controllerDialect
    );
    issues.push(...semanticResult.issues);
    const precisionReport = semanticResult.precisionReport;

    // 12. Stock & Collision Bridge Sanity Audit
    const collisionIssues = StockCollisionBridge.auditMotionsForCollisions(motion, contract.toolSnapshots || []);
    issues.push(...collisionIssues);

    // 13. Determine Overall Verification Status
    const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;

    let status: VerificationStatus = 'VERIFIED';
    let isPassing = true;

    if (criticalCount > 0 || errorCount > 0) {
      status = 'FAILED';
      isPassing = false;
    } else if (warningCount > 0) {
      status = 'VERIFIED_WITH_WARNINGS';
      isPassing = true;
    }

    // 14. Generate Cryptographic Provenance Evidence
    const evidence = await VerificationEvidenceGenerator.generateEvidence(
      contract,
      tolerances,
      status,
      isPassing,
      motion,
      issues,
      toolpathReport,
      kinematicReport
    );

    return {
      contract,
      tolerances,
      status,
      isPassing,
      tokenizedBlocks,
      executionStates,
      motionSequence: motion,
      issues,
      toolpathDeviationReport: toolpathReport,
      kinematicDeviationReport: kinematicReport,
      precisionReport,
      evidence
    };
  }
}
