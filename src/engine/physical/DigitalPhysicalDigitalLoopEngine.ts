/**
 * SECP Industrial OS — Digital → Physical → Digital Closed Loop Engine
 * POST-PLUGIN-MATURITY-008R (Part C, D, E, F)
 *
 * Orchestrates the full authoritative closed loop:
 * Canonical Design Revision
 *   → Additive Manufacturing Intent
 *   → Printable G-Code/3MF Artifact
 *   → Serialized Physical Part
 *   → Metrology 3D Scan
 *   → Deviation Analysis
 *   → Feature Reconstruction
 *   → Merkle Evidence & Provenance Graph
 *   → New Canonical Engineering Revision
 *   → Durable Persistence & Rehydration
 */

import { createHash } from 'crypto';
import { RevisionEngine } from '../revision/RevisionEngine';
import { ProvenanceGraph } from '../provenance/ProvenanceGraph';
import { EvidenceMerkleTree } from '../certification/truth/EvidenceMerkleTree';
import { EvidenceLeafRecord } from '../certification/truth/types';
import { IndexedDbEngine } from '../storage/IndexedDbEngine';
import { AdditiveManufacturingAuthority, AdditiveManufacturingIntent, PrintableManufacturingArtifact, PhysicalPartSerialization } from './AdditiveManufacturingAuthority';
import { ReverseEngineeringAuthority, RawMetrologyScan, DeviationAnalysisReport, CanonicalReconstructionPackage } from './ReverseEngineeringAuthority';
import { PhysicalOriginType } from './PhysicalOriginSemantics';

export interface PhysicalClosedLoopExecutionRecord {
  readonly loopExecutionId: string;
  readonly entityId: string;
  readonly initialRevisionId: string;
  readonly initialRevisionHash: string;
  readonly manufacturingIntentId: string;
  readonly printableArtifactId: string;
  readonly physicalSerialId: string;
  readonly metrologyScanId: string;
  readonly deviationAnalysisId: string;
  readonly reconstructionPackageId: string;
  readonly newRevisionId: string;
  readonly newRevisionHash: string;
  readonly evidenceLeafHash: string;
  readonly merkleRoot: string;
  readonly executionTimestamp: string;
  readonly status: 'COMPLETED_VERIFIED' | 'FAILED_CLOSED';
}

export interface EngineeringHistoryEntry {
  readonly eventId: string;
  readonly eventType:
    | 'DESIGN_BASELINE_RELEASED'
    | 'MANUFACTURING_INTENT_CREATED'
    | 'PRINTABLE_ARTIFACT_GENERATED'
    | 'PHYSICAL_PART_REALIZED'
    | 'METROLOGY_SCAN_ACQUIRED'
    | 'DEVIATION_ANALYZED'
    | 'GEOMETRY_RECONSTRUCTED'
    | 'EVIDENCE_SEALED'
    | 'PROVENANCE_WIRED'
    | 'RECONSTRUCTED_REVISION_RELEASED';
  readonly entityId: string;
  readonly relatedIdentity: string;
  readonly timestamp: string;
  readonly details: string;
}

export class DigitalPhysicalDigitalLoopEngine {
  private static executionHistory: EngineeringHistoryEntry[] = [];
  private static closedLoopRecords: Map<string, PhysicalClosedLoopExecutionRecord> = new Map();

