import { EngineeringCapability, CapabilityStatus, EvidenceRecord, CapabilityProvider } from './types';

export class CapabilityQualificationService {
  private readonly evidenceRegistry: Map<string, EvidenceRecord> = new Map();

  /**
   * Register a verified evidence record in the system.
   */
  public registerEvidence(evidence: EvidenceRecord): void {
    const frozenEvidence = Object.freeze({
      ...evidence,
      metricSnapshots: Object.freeze({ ...(evidence.metricSnapshots || {}) })
    });
    this.evidenceRegistry.set(evidence.id, frozenEvidence);
  }

  public getEvidence(evidenceId: string): EvidenceRecord | undefined {
    return this.evidenceRegistry.get(evidenceId);
  }

  public listEvidence(): EvidenceRecord[] {
    return Array.from(this.evidenceRegistry.values());
  }

  public clearEvidence(): void {
    this.evidenceRegistry.clear();
  }

  /**
   * Qualify a capability's real engineering status based on registered evidence and active providers.
   */
  public qualify(
    capability: EngineeringCapability,
    provider: CapabilityProvider | undefined
  ): { status: CapabilityStatus; qualificationPath: string[]; missingRequirements: string[] } {
    const qualificationPath: string[] = ['START_QUALIFICATION'];
    const missingRequirements: string[] = [];

    // 1. Check if capability is enabled
    if (!capability.enabled) {
      qualificationPath.push('CAPABILITY_DISABLED');
      return {
        status: 'UNAVAILABLE',
        qualificationPath,
        missingRequirements: ['CAPABILITY_ENABLED']
      };
    }

    // 2. Check if a provider exists
    if (!provider) {
      qualificationPath.push('NO_ACTIVE_PROVIDER');
      return {
        status: 'UNAVAILABLE',
        qualificationPath,
        missingRequirements: ['ACTIVE_PROVIDER_REGISTRATION']
      };
    }
    qualificationPath.push(`PROVIDER_DETECTED::${provider.id}`);

    // 3. Detect and prevent capability hallucination (e.g. claiming GPU/NATIVE but using CPU or SIMULATION fallback)
    if (capability.executionMode === 'GPU' && provider.type !== 'GPU') {
      qualificationPath.push('HARDWARE_MISMATCH::Claimed GPU execution, but provider is CPU fallback');
      missingRequirements.push('REAL_GPU_HARDWARE_INTEGRATION');
      return {
        status: 'UNPROVEN',
        qualificationPath,
        missingRequirements
      };
    }

    if (capability.executionMode === 'NATIVE' && (provider.type === 'SIMULATION' || provider.type === 'CPU')) {
      qualificationPath.push('HARDWARE_MISMATCH::Claimed native execution, but provider is simulated/interpreted');
      missingRequirements.push('NATIVE_BINARY_EXECUTION_PROOF');
      return {
        status: 'UNPROVEN',
        qualificationPath,
        missingRequirements
      };
    }

    // 4. Check if the capability is classified as metadata/query only
    const isMetadataOnly = capability.metadata && capability.metadata.isMetadataQuery === true;
    if (isMetadataOnly) {
      qualificationPath.push('METADATA_QUERY_CAPABILITY::No execution evidence required');
      return {
        status: 'PROVEN',
        qualificationPath,
        missingRequirements: []
      };
    }

    // 5. Active Evidence checking for executive capabilities
    if (capability.evidenceIds.length === 0) {
      qualificationPath.push('EXECUTIVE_CAPABILITY_WITHOUT_EVIDENCE_IDS');
      missingRequirements.push('VERIFIABLE_EXECUTION_EVIDENCE');
      return {
        status: 'UNPROVEN',
        qualificationPath,
        missingRequirements
      };
    }

    let validEvidenceCount = 0;
    const checks = {
      apiDetected: false,
      adapterDetected: false,
      shaderCompiled: false,
      realHardwareExecution: false,
      hardwareTimingPassed: false,
      independentVerification: false
    };

    for (const evidenceId of capability.evidenceIds) {
      const evidence = this.evidenceRegistry.get(evidenceId);
      if (!evidence) {
        qualificationPath.push(`EVIDENCE_MISSING::${evidenceId}`);
        continue;
      }

      if (!evidence.valid) {
        qualificationPath.push(`EVIDENCE_INVALID_OR_TAMPERED::${evidenceId}`);
        continue;
      }

      // Check specific cryptographic hashes & metrics
      validEvidenceCount++;
      qualificationPath.push(`EVIDENCE_VERIFIED::${evidenceId}`);

      const metrics = evidence.metricSnapshots || {};
      if (metrics.apiDetected === true) checks.apiDetected = true;
      if (metrics.adapterDetected === true) checks.adapterDetected = true;
      if (metrics.shaderCompiled === true) checks.shaderCompiled = true;
      if (metrics.realHardwareExecution === true) checks.realHardwareExecution = true;
      if (metrics.hardwareTimingPassed === true) checks.hardwareTimingPassed = true;
      if (metrics.independentVerification === true) checks.independentVerification = true;
    }

    if (validEvidenceCount === 0) {
      qualificationPath.push('NO_VALID_EVIDENCE_FOUND');
      missingRequirements.push('VERIFIABLE_CRYPTOGRAPHIC_EVIDENCE');
      return {
        status: 'UNPROVEN',
        qualificationPath,
        missingRequirements
      };
    }

    // If it's a GPU capability (e.g. capability:compute.webgpu), evaluate WebGPU Hardware Pipeline checks
    if (capability.executionMode === 'GPU') {
      qualificationPath.push('EVALUATING_WEBGPU_HARDWARE_PIPELINE');
      if (!checks.apiDetected) missingRequirements.push('WEBGPU_API_DETECTION');
      if (!checks.adapterDetected) missingRequirements.push('WEBGPU_ADAPTER_DETECTION');
      if (!checks.shaderCompiled) missingRequirements.push('WEBGPU_SHADER_COMPILATION');
      if (!checks.realHardwareExecution) missingRequirements.push('REAL_GPU_HARDWARE_EXECUTION');
      if (!checks.hardwareTimingPassed) missingRequirements.push('HARDWARE_TIMING_MARKER_PASS');
      if (!checks.independentVerification) missingRequirements.push('INDEPENDENT_VERIFICATION');

      if (missingRequirements.length > 0) {
        qualificationPath.push('WEBGPU_HARDWARE_PIPELINE_INCOMPLETE');
        // Partially qualified if some parts are present
        const hasSomeGpuSteps = checks.apiDetected && checks.adapterDetected;
        return {
          status: hasSomeGpuSteps ? 'PARTIAL' : 'UNPROVEN',
          qualificationPath,
          missingRequirements
        };
      }
    }

    // General capability qualification: if we have evidence but not complete, it can be PARTIAL
    qualificationPath.push('ALL_QUALIFICATION_CHECKS_PASSED');
    return {
      status: 'PROVEN',
      qualificationPath,
      missingRequirements: []
    };
  }
}
