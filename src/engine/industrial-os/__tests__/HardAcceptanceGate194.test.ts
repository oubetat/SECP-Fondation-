import { describe, it, expect, vi } from 'vitest';
import { HardAcceptanceGate194 } from '../HardAcceptanceGate194';

vi.mock('crypto', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    randomUUID: original.randomUUID || (() => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    })
  };
});

if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  };
} else if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as any).randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

describe('PATCH-194 Hard Acceptance Gate', () => {
  it('should pass all 30 strict verification checks with 30/30 score', () => {
    const result = HardAcceptanceGate194.execute();
    console.log(`Gate 194 execution score: ${result.score}/30`);
    if (!result.passed) {
      console.error('Failed checks:', Object.entries(result.checks).filter(([_, v]) => !v));
    }
    expect(result.score).toBe(30);
    expect(result.passed).toBe(true);
  });
});
