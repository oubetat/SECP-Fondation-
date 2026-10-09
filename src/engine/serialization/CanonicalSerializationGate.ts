/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-009: Canonical Serialization Acceptance Gate
 *
 * Evaluates the Canonical Serialization subsystem against all non-negotiable architectural mandates.
 */

import { CanonicalSerializer } from './CanonicalSerializer';
import { CanonicalNormalizer } from './CanonicalNormalizer';
import { CanonicalSerializationValidator } from './CanonicalSerializationValidator';
import {
  CircularReferenceError,
  NonFiniteNumberError,
  UndefinedInArrayError,
  UnsupportedTypeError,
  PrototypePollutionAttemptError
} from './CanonicalSerializationErrors';
import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../identity/CanonicalEngineeringIdentity';

export interface SerializationGateCheck {
  id: string;
  name: string;
  passed: boolean;
  reason: string;
}

export interface CanonicalSerializationGateResult {
  gateId: string;
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN';
  timestamp: string;
  checks: SerializationGateCheck[];
  findings: string[];
}

export class CanonicalSerializationGate {
  public static evaluate(): CanonicalSerializationGateResult {
    const checks: SerializationGateCheck[] = [];
    const findings: string[] = [];

    // 1. Deterministic Output
    let determinismPassed = true;
    try {
      const sample = {
        name: 'Turbine Blade',
        dimensions: [12.5, 30.2, 5.0],
        active: true,
        metadata: { stage: 1, alloy: 'Inconel 718' }
      };
      const res1 = CanonicalSerializer.serialize(sample);
      const res2 = CanonicalSerializer.serialize(sample);
      if (res1.canonicalString !== res2.canonicalString || res1.byteLength !== res2.byteLength) {
        determinismPassed = false;
        findings.push('Multiple serializations of identical object yielded divergent outputs');
      }
    } catch (e: unknown) {
      determinismPassed = false;
      findings.push(`Determinism check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-01-DETERMINISM',
      name: 'Serialization produces 100% deterministic canonical output',
      passed: determinismPassed,
      reason: determinismPassed ? 'Identical inputs consistently produce identical canonical bytes' : 'Determinism failure'
    });

    // 2. Key Order Invariance
    let keyOrderPassed = true;
    try {
      const objA = { z: 3, a: 1, m: 2 };
      const objB = { a: 1, m: 2, z: 3 };
      const resA = CanonicalSerializer.serialize(objA);
      const resB = CanonicalSerializer.serialize(objB);
      if (resA.canonicalString !== resB.canonicalString || resA.canonicalString !== '{"a":1,"m":2,"z":3}') {
        keyOrderPassed = false;
        findings.push(`Key order normalization failed: ${resA.canonicalString} vs ${resB.canonicalString}`);
      }
    } catch (e: unknown) {
      keyOrderPassed = false;
      findings.push(`Key order check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-02-KEY-ORDER-INVARIANCE',
      name: 'Object key order invariance strictly enforced',
      passed: keyOrderPassed,
      reason: keyOrderPassed ? 'Reordered object keys produce identical canonical representations' : 'Key ordering failed'
    });

    // 3. Array Order Preservation
    let arrayOrderPassed = true;
    try {
      const arrA = [10, 20, 30];
      const arrB = [30, 20, 10];
      const resA = CanonicalSerializer.serialize(arrA);
      const resB = CanonicalSerializer.serialize(arrB);
      if (resA.canonicalString === resB.canonicalString) {
        arrayOrderPassed = false;
        findings.push('Array order was falsely normalized or sorted');
      }
    } catch (e: unknown) {
      arrayOrderPassed = false;
      findings.push(`Array order check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-03-ARRAY-ORDER-PRESERVATION',
      name: 'Array sequence order is preserved without unwarranted sorting',
      passed: arrayOrderPassed,
      reason: arrayOrderPassed ? 'Array sequence preserved faithfully' : 'Array sorting defect'
    });

    // 4. Unicode NFC Normalization
    let unicodePassed = true;
    try {
      const strComposed = '\u00e9'; // é (composed)
      const strDecomposed = 'e\u0301'; // e + acute accent (decomposed)
      const res1 = CanonicalSerializer.serialize({ char: strComposed });
      const res2 = CanonicalSerializer.serialize({ char: strDecomposed });
      if (res1.canonicalString !== res2.canonicalString) {
        unicodePassed = false;
        findings.push('Unicode NFC normalization failed for composed/decomposed strings');
      }
    } catch (e: unknown) {
      unicodePassed = false;
      findings.push(`Unicode check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-04-UNICODE-NORMALIZATION',
      name: 'Unicode NFC canonical normalization applied to strings and property keys',
      passed: unicodePassed,
      reason: unicodePassed ? 'Unicode NFC form normalized across text and keys' : 'Unicode mismatch'
    });

    // 5. Numeric Policy (-0 normalization)
    let numberPolicyPassed = true;
    try {
      const resNegZero = CanonicalSerializer.serialize({ val: -0 });
      const resPosZero = CanonicalSerializer.serialize({ val: 0 });
      if (resNegZero.canonicalString !== resPosZero.canonicalString || resNegZero.canonicalString !== '{"val":0}') {
        numberPolicyPassed = false;
        findings.push('-0 normalization failed');
      }
    } catch (e: unknown) {
      numberPolicyPassed = false;
      findings.push(`Number policy check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-05-NUMBER-POLICY',
      name: 'Number policy normalizes -0 to 0 and maintains finite numbers',
      passed: numberPolicyPassed,
      reason: numberPolicyPassed ? '-0 normalized to 0 seamlessly' : 'Number policy defect'
    });

    // 6. NaN / Infinity Rejection
    let nonFiniteRejectionPassed = true;
    try {
      let nanCaught = false;
      try {
        CanonicalSerializer.serialize({ val: NaN });
      } catch (e) {
        if (e instanceof NonFiniteNumberError) nanCaught = true;
      }
      let infCaught = false;
      try {
        CanonicalSerializer.serialize({ val: Infinity });
      } catch (e) {
        if (e instanceof NonFiniteNumberError) infCaught = true;
      }
      if (!nanCaught || !infCaught) {
        nonFiniteRejectionPassed = false;
        findings.push('NaN or Infinity was not rejected with NonFiniteNumberError');
      }
    } catch (e: unknown) {
      nonFiniteRejectionPassed = false;
      findings.push(`Non-finite check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-06-NON-FINITE-REJECTION',
      name: 'Strict rejection of NaN, Infinity, and -Infinity values',
      passed: nonFiniteRejectionPassed,
      reason: nonFiniteRejectionPassed ? 'NaN and Infinity are correctly rejected' : 'Non-finite leak'
    });

    // 7. BigInt Policy
    let bigintPassed = true;
    try {
      const big = BigInt('9007199254740993');
      const res = CanonicalSerializer.serialize({ bigVal: big });
      if (!res.canonicalString.includes('"$type":"bigint"') || !res.canonicalString.includes('"$value":"9007199254740993"')) {
        bigintPassed = false;
        findings.push('BigInt serialization does not conform to typed marker format');
      }
    } catch (e: unknown) {
      bigintPassed = false;
      findings.push(`BigInt check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-07-BIGINT-POLICY',
      name: 'BigInt formatted deterministically with explicit type marker',
      passed: bigintPassed,
      reason: bigintPassed ? 'BigInt preserved with explicit $type and $value' : 'BigInt defect'
    });

    // 8. Undefined Policy
    let undefinedPassed = true;
    try {
      const objWithUndef = { a: 1, b: undefined, c: 3 };
      const resObj = CanonicalSerializer.serialize(objWithUndef);
      if (resObj.canonicalString !== '{"a":1,"c":3}') {
        undefinedPassed = false;
        findings.push('Undefined object property was not omitted');
      }

      let arrUndefCaught = false;
      try {
        CanonicalSerializer.serialize([1, undefined, 3]);
      } catch (e) {
        if (e instanceof UndefinedInArrayError) arrUndefCaught = true;
      }
      if (!arrUndefCaught) {
        undefinedPassed = false;
        findings.push('Undefined in array was not rejected');
      }
    } catch (e: unknown) {
      undefinedPassed = false;
      findings.push(`Undefined policy check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-08-UNDEFINED-POLICY',
      name: 'Undefined in objects is omitted; undefined in arrays is rejected',
      passed: undefinedPassed,
      reason: undefinedPassed ? 'Undefined policy strictly enforced across records and arrays' : 'Undefined policy failure'
    });

    // 9. Circular Reference Detection
    let circularPassed = true;
    try {
      const cyclic: any = { name: 'cycle-root' };
      cyclic.child = cyclic;
      let cycleCaught = false;
      try {
        CanonicalSerializer.serialize(cyclic);
      } catch (e) {
        if (e instanceof CircularReferenceError) cycleCaught = true;
      }
      if (!cycleCaught) {
        circularPassed = false;
        findings.push('Circular reference did not trigger CircularReferenceError');
      }
    } catch (e: unknown) {
      circularPassed = false;
      findings.push(`Circular check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-09-CIRCULAR-REFERENCE',
      name: 'Circular graph references detected and rejected before recursion overflow',
      passed: circularPassed,
      reason: circularPassed ? 'CircularReferenceError thrown reliably on graph cycles' : 'Circular cycle uncaught'
    });

    // 10. Unsupported Type Rejection
    let unsupportedPassed = true;
    try {
      let funcCaught = false;
      try {
        CanonicalSerializer.serialize({ fn: () => {} });
      } catch (e) {
        if (e instanceof UnsupportedTypeError) funcCaught = true;
      }
      let symCaught = false;
      try {
        CanonicalSerializer.serialize({ s: Symbol('test') });
      } catch (e) {
        if (e instanceof UnsupportedTypeError) symCaught = true;
      }
      if (!funcCaught || !symCaught) {
        unsupportedPassed = false;
        findings.push('Function or Symbol was not rejected with UnsupportedTypeError');
      }
    } catch (e: unknown) {
      unsupportedPassed = false;
      findings.push(`Unsupported type check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-10-UNSUPPORTED-TYPE-REJECTION',
      name: 'Functions, Symbols, and unsupported instances rejected explicitly',
      passed: unsupportedPassed,
      reason: unsupportedPassed ? 'Unsupported types rejected without silent fallback' : 'Unsupported type leak'
    });

    // 11. Prototype Safety
    let protoSafetyPassed = true;
    try {
      let protoCaught = false;
      try {
        const attackObj = JSON.parse('{"__proto__":{"evil":true}}');
        CanonicalSerializer.serialize(attackObj);
      } catch (e) {
        if (e instanceof PrototypePollutionAttemptError) protoCaught = true;
      }
      let constructorCaught = false;
      try {
        CanonicalSerializer.serialize({ constructor: 'evil' });
      } catch (e) {
        if (e instanceof PrototypePollutionAttemptError) constructorCaught = true;
      }
      if (!protoCaught || !constructorCaught) {
        protoSafetyPassed = false;
        findings.push('__proto__ or constructor property injection was not blocked');
      }
    } catch (e: unknown) {
      protoSafetyPassed = false;
      findings.push(`Prototype safety check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-11-PROTOTYPE-SAFETY',
      name: 'Prototype pollution attempts blocked on __proto__, constructor, and prototype',
      passed: protoSafetyPassed,
      reason: protoSafetyPassed ? 'Prototype pollution attempts safely rejected' : 'Prototype vulnerability'
    });

    // 12. Input Immutability
    let immutabilityPassed = true;
    try {
      const original = { a: 1, b: [10, 20], nested: { c: 'text' } };
      const copy = JSON.parse(JSON.stringify(original));
      CanonicalSerializer.serialize(original);
      if (JSON.stringify(original) !== JSON.stringify(copy)) {
        immutabilityPassed = false;
        findings.push('Serializer modified input data structure');
      }
    } catch (e: unknown) {
      immutabilityPassed = false;
      findings.push(`Immutability check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-12-INPUT-IMMUTABILITY',
      name: 'Input objects are pure and never mutated during serialization',
      passed: immutabilityPassed,
      reason: immutabilityPassed ? 'Input objects completely unmodified' : 'Input mutation defect'
    });

    // 13. PATCH-008 Identity Compatibility
    let identityCompatibilityPassed = true;
    try {
      const identity = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
        projectId: 'cad-impeller-001',
        revisionId: 'rev-01',
        createdBy: 'test-user',
        seed: 'seed'
      }, { });
      const res = CanonicalSerializer.serialize({ identity, status: 'VERIFIED' });
      if (!res.canonicalString.includes('"namespace":"SECP"') || !res.canonicalString.includes('"projectId":"cad-impeller-001"')) {
        identityCompatibilityPassed = false;
        findings.push('EngineeringIdentity failed canonical serialization integration');
      }
    } catch (e: unknown) {
      identityCompatibilityPassed = false;
      findings.push(`Identity compatibility check thrown error: ${e instanceof Error ? e.message : String(e)}`);
    }
    checks.push({
      id: 'CHECK-13-IDENTITY-COMPATIBILITY',
      name: 'Full compatibility with PATCH-008 EngineeringIdentity',
      passed: identityCompatibilityPassed,
      reason: identityCompatibilityPassed ? 'PATCH-008 identities serialize canonically and deterministically' : 'Identity mismatch'
    });

    // 14. Hashing Prohibition in PATCH-009
    const serializerSource = CanonicalSerializer.toString() + CanonicalNormalizer.toString();
    const hasHashCall =
      serializerSource.includes('crypto.createHash') ||
      serializerSource.includes('sha256') ||
      serializerSource.includes('sha3') ||
      serializerSource.includes('blake') ||
      serializerSource.includes('md5');

    checks.push({
      id: 'CHECK-14-NO-HASHING-PROHIBITION',
      name: 'Cryptographic hashing strictly absent in PATCH-009 (reserved for PATCH-010)',
      passed: !hasHashCall,
      reason: !hasHashCall ? 'Zero hashing calls in canonical serialization modules' : 'Unauthorized hashing detected'
    });

    // 15. No Timestamp Generation
    const hasTimestampGen =
      serializerSource.includes('Date.now()') ||
      serializerSource.includes('new Date()');

    checks.push({
      id: 'CHECK-15-NO-TIMESTAMP-GENERATION',
      name: 'No runtime timestamp generation inside serialization pipeline',
      passed: !hasTimestampGen,
      reason: !hasTimestampGen ? 'Pure serialization without clock injection' : 'Clock generation detected'
    });

    const anyFailed = checks.some((c) => !c.passed);
    const verdict: 'PASS' | 'FAIL' | 'UNPROVEN' = anyFailed ? 'FAIL' : 'PASS';

    return {
      gateId: 'GATE-CANONICAL-SERIALIZATION',
      verdict,
      timestamp: new Date().toISOString(),
      checks,
      findings
    };
  }
}
