import { PhysicalManufacturingAttestation, MetrologyProof, PhysicalTelemetryEnvelope, PMALevel, DeviationVerdict, ManufacturingExecutionEnvelope } from './PhysicalManufacturingTypes';
import { PhysicalManufacturingEngine } from './PhysicalManufacturingEngine';
import { CanonicalDerivedArtifactBinding, DerivedArtifactBindingResult } from '../../topology/CanonicalDerivedArtifactBinding';
import crypto from 'crypto';

export interface PMARequest {
  digitalEngineeringTruthHash: string; // from SECP-P12 or earlier
  releasedArtifactGCodeHash: string;
  loadedProgramHash: string;
  machineId: string;
  controllerId: string;
  toolId: string;
  stockId: string;
  manufacturingRunId: string;
  physicalPartId: string;
  telemetryChain: PhysicalTelemetryEnvelope[];
  metrologyProof: MetrologyProof | null;
  canonicalGeometryHash: string;
  actualGeometryHash: string; // From inspection/CMM
  predecessorAttestationHash: string;
  hasHardwareRootOfTrust: boolean;
  requiredTolerances?: Record<string, number>;
  cadRevisionHash?: string;
  manufacturingEnvelope?: ManufacturingExecutionEnvelope;
  derivedArtifactBinding?: DerivedArtifactBindingResult;
}

export interface PMAVerdict {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reason?: string;
  claimLevel: PMALevel;
  attestation?: PhysicalManufacturingAttestation;
  antiFabricationGuardBlocked: boolean;
  determinismClass?: string;
}

