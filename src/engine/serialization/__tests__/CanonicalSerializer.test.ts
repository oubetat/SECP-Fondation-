import { describe, it, expect } from 'vitest';
import { CanonicalSerializer } from '../CanonicalSerializer';
import { CanonicalNormalizer } from '../CanonicalNormalizer';
import {
  CircularReferenceError,
  NonFiniteNumberError,
  UndefinedInArrayError,
  UnsupportedTypeError
} from '../CanonicalSerializationErrors';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';

describe('PATCH-009 — CanonicalSerializer Unit Test Suite', () => {
  // TEST 01: Object key order invariance
  it('TEST 01: Object key order invariance', () => {
    const inputA = { a: 1, b: 2 };
    const inputB = { b: 2, a: 1 };
    const resA = CanonicalSerializer.serialize(inputA);
    const resB = CanonicalSerializer.serialize(inputB);
    expect(resA.canonicalString).toBe('{"a":1,"b":2}');
    expect(resA.canonicalString).toBe(resB.canonicalString);
  });

  // TEST 02: Nested object key ordering
  it('TEST 02: Nested object key ordering', () => {
    const input1 = {
      level1_b: { z: 10, a: 20 },
      level1_a: { y: 30, x: 40 }
    };
    const input2 = {
      level1_a: { x: 40, y: 30 },
      level1_b: { a: 20, z: 10 }
    };
    const res1 = CanonicalSerializer.serialize(input1);
    const res2 = CanonicalSerializer.serialize(input2);
    expect(res1.canonicalString).toBe('{"level1_a":{"x":40,"y":30},"level1_b":{"a":20,"z":10}}');
    expect(res1.canonicalString).toBe(res2.canonicalString);
  });

  // TEST 03: Array order preservation
  it('TEST 03: Array order preservation', () => {
    const inputA = ['pointA', 'pointB'];
    const inputB = ['pointB', 'pointA'];
    const resA = CanonicalSerializer.serialize(inputA);
    const resB = CanonicalSerializer.serialize(inputB);
    expect(resA.canonicalString).toBe('["pointA","pointB"]');
    expect(resB.canonicalString).toBe('["pointB","pointA"]');
    expect(resA.canonicalString).not.toBe(resB.canonicalString);
  });

  // TEST 04: String Unicode NFC normalization
  it('TEST 04: String Unicode NFC normalization', () => {
    const composed = 'caf\u00e9'; // café with precomposed é
    const decomposed = 'cafe\u0301'; // café with e + combining acute
    const res1 = CanonicalSerializer.serialize({ word: composed });
    const res2 = CanonicalSerializer.serialize({ word: decomposed });
    expect(res1.canonicalString).toBe(res2.canonicalString);
  });

  // TEST 05: Case preservation
  it('TEST 05: Case preservation', () => {
    const resUpper = CanonicalSerializer.serialize({ part: 'PART_A' });
    const resLower = CanonicalSerializer.serialize({ part: 'part_a' });
    expect(resUpper.canonicalString).not.toBe(resLower.canonicalString);
    expect(resUpper.canonicalString).toBe('{"part":"PART_A"}');
    expect(resLower.canonicalString).toBe('{"part":"part_a"}');
  });

  // TEST 06: null preservation
  it('TEST 06: null preservation', () => {
    const res = CanonicalSerializer.serialize({ parentId: null });
    expect(res.canonicalString).toBe('{"parentId":null}');
    expect(res.normalized).toEqual({ parentId: null });
  });

  // TEST 07: boolean preservation
  it('TEST 07: boolean preservation', () => {
    const res = CanonicalSerializer.serialize({ isConverged: true, hasMeshGaps: false });
    expect(res.canonicalString).toBe('{"hasMeshGaps":false,"isConverged":true}');
  });

  // TEST 08: string vs number separation
  it('TEST 08: string vs number separation', () => {
    const resStr = CanonicalSerializer.serialize({ id: '1' });
    const resNum = CanonicalSerializer.serialize({ id: 1 });
    expect(resStr.canonicalString).toBe('{"id":"1"}');
    expect(resNum.canonicalString).toBe('{"id":1}');
    expect(resStr.canonicalString).not.toBe(resNum.canonicalString);
  });

  // TEST 09: -0 normalization
  it('TEST 09: -0 normalization', () => {
    const resNeg = CanonicalSerializer.serialize({ value: -0 });
    const resPos = CanonicalSerializer.serialize({ value: 0 });
    expect(resNeg.canonicalString).toBe('{"value":0}');
    expect(resNeg.canonicalString).toBe(resPos.canonicalString);
  });

  // TEST 10: NaN rejection
  it('TEST 10: NaN rejection', () => {
    expect(() => {
      CanonicalSerializer.serialize({ residual: NaN });
    }).toThrow(NonFiniteNumberError);
  });

  // TEST 11: Infinity rejection
  it('TEST 11: Infinity rejection', () => {
    expect(() => {
      CanonicalSerializer.serialize({ pressure: Infinity });
    }).toThrow(NonFiniteNumberError);

    expect(() => {
      CanonicalSerializer.serialize({ pressure: -Infinity });
    }).toThrow(NonFiniteNumberError);
  });

  // TEST 12: BigInt deterministic representation
  it('TEST 12: BigInt deterministic representation', () => {
    const big = BigInt('12345678901234567890');
    const res = CanonicalSerializer.serialize({ serial: big });
    expect(res.canonicalString).toBe('{"serial":{"$type":"bigint","$value":"12345678901234567890"}}');
  });

  // TEST 13: Date serialization
  it('TEST 13: Date serialization', () => {
    const fixedDate = new Date('2026-08-18T12:00:00.000Z');
    const res = CanonicalSerializer.serialize({ timestamp: fixedDate });
    expect(res.canonicalString).toBe('{"timestamp":"2026-08-18T12:00:00.000Z"}');
  });

  // TEST 14: Serializer does not create current time
  it('TEST 14: Serializer does not inject runtime timestamps', () => {
    const input = { artifactId: 'cad-001' };
    const res = CanonicalSerializer.serialize(input);
    expect(res.canonicalString).toBe('{"artifactId":"cad-001"}');
    expect(res.canonicalString.includes('2026')).toBe(false);
  });

  // TEST 15: Undefined object policy (omit)
  it('TEST 15: Undefined object policy (omit)', () => {
    const input = { a: 1, b: undefined, c: 3 };
    const res = CanonicalSerializer.serialize(input);
    expect(res.canonicalString).toBe('{"a":1,"c":3}');
  });

  // TEST 16: Undefined array rejection
  it('TEST 16: Undefined array rejection', () => {
    expect(() => {
      CanonicalSerializer.serialize([1, undefined, 3]);
    }).toThrow(UndefinedInArrayError);
  });

  // TEST 17: Unsupported Function rejection
  it('TEST 17: Unsupported Function rejection', () => {
    expect(() => {
      CanonicalSerializer.serialize({ handler: () => 42 });
    }).toThrow(UnsupportedTypeError);
  });

  // TEST 18: Circular reference detection
  it('TEST 18: Circular reference detection', () => {
    const cyclicObj: any = { name: 'cyclic' };
    cyclicObj.self = cyclicObj;

    expect(() => {
      CanonicalSerializer.serialize(cyclicObj);
    }).toThrow(CircularReferenceError);
  });

  // TEST 19: Input immutability
  it('TEST 19: Input immutability', () => {
    const input = {
      name: 'impeller',
      nodes: [{ id: 1 }, { id: 2 }],
      params: { speed: 3000 }
    };
    const cloneBefore = JSON.parse(JSON.stringify(input));
    CanonicalSerializer.serialize(input);
    expect(input).toEqual(cloneBefore);
  });

  // TEST 20: Canonical output has no unnecessary whitespace
  it('TEST 20: Canonical output has no unnecessary whitespace', () => {
    const res = CanonicalSerializer.serialize({
      title: 'Bracket Assembly',
      count: 4,
      nested: { x: 1, y: 2 }
    });
    expect(res.canonicalString).toBe('{"count":4,"nested":{"x":1,"y":2},"title":"Bracket Assembly"}');
    // Note: internal space in "Bracket Assembly" must be kept, but external tokens have 0 spaces
    expect(res.canonicalString.includes(': ')).toBe(false);
    expect(res.canonicalString.includes(', ')).toBe(false);
  });

  // TEST 21: Canonical validation
  it('TEST 21: Canonical validation', () => {
    const validStr = '{"a":1,"b":"valid"}';
    const invalidOrder = '{"b":2,"a":1}';
    const invalidWhitespace = '{"a": 1}';

    expect(CanonicalSerializer.validate(validStr).valid).toBe(true);
    expect(CanonicalSerializer.validate(invalidOrder).valid).toBe(false);
    expect(CanonicalSerializer.validate(invalidWhitespace).valid).toBe(false);
  });

  // TEST 22: Schema version
  it('TEST 22: Schema version is 1.0.0', () => {
    const res = CanonicalSerializer.serialize({ id: 'test' });
    expect(res.schemaVersion).toBe('1.0.0');
  });

  // TEST 23: EngineeringIdentity integration
  it('TEST 23: EngineeringIdentity integration', () => {
    const identity = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
      projectId: 'housing-volute-01',
      revisionId: 'rev-01',
      createdBy: 'CATIA',
      seed: 'seed'
    }, { });

    const res = CanonicalSerializer.serialize({ identity, status: 'APPROVED' });
    expect(res.canonicalString).toContain('"projectId":"housing-volute-01"');
  });

  // TEST 24: All EngineeringObjectType examples
  it('TEST 24: All EngineeringObjectType examples serialize deterministically', () => {
    const types: EngineeringObjectType[] = [
      EngineeringObjectType.GEOMETRY,
      EngineeringObjectType.MATERIAL,
      EngineeringObjectType.MESH,
      EngineeringObjectType.SIMULATION,
      EngineeringObjectType.TOOLPATH,
      EngineeringObjectType.RESULT,
      EngineeringObjectType.EVIDENCE,
      EngineeringObjectType.REVISION
    ];

    for (const t of types) {
      const id = EngineeringIdentityFactory.createIdentity({ objectType: t,
        projectId: `sample-project`,
        revisionId: 'rev-01',
        createdBy: 'test-user',
        seed: 'seed'
      }, { });
      const res = CanonicalSerializer.serialize({ identity: id, active: true });
      expect(res.canonicalString).toBeDefined();
      expect(res.byteLength).toBeGreaterThan(0);
      expect(res.canonicalString.includes(`"objectType":"${t}"`)).toBe(true);
    }
  });
});
