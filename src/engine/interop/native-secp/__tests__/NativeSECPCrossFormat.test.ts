import { describe, it, expect } from 'vitest';
import { NativeSECPFixtures } from '../__fixtures__/NativeSECPFixtures';
import { NativeSECPInteroperabilityBridge } from '../NativeSECPInteroperabilityBridge';

describe('PATCH-039: Native SECP Cross-Format Interoperability (Native <-> STEP AP242)', () => {

  it('translates Native SECP to STEP AP242 Part 21 and back to Native SECP', () => {
    const originalDoc = NativeSECPFixtures.createValidCubeDocument();

    // 1. Native -> STEP AP242
    const nativeToStep = NativeSECPInteroperabilityBridge.nativeToStepAP242(originalDoc);
    expect(nativeToStep.success).toBe(true);
    expect(nativeToStep.stepContent).toContain('ISO-10303-21;');
    expect(nativeToStep.stepContent).toContain('FILE_SCHEMA');
    expect(nativeToStep.ap242Model.solids.length).toBe(1);
    expect(nativeToStep.ap242Model.solids[0].faces.length).toBe(6);

    // 2. STEP AP242 -> Native SECP
    const stepToNative = NativeSECPInteroperabilityBridge.stepAP242ToNative(nativeToStep.stepContent, {
      objectId: 'SECP-REIMPORTED-CUBE',
      revisionId: 'REV-01'
    });

    expect(stepToNative.success).toBe(true);
    expect(stepToNative.document).not.toBeNull();
    expect(stepToNative.document.header.formatId).toBe('SECP-NATIVE');
    expect(stepToNative.document.model.topology.solids.length).toBe(1);
    expect(stepToNative.document.model.topology.faces.length).toBe(6);
    expect(stepToNative.document.model.topology.edges.length).toBeGreaterThanOrEqual(12);

    // Diagnostics should report feature tree dropped as expected for STEP pure geometry interchange
    expect(nativeToStep.diagnostics.some(d => d.code === 'SECP-STEP-FEATURE-HISTORY-DROPPED')).toBe(true);
  });
});
