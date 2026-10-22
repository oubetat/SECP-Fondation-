/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: Aircraft & Industrial Qualification Engine
 * QualificationRequirement.ts
 * 
 * Formal data types, schemas, and verification contracts for system-level
 * engineering qualification requirements and traceability.
 */

export type QualificationStandard =
  | 'DO-254'
  | 'DO-178C'
  | 'ISO-26262-ASIL-D'
  | 'IEC-61508-SIL-3'
  | 'IPC-6012-CLASS-3'
  | 'MIL-STD-810H'
  | 'DEF-STAN-00-56'
  | 'SECP-CORE-STANDARD';

export type VerificationMethod =
  | 'ANALYSIS'      // Formal mathematical or algorithmic analysis (e.g. MNA circuit solver)
  | 'SIMULATION'    // Physics-based multi-physics numerical simulation (e.g. thermal lumped model)
  | 'TEST'          // Executable automated test against canonical assertions
  | 'INSPECTION';   // Automated geometric, netlist, or BOM audit against rules

export type RequirementCriticality =
  | 'SAFETY_CRITICAL'   // Failure directly compromises system safety (catastrophic / hazardous)
  | 'MISSION_CRITICAL'  // Failure prevents primary mission function
  | 'OPERATIONAL'       // Performance or efficiency degradation
  | 'DIAGNOSTIC';       // Telemetry, reporting, or non-functional constraint

export type RequirementLifecycleState =
  | 'DECLARED'              // Formally defined in specification
  | 'IMPLEMENTED'           // Verification hook & test runner exist
  | 'EXECUTED'              // Evaluation executed on active assembly
  | 'VERIFIED'              // Measured value complies with acceptance threshold
  | 'EVIDENCE_BACKED'       // Cryptographic evidence record generated in ledger
  | 'QUALIFICATION_ACCEPTED';// Formally accepted in final qualification gate

export type SystemQualificationStatus =
  | 'NOT_ASSESSED'
  | 'PARTIALLY_ASSESSED'
  | 'VERIFICATION_IN_PROGRESS'
  | 'VERIFICATION_FAILED'
  | 'EVIDENCE_INCOMPLETE'
  | 'QUALIFICATION_BLOCKED'
  | 'QUALIFIED_WITH_LIMITATIONS'
  | 'QUALIFIED_WITHIN_DECLARED_SCOPE';

export type ComparisonOperator = '<' | '<=' | '>' | '>=' | '==' | '!=' | 'IN_RANGE' | 'MATCHES';

export interface AcceptanceThreshold {
  operator: ComparisonOperator;
  expectedValue: number | string | boolean;
  maxTolerance?: number;
  unit: string;
}

export interface CanonicalDesignReference {
  domain: 'ECAD' | 'ELECTRICAL' | 'WIRING_HARNESS' | 'MCAD' | 'THERMAL' | 'BOM' | 'CROSSDOMAIN';
  elementId: string;       // e.g. 'trace-power-vbus', 'U1', 'CONN_PCB_A'
  elementType: 'NET' | 'TRACE' | 'COMPONENT' | 'CONNECTOR' | 'WIRE' | 'STANDOFF' | 'ENCLOSURE' | 'BOM_ENTRY';
  canonicalModelPath: string; // e.g. 'pcb.traces[0]', 'electricalCircuit.components[0]'
}

export interface QualificationRequirement {
  requirementId: string;
  sourceStandard: QualificationStandard;
  standardClause?: string;
  criticality: RequirementCriticality;
  title: string;
  description: string;
  verificationMethod: VerificationMethod;
  authoritativeEngine: string; // e.g. 'MultidomainPcbIntegrationEngine.verifyElectricalTraceDrop'
  targetReference: CanonicalDesignReference;
  acceptanceCriteria: AcceptanceThreshold;
  state: RequirementLifecycleState;
  solverValidityLimits: string; // Explicit statement of solver bounds under which this requirement is valid
}

export interface RequirementVerificationEvidence {
  requirementId: string;
  measuredValue: number | string | boolean;
  isCompliant: boolean;
  executionTimestamp: string;
  evidenceDigest: string;
  ledgerRecordId?: string;
  solverUsed: string;
  solverLimitationsNoted: string;
  notes: string;
}

export interface RequirementTraceabilityRecord {
  requirement: QualificationRequirement;
  evidence?: RequirementVerificationEvidence;
  status: 'SATISFIED' | 'BREACHED' | 'UNVERIFIED' | 'INVALIDATED';
  gapAnalysisNotes?: string;
}

/**
 * Validates whether a measured value meets the requirement acceptance threshold.
 */
export function evaluateAcceptanceCriteria(
  criteria: AcceptanceThreshold,
  measuredValue: number | string | boolean
): { complies: boolean; message: string } {
  const { operator, expectedValue, maxTolerance, unit } = criteria;

  if (typeof measuredValue === 'number' && typeof expectedValue === 'number') {
    switch (operator) {
      case '<=': {
        const tol = maxTolerance || 0;
        const complies = measuredValue <= (expectedValue + tol);
        return {
          complies,
          message: complies
            ? `Measured ${measuredValue} ${unit} <= ${expectedValue} ${unit}`
            : `Breach: Measured ${measuredValue} ${unit} exceeds threshold ${expectedValue} ${unit}`
        };
      }
      case '<': {
        const complies = measuredValue < expectedValue;
        return {
          complies,
          message: complies
            ? `Measured ${measuredValue} ${unit} < ${expectedValue} ${unit}`
            : `Breach: Measured ${measuredValue} ${unit} is not strictly less than ${expectedValue} ${unit}`
        };
      }
      case '>=': {
        const tol = maxTolerance || 0;
        const complies = measuredValue >= (expectedValue - tol);
        return {
          complies,
          message: complies
            ? `Measured ${measuredValue} ${unit} >= ${expectedValue} ${unit}`
            : `Breach: Measured ${measuredValue} ${unit} is below threshold ${expectedValue} ${unit}`
        };
      }
      case '>': {
        const complies = measuredValue > expectedValue;
        return {
          complies,
          message: complies
            ? `Measured ${measuredValue} ${unit} > ${expectedValue} ${unit}`
            : `Breach: Measured ${measuredValue} ${unit} is not strictly greater than ${expectedValue} ${unit}`
        };
      }
      case '==': {
        const tol = maxTolerance || 1e-9;
        const complies = Math.abs(measuredValue - expectedValue) <= tol;
        return {
          complies,
          message: complies
            ? `Measured ${measuredValue} ${unit} == ${expectedValue} ${unit} (tol: ${tol})`
            : `Breach: Measured ${measuredValue} ${unit} does not equal ${expectedValue} ${unit} within tolerance ${tol}`
        };
      }
      default:
        break;
    }
  }

  if (operator === '==' || operator === 'MATCHES') {
    const complies = String(measuredValue).trim().toLowerCase() === String(expectedValue).trim().toLowerCase();
    return {
      complies,
      message: complies
        ? `Value matched expected "${expectedValue}"`
        : `Breach: Expected "${expectedValue}" but received "${measuredValue}"`
    };
  }

  if (operator === '!=') {
    const complies = measuredValue !== expectedValue;
    return {
      complies,
      message: complies
        ? `Value correctly differs from prohibited value`
        : `Breach: Prohibited value "${expectedValue}" was encountered`
    };
  }

  return {
    complies: false,
    message: `Unsupported comparison operator ${operator} for values: ${measuredValue} vs ${expectedValue}`
  };
}
