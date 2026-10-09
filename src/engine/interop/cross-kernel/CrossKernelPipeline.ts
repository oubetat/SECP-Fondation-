/**
 * SECP Industrial OS v2 — Cross-Kernel Round-Trip Pipeline
 * PATCH-040: Industrial CAD Interoperability & Loss Measurement
 * 
 * Orchestrates the full round-trip verification pipeline:
 * SECP -> STEP AP242 -> External CAD -> STEP AP242 -> SECP
 */

import { NativeSECPDocument } from '../native-secp/NativeSECPTypes';
import { NativeSECPReader } from '../native-secp/NativeSECPReader';
import { NativeSECPInteroperabilityBridge } from '../native-secp/NativeSECPInteroperabilityBridge';
import { IExternalCADKernelAdapter, NullExternalCADKernelAdapter } from './ExternalCADKernelAdapter';
import { CrossKernelSourceExtractor } from './CrossKernelSourceExtractor';
import { CrossKernelComparator } from './CrossKernelComparator';
import {
  CrossKernelEvidencePackage,
  CrossKernelExecutionOptions,
  CrossKernelVerdict,
  ExportEvidence,
  RoundtripEvidence,
  IdentityMappingEntry,
  ProvenanceTransition
} from './CrossKernelTypes';
import { HardAcceptanceGateCrossKernel } from './verification/HardAcceptanceGateCrossKernel';
import * as crypto from 'crypto';

export class CrossKernelPipeline {

