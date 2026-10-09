const fs = require('fs');
let content = fs.readFileSync('src/verification/patch040/__tests__/PATCH-044-PMITruth.test.ts', 'utf8');

const docReplacement = `  const mockDoc: EngineeringDocument = {
    documentId: 'DOC-PMI-123',
    revision: 1,
    type: 'PART',
    units: { system: 'SI_MM', length: 'mm', angle: 'deg', mass: 'kg', force: 'N', pressure: 'MPa' },
    sketches: [],
    constraints: [],
    features: [],
    parameters: [],
    topologyMap: {},
    derived: {},
    evidence: []
  } as any;

  const mockDocWithTopology: EngineeringDocument = {
    ...mockDoc,
    topologyMap: {
      faceMap: {
        'FACE_TOP': 'topo_1',
        'FACE_BOTTOM': 'topo_2',
        'FACE_A': 'topo_3'
      },
      edgeMap: {
        'EDGE_1': 'topo_4'
      },
      'FACE_TOP': 'topo_1',
      'FACE_BOTTOM': 'topo_2',
      'FACE_A': 'topo_3',
      'EDGE_1': 'topo_4',
      'HOLE_1': 'topo_5'
    } as any
  } as any;
`;

content = content.replace(/  const mockDoc: EngineeringDocument = \{[\s\S]*?\} as any;/m, docReplacement);

// Fix positive tests
content = content.replace(/expect\(PMIVerifier.verifyGeometryAssociation\(dim, mockDoc\)\).toBe\(true\);/g, "expect(PMIVerifier.verifyGeometryAssociation(dim, mockDocWithTopology)).toBe(true);");
content = content.replace(/const verdicts = PMITruthAcceptanceGate.runAudit\(mockDoc, pmiModel\);/g, "const verdicts = PMITruthAcceptanceGate.runAudit(mockDocWithTopology, pmiModel);");
content = content.replace(/const evidence = PMITruthAcceptanceGate.generateEvidence\(mockDoc, pmiModel\);/g, "const evidence = PMITruthAcceptanceGate.generateEvidence(mockDocWithTopology, pmiModel);");

// Add negative tests
const negativeTests = `
  // NEGATIVE PROOFS - GEOMETRY ASSOCIATION
  it('should FAIL verifyGeometryAssociation with empty topology', () => {
    const dim = PMIEngine.createDimension(mockDoc, 'LINEAR', 50.0, ['FACE_TOP']);
    expect(PMIVerifier.verifyGeometryAssociation(dim, mockDoc)).toBe(false);
  });

  it('should FAIL verifyGeometryAssociation if reference is missing in topology map', () => {
    const dim = PMIEngine.createDimension(mockDocWithTopology, 'LINEAR', 50.0, ['FACE_MISSING']);
    expect(PMIVerifier.verifyGeometryAssociation(dim, mockDocWithTopology)).toBe(false);
  });

  it('should FAIL verifyGeometryAssociation if reference is a dangling string', () => {
    const dim = PMIEngine.createDimension(mockDocWithTopology, 'LINEAR', 50.0, ['dangling_ref']);
    expect(PMIVerifier.verifyGeometryAssociation(dim, mockDocWithTopology)).toBe(false);
  });

  it('should FAIL verifyGeometryAssociation if reference chain is broken (no references)', () => {
    const dim = PMIEngine.createDimension(mockDocWithTopology, 'LINEAR', 50.0, []);
    expect(PMIVerifier.verifyGeometryAssociation(dim, mockDocWithTopology)).toBe(false);
  });
`;

content = content.replace(/  \/\/ NEGATIVE PROOFS/g, negativeTests + '\n  // NEGATIVE PROOFS');

fs.writeFileSync('src/verification/patch040/__tests__/PATCH-044-PMITruth.test.ts', content);
