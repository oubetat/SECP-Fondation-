import { describe, it, expect } from 'vitest';
import { NativeSECPFixtures } from '../__fixtures__/NativeSECPFixtures';
import { NativeSECPWriter } from '../NativeSECPWriter';
import { NativeSECPReader } from '../NativeSECPReader';
import { NativeSECPCanonicalizer } from '../NativeSECPCanonicalizer';

describe('PATCH-039: Native SECP Performance Benchmark Baseline', () => {

  it('measures serialization, canonicalization, hashing, and parsing performance', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();

    // 1. Serialization benchmark
    const t0 = performance.now();
    const writeResult = NativeSECPWriter.write(doc);
    const t1 = performance.now();
    const serializationMs = t1 - t0;

    // 2. Canonicalization & Hashing benchmark
    const t2 = performance.now();
    const hashResult = NativeSECPCanonicalizer.computeCanonicalHash(doc);
    const t3 = performance.now();
    const canonicalizationMs = t3 - t2;

    // 3. Deserialization & Verification benchmark
    const t4 = performance.now();
    const readResult = NativeSECPReader.read(writeResult.jsonString);
    const t5 = performance.now();
    const deserializationMs = t5 - t4;

    expect(writeResult.success).toBe(true);
    expect(readResult.success).toBe(true);
    expect(hashResult.canonicalHash).toBe(doc.integrity.canonicalHash);

    // Performance constraints (should be under 50ms for standard B-Rep model)
    expect(serializationMs).toBeLessThan(100);
    expect(canonicalizationMs).toBeLessThan(100);
    expect(deserializationMs).toBeLessThan(100);
  });
});
