/**
 * SECP Engineering OS Architecture 2.0
 * The central integration layer for all industrial engineering domains.
 */

import { EngineeringTruthEngine } from './EngineeringTruthEngine';
import { InvalidationEngine } from './InvalidationEngine';
import { EngineeringID, EngineeringObject, EngineeringObjectStatus } from './types';
import { EvidenceBus314 } from '../engineering_ai/copilot/EvidenceBus314';
import { EngineeringEvidenceLedger } from '../evidence/ledger/EngineeringEvidenceLedger';
import { StateSyncEngine } from '../sync/StateSyncEngine';
import { WorkbenchStateOwnershipEngine } from '../workbench/WorkbenchStateOwnershipEngine';
import { EvidenceBus } from '../industrial-os/evidence-bus/EvidenceBus';
import { AttestationRegistry } from '../attestation/AttestationRegistry';
import { CanonicalCapabilityResolver } from '../capabilities/CanonicalCapabilityResolver';
import { CapabilityRegistry } from '../capabilities/CapabilityRegistry';
import { FrontendCapabilityMirror } from '../capabilities/FrontendCapabilityMirror';
import { CapabilityDriftDetector } from '../capabilities/CapabilityDriftDetector';
import { InvalidationPipelineEngine } from '../workbench/InvalidationPipelineEngine';
import { ProductionProofEngine } from '../production-proof/ProductionProofEngine';
import { EngineeringIdentityService } from '../identity/EngineeringIdentityService';
import { EngineeringTelemetryEngine } from '../telemetry/EngineeringTelemetryEngine';
import { MasterPLMManager } from '../plm/MasterPLMManager';
import { initializeAuthorityHandshake } from '../simulation/SimulationAuthorityInternal';
import { SimulationEngine } from '../simulation/SimulationEngine';

import { SimulationExecutionRegistry } from '../simulation/SimulationExecutionRegistry';
import { SimulationScenarioRegistry } from '../simulation/SimulationScenarioRegistry';
import { SimulationIdentityService } from '../simulation/SimulationIdentityService';

export class EngineeringOS {
  private static instance: EngineeringOS;
  private truthEngine = EngineeringTruthEngine.getInstance();
  private invalidationEngine = InvalidationEngine.getInstance();

  private constructor() {}

  public static getInstance(): EngineeringOS {
    if (!EngineeringOS.instance) {
      EngineeringOS.instance = new EngineeringOS();
    }
    return EngineeringOS.instance;
  }

  /**
   * Initializes a core engineering workflow context.
   */
  public boot(): void {
    console.log('[SECP OS] Booting Engineering OS Architecture 2.0...');
    
    // Initialize Simulation Authority Boundary
    try {
      const engineKey = initializeAuthorityHandshake();
      SimulationEngine.bootAuthority(engineKey);
    } catch (e) {
      console.warn('[SECP OS] Simulation Authority already initialized or failed.');
    }

    this.seedInitialObjects();
  }

  private seedInitialObjects(): void {
    // Seed a master turbine object
    const turbine: EngineeringObject = {
      id: 'OBJ-TURBINE-001',
      name: 'Industrial Turbine Master',
      domain: 'ASSEMBLY',
      status: EngineeringObjectStatus.STABLE,
      revision: {
        id: 'REV-A',
        timestamp: new Date().toISOString(),
        author: 'SECP-SYSTEM',
        comment: 'Initial Master Release',
        hash: 'SHA256-INIT-8821'
      },
      provenance: {
        sourceId: 'NATIVE',
        sourceDomain: 'CAD',
        transformType: 'INITIAL_CREATION',
        timestamp: new Date().toISOString(),
        runtimeVersion: 'v3.190.0'
      },
      simulationResultIds: ['SIM-CFD-001'],
      evidenceIds: ['EVID-ARCH-01'],
      isCertified: true,
      metadata: { partCount: 1240, mass: '12.4kg' }
    };

    this.truthEngine.registerObject(turbine);

    // Seed a CFD result dependent on the turbine
    const cfdResult: EngineeringObject = {
      id: 'OBJ-CFD-001',
      name: 'Turbine Thermal Analysis',
      domain: 'CFD',
      status: EngineeringObjectStatus.STABLE,
      revision: {
        id: 'REV-A',
        timestamp: new Date().toISOString(),
        author: 'CFD-SOLVER-V3',
        comment: 'Converged Solution',
        hash: 'SHA256-CFD-9921'
      },
      provenance: {
        sourceId: 'OBJ-TURBINE-001',
        sourceDomain: 'ASSEMBLY',
        transformType: 'SIMULATION_SOLVE',
        timestamp: new Date().toISOString(),
        runtimeVersion: 'v3.190.0'
      },
      simulationResultIds: [],
      evidenceIds: ['EVID-CFD-001'],
      isCertified: true,
      metadata: { iterations: 1500, residual: 1e-6 }
    };

    this.truthEngine.registerObject(cfdResult);

    // Link them in dependency graph
    this.invalidationEngine.addDependency({
      sourceId: 'OBJ-TURBINE-001',
      targetId: 'OBJ-CFD-001',
      type: 'GEOMETRY',
      isCritical: true
    });
  }

  public triggerGeometricChange(id: EngineeringID): void {
    console.log(`[SECP OS] Geometric change detected in ${id}. Propagating invalidation...`);
    const invalidated = this.invalidationEngine.invalidateDownstream(id);
    console.log(`[SECP OS] Invalidated ${invalidated.length} downstream objects.`);
  }

  public getSystemState(): any {
    return {
      truthEngine: this.truthEngine.getAllObjects(),
      activeTransactions: 0,
      computeResources: [
        { type: 'CPU', available: true, performanceScore: 92 },
        { type: 'WASM', available: true, performanceScore: 88 },
        { type: 'GPU', available: true, performanceScore: 96 }
      ]
    };
  }

  /**
   * Authoritative Forensic System Reset.
   * Clears all global singletons to prevent cross-project state leakage.
   */
  public resetSystem(): void {
    console.log('[SECP OS] EXECUTING AUTHORITATIVE SYSTEM RESET...');
    
    // Core Kernel
    this.truthEngine.reset();
    this.invalidationEngine.reset();

    // Evidence & Ledger
    EngineeringEvidenceLedger.getInstance().reset();
    EvidenceBus314.getInstance().clear();
    EvidenceBus.getInstance().clear();
    AttestationRegistry.getInstance().clear();

    // Capabilities
    FrontendCapabilityMirror.getInstance().reset();
    // (Resolver and DriftDetector are reset via FrontendCapabilityMirror.reset())

    // State Sync & Pipeline
    StateSyncEngine.getInstance().reset();
    InvalidationPipelineEngine.getInstance().reset();
    WorkbenchStateOwnershipEngine.getInstance().resetAuditState();

    // Qualification
    ProductionProofEngine.reset();

    // Identity, Telemetry & PLM
    SimulationExecutionRegistry.clear();
    SimulationScenarioRegistry.clear();
    SimulationIdentityService.clear();
    EngineeringIdentityService.getInstance().clear();
    EngineeringTelemetryEngine.getInstance().clearCache();
    MasterPLMManager.reset();

    console.log('[SECP OS] SYSTEM RESET COMPLETE.');
  }
}
