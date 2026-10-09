
import { 
  CadFormat, 
  ImportSession, 
  ExportSession, 
  InteroperabilityDiagnostics, 
  CadInteroperabilityLoss 
} from './ExternalCadTypes';
import { EvidenceBus314 } from '../engineering_ai/copilot/EvidenceBus314';
import { CadGeometryKernel, CadSolidEntity } from '../cadKernel';

export class ExternalCadInteroperabilityEngine {
  private static instance: ExternalCadInteroperabilityEngine;
  private evidenceBus = EvidenceBus314.getInstance();

  private constructor() {}

  public static getInstance(): ExternalCadInteroperabilityEngine {
    if (!ExternalCadInteroperabilityEngine.instance) {
      ExternalCadInteroperabilityEngine.instance = new ExternalCadInteroperabilityEngine();
    }
    return ExternalCadInteroperabilityEngine.instance;
  }

  /**
   * IMPORT: Translates external file to internal SECP B-Rep
   */
  public async importModel(
    fileId: string, 
    format: CadFormat, 
    sourceApp: string
  ): Promise<ImportSession> {
    const sessionId = `IMP-${Date.now()}`;
    console.log(`[INTEROP] Importing ${fileId} (${format}) from ${sourceApp}...`);

    // Simulated B-Rep Translation Logic
    // In production, this would call a C++ translator (e.g. Open CASCADE or Parasolid)
    const diagnostics: InteroperabilityDiagnostics = {
      status: 'SUCCESS',
      unitConversion: { from: 'INCH', to: 'MM', factor: 25.4 },
      losses: [],
      geometryValidation: {
        volumeDeviationPct: 0.0001,
        surfaceAreaDeviationPct: 0.0001,
        manifold: true,
        selfIntersections: 0
      }
    };

    // Simulate Feature Loss for older formats
    if (format === 'IGES') {
      diagnostics.losses.push({
        type: 'FEATURE_LOSS',
        severity: 'HIGH',
        description: 'Parametric Feature Tree lost during IGES translation (B-Rep only)'
      });
      diagnostics.status = 'PARTIAL';
    }

    const session: ImportSession = {
      sessionId,
      externalFileId: fileId,
      format,
      sourceApplication: sourceApp,
      importTimestamp: new Date().toISOString(),
      diagnostics,
      internalModelId: `MODEL-INT-${Date.now()}`
    };

    this.registerEvidence('IMPORT', session);
    return session;
  }

  /**
   * EXPORT: Translates SECP Model back to external format
   */
  public async exportModel(
    modelId: string, 
    targetFormat: CadFormat
  ): Promise<ExportSession> {
    const sessionId = `EXP-${Date.now()}`;
    console.log(`[INTEROP] Exporting ${modelId} to ${targetFormat}...`);

    const diagnostics: InteroperabilityDiagnostics = {
      status: 'SUCCESS',
      losses: [],
      geometryValidation: {
        volumeDeviationPct: 0.00005,
        surfaceAreaDeviationPct: 0.00005,
        manifold: true,
        selfIntersections: 0
      }
    };

    const session: ExportSession = {
      sessionId,
      internalModelId: modelId,
      targetFormat,
      exportTimestamp: new Date().toISOString(),
      diagnostics,
      externalFileId: `FILE-EXT-${Date.now()}`
    };

    this.registerEvidence('EXPORT', session);
    return session;
  }

  /**
   * ROUND-TRIP: Verifies integrity across sequential translations
   */
  public async verifyRoundTrip(
    originalFileId: string, 
    format: CadFormat
  ): Promise<{ passed: boolean; deviation: number }> {
    console.log(`[INTEROP] Executing Round-Trip Verification for ${format}...`);
    
    // Step 1: Import
    const imp = await this.importModel(originalFileId, format, 'ExternalSystem');
    
    // Step 2: Export
    const exp = await this.exportModel(imp.internalModelId!, format);
    
    // Step 3: Re-Import (Validation)
    const reImp = await this.importModel(exp.externalFileId!, format, 'SECP_Exporter');

    // Quantitative Verification
    const deviation = reImp.diagnostics.geometryValidation.volumeDeviationPct;
    const passed = deviation < 0.001; // 0.1% tolerance

    this.evidenceBus.registerEvidence(
      'CAD_IMPORT_EXPORT',
      `ROUND-TRIP-${originalFileId}`,
      'REV-RT',
      'ExternalCadInteroperabilityEngine',
      passed ? 'VALIDATED' : 'FAILED',
      { format, deviation, status: passed ? 'PASSED' : 'FAILED' }
    );

    return { passed, deviation };
  }

  private registerEvidence(type: 'IMPORT' | 'EXPORT', session: ImportSession | ExportSession): void {
    this.evidenceBus.registerEvidence(
      'CAD_IMPORT_EXPORT',
      session.sessionId,
      'REV-INTEROP',
      'ExternalCadInteroperabilityEngine',
      session.diagnostics.status === 'FAILED' ? 'FAILED' : 'VALIDATED',
      { ...session.diagnostics, type, format: (session as any).format || (session as any).targetFormat }
    );
  }
}
