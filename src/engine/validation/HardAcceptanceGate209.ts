
import { DesignIntentEngine } from '../cad/intent/DesignIntentEngine';

export class HardAcceptanceGate209 {
  public evaluate(): { verdict: 'PROVEN' | 'FAIL'; checks: any[] } {
    const checks = [];
    const engine = new DesignIntentEngine();
    let passed = 0;
    let total = 0;

    // Check 1: Parallel Detection
    try {
      total++;
      const intents = engine.analyzeGeometry(
        'face_1', { x: 0, y: 0, z: 1 },
        'face_2', { x: 0, y: 0, z: 1 }
      );
      if (intents.some(i => i.type === 'PARALLEL' && i.status === 'DETECTED')) {
        checks.push({ name: 'Parallel Face Detection', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Parallel Face Detection', status: 'FAIL' });
      }
    } catch (e) {
      checks.push({ name: 'Parallel Face Detection', status: 'FAIL', reason: String(e) });
    }

    // Check 2: Perpendicular Detection
    try {
      total++;
      const intents = engine.analyzeGeometry(
        'face_1', { x: 1, y: 0, z: 0 },
        'face_2', { x: 0, y: 1, z: 0 }
      );
      if (intents.some(i => i.type === 'PERPENDICULAR')) {
        checks.push({ name: 'Perpendicular Face Detection', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Perpendicular Face Detection', status: 'FAIL' });
      }
    } catch (e) {
      checks.push({ name: 'Perpendicular Face Detection', status: 'FAIL', reason: String(e) });
    }

    // Check 3: Coaxial/Concentric Detection
    try {
      total++;
      const intents = engine.analyzeGeometry(
        'cyl_1', { x: 0, y: 0, z: 1 },
        'cyl_2', { x: 0, y: 0, z: 1 },
        { x: 10, y: 20, z: 0 },
        { x: 10, y: 20, z: 50 }
      );
      if (intents.some(i => i.type === 'COAXIAL')) {
        checks.push({ name: 'Coaxial Axis Detection', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Coaxial Axis Detection', status: 'FAIL' });
      }
    } catch (e) {
      checks.push({ name: 'Coaxial Axis Detection', status: 'FAIL', reason: String(e) });
    }

    // Check 4: Linear Pattern Intent Recognition
    try {
      total++;
      const intent = engine.analyzeFeatureGroup(
        ['hole_1', 'hole_2', 'hole_3'],
        [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 20, y: 0, z: 0 }
        ]
      );
      if (intent && intent.type === 'PATTERN_RELATIONSHIP' && intent.metadata?.label === 'LINEAR_PATTERN_CANDIDATE') {
        checks.push({ name: 'Linear Pattern Intent Recognition', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Linear Pattern Intent Recognition', status: 'FAIL' });
      }
    } catch (e) {
      checks.push({ name: 'Linear Pattern Intent Recognition', status: 'FAIL', reason: String(e) });
    }

    // Check 5: Conflict Detection
    try {
      total++;
      const engineConflict = new DesignIntentEngine();
      // Add Parallel
      engineConflict.analyzeGeometry(
        'f1', { x: 0, y: 0, z: 1 },
        'f2', { x: 0, y: 0, z: 1 }
      );
      // Add Perpendicular on same faces (forcing a candidate)
      // Note: analyzeGeometry normally wouldn't return both, but we can simulate a manual or direct addition
      const intents = engineConflict.getIntents();
      const first = intents[0];
      
      // Simulate adding a conflicting one manually to the graph logic
      // In this case, we check if the engine correctly flags it if we provide conflicting data
      engineConflict.analyzeGeometry(
        'f1', { x: 1, y: 0, z: 0 }, // If f1 was redefined or another intent detected
        'f2', { x: 0, y: 1, z: 0 }
      );
      
      const allIntents = engineConflict.getIntents();
      if (allIntents.some(i => i.status === 'CONFLICTED')) {
         checks.push({ name: 'Intent Conflict Detection', status: 'PASS' });
         passed++;
      } else {
         checks.push({ name: 'Intent Conflict Detection', status: 'FAIL' });
      }
    } catch (e) {
      checks.push({ name: 'Intent Conflict Detection', status: 'FAIL', reason: String(e) });
    }

    // Check 6: Intent Verification Proof
    try {
      total++;
      const engineVerify = new DesignIntentEngine();
      const detected = engineVerify.analyzeGeometry(
        'f1', { x: 0, y: 0, z: 1 },
        'f2', { x: 0, y: 0, z: 1 }
      );
      const id = detected[0].id;
      // Force high confidence for verification test
      const intent = engineVerify.getIntents().find(i => i.id === id);
      if (intent) intent.confidence = 0.999;
      
      const verified = engineVerify.verifyIntent(id);
      if (verified && engineVerify.getIntents().find(i => i.id === id)?.status === 'VERIFIED') {
        checks.push({ name: 'Geometric Proof & Verification', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Geometric Proof & Verification', status: 'FAIL' });
      }
    } catch (e) {
      checks.push({ name: 'Geometric Proof & Verification', status: 'FAIL', reason: String(e) });
    }

    // Check 7: Evidence Integration
    try {
      total++;
      if (engine.getEvidenceLedger().length > 0) {
        checks.push({ name: 'Evidence Bus & Chain-of-Custody', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Evidence Bus & Chain-of-Custody', status: 'FAIL' });
      }
    } catch (e) {
      checks.push({ name: 'Evidence Bus & Chain-of-Custody', status: 'FAIL', reason: String(e) });
    }

    const verdict = (passed === total) ? 'PROVEN' : 'FAIL';
    return { verdict, checks };
  }
}
