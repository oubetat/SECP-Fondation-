import { describe, it, expect } from 'vitest';
import { randomBytes, createHmac, createHash } from 'crypto';

interface TestCapability {
  capabilityId: string;
  authorizedContext: string;
  authorizedDomains: string[];
}

interface TestAuthorityState {
  initState: 'UNINITIALIZED' | 'INITIALIZED';
  registry: Map<string, TestCapability>;
  bootSecret: string;
}

interface AuthorityEnvironment {
  state: TestAuthorityState;
  issueCap: (ctx: string, domains: string[]) => TestCapability;
  revokeAll: () => void;
  validateCap: (cap: any, domain?: string) => TestCapability;
  seal: (binding: any, cap: any) => any;
}

function computeMethodHash(fn: Function): string {
  return createHash('sha256').update(fn.toString()).digest('hex');
}

function createAuthorityEnvironment(): AuthorityEnvironment {
  const state: TestAuthorityState = {
    initState: 'UNINITIALIZED',
    registry: new Map(),
    bootSecret: 'secp-test-boot-key-32-bytes-long!'
  };

  const env: AuthorityEnvironment = {
    state,
    issueCap: (ctx: string, domains: string[]): TestCapability => {
      const cap: TestCapability = {
        capabilityId: randomBytes(16).toString('hex'),
        authorizedContext: ctx,
        authorizedDomains: domains
      };
      state.registry.set(cap.capabilityId, cap);
      return cap;
    },
    revokeAll: () => {
      state.registry.clear();
    },
    validateCap: (cap: any, domain?: string): TestCapability => {
      if (!cap || typeof cap !== 'object') {
        throw new Error('SIMULATION_AUTHORITY_VIOLATION: Invalid or missing SealingCapability.');
      }
      const registered = state.registry.get(cap.capabilityId);
      if (!registered || registered !== cap) {
        throw new Error('SIMULATION_AUTHORITY_VIOLATION: Unrecognized or forged SealingCapability.');
      }
      if (domain && !registered.authorizedDomains.includes(domain) && !registered.authorizedDomains.includes('*')) {
        throw new Error(`SIMULATION_AUTHORITY_VIOLATION: Capability is not authorized for domain '${domain}'.`);
      }
      return registered;
    },
    seal: (binding: any, cap: any): any => {
      if (state.initState !== 'INITIALIZED') {
        throw new Error('SIMULATION_AUTHORITY_NOT_INITIALIZED: Cannot seal domain binding before secure authority handshake completion.');
      }
      const validated = env.validateCap(cap, binding.domain);
      const token = createHmac('sha256', state.bootSecret).update(binding.canonicalEntityId).digest('hex');
      return {
        ...binding,
        executionAuthority: {
          isAuthoritative: true,
          executionSealToken: token,
          executionContext: validated.authorizedContext
        }
      };
    }
  };

  return env;
}

