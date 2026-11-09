import * as fs from 'fs';
import * as path from 'path';
import { IndependentPersistentEvidenceVerifier } from '../IndependentPersistentEvidenceVerifier';
import { initializeAuthorityHandshake } from '../../simulation/SimulationAuthorityInternal';

/**
 * CLI runner for out-of-process evidence chain verification.
 * Proves process-level cold-start recovery without shared memory state.
 */
function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: tsx standaloneVerifierProcess.ts <path-to-evidence-json>');
    process.exit(2);
  }

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(3);
  }

  // Initialize process-level authority handshake (simulating boot initialization)
  initializeAuthorityHandshake();

  try {
    const rawJson = fs.readFileSync(absolutePath, 'utf-8');
    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(rawJson);
    
    console.log(JSON.stringify(result, null, 2));

    if (result.isValid && result.provenanceValid) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`Fatal execution error: ${err?.message || err}`);
    process.exit(4);
  }
}

main();
