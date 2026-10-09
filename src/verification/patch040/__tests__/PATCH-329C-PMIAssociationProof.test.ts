/**
 * SECP — PATCH-329C PMI Geometry Association Proof
 * 
 * Objectives:
 * 1. Load actual STEP AP242 fixture with PMI.
 * 2. Execute full import pipeline.
 * 3. Verify real causality chain: STEP Entity -> Native Topology -> PMI Reference.
 * 4. Prove that PMI_GEOMETRY_ASSOCIATIVITY passes based on real geometry, not mocks.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { StepAp242Pipeline } from '../../../engine/interop/step-ap242/StepAp242Pipeline';
import { PMITruthAcceptanceGate } from '../../../engine/cad/pmi/PMITruthAcceptanceGate';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { PMIModel, PMISemanticDefinition, DatumReferenceFrame, PMIType, GDNTCharacteristic } from '../../../engine/cad/pmi/PMITypes';
import { PmiObject } from '../../../engine/interop/step-ap242/pmi/AP242PmiTypes';

describe('PATCH-329C — PMI Geometry Association Proof', () => {

  const FIXTURE_PATH = path.join(__dirname, '../../../engine/interop/step-ap242/pmi/__fixtures__/pmi_box.stp');

  it('should prove source-to-topology causality for PMI in pmi_box.stp', async () => {
    // 1. Load Real Fixture
    const stepContent = readFileSync(FIXTURE_PATH, 'utf-8');
    
    // 2. Execute Pipeline
    const result = await StepAp242Pipeline.execute(stepContent, 'pmi_box.stp');
    
    expect(result.validation.status).toBe('VALID');
    expect(result.pmiModel).toBeDefined();
    expect(result.pmiModel?.length).toBeGreaterThan(0);
    expect(result.topologyMap).toBeDefined();

    // 3. Construct Canonical Engineering Document
    const doc: EngineeringDocument = {
      documentId: 'DOC-PMI-PROOF',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: result.topologyMap!,
      evaluatedShape: result.nativeModel, // This is the Solid[]
      derived: {},
      evidence: []
    } as any;

    // Bridge Solid[] to evaluatedShape if it's a single solid
    if (Array.isArray(result.nativeModel)) {
        doc.evaluatedShape = result.nativeModel[0];
    }

    // 4. Bridge PmiObject[] to PMISemanticDefinition[] (Canonical Model)
    const pmiList: PMISemanticDefinition[] = result.pmiModel!.map(obj => pmiObjectToSemantic(obj, doc.documentId, doc.revision));
    
    const pmiModel: PMIModel = {
      pmiList,
      datums: {},
      drfs: []
    };

    // Populate datums and DRFs for the audit
    pmiList.forEach(p => {
      if (p.type === 'DATUM' && p.datumDefinition) {
        pmiModel.datums[p.datumDefinition.label] = p.pmiId;
      }
    });

    // 5. Run Forensic Audit
    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    
    // 6. VERIFY PMI_GEOMETRY_ASSOCIATIVITY
    const associationVerdict = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    
    expect(associationVerdict).toBeDefined();
    expect(associationVerdict?.verdict).toBe('PASS');
    expect(associationVerdict?.details).toContain('resolve to actual canonical engineering geometry');

    // 7. DEEP INSPECTION: Prove the chain for DIMENSION (#301)
    // #301 in pmi_box.stp references #21 (ADVANCED_FACE)
    const dim301 = pmiList.find(p => p.pmiId === 'pmi_dim_301');
    expect(dim301).toBeDefined();
    expect(dim301?.featureReferences[0].sourceId).toBe('geom_21');

    // Verify geom_21 exists in topologyMap
    if (!doc.topologyMap || !('faceMap' in doc.topologyMap) || !doc.topologyMap.faceMap) {
      throw new Error('doc.topologyMap.faceMap is undefined');
    }
    const topoId = (doc.topologyMap.faceMap as any)['geom_21'];
    expect(topoId).toBeDefined();
    expect(typeof topoId).toBe('string');
    expect(topoId.length).toBe(64); // SHA-256

    console.log(`Verified PMI #301 association: geom_21 -> ${topoId}`);
  });

  it('should fail verification if topology is missing (Negative Causality)', async () => {
    const stepContent = readFileSync(FIXTURE_PATH, 'utf-8');
    const result = await StepAp242Pipeline.execute(stepContent, 'pmi_box.stp');
    
    const doc: EngineeringDocument = {
      documentId: 'DOC-MISSING-TOPO',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
      topologyMap: { ...result.topologyMap!, faceMap: {} }, // Strip faceMap
      evaluatedShape: result.nativeModel![0],
      derived: {},
      evidence: []
    } as any;

    const pmiList = result.pmiModel!.map(obj => pmiObjectToSemantic(obj, doc.documentId, doc.revision));
    const pmiModel: PMIModel = { pmiList, datums: {}, drfs: [] };

    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const associationVerdict = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    
    expect(associationVerdict?.verdict).toBe('FAIL');
  });

  it('should fail verification if reference is dangling', async () => {
    const stepContent = readFileSync(FIXTURE_PATH, 'utf-8');
    const result = await StepAp242Pipeline.execute(stepContent, 'pmi_box.stp');
    
    const doc: EngineeringDocument = {
      documentId: 'DOC-DANGLING',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
      topologyMap: result.topologyMap!,
      evaluatedShape: result.nativeModel![0],
      derived: {},
      evidence: []
    } as any;

    // Create a PMI with a dangling reference
    const pmiList: PMISemanticDefinition[] = [{
      pmiId: 'PMI-DANGLING',
      type: 'DIMENSION',
      sourceDocumentId: doc.documentId,
      sourceModelRevision: doc.revision,
      featureReferences: [{ id: 'REF-1', type: 'FACE', sourceId: 'geom_999999' }], // Non-existent
      isSemantic: true,
      revision: 1,
      lineage: 'TEST'
    }];
    const pmiModel: PMIModel = { pmiList, datums: {}, drfs: [] };

    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const associationVerdict = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    
    expect(associationVerdict?.verdict).toBe('FAIL');
  });

  it('should fail verification if topology type is mismatched', async () => {
    const stepContent = readFileSync(FIXTURE_PATH, 'utf-8');
    const result = await StepAp242Pipeline.execute(stepContent, 'pmi_box.stp');
    
    const doc: EngineeringDocument = {
      documentId: 'DOC-TYPE-MISMATCH',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
      topologyMap: result.topologyMap!,
      evaluatedShape: result.nativeModel![0],
      derived: {},
      evidence: []
    } as any;

    // Create a PMI that expects a VERTEX but references a FACE (geom_21)
    const pmiList: PMISemanticDefinition[] = [{
      pmiId: 'PMI-MISMATCH',
      type: 'DIMENSION',
      sourceDocumentId: doc.documentId,
      sourceModelRevision: doc.revision,
      featureReferences: [{ id: 'REF-1', type: 'VERTEX', sourceId: 'geom_21' }], // geom_21 is a FACE
      isSemantic: true,
      revision: 1,
      lineage: 'TEST'
    }];
    const pmiModel: PMIModel = { pmiList, datums: {}, drfs: [] };

    const verdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    const associationVerdict = verdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY');
    
    expect(associationVerdict?.verdict).toBe('FAIL');
  });

  it('should fail verification when causality is mutated (MANDATORY)', async () => {
    const stepContent = readFileSync(FIXTURE_PATH, 'utf-8');
    const result = await StepAp242Pipeline.execute(stepContent, 'pmi_box.stp');
    
    // 1. Initial State (Pass)
    const doc: EngineeringDocument = {
      documentId: 'DOC-MUTATION',
      revision: 1,
      topologyMap: { ...result.topologyMap! },
      evaluatedShape: result.nativeModel![0]
    } as any;
    
    const pmiList = result.pmiModel!.map(obj => pmiObjectToSemantic(obj, doc.documentId, doc.revision));
    const pmiModel: PMIModel = { pmiList, datums: {}, drfs: [] };

    expect(PMITruthAcceptanceGate.runAudit(doc, pmiModel).find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY')?.verdict).toBe('PASS');

    // 2. Mutate Mapping: Point geom_21 to a non-existent identity
    if (!doc.topologyMap || !doc.topologyMap.faceMap) {
      throw new Error('Topology map or faceMap is undefined');
    }
    (doc.topologyMap.faceMap as any)['geom_21'] = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    // 3. Verify Failure
    const mutatedVerdicts = PMITruthAcceptanceGate.runAudit(doc, pmiModel);
    expect(mutatedVerdicts.find(v => v.test === 'PMI_GEOMETRY_ASSOCIATIVITY')?.verdict).toBe('FAIL');
  });

  function pmiObjectToSemantic(obj: PmiObject, docId: string, revision: string | number): PMISemanticDefinition {
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
