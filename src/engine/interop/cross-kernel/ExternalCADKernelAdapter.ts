/**
 * SECP Industrial OS v2 — External CAD Kernel Adapter
 * PATCH-040: Industrial CAD Interoperability & Loss Measurement
 * 
 * Formal abstraction for interfacing with external CAD kernels (OpenCASCADE, Parasolid, ACIS, etc.)
 * Strictly enforces that missing/unconnected external kernels yield UNAVAILABLE.
 */

import { ExternalKernelIdentity, ExternalKernelStatus, ExternalImportEvidence, ExternalExportEvidence } from './CrossKernelTypes';
import { STEPAP242Translator } from '../STEPAP242Translator';
import { AP242SemanticModel } from '../AP242Types';
import * as crypto from 'crypto';

export interface ExternalImportResult {
  success: boolean;
  importedEntityCount: number;
  healingOperationsApplied: string[];
  toleranceAdjustments: Record<string, number>;
  unsupportedEntities: string[];
  warnings: string[];
  errors: string[];
  nativeHandle?: any;
}

export interface ExternalExportResult {
  success: boolean;
  stepContent: string;
  stepArtifactHash: string;
  stepByteLength: number;
  exportedEntityCount: number;
  healingOperations: string[];
  warnings: string[];
  errors: string[];
}

export interface ExternalRoundTripResult {
  importEvidence: ExternalImportEvidence;
  exportEvidence: ExternalExportEvidence;
  success: boolean;
  outputStepContent: string;
}

export interface IExternalCADKernelAdapter {
  identify(): ExternalKernelIdentity;
  getVersion(): string;
  isAvailable(): boolean;
  getStatus(): ExternalKernelStatus;
  importSTEP(stepContent: string): Promise<ExternalImportResult> | ExternalImportResult;
  exportSTEP(handle: any): Promise<ExternalExportResult> | ExternalExportResult;
  executeRoundTrip(stepContent: string): Promise<ExternalRoundTripResult> | ExternalRoundTripResult;
}

/**
 * Null adapter when no external CAD kernel is installed/connected.
 * Always reports UNAVAILABLE.
 */
export class NullExternalCADKernelAdapter implements IExternalCADKernelAdapter {
  private readonly identity: ExternalKernelIdentity = {
    kernelName: 'NULL_KERNEL',
    vendor: 'NONE',
    version: 'UNAVAILABLE',
    build: 'UNAVAILABLE',
    platform: 'UNAVAILABLE',
    importerVersion: 'UNAVAILABLE',
    exporterVersion: 'UNAVAILABLE',
    isTestHarness: false
  };

  public identify(): ExternalKernelIdentity {
    return this.identity;
  }

  public getVersion(): string {
    return 'UNAVAILABLE';
  }

  public isAvailable(): boolean {
    return false;
  }

  public getStatus(): ExternalKernelStatus {
    return 'UNAVAILABLE';
  }

  public importSTEP(_stepContent: string): ExternalImportResult {
    return {
      success: false,
      importedEntityCount: 0,
      healingOperationsApplied: [],
      toleranceAdjustments: {},
      unsupportedEntities: [],
      warnings: [],
      errors: ['External CAD kernel is UNAVAILABLE in this environment']
    };
  }

  public exportSTEP(_handle: any): ExternalExportResult {
    return {
      success: false,
      stepContent: '',
      stepArtifactHash: '',
      stepByteLength: 0,
      exportedEntityCount: 0,
      healingOperations: [],
      warnings: [],
      errors: ['External CAD kernel is UNAVAILABLE in this environment']
    };
  }

  public executeRoundTrip(_stepContent: string): ExternalRoundTripResult {
    const timestamp = new Date().toISOString();
    return {
      success: false,
      outputStepContent: '',
      importEvidence: {
        timestamp,
        kernelIdentity: this.identify(),
        importSuccess: false,
        importedEntityCount: 0,
        healingOperationsApplied: [],
        toleranceAdjustments: {},
        unsupportedEntities: [],
        warnings: [],
        errors: ['External CAD kernel is UNAVAILABLE in this environment']
      },
      exportEvidence: {
        timestamp,
        kernelIdentity: this.identify(),
        exportSuccess: false,
        exporterVersion: 'UNAVAILABLE',
        stepSchema: 'UNAVAILABLE',
        stepArtifactHash: '',
        stepByteLength: 0,
        stepContent: '',
        exportedEntityCount: 0,
        healingOperations: [],
        warnings: [],
        errors: ['External CAD kernel is UNAVAILABLE in this environment']
      }
    };
  }
}

/**
 * Controlled Pipeline Test Adapter.
 * Explicitly flagged as `isTestHarness: true`.
 * Used ONLY to verify test harness & difference mechanics.
 * Gate will strictly recognize this and NEVER grant genuine PASS with this adapter.
 */
export class TestExternalCADKernelAdapter implements IExternalCADKernelAdapter {
  private readonly identity: ExternalKernelIdentity;
  private readonly simulateHealing: boolean;
  private readonly simulateLoss: boolean;

