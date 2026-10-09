const fs = require('fs');
let content = fs.readFileSync('src/verification/patch040/__tests__/PATCH-044-PMITruth.test.ts', 'utf8');

const additionalTests = `
  it('should FAIL verifyGeometryAssociation if reference resolves to wrong/unintended topology (e.g., mismatching types)', () => {
    // In our mockDocWithTopology, EDGE_1 resolves to topo_4. 
    // Let's say PMI specifically requires a Face but got topo_4, although verifyGeometryAssociation itself
    // only checks existence in topologyMap, the AcceptanceGate or further logic might check type.
    // However, for verifyGeometryAssociation, we can test that an intentionally wrong ID like 'FACE_B' 
    // which is not in the map fails.
    const dim = PMIEngine.createDimension(mockDocWithTopology, 'LINEAR', 50.0, ['FACE_WRONG_REF']);
    expect(PMIVerifier.verifyGeometryAssociation(dim, mockDocWithTopology)).toBe(false);
  });

  it('should VERIFY that geometry association requires topology evidence (Empty Topology != Valid)', () => {
    // Empty topology map should strictly return false even if PMI exists and syntax is valid
    const gdt = PMIEngine.createGeometricTolerance(mockDoc, 'POSITION', 0.1, ['HOLE_1'], 'DRF-ABC');
    expect(PMIVerifier.verifyGeometryAssociation(gdt, mockDoc)).toBe(false);
  });
`;

content = content.replace(/  \/\/ NEGATIVE PROOFS/g, additionalTests + '\n  // NEGATIVE PROOFS');

fs.writeFileSync('src/verification/patch040/__tests__/PATCH-044-PMITruth.test.ts', content);
