/**
 * SECP-097: CAD Interoperability & STEP AP242 Forensic Fidelity Types
 */

import { ValidationDomain } from '../validation/IndustrialValidationSuite';

export interface InteropFidelityReport {
  isValid: boolean;
  overallFidelityScore: number; // 0-100
  geometricFidelity: {
    volumeError: number;
    areaError: number;
    cogDrift: number;
    maxCoordinateDrift: number;
  };
  topologicalFidelity: {
    vertexCountMatch: boolean;
    edgeCountMatch: boolean;
    faceCountMatch: boolean;
    referenceIntegrity: boolean;
  };
  semanticFidelity: {
    dimensionCountMatch: boolean;
    toleranceCountMatch: boolean;
    datumCountMatch: boolean;
    pmiPreservation: boolean;
  };
  metadata: {
    sourceFormat: string;
    targetFormat: string;
    schemaVersion: string;
    timestamp: string;
    determinismHash: string;
  };
  violations: InteropViolation[];
}

export interface InteropViolation {
  severity: 'ERROR' | 'WARNING';
  type: string;
  message: string;
  entityId?: string;
  expected?: any;
  actual?: any;
}
