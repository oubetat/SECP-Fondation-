import { describe, it, expect } from 'vitest';
import { CoreExecutionAuthority } from '../../../../src/engine/execution/CoreExecutionAuthority';
import { runADSERepresentativePath } from '../../../../src/engine/adse/p0/ADSERepresentativePath';

describe('ADSE-P0 Provenance Suite', () => {
  it('wires execution results into the SECP Core Provenance DAG Graph', async () => {
    const res = await runADSERepresentativePath();
    expect(res.success).toBe(true);

    const provGraph = CoreExecutionAuthority.getProvenanceGraph();
    expect(provGraph).toBeDefined();
    const nodes = provGraph.getNodes();
    expect(nodes.length).toBeGreaterThan(0);
  });
});
