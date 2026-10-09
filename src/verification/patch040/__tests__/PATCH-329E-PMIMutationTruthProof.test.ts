/**
 * SECP — PATCH-329E PMI Mutation / Semantic & Topology Truth Proof
 * 
 * Objectives:
 * 1. Validate complete adversarial resistance of the PMI / GD&T acceptance gate.
 * 2. Verify that any modification of semantic meaning, topology, or references results in strict audit failure.
 * 3. Implement 8 specific mutation scenarios:
 *    - Mutation #1: Change target Face
 *    - Mutation #2: Change STEP semantic reference
 *    - Mutation #3: Change topology identity
 *    - Mutation #4: Delete target topology
 *    - Mutation #5: Change topology type
 *    - Mutation #6: Change PMI semantic meaning/value
 *    - Mutation #7: Tamper with exported STEP reference
 *    - Mutation #8: Change canonical identity without changing transient STEP index
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { StepAp242Pipeline } from '../../../engine/interop/step-ap242/StepAp242Pipeline';
import { PMITruthAcceptanceGate } from '../../../engine/cad/pmi/PMITruthAcceptanceGate';
import { PMIVerifier } from '../../../engine/cad/pmi/PMIEngine';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { PMIModel, PMISemanticDefinition, GDNTCharacteristic, PMIType } from '../../../engine/cad/pmi/PMITypes';
import { PmiObject } from '../../../engine/interop/step-ap242/pmi/AP242PmiTypes';
import { StepAp242Exporter } from '../../../engine/interop/step-ap242/StepAp242Exporter';
import { AP242PmiExporter } from '../../../engine/interop/step-ap242/pmi/AP242PmiExporter';

describe('PATCH-329E — PMI Mutation / Semantic & Topology Truth Proof', () => {

  const FIXTURE_PATH = path.join(__dirname, '../../../engine/interop/step-ap242/pmi/__fixtures__/pmi_box.stp');

  // Helper to load fixture and build base valid document
  async function setupBaseline() {
    const originalContent = readFileSync(FIXTURE_PATH, 'utf-8');
    const result = await StepAp242Pipeline.execute(originalContent, 'pmi_box.stp');
    
    const doc: EngineeringDocument = {
      documentId: 'DOC-PMI-MUTATION-BASE',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: JSON.parse(JSON.stringify(result.topologyMap!)),
      evaluatedShape: Array.isArray(result.nativeModel) ? result.nativeModel[0] : result.nativeModel,
      derived: {},
      evidence: []
    } as any;

    const revisionNumber = typeof doc.revision === 'number' ? doc.revision : 1;
    const pmiList: PMISemanticDefinition[] = result.pmiModel!.map(obj => pmiObjectToSemantic(obj, doc.documentId, revisionNumber));
    const pmiModel: PMIModel = { pmiList, datums: {}, drfs: [] };
    pmiList.forEach(p => {
      if (p.type === 'DATUM' && p.datumDefinition) {
        pmiModel.datums[p.datumDefinition.label] = p.pmiId;
      }
    });

    return { doc, pmiModel, result, originalContent };
  }

  it('should verify that the baseline (unmutated) PMI model passes all audits', async () => {
    const { doc, pmiModel } = await setupBaseline();
    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    
    const associVer = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    expect(associVer?.verdict).toBe('PASS');

    const dimVer = verdicts.find(v => v.test === 'DIMENSION_SEMANTICS_VALID');
    expect(dimVer?.verdict).toBe('PASS');

    const fcfVer = verdicts.find(v => v.test === 'FEATURE_CONTROL_FRAME_VALID');
    expect(fcfVer?.verdict).toBe('PASS');
  });

  // ==========================================
  // Mutation #1: Change target Face
  // ==========================================
  it('should fail validation when target Face mapping is mutated to an invalid/non-existent ID', async () => {
    const { doc, pmiModel } = await setupBaseline();
    
    // Mutate faceMap to map geom_21 to a non-existent face ID
    if (!doc.topologyMap || !doc.topologyMap.faceMap) {
      throw new Error('Topology map is undefined');
    }
    doc.topologyMap.faceMap['geom_21'] = 'face_mutated_invalid_id';
    
    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const associVer = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    expect(associVer?.verdict).toBe('FAIL');
  });

  // ==========================================
  // Mutation #2: Change STEP semantic reference
  // ==========================================
  it('should fail validation when PMI geometry reference is pointed to an invalid STEP identifier', async () => {
    const { doc, pmiModel } = await setupBaseline();
    
    // Mutate the featureReference's sourceId of the first PMI from geom_21 to non-existent geom_99
    pmiModel.pmiList[0].featureReferences[0].sourceId = 'geom_99';
    
    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const associVer = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    expect(associVer?.verdict).toBe('FAIL');
  });

  // ==========================================
  // Mutation #3: Change topology identity
  // ==========================================
  it('should fail validation when topology identity is changed but the mapping key remains the same', async () => {
    const { doc, pmiModel } = await setupBaseline();
    
    // geom_21 points to a face with SHA-256 ID in evaluatedShape
    // Let's modify the actual face ID in doc.evaluatedShape to break referential matching
    if (!doc.topologyMap || !doc.topologyMap.faceMap) {
      throw new Error('Topology map is undefined');
    }
    const targetFaceId = doc.topologyMap.faceMap['geom_21'];
    expect(targetFaceId).toBeDefined();

    // Deep traverse evaluatedShape and change the ID of the face
    let modified = false;
    const shell = (doc.evaluatedShape as any).outerShell;
    if (shell && shell.orientedFaces) {
      for (const of of shell.orientedFaces) {
        if (of.face.id === targetFaceId) {
          of.face.id = 'face_tampered_id';
          modified = true;
          break;
        }
      }
    }
    expect(modified).toBe(true);

    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const associVer = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    expect(associVer?.verdict).toBe('FAIL');
  });

  // ==========================================
  // Mutation #4: Delete target topology
  // ==========================================
  it('should fail validation when target topology is completely deleted from the document', async () => {
    const { doc, pmiModel } = await setupBaseline();
    if (!doc.topologyMap || !doc.topologyMap.faceMap) {
      throw new Error('Topology map is undefined');
    }
    const targetFaceId = doc.topologyMap.faceMap['geom_21'];

    // Delete the ADVANCED_FACE from evaluatedShape outerShell orientedFaces
    const shell = (doc.evaluatedShape as any).outerShell;
    if (shell && shell.orientedFaces) {
      const originalLength = shell.orientedFaces.length;
      shell.orientedFaces = shell.orientedFaces.filter((of: any) => of.face.id !== targetFaceId);
      expect(shell.orientedFaces.length).toBeLessThan(originalLength);
    }

    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const associVer = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    expect(associVer?.verdict).toBe('FAIL');
  });

  // ==========================================
  // Mutation #5: Change topology type
  // ==========================================
  it('should fail validation when geometry reference type is changed from FACE to EDGE but refers to a FACE', async () => {
    const { doc, pmiModel } = await setupBaseline();
    
    // Mutate featureReference type to 'EDGE' for face geom_21
    const pmi = pmiModel.pmiList.find(p => p.pmiId === 'pmi_dim_301');
    expect(pmi).toBeDefined();
    pmi!.featureReferences[0].type = 'EDGE';

    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const associVer = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    expect(associVer?.verdict).toBe('FAIL');
  });

  // ==========================================
  // Mutation #6: Change PMI semantic meaning/value
  // ==========================================
  it('should fail semantic validation when PMI semantic metadata is corrupted or missing', async () => {
    const { doc, pmiModel } = await setupBaseline();
    
    // Find dimension and geometric tolerance PMIs
    const dim = pmiModel.pmiList.find(p => p.type === 'DIMENSION');
    const tol = pmiModel.pmiList.find(p => p.type === 'GEOMETRIC_TOLERANCE');
    expect(dim).toBeDefined();
    expect(tol).toBeDefined();

    // Let's strip their semantic containers to trigger acceptance gate errors
    delete dim!.dimension;
    delete tol!.tolerance;

    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const dimVer = verdicts.find(v => v.test === 'DIMENSION_SEMANTICS_VALID');
    const fcfVer = verdicts.find(v => v.test === 'FEATURE_CONTROL_FRAME_VALID');

    expect(dimVer?.verdict).toBe('FAIL');
    expect(fcfVer?.verdict).toBe('FAIL');
  });

  // ==========================================
  // Mutation #7: Tamper with exported STEP reference
  // ==========================================
  it('should fail validation if exported STEP references are tampered with (adversarial import check)', async () => {
    const { doc, pmiModel, result } = await setupBaseline();
    
    const exporter = new StepAp242Exporter();
    let exportedText = exporter.export(doc.evaluatedShape ? [doc.evaluatedShape] : [], 'rt_pmi_box.stp');
    
    const geometryIdMap: Record<string, number> = {};
    const entityMap = exporter.getEntityMap();
    if (!doc.topologyMap) {
      throw new Error('Topology map is undefined');
    }
    if (doc.topologyMap.faceMap) {
      for (const [geomId, faceId] of Object.entries(doc.topologyMap.faceMap)) {
        const exportedId = entityMap.get(faceId as string);
        if (exportedId !== undefined) {
          geometryIdMap[geomId] = exportedId;
        }
      }
    }

    const pmiObjects = result.pmiModel!;
    const pmiExportResult = AP242PmiExporter.export(pmiObjects, 5000, geometryIdMap);
    
    expect(pmiExportResult.text).toBeDefined();

    // Adversarial STEP injection: Modify the parsed PMI text block to replace the valid geometry reference index #118 with #999 (non-existent index)
    // #118 is ADVANCED_FACE's index. Let's find it and replace it.
    let tamperedPmiText = pmiExportResult.text;
    
    // Let's print or inspect to locate index in PMI text. 
    // In pmi_box, #301 points to #21, which becomes some other index under geometryIdMap (e.g. #118 or similar).
    // Let's perform a robust search and replace of '#(any exported index)' with '#999'.
    const exportedFaceIdNum = geometryIdMap['geom_21'];
    expect(exportedFaceIdNum).toBeDefined();

    tamperedPmiText = tamperedPmiText.replace(new RegExp(`#${exportedFaceIdNum}\\b`, 'g'), '#999');

    exportedText = exportedText.replace('ENDSEC;\nEND-ISO-10303-21;', `${tamperedPmiText}\nENDSEC;\nEND-ISO-10303-21;`);

    // Now re-import the tampered STEP file
    const resultTampered = await StepAp242Pipeline.execute(exportedText, 'rt_pmi_box.stp');
    
    // The pipeline validator checks for reference integrity. 
    // It should identify a DANGLING_REFERENCE to #999!
    expect(resultTampered.validation.status).toBe('INVALID');
    expect(resultTampered.validation.errors.some(e => e.includes('DANGLING_REFERENCE') && e.includes('#999'))).toBe(true);
  });

  // ==========================================
  // Mutation #8: Change canonical identity without changing transient STEP index
  // ==========================================
  it('should fail association audit when the canonical identity inside the STEP file changes, despite retaining identical STEP index numbering', async () => {
    const { doc, pmiModel, result } = await setupBaseline();
    
    const exporter = new StepAp242Exporter();
    let exportedText = exporter.export(doc.evaluatedShape ? [doc.evaluatedShape] : [], 'rt_pmi_box.stp');
    
    const geometryIdMap: Record<string, number> = {};
    const entityMap = exporter.getEntityMap();
    if (!doc.topologyMap) {
      throw new Error('Topology map is undefined');
    }
    if (doc.topologyMap.faceMap) {
      for (const [geomId, faceId] of Object.entries(doc.topologyMap.faceMap)) {
        const exportedId = entityMap.get(faceId as string);
        if (exportedId !== undefined) {
          geometryIdMap[geomId] = exportedId;
        }
      }
    }

    const pmiObjects = result.pmiModel!;
    const pmiExportResult = AP242PmiExporter.export(pmiObjects, 5000, geometryIdMap);
    
    let combinedText = exportedText.replace('ENDSEC;\nEND-ISO-10303-21;', `${pmiExportResult.text}\nENDSEC;\nEND-ISO-10303-21;`);

    // Tamper with the ADVANCED_FACE canonical identity parameter (the SHA-256 hash face name)
    // A face in the exported text will look like: 
    // #118=ADVANCED_FACE('64e2153d6857ba51eb730628c1a719ce509a81a43685dcca4f9ae3672c9c2af8', ...);
    // Let's replace '64e2153d...' with an arbitrary valid-looking tampered SHA-256 hash.
    if (!doc.topologyMap || !doc.topologyMap.faceMap) {
      throw new Error('Topology map is undefined');
    }
    const originalHash = doc.topologyMap.faceMap['geom_21'];
    const tamperedHash = 'beef153d6857ba51eb730628c1a719ce509a81a43685dcca4f9ae3672c9caaaa';

    expect(combinedText.includes(originalHash)).toBe(true);
    combinedText = combinedText.replace(originalHash, tamperedHash);

    // Re-import the tampered model
    const resultTampered = await StepAp242Pipeline.execute(combinedText, 'rt_pmi_box.stp');
    expect(resultTampered.validation.status).toBe('VALID'); // Valid STEP structural syntax but content is semantically mutated!

    // Reconstruct the re-imported document
    const docTampered: EngineeringDocument = {
      documentId: 'DOC-TAMPERED-ID',
      revision: 2,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: resultTampered.topologyMap!,
      evaluatedShape: Array.isArray(resultTampered.nativeModel) ? resultTampered.nativeModel[0] : resultTampered.nativeModel,
      derived: {},
      evidence: []
    } as any;

    // Find which key maps to the tamperedHash in the re-imported document
    let reImportedKey: string | undefined;
    if (!docTampered.topologyMap || !docTampered.topologyMap.faceMap) {
      throw new Error('Topology map is undefined');
    }
    for (const [key, val] of Object.entries(docTampered.topologyMap.faceMap || {})) {
      if (val === tamperedHash) {
        reImportedKey = key;
        break;
      }
    }

    expect(reImportedKey).toBeDefined();
    const reImportedFaceId = docTampered.topologyMap.faceMap[reImportedKey!];
    expect(reImportedFaceId).toBe(tamperedHash);
    expect(reImportedFaceId).not.toBe(originalHash);

    // Furthermore, we run the association audit using the original PMI definition (which references geom_21).
    // In docTampered, geom_21 does not exist, or points to something else (or maps to a different face ID), 
    // meaning the original PMI will fail to associate to its intended original face!
    const verdictsTampered = PMITruthAcceptanceGate.runAudit(docTampered, pmiModel);
    const associVer = verdictsTampered.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    expect(associVer?.verdict).toBe('FAIL');

    console.log(`Adversarial verification success: Transient STEP index matched, but canonical SHA-256 identity changed from original ${originalHash} to tampered ${reImportedFaceId}. Verification FAIL.`);
  });

  // Helper functions
  function pmiObjectToSemantic(obj: PmiObject, docId: string, revision: number): PMISemanticDefinition {
    let type: PMIType = 'NOTE';
    if (obj.category === 'DIMENSION') type = 'DIMENSION';
    else if (obj.category === 'DATUM') type = 'DATUM';
    else if (obj.category === 'FEATURE_CONTROL_FRAME') type = 'GEOMETRIC_TOLERANCE';

    const pmi: PMISemanticDefinition = {
      pmiId: obj.id,
      type,
      sourceDocumentId: docId,
      sourceModelRevision: revision,
      featureReferences: obj.geometryReferences.map(gr => ({
        id: `REF-${gr}`,
        type: 'FACE',
        sourceId: gr
      })),
      isSemantic: obj.isSemantic,
      revision: 1,
      lineage: 'IMPORT'
    };

    if (type === 'DIMENSION') {
      pmi.dimension = {
        type: 'LINEAR',
        nominalValue: obj.value || 0,
        unit: obj.unit || 'mm',
        precision: 3
      };
    } else if (type === 'DATUM') {
      pmi.datumDefinition = {
        label: (obj as any).datumLabel || '?',
        datumType: 'PLANE'
      };
    } else if (type === 'GEOMETRIC_TOLERANCE') {
      pmi.tolerance = {
        value: obj.value || 0,
        unit: obj.unit || 'mm',
        characteristic: (obj as any).geometricCharacteristic as GDNTCharacteristic || 'POSITION',
        modifier: 'RFS'
      };
    }

    return pmi;
  }
});