  constructor(options?: {
    kernelName?: string;
    version?: string;
    simulateHealing?: boolean;
    simulateLoss?: boolean;
  }) {
    this.identity = {
      kernelName: options?.kernelName || 'TEST_SIMULATED_CAD_KERNEL',
      vendor: 'SECP_TEST_HARNESS',
      version: options?.version || '1.0.0-TEST',
      build: 'TEST_BUILD_001',
      platform: 'NODE_TEST_RUNTIME',
      importerVersion: 'TEST_STEP_IN_1.0',
      exporterVersion: 'TEST_STEP_OUT_1.0',
      isTestHarness: true,
      configuration: {
        linearTolerance: 1e-6,
        angularTolerance: 1e-6,
        units: 'MILLIMETRE',
        healingEnabled: options?.simulateHealing ?? false
      }
    };
    this.simulateHealing = options?.simulateHealing ?? false;
    this.simulateLoss = options?.simulateLoss ?? false;
  }

  public identify(): ExternalKernelIdentity {
    return this.identity;
  }

  public getVersion(): string {
    return this.identity.version;
  }

  public isAvailable(): boolean {
    return true;
  }

  public getStatus(): ExternalKernelStatus {
    return 'AVAILABLE';
  }

  public importSTEP(stepContent: string): ExternalImportResult {
    const warnings: string[] = [];
    const healingOperations: string[] = [];

    if (this.simulateHealing) {
      healingOperations.push('FACE_TOLERANCE_HEALING');
      healingOperations.push('SEWING_COINCIDENT_VERTICES');
      warnings.push('Simulated healing modified edge boundary tolerances');
    }

    try {
      const parsed = STEPAP242Translator.importFromStepPart21(stepContent);
      let entityCount = parsed.solids.length;
      for (const s of parsed.solids) {
        entityCount += (s.faces?.length || 0) + (s.edges?.length || 0) + (s.vertices?.length || 0);
      }

      return {
        success: true,
        importedEntityCount: entityCount,
        healingOperationsApplied: healingOperations,
        toleranceAdjustments: this.simulateHealing ? { linear: 1e-5 } : {},
        unsupportedEntities: [],
        warnings,
        errors: [],
        nativeHandle: { model: parsed, rawStep: stepContent }
      };
    } catch (e: any) {
      return {
        success: false,
        importedEntityCount: 0,
        healingOperationsApplied: [],
        toleranceAdjustments: {},
        unsupportedEntities: [],
        warnings: [],
        errors: [e.message || 'Failed to import STEP']
      };
    }
  }

  public exportSTEP(handle: any): ExternalExportResult {
    if (!handle?.model) {
      return {
        success: false,
        stepContent: '',
        stepArtifactHash: '',
        stepByteLength: 0,
        exportedEntityCount: 0,
        healingOperations: [],
        warnings: [],
        errors: ['Invalid handle provided for export']
      };
    }

    try {
      const model: AP242SemanticModel = handle.model;
      let exportedContent = STEPAP242Translator.exportToStepPart21(model);

      if (this.simulateLoss) {
        // Simulate an external kernel dropping metadata or altering entity order
        exportedContent = exportedContent.replace(/SECP Exported/g, 'External Cad Kernel 3D');
      }

      const stepArtifactHash = crypto.createHash('sha256').update(exportedContent, 'utf8').digest('hex');

      return {
        success: true,
        stepContent: exportedContent,
        stepArtifactHash,
        stepByteLength: Buffer.byteLength(exportedContent, 'utf8'),
        exportedEntityCount: model.solids.length,
        healingOperations: [],
        warnings: [],
        errors: []
      };
    } catch (e: any) {
      return {
        success: false,
        stepContent: '',
        stepArtifactHash: '',
        stepByteLength: 0,
        exportedEntityCount: 0,
        healingOperations: [],
        warnings: [],
        errors: [e.message || 'Failed to export STEP']
      };
    }
  }

  public executeRoundTrip(stepContent: string): ExternalRoundTripResult {
    const importRes = this.importSTEP(stepContent);
    const timestamp = new Date().toISOString();

    const importEvidence: ExternalImportEvidence = {
      timestamp,
      kernelIdentity: this.identify(),
      importSuccess: importRes.success,
      importedEntityCount: importRes.importedEntityCount,
      healingOperationsApplied: importRes.healingOperationsApplied,
      toleranceAdjustments: importRes.toleranceAdjustments,
      unsupportedEntities: importRes.unsupportedEntities,
      warnings: importRes.warnings,
      errors: importRes.errors,
      nativeHandle: importRes.nativeHandle
    };

    if (!importRes.success) {
      return {
        success: false,
        outputStepContent: '',
        importEvidence,
        exportEvidence: {
          timestamp,
          kernelIdentity: this.identify(),
          exportSuccess: false,
          exporterVersion: this.identity.exporterVersion,
          stepSchema: 'ISO-10303-242',
          stepArtifactHash: '',
          stepByteLength: 0,
          stepContent: '',
          exportedEntityCount: 0,
          healingOperations: [],
          warnings: [],
          errors: ['Export skipped due to import failure']
        }
      };
    }

    const exportRes = this.exportSTEP(importRes.nativeHandle);

    const exportEvidence: ExternalExportEvidence = {
      timestamp: new Date().toISOString(),
      kernelIdentity: this.identify(),
      exportSuccess: exportRes.success,
      exporterVersion: this.identity.exporterVersion,
      stepSchema: 'ISO-10303-242',
      stepArtifactHash: exportRes.stepArtifactHash,
      stepByteLength: exportRes.stepByteLength,
      stepContent: exportRes.stepContent,
      exportedEntityCount: exportRes.exportedEntityCount,
      healingOperations: exportRes.healingOperations,
      warnings: exportRes.warnings,
      errors: exportRes.errors
    };

    return {
      success: importRes.success && exportRes.success,
      outputStepContent: exportRes.stepContent,
      importEvidence,
      exportEvidence
    };
  }
}