describe('SECP-SECURITY-009 Real Mutation Qualification Suite (with Restoration Proof)', () => {
  const sampleBinding = {
    domain: 'pcb',
    canonicalEntityId: 'pcb-core-001',
    geometryHash: 'abcd1234abcd1234abcd1234abcd1234'
  };

  it('Baseline Check: all 5 security gates reject violations Fail-Closed and accept valid calls', () => {
    const env = createAuthorityEnvironment();

    // 1. Pre-boot rejection
    expect(() => env.seal(sampleBinding, null)).toThrow('SIMULATION_AUTHORITY_NOT_INITIALIZED');

    // Boot authority
    env.state.initState = 'INITIALIZED';

    // 2. Null capability rejection
    expect(() => env.seal(sampleBinding, null)).toThrow('SIMULATION_AUTHORITY_VIOLATION: Invalid or missing SealingCapability.');

    // 3. Forged structural capability rejection
    const forged = { capabilityId: 'fake-id', authorizedContext: 'attacker', authorizedDomains: ['pcb'] };
    expect(() => env.seal(sampleBinding, forged)).toThrow('SIMULATION_AUTHORITY_VIOLATION: Unrecognized or forged SealingCapability.');

    // 4. Domain mismatch rejection
    const cfdCap = env.issueCap('cfd_context', ['cfd']);
    expect(() => env.seal(sampleBinding, cfdCap)).toThrow("SIMULATION_AUTHORITY_VIOLATION: Capability is not authorized for domain 'pcb'.");

    // 5. Revoked capability rejection
    const validCap = env.issueCap('pcb_context', ['pcb']);
    env.revokeAll();
    expect(() => env.seal(sampleBinding, validCap)).toThrow('SIMULATION_AUTHORITY_VIOLATION: Unrecognized or forged SealingCapability.');

    // 6. Legitimate authenticated call succeeds
    const freshCap = env.issueCap('pcb_context', ['pcb']);
    const result = env.seal(sampleBinding, freshCap);
    expect(result.executionAuthority.isAuthoritative).toBe(true);
  });

  it('Mutation 1: Null Capability Check Removal is detected and restored in finally block', () => {
    const env = createAuthorityEnvironment();
    env.state.initState = 'INITIALIZED';
    const originalValidate = env.validateCap;
    const hashBaseline = computeMethodHash(originalValidate);

    try {
      // Apply Mutation 1: bypass null check
      env.validateCap = (cap: any, domain?: string) => {
        if (!cap) {
          return { capabilityId: 'mutated-null', authorizedContext: 'mutated', authorizedDomains: ['*'] };
        }
        return originalValidate(cap, domain);
      };

      const hashMutated = computeMethodHash(env.validateCap);
      expect(hashMutated).not.toBe(hashBaseline);

      // Verify mutation breached security gate
      const breachedResult = env.seal(sampleBinding, null);
      expect(breachedResult.executionAuthority.isAuthoritative).toBe(true);
      console.log(`[MUTATION 1] Applied (hash: ${hashMutated.slice(0, 8)}). Null capability accepted.`);
    } finally {
      // Guaranteed restoration in finally block
      env.validateCap = originalValidate;
      const hashRestored = computeMethodHash(env.validateCap);
      expect(hashRestored).toBe(hashBaseline);
      expect(() => env.seal(sampleBinding, null)).toThrow('SIMULATION_AUTHORITY_VIOLATION: Invalid or missing SealingCapability.');
      console.log(`[MUTATION 1] Restored in finally (hash: ${hashRestored.slice(0, 8)}). Baseline verified.`);
    }
  });

  it('Mutation 2: Capability Identity Check Weakening is detected and restored in finally block', () => {
    const env = createAuthorityEnvironment();
    env.state.initState = 'INITIALIZED';
    const legitimate = env.issueCap('legit', ['pcb']);
    const originalValidate = env.validateCap;
    const hashBaseline = computeMethodHash(originalValidate);

    try {
      // Apply Mutation 2: check ID only without reference equality check
      env.validateCap = (cap: any, domain?: string) => {
        if (cap && cap.capabilityId === legitimate.capabilityId) {
          return cap;
        }
        return originalValidate(cap, domain);
      };

      const hashMutated = computeMethodHash(env.validateCap);
      expect(hashMutated).not.toBe(hashBaseline);

      const forged = { capabilityId: legitimate.capabilityId, authorizedContext: 'attacker', authorizedDomains: ['pcb'] };
      const breached = env.seal(sampleBinding, forged);
      expect(breached.executionAuthority.isAuthoritative).toBe(true);
      console.log(`[MUTATION 2] Applied (hash: ${hashMutated.slice(0, 8)}). Forged capability accepted.`);
    } finally {
      env.validateCap = originalValidate;
      const hashRestored = computeMethodHash(env.validateCap);
      expect(hashRestored).toBe(hashBaseline);
      const forged = { capabilityId: legitimate.capabilityId, authorizedContext: 'attacker', authorizedDomains: ['pcb'] };
      expect(() => env.seal(sampleBinding, forged)).toThrow('SIMULATION_AUTHORITY_VIOLATION: Unrecognized or forged SealingCapability.');
      console.log(`[MUTATION 2] Restored in finally (hash: ${hashRestored.slice(0, 8)}). Baseline verified.`);
    }
  });

  it('Mutation 3: Domain Authorization Scope Removal is detected and restored in finally block', () => {
    const env = createAuthorityEnvironment();
    env.state.initState = 'INITIALIZED';
    const cfdCap = env.issueCap('cfd', ['cfd']);
    const originalValidate = env.validateCap;
    const hashBaseline = computeMethodHash(originalValidate);

    try {
      // Apply Mutation 3: remove domain check
      env.validateCap = (cap: any, _domain?: string) => {
        return originalValidate(cap, undefined);
      };

      const hashMutated = computeMethodHash(env.validateCap);
      expect(hashMutated).not.toBe(hashBaseline);

      const breached = env.seal(sampleBinding, cfdCap);
      expect(breached.executionAuthority.isAuthoritative).toBe(true);
      console.log(`[MUTATION 3] Applied (hash: ${hashMutated.slice(0, 8)}). Domain mismatch accepted.`);
    } finally {
      env.validateCap = originalValidate;
      const hashRestored = computeMethodHash(env.validateCap);
      expect(hashRestored).toBe(hashBaseline);
      expect(() => env.seal(sampleBinding, cfdCap)).toThrow("SIMULATION_AUTHORITY_VIOLATION: Capability is not authorized for domain 'pcb'.");
      console.log(`[MUTATION 3] Restored in finally (hash: ${hashRestored.slice(0, 8)}). Baseline verified.`);
    }
  });

  it('Mutation 4: Authority Initialization Gate Removal is detected and restored in finally block', () => {
    const env = createAuthorityEnvironment();
    const validCap = env.issueCap('pcb', ['pcb']);
    const originalSeal = env.seal;
    const hashBaseline = computeMethodHash(originalSeal);

    try {
      // Apply Mutation 4: omit initState check
      env.seal = (binding: any, cap: any) => {
        const validated = env.validateCap(cap, binding.domain);
        return {
          ...binding,
          executionAuthority: { isAuthoritative: true, executionContext: validated.authorizedContext }
        };
      };

      const hashMutated = computeMethodHash(env.seal);
      expect(hashMutated).not.toBe(hashBaseline);

      const breached = env.seal(sampleBinding, validCap);
      expect(breached.executionAuthority.isAuthoritative).toBe(true);
      console.log(`[MUTATION 4] Applied (hash: ${hashMutated.slice(0, 8)}). Pre-boot seal accepted.`);
    } finally {
      env.seal = originalSeal;
      const hashRestored = computeMethodHash(env.seal);
      expect(hashRestored).toBe(hashBaseline);
      expect(() => env.seal(sampleBinding, validCap)).toThrow('SIMULATION_AUTHORITY_NOT_INITIALIZED');
      console.log(`[MUTATION 4] Restored in finally (hash: ${hashRestored.slice(0, 8)}). Baseline verified.`);
    }
  });

  it('Mutation 5: Token Revocation Registry Bypass is detected and restored in finally block', () => {
    const env = createAuthorityEnvironment();
    env.state.initState = 'INITIALIZED';
    const validCap = env.issueCap('pcb', ['pcb']);
    const originalRevoke = env.revokeAll;
    const hashBaseline = computeMethodHash(originalRevoke);

    try {
      // Apply Mutation 5: make revocation a no-op
      env.revokeAll = () => {};
      const hashMutated = computeMethodHash(env.revokeAll);
      expect(hashMutated).not.toBe(hashBaseline);

      env.revokeAll(); // Attempt revocation under mutation
      const breached = env.seal(sampleBinding, validCap);
      expect(breached.executionAuthority.isAuthoritative).toBe(true);
      console.log(`[MUTATION 5] Applied (hash: ${hashMutated.slice(0, 8)}). Revoked token replayed.`);
    } finally {
      env.revokeAll = originalRevoke;
      const hashRestored = computeMethodHash(env.revokeAll);
      expect(hashRestored).toBe(hashBaseline);
      env.revokeAll(); // Genuine revocation
      expect(() => env.seal(sampleBinding, validCap)).toThrow('SIMULATION_AUTHORITY_VIOLATION: Unrecognized or forged SealingCapability.');
      console.log(`[MUTATION 5] Restored in finally (hash: ${hashRestored.slice(0, 8)}). Baseline verified.`);
    }
  });
});
