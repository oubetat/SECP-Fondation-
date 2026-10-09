import { describe, it, expect } from 'vitest';
import { StepAp242Pipeline } from '../StepAp242Pipeline';
import { StepAp242NativeGate } from '../StepAp242NativeGate';
import * as fs from 'fs';
import * as path from 'path';

describe('STEP AP242 Native Pipeline (PATCH-034)', () => {
  const fixturePath = path.join(process.cwd(), 'src/engine/interop/step-ap242/__fixtures__/simple_box.stp');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf8');
  console.log('PIPELINE FIXTURE LEN:', fixtureContent.length, JSON.stringify(fixturePath));

  it('successfully processes a valid AP242 STEP file through the full pipeline', async () => {
    const result = await StepAp242Pipeline.execute(fixtureContent, 'simple_box.stp');
    
    if (result.validation.status === 'INVALID') {
      console.log('Validation Errors:', result.validation.errors);
    }

    expect(result.validation.status).toBe('VALID');
    expect(result.validation.referenceIntegrity).toBe(true);
    expect(result.nativeModel).toBeDefined();
    expect(result.fidelity?.verdict).toBe('EXACT');

    const gate = StepAp242NativeGate.evaluate(result);
    if (!gate.passed) {
      console.log('Gate Findings:', gate.findings);
      console.log('Loss Reports:', result.fidelity?.lossReports);
    }
    expect(gate.passed).toBe(true);
    expect(gate.verdict).toBe('PASS');
  });

  it('detects schema violations', async () => {
    const invalidSchemaContent = fixtureContent.replace('AP242', 'AP203_NOT_SUPPORTED').replace('242', '203');
    const result = await StepAp242Pipeline.execute(invalidSchemaContent, 'invalid_schema.stp');
    
    expect(result.validation.status).toBe('INVALID');
    expect(result.validation.errors[0]).toContain('INVALID_SCHEMA');
    
    const gate = StepAp242NativeGate.evaluate(result);
    expect(gate.passed).toBe(false);
    expect(gate.verdict).toBe('INVALID');
  });

  it('detects dangling references (adversarial)', async () => {
    const brokenRefContent = fixtureContent.replace('#22', '#9999');
    const result = await StepAp242Pipeline.execute(brokenRefContent, 'broken_ref.stp');
    
    expect(result.validation.referenceIntegrity).toBe(false);
    expect(result.validation.errors.some(e => e.includes('DANGLING_REFERENCE'))).toBe(true);
    
    const gate = StepAp242NativeGate.evaluate(result);
    expect(gate.passed).toBe(false);
    expect(gate.verdict).toBe('INVALID');
  });
});
