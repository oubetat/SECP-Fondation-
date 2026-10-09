import { describe, it, expect } from 'vitest';
import { StepAp242Pipeline } from '../../StepAp242Pipeline';
import { AP242PmiGate } from '../AP242PmiGate';
import * as fs from 'fs';
import * as path from 'path';

describe('AP242 PMI Native Pipeline (PATCH-035)', () => {
  const fixturePath = path.join(process.cwd(), 'src/engine/interop/step-ap242/pmi/__fixtures__/pmi_box.stp');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf8');

  it('successfully processes PMI entities through round-trip', async () => {
    const result = await StepAp242Pipeline.execute(fixtureContent, 'pmi_box.stp');
    
    expect(result.pmiModel).toBeDefined();
    expect(result.pmiModel!.length).toBe(4);
    
    const semanticPmis = result.pmiModel!.filter(p => p.isSemantic);
    expect(semanticPmis.length).toBe(3);

    expect(result.pmiValidations?.every(v => v.status === 'VALID')).toBe(true);

    const gate = AP242PmiGate.evaluate(result.pmiValidations!, result.pmiFidelity!);
    
    if (!gate.passed) {
      console.log('PMI Gate Findings:', gate.findings);
      console.log('PMI Loss:', result.pmiFidelity?.lossDetails);
    }
    
    expect(gate.passed).toBe(true);
    expect(gate.verdict).toBe('PASS');
    expect(result.pmiFidelity?.verdict).toBe('EXACT');
  });

  it('detects missing references (adversarial)', async () => {
    const brokenContent = fixtureContent.replace('(#21)', '(#999)');
    const result = await StepAp242Pipeline.execute(brokenContent, 'broken_pmi.stp');
    
    expect(result.pmiFidelity?.verdict).not.toBe('EXACT');
  });
});