export class HardAcceptanceGatePMA001 {
  public static executeGate(req: PMARequest): PMAVerdict {
    // 1. Digital Engineering Truth Verification
    if (!req.digitalEngineeringTruthHash) {
      return this.reject('ATTESTATION_CHAIN_FAILURE', 'Missing digital engineering truth hash');
    }

    // 2. Artifact and Execution Identity (G-Code parity)
    if (req.releasedArtifactGCodeHash !== req.loadedProgramHash) {
      return this.reject('ATTESTATION_FAILURE', 'G-Code substitution or hash mismatch detected');
    }

    if (req.manufacturingEnvelope && req.manufacturingEnvelope.gCodeHash !== req.manufacturingEnvelope.loadedProgramHash) {
      return this.reject('ATTESTATION_FAILURE', 'Manufacturing execution envelope G-Code substitution detected');
    }

    // 3. Gate 3 -> Gate 4 Cryptographic Continuity Bridge (CanonicalDerivedArtifactBinding)
    const binding = req.derivedArtifactBinding || req.manufacturingEnvelope?.bindingResult;
    if (binding) {
      const targetRevision = req.cadRevisionHash || req.manufacturingEnvelope?.cadRevisionHash || req.digitalEngineeringTruthHash;
      const targetGeometry = req.canonicalGeometryHash || req.manufacturingEnvelope?.canonicalGeometryHash;
      const bindingVerify = CanonicalDerivedArtifactBinding.verifyBinding(binding, targetRevision, targetGeometry);
      if (!bindingVerify.isValid) {
        if (bindingVerify.status === 'REVISION_MISMATCH') {
          return this.reject('DERIVED_ARTIFACT_REVISION_MISMATCH', `CAM toolpath derived from different CAD revision: ${binding.cadRevisionHash} vs ${targetRevision}`);
        }
        if (bindingVerify.status === 'GEOMETRY_MISMATCH') {
          return this.reject('GEOMETRY_PROVENANCE_MISMATCH', `CAM toolpath geometry mismatch: ${binding.canonicalGeometryHash} vs ${targetGeometry}`);
        }
        return this.reject('ATTESTATION_FAILURE', `Derived artifact binding verification failed: ${bindingVerify.reasons.join(', ')}`);
      }
    }

    // 4. Physical Part Identity check
    if (req.manufacturingEnvelope && req.manufacturingEnvelope.partId && req.physicalPartId) {
      if (req.manufacturingEnvelope.partId !== req.physicalPartId) {
        return this.reject('PHYSICAL_IDENTITY_MISMATCH', `Physical part ID ${req.physicalPartId} does not match envelope partId ${req.manufacturingEnvelope.partId}`);
      }
    }

    // 5. Telemetry Verification
    if (!req.telemetryChain || req.telemetryChain.length === 0) {
      return this.reject('CHAIN_INTEGRITY_FAILURE', 'Telemetry missing');
    }
    
    // Check replays, reordering, deletion, or identity mismatches inside telemetry
    const telemetryError = PhysicalManufacturingEngine.verifyTelemetryChain(req.telemetryChain, req.machineId);
    if (telemetryError !== null) {
      return this.reject(telemetryError, 'Telemetry tampering, wrong machine, or replay detected');
    }

    const telemetryHash = crypto.createHash('sha256').update(JSON.stringify(req.telemetryChain)).digest('hex');
    const executionHash = crypto.createHash('sha256').update(telemetryHash + req.loadedProgramHash).digest('hex');

    if (req.manufacturingEnvelope?.telemetryRoot && req.manufacturingEnvelope.telemetryRoot !== telemetryHash) {
      return this.reject('TELEMETRY_INTEGRITY_FAILURE', 'Telemetry root mismatch in manufacturing execution envelope');
    }

    // 6. Determine Hardware Root of Trust and AntiFabricationGuard
    if (!req.hasHardwareRootOfTrust) {
      // Hardware root of trust is UNAVAILABLE
      // Keep INDUSTRIAL_FIELD_QUALIFIED BLOCKED
      return {
        status: 'REJECTED',
        reason: 'HARDWARE_ROOT_OF_TRUST = UNAVAILABLE',
        claimLevel: 'PHYSICAL_EXECUTION_PROVEN',
        antiFabricationGuardBlocked: true
      };
    }

    // 5. CMM Metrology & Physical Deviation Verification
    if (!req.metrologyProof) {
      return this.reject('INSPECTION_INTEGRITY_FAILURE', 'CMM evidence missing');
    }

    const deviationVerdict = PhysicalManufacturingEngine.analyzeDeviation(
      req.canonicalGeometryHash,
      req.actualGeometryHash,
      req.metrologyProof,
      req.requiredTolerances || {}
    );

    if (deviationVerdict === 'INSPECTION_INCOMPLETE') return this.reject('INSPECTION_INTEGRITY_FAILURE', 'Inspection incomplete');
    if (deviationVerdict === 'OUT_OF_TOLERANCE') return this.reject('GEOMETRY_PROVENANCE_MISMATCH', 'Inspection out of tolerance');
    if (deviationVerdict === 'GEOMETRY_PROVENANCE_MISMATCH') return this.reject('GEOMETRY_PROVENANCE_MISMATCH', 'Geometry mismatch');
    if (deviationVerdict === 'FAIL') return this.reject('GEOMETRY_PROVENANCE_MISMATCH', 'Geometry mismatch');

    // Also verify physical part identity vs what metrology says if we want, but for now we rely on the above tests.

    // 6. Verification passed
    const attestation: PhysicalManufacturingAttestation = {
      attestationId: crypto.randomUUID(),
      documentId: 'DOC_DRONE_001',
      instanceId: 'INST_001',
      releasedArtifactHash: req.releasedArtifactGCodeHash,
      toolpathHash: req.loadedProgramHash,
      machineId: req.machineId,
      controllerId: req.controllerId,
      toolId: req.toolId,
      stockId: req.stockId,
      manufacturingRunId: req.manufacturingRunId,
      physicalPartId: req.physicalPartId,
      inspectionId: req.metrologyProof.inspectionId,
      telemetryEvidenceHash: telemetryHash,
      executionEvidenceHash: executionHash,
      inspectionEvidenceHash: req.metrologyProof.inspectionEvidenceHash,
      predecessorAttestationHash: req.predecessorAttestationHash,
      status: 'ACCEPTED',
      claimLevel: 'INDUSTRIAL_FIELD_QUALIFIED',
      determinismClass: 'CANONICALLY_DETERMINISTIC'
    };

    return {
      status: 'ACCEPTED',
      claimLevel: 'INDUSTRIAL_FIELD_QUALIFIED',
      attestation,
      antiFabricationGuardBlocked: false,
      determinismClass: 'CANONICALLY_DETERMINISTIC'
    };
  }

  private static reject(reason: string, details: string): PMAVerdict {
    return {
      status: 'REJECTED',
      reason,
      claimLevel: 'NOT_CLOSED',
      antiFabricationGuardBlocked: true
    };
  }
}
