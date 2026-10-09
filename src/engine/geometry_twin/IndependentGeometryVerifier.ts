// SECP Industrial OS v2 — Independent Geometry Verifier & Differential Engine
import { GeometryTwin, DifferentialVerdict } from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';
import { GeometryCoordinateService } from './GeometryCoordinateService';
import { GeometryValidityVerifier } from './GeometryValidityVerifier';

export interface IndependentGeometryVerificationReport {
  verdict: 'VALID' | 'CORRUPTED' | 'INVALID';
  geometryHashMatch: boolean;
  topologyHashMatch: boolean;
  coordinateIntegrityValid: boolean;
  toleranceIntegrityValid: boolean;
  validityCheckVerdict: string;
  calculatedGeometryHash: string;
  calculatedTopologyHash: string;
  calculatedRootHash: string;
  rootHashMatch: boolean;
  details: string[];
}

export class IndependentGeometryVerifier {
  public static verifyTwin(twin: GeometryTwin): IndependentGeometryVerificationReport {
    const details: string[] = [];

    // 1. Independent Coordinate Check
    const coordVal = GeometryCoordinateService.validateCoordinateSystem(twin.coordinateSystem);
    const coordinateIntegrityValid = coordVal.valid;
    if (!coordinateIntegrityValid) {
      details.push(`Coordinate Check Failed: ${coordVal.error}`);
    }

    // 2. Independent Tolerance Check
    let toleranceIntegrityValid = true;
    if (twin.toleranceModel.modelTolerance <= 0 || twin.toleranceModel.angularTolerance <= 0) {
      toleranceIntegrityValid = false;
      details.push('Tolerance values must be strictly positive non-zero numbers');
    }

    // 3. Independent Hash Recomputation
    const calculatedGeometryHash = CanonicalGeometrySerializer.computeGeometryHash({
      bRep: twin.bRep,
      nurbsSurfaces: twin.nurbsSurfaces,
      nurbsCurves: twin.nurbsCurves,
      analyticEntities: twin.analyticEntities
    });

    const calculatedTopologyHash = twin.bRep
      ? CanonicalGeometrySerializer.computeTopologyHash(twin.bRep)
      : CanonicalGeometrySerializer.sha256('NO_TOPOLOGY');

    const geometryHashMatch = calculatedGeometryHash === twin.geometryHash;
    const topologyHashMatch = calculatedTopologyHash === twin.topologyHash;

    if (!geometryHashMatch) {
      details.push(`Geometry Hash Mismatch: Expected ${twin.geometryHash}, Calculated ${calculatedGeometryHash}`);
    }
    if (!topologyHashMatch) {
      details.push(`Topology Hash Mismatch: Expected ${twin.topologyHash}, Calculated ${calculatedTopologyHash}`);
    }

    // 4. Validity Check
    let validityCheckVerdict = 'VALID';
    if (twin.bRep) {
      const rep = GeometryValidityVerifier.verifyBRep(twin.bRep, twin.toleranceModel);
      validityCheckVerdict = rep.verdict;
      if (rep.verdict !== 'VALID') {
        details.push(`B-Rep Topological/Geometric Flaw Detected: ${rep.verdict}`);
      }
    }

    // 5. Root Hash Recomputation
    const coordHash = CanonicalGeometrySerializer.computeCoordinateSystemHash(twin.coordinateSystem);
    const tolHash = CanonicalGeometrySerializer.computeToleranceModelHash(twin.toleranceModel);
    const calculatedRootHash = CanonicalGeometrySerializer.computeGeometryRootHash({
      geometryHash: calculatedGeometryHash,
      topologyHash: calculatedTopologyHash,
      revisionHash: CanonicalGeometrySerializer.sha256(twin.geometryRevisionId),
      coordinateSystemHash: coordHash,
      toleranceHash: tolHash,
      configurationHash: CanonicalGeometrySerializer.sha256(twin.configurationId),
      evidenceHash: CanonicalGeometrySerializer.sha256(JSON.stringify(twin.evidence))
    });

    const rootHashMatch = calculatedRootHash === twin.rootHash;
    if (!rootHashMatch) {
      details.push(`Root Hash Mismatch: Expected ${twin.rootHash}, Calculated ${calculatedRootHash}`);
    }

    const isCorrupted = !geometryHashMatch || !topologyHashMatch || !rootHashMatch;
    const isValid = geometryHashMatch && topologyHashMatch && rootHashMatch && coordinateIntegrityValid && toleranceIntegrityValid && validityCheckVerdict === 'VALID';

    return {
      verdict: isCorrupted ? 'CORRUPTED' : (isValid ? 'VALID' : 'INVALID'),
      geometryHashMatch,
      topologyHashMatch,
      coordinateIntegrityValid,
      toleranceIntegrityValid,
      validityCheckVerdict,
      calculatedGeometryHash,
      calculatedTopologyHash,
      calculatedRootHash,
      rootHashMatch,
      details
    };
  }

  public static compareVerifiers(
    primaryReport: { verdict: string },
    independentReport: IndependentGeometryVerificationReport
  ): {
    differentialVerdict: DifferentialVerdict;
    details: string;
  } {
    const isMatch = primaryReport.verdict === independentReport.verdict;
    return {
      differentialVerdict: isMatch ? 'MATCH' : 'MISMATCH',
      details: `Primary [${primaryReport.verdict}] vs Independent [${independentReport.verdict}]`
    };
  }
}