  public static async execute(
    sourceDoc: NativeSECPDocument,
    adapter: IExternalCADKernelAdapter = new NullExternalCADKernelAdapter(),
    options?: CrossKernelExecutionOptions
  ): Promise<CrossKernelEvidencePackage> {
    const timestamp = new Date().toISOString();
    const packageId = `EVID_PKG_${crypto.randomBytes(8).toString('hex')}`;
    const provenanceChain: ProvenanceTransition[] = [];

    // Stage 1: Validate and Extract Source Baseline
    const srcValidation = NativeSECPReader.read(sourceDoc);
    const sourceBaseline = CrossKernelSourceExtractor.extractBaseline(sourceDoc);
    const sourceArtifactHash = crypto.createHash('sha256').update(JSON.stringify(sourceDoc), 'utf8').digest('hex');

    provenanceChain.push({
      step: 'SOURCE_NATIVE',
      timestamp: sourceDoc.header.createdAt || timestamp,
      operation: 'INITIALIZE_SOURCE_BASELINE',
      authorOrSystem: sourceDoc.header.generator || 'SECP Native Kernel',
      inputArtifactHash: undefined,
      outputArtifactHash: sourceArtifactHash,
      details: { canonicalHash: sourceBaseline.canonicalHash }
    });

    // Stage 2: SECP -> STEP AP242 Export
    const exportResult = NativeSECPInteroperabilityBridge.nativeToStepAP242(sourceDoc);
    const stepExportHash = crypto.createHash('sha256').update(exportResult.stepContent, 'utf8').digest('hex');

    const exportEvidence: ExportEvidence = {
      timestamp: new Date().toISOString(),
      exporterVersion: 'SECP_STEP_AP242_EXP_v1.0.0',
      schemaVersion: 'ISO-10303-242:2020',
      sourceCanonicalHash: sourceBaseline.canonicalHash,
      stepArtifactHash: stepExportHash,
      stepByteLength: Buffer.byteLength(exportResult.stepContent, 'utf8'),
      stepContent: exportResult.stepContent,
      ap242Model: exportResult.ap242Model,
      mappedEntitiesCount: exportResult.mappedEntitiesCount,
      warnings: exportResult.diagnostics.filter(d => d.severity === 'WARNING' || d.severity === 'INFO').map(d => d.message),
      errors: exportResult.diagnostics.filter(d => d.severity === 'ERROR' || d.severity === 'CRITICAL').map(d => d.message)
    };

    provenanceChain.push({
      step: 'STEP_EXPORT',
      timestamp: exportEvidence.timestamp,
      operation: 'EXPORT_NATIVE_TO_STEP_AP242',
      authorOrSystem: 'SECP Interoperability Bridge',
      inputArtifactHash: sourceArtifactHash,
      outputArtifactHash: stepExportHash,
      details: { mappedEntities: exportResult.mappedEntitiesCount }
    });

    // Stage 3: External CAD Kernel Execution
    const kernelStatus = adapter.getStatus();
    const kernelIdentity = adapter.identify();

    if (kernelStatus !== 'AVAILABLE' || !adapter.isAvailable()) {
      // Rule: If no external kernel is available, return UNPROVEN
      const roundTripResult = await adapter.executeRoundTrip(exportResult.stepContent);
      const emptyRoundtripDoc: NativeSECPDocument = {
        header: sourceDoc.header,
        identity: sourceDoc.identity,
        model: { geometry: { points: [], analyticCurves: [], nurbsCurves: [], analyticSurfaces: [], nurbsSurfaces: [] }, topology: { vertices: [], edges: [], loops: [], faces: [], shells: [], solids: [] }, features: { features: [], executionOrder: [], isValid: true }, sketches: [], assemblies: { nodes: [], instances: [], mates: [] } },
        manufacturing: { features: [], toolpaths: [], metadata: {} },
        provenance: { source: 'UNAVAILABLE', operations: [], revisions: [], graphNodes: [], graphEdges: [] },
        integrity: { canonicalHash: '', artifactHash: '', integrityStatus: 'UNVERIFIED', hashAlgorithm: 'SHA-256', canonicalizationVersion: '1.0.0', evidenceReferences: [] },
        compatibility: { diagnostics: [] }
      };

      const diffReport = CrossKernelComparator.compare(sourceBaseline, emptyRoundtripDoc, {
        externalKernelName: kernelIdentity.kernelName
      });

      const emptyPkg: CrossKernelEvidencePackage = {
        packageId,
        timestamp,
        sourceArtifactHash,
        sourceCanonicalHash: sourceBaseline.canonicalHash,
        sourceBaseline,
        externalKernelIdentity: kernelIdentity,
        externalKernelStatus: 'UNAVAILABLE',
        exportEvidence,
        externalImportEvidence: roundTripResult.importEvidence,
        externalExportEvidence: roundTripResult.exportEvidence,
        roundtripEvidence: {
          timestamp: new Date().toISOString(),
          importerVersion: 'UNAVAILABLE',
          document: emptyRoundtripDoc,
          canonicalHash: '',
          stepArtifactHash: '',
          structuralValid: false,
          topologyValid: false,
          geometryValid: false,
          warnings: ['External CAD kernel is unavailable in runtime environment'],
          errors: ['EXTERNAL_CAD_KERNEL_UNAVAILABLE']
        },
        differenceReport: diffReport,
        identityMapping: [],
        provenanceChain,
        verdict: 'UNPROVEN',
        verdictReason: 'External CAD kernel is UNAVAILABLE in this environment. Verdict is strictly UNPROVEN per Step 26.'
      };

      return emptyPkg;
    }

    const roundTripResult = await adapter.executeRoundTrip(exportResult.stepContent);

    provenanceChain.push({
      step: 'EXTERNAL_IMPORT',
      timestamp: roundTripResult.importEvidence.timestamp,
      operation: 'IMPORT_STEP_INTO_EXTERNAL_KERNEL',
      authorOrSystem: `${kernelIdentity.vendor} ${kernelIdentity.kernelName} v${kernelIdentity.version}`,
      inputArtifactHash: stepExportHash,
      outputArtifactHash: undefined,
      details: {
        importedEntities: roundTripResult.importEvidence.importedEntityCount,
        healing: roundTripResult.importEvidence.healingOperationsApplied
      }
    });

    provenanceChain.push({
      step: 'EXTERNAL_EXPORT',
      timestamp: roundTripResult.exportEvidence.timestamp,
      operation: 'EXPORT_STEP_FROM_EXTERNAL_KERNEL',
      authorOrSystem: `${kernelIdentity.vendor} ${kernelIdentity.kernelName} v${kernelIdentity.version}`,
      inputArtifactHash: undefined,
      outputArtifactHash: roundTripResult.exportEvidence.stepArtifactHash,
      details: {
        exportedEntities: roundTripResult.exportEvidence.exportedEntityCount
      }
    });

    // Stage 4: STEP AP242 -> SECP Native Re-import
    const reImportResult = NativeSECPInteroperabilityBridge.stepAP242ToNative(
      roundTripResult.outputStepContent,
      {
        objectId: `${sourceDoc.identity.engineeringObjectId}-RT`,
        revisionId: sourceDoc.identity.revisionId
      }
    );

    const roundtripDoc = reImportResult.document;
    const rtValidation = NativeSECPReader.read(roundtripDoc);

    const roundtripEvidence: RoundtripEvidence = {
      timestamp: new Date().toISOString(),
      importerVersion: 'SECP_STEP_AP242_IMP_v1.0.0',
      document: roundtripDoc,
      canonicalHash: roundtripDoc.integrity.canonicalHash,
      stepArtifactHash: roundTripResult.exportEvidence.stepArtifactHash,
      structuralValid: rtValidation.success,
      topologyValid: rtValidation.entityCoverage.invalid === 0,
      geometryValid: (roundtripDoc.model.topology.solids || []).length > 0,
      warnings: reImportResult.diagnostics.filter(d => d.severity === 'WARNING' || d.severity === 'INFO').map(d => d.message),
      errors: reImportResult.diagnostics.filter(d => d.severity === 'ERROR' || d.severity === 'CRITICAL').map(d => d.message)
    };

    provenanceChain.push({
      step: 'STEP_IMPORT',
      timestamp: roundtripEvidence.timestamp,
      operation: 'REIMPORT_STEP_TO_NATIVE_SECP',
      authorOrSystem: 'SECP Interoperability Bridge',
      inputArtifactHash: roundTripResult.exportEvidence.stepArtifactHash,
      outputArtifactHash: roundtripDoc.integrity.canonicalHash,
      details: {
        solids: (roundtripDoc.model.topology.solids || []).length,
        faces: (roundtripDoc.model.topology.faces || []).length
      }
    });

    // Stage 5: Deep Comparative Differential Analysis
    const differenceReport = CrossKernelComparator.compare(sourceBaseline, roundtripDoc, {
      customLinearTolerance: options?.customLinearTolerance,
      customAngularTolerance: options?.customAngularTolerance,
      externalKernelName: kernelIdentity.kernelName
    });

    // Identity Mapping
    const identityMapping: IdentityMappingEntry[] = [
      {
        sourceId: sourceDoc.identity.engineeringObjectId,
        sourceType: 'PART_DOCUMENT',
        externalId: undefined,
        roundtripId: roundtripDoc.identity.engineeringObjectId,
        status: sourceDoc.identity.engineeringObjectId === roundtripDoc.identity.engineeringObjectId ? 'PRESERVED' : 'MAPPED'
      }
    ];

    for (const solid of sourceDoc.model.topology.solids || []) {
      const matchRt = (roundtripDoc.model.topology.solids || []).find(r => r.id === solid.id || r.name === solid.name);
      identityMapping.push({
        sourceId: solid.id,
        sourceType: 'SOLID',
        roundtripId: matchRt ? matchRt.id : 'RECONSTRUCTED_SOLID',
        status: matchRt ? 'PRESERVED' : 'MAPPED'
      });
    }

    provenanceChain.push({
      step: 'ROUNDTRIP_VERIFICATION',
      timestamp: new Date().toISOString(),
      operation: 'MULTI_DOMAIN_DIFFERENTIAL_ANALYSIS',
      authorOrSystem: 'CrossKernelComparator Engine',
      inputArtifactHash: roundtripDoc.integrity.canonicalHash,
      outputArtifactHash: undefined,
      details: {
        totalDifferences: differenceReport.totalDifferences,
        criticalLosses: differenceReport.criticalCount
      }
    });

    // Final Gate Evaluation
    const pkg: CrossKernelEvidencePackage = {
      packageId,
      timestamp,
      sourceArtifactHash,
      sourceCanonicalHash: sourceBaseline.canonicalHash,
      sourceBaseline,
      externalKernelIdentity: kernelIdentity,
      externalKernelStatus: kernelStatus,
      exportEvidence,
      externalImportEvidence: roundTripResult.importEvidence,
      externalExportEvidence: roundTripResult.exportEvidence,
      roundtripEvidence,
      differenceReport,
      identityMapping,
      provenanceChain,
      verdict: 'UNPROVEN',
      verdictReason: ''
    };

    const gateEvaluation = HardAcceptanceGateCrossKernel.evaluate(pkg);
    pkg.verdict = gateEvaluation.verdict;
    pkg.verdictReason = gateEvaluation.reason;

    return pkg;
  }
}
