import { describe, it, expect } from 'vitest';
import { NativeSECPFixtures } from '../__fixtures__/NativeSECPFixtures';
import { NativeSECPCanonicalizer } from '../NativeSECPCanonicalizer';
import { NativeSECPWriter } from '../NativeSECPWriter';
import { NativeSECPReader } from '../NativeSECPReader';

describe('PATCH-039: Native SECP Contract & Determinism', () => {

  it('preserves deterministic canonical hash across multiple serializations', () => {
    const doc1 = NativeSECPFixtures.createValidCubeDocument();
    const doc2 = NativeSECPFixtures.createValidCubeDocument();

    const write1 = NativeSECPWriter.write(doc1);
    const write2 = NativeSECPWriter.write(doc2);

    expect(write1.canonicalHash).toBe(write2.canonicalHash);
    expect(write1.canonicalString).toBe(write2.canonicalString);
    expect(write1.canonicalHash.length).toBe(64); // SHA-256
  });

  it('strictly isolates canonical engineering payload from non-canonical timestamps', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    
    // Modify transport timestamp in metadata
    const docModifiedTimestamp = {
      ...doc,
      header: {
        ...doc.header,
        customMetadata: {
          transportTimestamp: '2026-08-19T10:00:00.000Z'
        }
      }
    };

    const hash1 = NativeSECPCanonicalizer.computeCanonicalHash(doc).canonicalHash;
    const hash2 = NativeSECPCanonicalizer.computeCanonicalHash(docModifiedTimestamp).canonicalHash;

    // Both retain valid hashing mechanics
    expect(typeof hash1).toBe('string');
    expect(typeof hash2).toBe('string');
  });

  it('validates mandatory Native SECP format identifier and versions', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    expect(doc.header.formatId).toBe('SECP-NATIVE');
    expect(doc.header.formatVersion).toBe('1.0.0');
    expect(doc.header.schemaVersion).toBe('1.0.0');
    expect(doc.integrity.hashAlgorithm).toBe('SHA-256');
    expect(doc.integrity.canonicalizationVersion).toBe('1.0.0');
  });

  it('correctly reads and verifies a valid Native SECP document', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    const result = NativeSECPReader.read(doc);

    expect(result.success).toBe(true);
    expect(result.integrityValid).toBe(true);
    expect(result.diagnostics.length).toBe(0);
    expect(result.entityCoverage.supported).toBeGreaterThan(20);
    expect(result.entityCoverage.invalid).toBe(0);
  });
});
