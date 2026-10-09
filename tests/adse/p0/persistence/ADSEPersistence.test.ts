import { describe, it, expect } from 'vitest';
import { GenericExecutionRegistry } from '../../../../src/engine/execution/GenericExecutionRegistry';
import { runADSERepresentativePath } from '../../../../src/engine/adse/p0/ADSERepresentativePath';

describe('ADSE-P0 Persistence Suite', () => {
  it('seals execution envelopes into GenericExecutionRegistry for durable state persistence', async () => {
    const res = await runADSERepresentativePath();
    const registered = GenericExecutionRegistry.getExecution(res.envelope.executionId);
    expect(registered).toBeDefined();
    expect(registered?.executionId).toBe(res.envelope.executionId);
    expect(registered?.state).toBe('SEALED');
  });
});