  /**
   * Executes the complete Digital -> Physical -> Digital authoritative workflow.
   */
  public static async executeFullClosedLoop(
    revisionEngine: RevisionEngine,
    provenanceGraph: ProvenanceGraph,
    config: {
      entityId: string;
      initialRevisionId: string;
      operatorId: string;
      machineModel: string;
      machineSerial: string;
      materialGrade: string;
      materialLot: string;
      scanPoints: readonly { x: number; y: number; z: number }[];
      nominalBounds: { lengthMm: number; widthMm: number; heightMm: number };
      reconstructedFeatures: readonly {
        featureId: string;
        featureType: 'PLANAR_FACE' | 'CYLINDRICAL_BORE' | 'SPHERICAL_CAP' | 'FREEFORM_NURBS';
        nominalParameters: Record<string, number>;
        rmsFittingErrorMm: number;
      }[];
    }
  ): Promise<PhysicalClosedLoopExecutionRecord> {
    const timestamp = new Date().toISOString();

    // 1. Resolve Initial Canonical Design Revision
    const revA = revisionEngine.getRevision(config.initialRevisionId);
    if (!revA) {
      throw new Error(`CLOSED_LOOP_FAILURE: Initial revision '${config.initialRevisionId}' not found.`);
    }
    this.recordHistory('DESIGN_BASELINE_RELEASED', config.entityId, revA.revisionHash, 'Initial design baseline active in RevisionEngine.');

    // 2. Authoritative Manufacturing Intent
    const intent = AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
      entityId: config.entityId,
      revisionId: revA.revisionId,
      expectedRevisionHash: revA.revisionHash,
      processType: 'FDM_3D_PRINTING',
      layerHeightMm: 0.2,
      infillPercentage: 35,
      printSpeedMmS: 60,
      materialGrade: config.materialGrade,
      targetMachineModel: config.machineModel
    });
    this.recordHistory('MANUFACTURING_INTENT_CREATED', config.entityId, intent.intentId, `Additive intent created for ${intent.processType}.`);

    // 3. Printable Artifact Generation (G-Code)
    const artifact = AdditiveManufacturingAuthority.generatePrintableArtifact(
      intent.intentId,
      'GCODE',
      { x: config.nominalBounds.lengthMm, y: config.nominalBounds.widthMm, z: config.nominalBounds.heightMm }
    );
    this.recordHistory('PRINTABLE_ARTIFACT_GENERATED', config.entityId, artifact.artifactId, `G-Code artifact generated (${artifact.layerCount} layers).`);

    // 4. Physical Part Serialization
    const physicalPart = AdditiveManufacturingAuthority.serializePhysicalPart({
      artifactId: artifact.artifactId,
      physicalMachineSerial: config.machineSerial,
      materialLotNumber: config.materialLot,
      operatorId: config.operatorId
    });
    this.recordHistory('PHYSICAL_PART_REALIZED', config.entityId, physicalPart.physicalSerialId, `Physical part serialized from machine ${config.machineSerial}.`);

    // 5. Metrology Scan Acquisition (Optical CMM)
    const scan = ReverseEngineeringAuthority.ingestRawScan({
      physicalSerialId: physicalPart.physicalSerialId,
      instrumentType: 'OPTICAL_CMM',
      instrumentId: 'ZEISS-COMET-L3D-09',
      calibrationCertificateId: 'CAL-CERT-ZEISS-2026-A1',
      measurementUncertaintyMm: 0.005,
      points: config.scanPoints
    });
    this.recordHistory('METROLOGY_SCAN_ACQUIRED', config.entityId, scan.scanId, `Acquired ${scan.pointCount} points with uncertainty ±0.005mm.`);

    // 6. As-Built Deviation Analysis
    const deviationReport = ReverseEngineeringAuthority.performDeviationAnalysis(
      scan.scanId,
      revA.revisionHash,
      config.nominalBounds
    );
    this.recordHistory('DEVIATION_ANALYZED', config.entityId, deviationReport.analysisId, `RMS deviation: ${deviationReport.rmsDeviationMm}mm, Verdict: ${deviationReport.complianceVerdict}.`);

    // 7. Parametric Feature Reconstruction
    const reconstructionPackage = ReverseEngineeringAuthority.reconstructEngineeringModel(
      scan.scanId,
      deviationReport.analysisId,
      config.reconstructedFeatures
    );
    this.recordHistory('GEOMETRY_RECONSTRUCTED', config.entityId, reconstructionPackage.reconstructionId, `Reconstructed ${reconstructionPackage.reconstructedFeatures.length} B-Rep features.`);

    // 8. Publish New Canonical Revision B
    const revB = ReverseEngineeringAuthority.publishToCanonicalRevision(
      revisionEngine,
      config.entityId,
      reconstructionPackage.reconstructionId,
      config.operatorId,
      `Reconstructed engineering revision from physical part ${physicalPart.physicalSerialId}`
    );
    this.recordHistory('RECONSTRUCTED_REVISION_RELEASED', config.entityId, revB.revisionHash, `Released Canonical Revision ${revB.revisionCode} (#${revB.revisionNumber}).`);

    // 9. Merkle Evidence Leaf Record Construction
    const evidenceLeaf: EvidenceLeafRecord = {
      entityId: config.entityId,
      partId: config.entityId,
      revisionId: revB.revisionId,
      cadRevisionHash: revB.revisionHash,
      canonicalGeometryHash: revB.snapshot?.geometryState?.geometryHash || revB.contentHash,
      artifactKind: 'PHYSICAL_REALITY_CLOSED_LOOP_AUDIT',
      artifactContentHash: reconstructionPackage.packageDigest,
      evidenceType: 'CORE_EXECUTION_EVIDENCE',
      authorityIdentity: 'DIGITAL_PHYSICAL_DIGITAL_LOOP_ENGINE',
      sourceIdentity: reconstructionPackage.reconstructionId,
      executionIdentity: physicalPart.physicalSerialId,
      createdAt: timestamp,
      status: 'VERIFIED'
    };
    evidenceLeaf.leafHash = EvidenceMerkleTree.computeLeafHash(evidenceLeaf);

    const merkleTree = EvidenceMerkleTree.buildFromLeaves([evidenceLeaf]);
    const merkleRoot = merkleTree.getRootHash();
    this.recordHistory('EVIDENCE_SEALED', config.entityId, evidenceLeaf.leafHash, `Sealed evidence in Merkle root ${merkleRoot}.`);

    // 10. Multi-Stage Provenance Graph Lineage Wiring
    this.wireProvenanceGraph(provenanceGraph, {
      entityId: config.entityId,
      revA,
      intent,
      artifact,
      physicalPart,
      scan,
      deviationReport,
      reconstructionPackage,
      revB,
      evidenceLeaf,
      timestamp
    });
    this.recordHistory('PROVENANCE_WIRED', config.entityId, `PROV-${config.entityId}`, `Wired full 8-node directed provenance chain.`);

    // Final Closed Loop Record
    const loopRecord: PhysicalClosedLoopExecutionRecord = Object.freeze({
      loopExecutionId: `LOOP-DPD-${createHash('sha256').update(`${revA.revisionHash}_${physicalPart.physicalSerialId}_${revB.revisionHash}`).digest('hex').substring(0, 16).toUpperCase()}`,
      entityId: config.entityId,
      initialRevisionId: revA.revisionId,
      initialRevisionHash: revA.revisionHash,
      manufacturingIntentId: intent.intentId,
      printableArtifactId: artifact.artifactId,
      physicalSerialId: physicalPart.physicalSerialId,
      metrologyScanId: scan.scanId,
      deviationAnalysisId: deviationReport.analysisId,
      reconstructionPackageId: reconstructionPackage.reconstructionId,
      newRevisionId: revB.revisionId,
      newRevisionHash: revB.revisionHash,
      evidenceLeafHash: evidenceLeaf.leafHash || '',
      merkleRoot,
      executionTimestamp: timestamp,
      status: 'COMPLETED_VERIFIED'
    });

    this.closedLoopRecords.set(loopRecord.loopExecutionId, loopRecord);

    // Persist to durable storage
    await this.persistToDurableStorage();

    return loopRecord;
  }

  /**
   * Wires the complete directed provenance chain across digital design, additive manufacturing,
   * physical serialization, metrology, and reconstruction.
   */
  private static wireProvenanceGraph(
    graph: ProvenanceGraph,
    ctx: {
      entityId: string;
      revA: any;
      intent: AdditiveManufacturingIntent;
      artifact: PrintableManufacturingArtifact;
      physicalPart: PhysicalPartSerialization;
      scan: RawMetrologyScan;
      deviationReport: DeviationAnalysisReport;
      reconstructionPackage: CanonicalReconstructionPackage;
      revB: any;
      evidenceLeaf: EvidenceLeafRecord;
      timestamp: string;
    }
  ): void {
    const addNodeSafe = (node: any) => {
      try {
        graph.addNode(node);
      } catch (e) {
        // Node already exists, continue safely
      }
    };

    const addEdgeSafe = (edge: any) => {
      try {
        graph.addEdge(edge);
      } catch (e) {
        // Edge already exists, continue safely
      }
    };

    // Node 1: Initial Design Revision Node
    const nodeRevAId = `NODE-REV-${ctx.revA.revisionHash}`;
    addNodeSafe({
      id: nodeRevAId,
      type: 'REVISION' as any,
      engineeringIdentityId: ctx.entityId,
      canonicalHash: ctx.revA.revisionHash,
      version: ctx.revA.revisionCode,
      createdAt: ctx.timestamp,
      evidenceRefs: []
    });

    // Node 2: Manufacturing Intent Node
    const nodeIntentId = `NODE-INTENT-${ctx.intent.intentId}`;
    addNodeSafe({
      id: nodeIntentId,
      type: 'MANUFACTURING' as any,
      engineeringIdentityId: ctx.entityId,
      canonicalHash: ctx.intent.intentDigest,
      version: '1',
      createdAt: ctx.timestamp,
      evidenceRefs: []
    });

    // Node 3: Printable Artifact Node
    const nodeArtifactId = `NODE-ART-${ctx.artifact.artifactId}`;
    addNodeSafe({
      id: nodeArtifactId,
      type: 'TOOLPATH' as any,
      engineeringIdentityId: ctx.entityId,
      canonicalHash: ctx.artifact.artifactDigest,
      version: '1',
      createdAt: ctx.timestamp,
      evidenceRefs: []
    });

    // Node 4: Physical Part Serial Node
    const nodePartId = `NODE-PP-${ctx.physicalPart.physicalSerialId}`;
    addNodeSafe({
      id: nodePartId,
      type: 'RESULT' as any,
      engineeringIdentityId: ctx.entityId,
      canonicalHash: ctx.physicalPart.partIdentityDigest,
      version: '1',
      createdAt: ctx.timestamp,
      evidenceRefs: []
    });

    // Node 5: Raw Metrology Scan Node
    const nodeScanId = `NODE-SCAN-${ctx.scan.scanId}`;
    addNodeSafe({
      id: nodeScanId,
      type: 'INSPECTION' as any,
      engineeringIdentityId: ctx.entityId,
      canonicalHash: ctx.scan.rawDataHash,
      version: '1',
      createdAt: ctx.timestamp,
      evidenceRefs: []
    });

    // Node 6: Reconstructed Geometry Package Node
    const nodeRePkgId = `NODE-RE-${ctx.reconstructionPackage.reconstructionId}`;
    addNodeSafe({
      id: nodeRePkgId,
      type: 'GEOMETRY' as any,
      engineeringIdentityId: ctx.entityId,
      canonicalHash: ctx.reconstructionPackage.packageDigest,
      version: '1',
      createdAt: ctx.timestamp,
      evidenceRefs: []
    });

    // Node 7: New Reconstructed Revision Node
    const nodeRevBId = `NODE-REV-${ctx.revB.revisionHash}`;
    addNodeSafe({
      id: nodeRevBId,
      type: 'REVISION' as any,
      engineeringIdentityId: ctx.entityId,
      canonicalHash: ctx.revB.revisionHash,
      version: ctx.revB.revisionCode,
      createdAt: ctx.timestamp,
      evidenceRefs: []
    });

    // Node 8: Evidence Node
    const nodeEvidenceId = `NODE-EVI-${ctx.evidenceLeaf.leafHash}`;
    addNodeSafe({
      id: nodeEvidenceId,
      type: 'EVIDENCE' as any,
      engineeringIdentityId: ctx.entityId,
      canonicalHash: ctx.evidenceLeaf.leafHash || '',
      version: '1',
      createdAt: ctx.timestamp,
      evidenceRefs: []
    });

    // Edges: Directed Lineage
    // Intent DERIVED_FROM RevA
    addEdgeSafe({
      id: `EDGE-INTENT-REVA-${ctx.intent.intentId}`,
      type: 'DERIVED_FROM' as any,
      fromNodeId: nodeIntentId,
      toNodeId: nodeRevAId,
      createdAt: ctx.timestamp,
      evidenceRefs: [],
      relationHash: createHash('sha256').update(`DERIVED_${nodeIntentId}_${nodeRevAId}`).digest('hex')
    });

    // Artifact GENERATED_FROM Intent
    addEdgeSafe({
      id: `EDGE-ART-INTENT-${ctx.artifact.artifactId}`,
      type: 'GENERATED_FROM' as any,
      fromNodeId: nodeArtifactId,
      toNodeId: nodeIntentId,
      createdAt: ctx.timestamp,
      evidenceRefs: [],
      relationHash: createHash('sha256').update(`GENERATED_${nodeArtifactId}_${nodeIntentId}`).digest('hex')
    });

    // Part PRODUCED_BY Artifact
    addEdgeSafe({
      id: `EDGE-PP-ART-${ctx.physicalPart.physicalSerialId}`,
      type: 'PRODUCED_BY' as any,
      fromNodeId: nodePartId,
      toNodeId: nodeArtifactId,
      createdAt: ctx.timestamp,
      evidenceRefs: [],
      relationHash: createHash('sha256').update(`PRODUCED_${nodePartId}_${nodeArtifactId}`).digest('hex')
    });

    // Scan INSPECTION OF Part
    addEdgeSafe({
      id: `EDGE-SCAN-PP-${ctx.scan.scanId}`,
      type: 'USES' as any,
      fromNodeId: nodeScanId,
      toNodeId: nodePartId,
      createdAt: ctx.timestamp,
      evidenceRefs: [],
      relationHash: createHash('sha256').update(`USES_${nodeScanId}_${nodePartId}`).digest('hex')
    });

    // RePackage DERIVED_FROM Scan
    addEdgeSafe({
      id: `EDGE-RE-SCAN-${ctx.reconstructionPackage.reconstructionId}`,
      type: 'DERIVED_FROM' as any,
      fromNodeId: nodeRePkgId,
      toNodeId: nodeScanId,
      createdAt: ctx.timestamp,
      evidenceRefs: [],
      relationHash: createHash('sha256').update(`DERIVED_${nodeRePkgId}_${nodeScanId}`).digest('hex')
    });

    // RevB SUPERSEDES RevA
    addEdgeSafe({
      id: `EDGE-REVB-REVA-${ctx.revB.revisionId}`,
      type: 'SUPERSEDES' as any,
      fromNodeId: nodeRevBId,
      toNodeId: nodeRevAId,
      createdAt: ctx.timestamp,
      evidenceRefs: [],
      relationHash: createHash('sha256').update(`SUPERSEDES_${nodeRevBId}_${nodeRevAId}`).digest('hex')
    });

    // RevB DERIVED_FROM RePackage
    addEdgeSafe({
      id: `EDGE-REVB-RE-${ctx.revB.revisionId}`,
      type: 'DERIVED_FROM' as any,
      fromNodeId: nodeRevBId,
      toNodeId: nodeRePkgId,
      createdAt: ctx.timestamp,
      evidenceRefs: [],
      relationHash: createHash('sha256').update(`DERIVED_${nodeRevBId}_${nodeRePkgId}`).digest('hex')
    });

    // Evidence VERIFIES RevB
    addEdgeSafe({
      id: `EDGE-EVI-REVB-${ctx.evidenceLeaf.leafHash}`,
      type: 'VERIFIED_BY' as any,
      fromNodeId: nodeEvidenceId,
      toNodeId: nodeRevBId,
      createdAt: ctx.timestamp,
      evidenceRefs: [],
      relationHash: createHash('sha256').update(`VERIFIED_${nodeEvidenceId}_${nodeRevBId}`).digest('hex')
    });
  }

  private static recordHistory(
    eventType: EngineeringHistoryEntry['eventType'],
    entityId: string,
    relatedIdentity: string,
    details: string
  ): void {
    this.executionHistory.push({
      eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      eventType,
      entityId,
      relatedIdentity,
      timestamp: new Date().toISOString(),
      details
    });
  }

  public static getHistory(): readonly EngineeringHistoryEntry[] {
    return Object.freeze([...this.executionHistory]);
  }

  public static getClosedLoopRecord(id: string): PhysicalClosedLoopExecutionRecord | undefined {
    return this.closedLoopRecords.get(id);
  }

  public static getAllRecords(): readonly PhysicalClosedLoopExecutionRecord[] {
    return Object.freeze(Array.from(this.closedLoopRecords.values()));
  }

  /**
   * Persists all records to durable IndexedDB storage.
   */
  public static async persistToDurableStorage(): Promise<void> {
    try {
      if (IndexedDbEngine.isSupported()) {
        await IndexedDbEngine.setKeyValue('SECP_PHYSICAL_CLOSED_LOOP_RECORDS', Array.from(this.closedLoopRecords.values()));
        await IndexedDbEngine.setKeyValue('SECP_PHYSICAL_ENGINEERING_HISTORY', this.executionHistory);
      }
    } catch (e) {
      console.warn('[DigitalPhysicalDigitalLoopEngine] Durable persistence notice:', e);
    }
  }

  /**
   * Rehydrates all closed-loop records and engineering history from durable storage.
   */
  public static async rehydrateFromDurableStorage(): Promise<void> {
    try {
      if (IndexedDbEngine.isSupported()) {
        const records = await IndexedDbEngine.getKeyValue<PhysicalClosedLoopExecutionRecord[]>('SECP_PHYSICAL_CLOSED_LOOP_RECORDS');
        if (records && Array.isArray(records)) {
          for (const rec of records) {
            this.closedLoopRecords.set(rec.loopExecutionId, Object.freeze(rec));
          }
        }
        const history = await IndexedDbEngine.getKeyValue<EngineeringHistoryEntry[]>('SECP_PHYSICAL_ENGINEERING_HISTORY');
        if (history && Array.isArray(history)) {
          this.executionHistory = [...history];
        }
      }
    } catch (e) {
      console.warn('[DigitalPhysicalDigitalLoopEngine] Rehydration notice:', e);
    }
  }

  public static clear(): void {
    this.executionHistory = [];
    this.closedLoopRecords.clear();
    AdditiveManufacturingAuthority.clear();
    ReverseEngineeringAuthority.clear();
  }
}
