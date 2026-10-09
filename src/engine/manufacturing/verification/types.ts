import { PropertyProvenance } from "../../materials/types";
import { MachineAxisToolpath } from "../post/types";

export enum VerificationVerdict {
  QUALIFIED = "QUALIFIED",
  CONDITIONALLY_QUALIFIED = "CONDITIONALLY_QUALIFIED",
  REJECTED = "REJECTED",
  INCONCLUSIVE = "INCONCLUSIVE",
  CRITICAL_FAILURE = "CRITICAL_FAILURE"
}

export enum FailureClassification {
  SYNTAX_ERROR = "SYNTAX_ERROR",
  SEMANTIC_VIOLATION = "SEMANTIC_VIOLATION",
  KINEMATIC_VIOLATION = "KINEMATIC_VIOLATION",
  GEOMETRIC_DEVIATION = "GEOMETRIC_DEVIATION",
  COLLISION_DETECTED = "COLLISION_DETECTED",
  FEED_LIMIT_VIOLATION = "FEED_LIMIT_VIOLATION",
  SPINDLE_LIMIT_VIOLATION = "SPINDLE_LIMIT_VIOLATION",
  STOKE_LIMIT_VIOLATION = "STOKE_LIMIT_VIOLATION"
}

export interface GCodeVerificationContract {
  verifierId: string;
  verifierRevision: number;
  ncProgramId: string;
  ncProgramRevision: number;
  sourceToolpathId: string;
  machineProfileId: string;
  controllerProfileId: string;
  postProcessorId: string;
  tolerances: {
    linearPositionToleranceMM: number;
    angularOrientationToleranceDeg: number;
    axisToleranceMM: number;
    rotaryAxisToleranceDeg: number;
    arcRadiusToleranceMM: number;
    chordalErrorToleranceMM: number;
    minimumSafeClearanceMM: number;
    feedTolerancePercent: number;
    spindleToleranceRPM: number;
  };
  collisionPolicy: {
    checkTool: boolean;
    checkHolder: boolean;
    checkSpindle: boolean;
    checkMachineHead: boolean;
    checkFixture: boolean;
    checkStock: boolean;
    checkWorkpiece: boolean;
    checkKeepOut: boolean;
    minimumClearanceMM: number;
  };
  limitPolicy: {
    enforceLinearStroke: boolean;
    enforceRotaryRange: boolean;
    enforceRotaryContinuity: boolean;
    enforceFeedBounds: boolean;
    enforceSpindleBounds: boolean;
    enforceToolChangerCapacity: boolean;
  };
  provenance: PropertyProvenance;
}

export interface GCodeVerificationReport {
  reportId: string;
  contractId: string;
  verdict: VerificationVerdict;
  totalBlocksProcessed: number;
  syntaxStatus: "VALID" | "INVALID";
  semanticStatus: "VALID" | "INVALID";
  kinematicStatus: "VALID" | "INVALID";
  collisionStatus: "FREE" | "COLLISION";
  maxObservedDeviationMM: number;
  maxObservedAngularDeviationDeg: number;
  failures: {
    blockIndex: number;
    blockText: string;
    classification: FailureClassification;
    message: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }[];
  summary: string;
  timestamp: string;
}

export interface HardAcceptanceResult108 {
  passed: boolean;
  scorePercentage: number;
  totalChecks: number;
  passedChecks: number;
  verdict: VerificationVerdict;
  timestamp: string;
  details: {
    checkName: string;
    status: "PASS" | "FAIL";
    evidence: string;
  }[];
}

export interface AdversarialSuiteSummary {
  passed: boolean;
  totalTests: number;
  passCount: number;
  failCount: number;
  vulnerabilityScore: number;
  testResults: {
    testId: string;
    name: string;
    passed: boolean;
    expectedDetection: string;
    actualDetection: string;
  }[];
  timestamp: string;
}
