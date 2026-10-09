
import { 
  DesignIntent, 
  IntentType, 
  IntentStatus, 
  IntentEvidenceEvent, 
  Vector3D 
} from './IntentTypes';
import { GeometricIntentDetector } from './GeometricIntentDetector';
import { FeatureIntentRecognizer } from './FeatureIntentRecognizer';
import { DesignIntentGraph } from './DesignIntentGraph';

export class DesignIntentEngine {
  private detector = new GeometricIntentDetector();
  private recognizer = new FeatureIntentRecognizer();
  private graph = new DesignIntentGraph();
  private evidenceLedger: IntentEvidenceEvent[] = [];

  public analyzeGeometry(
    id1: string, v1: Vector3D, 
    id2: string, v2: Vector3D,
    origin1?: Vector3D, origin2?: Vector3D
  ): DesignIntent[] {
    const candidates: DesignIntent[] = [];

    // Parallelism
    const parallel = this.detector.detectParallel(id1, v1, id2, v2);
    if (parallel) candidates.push(parallel);

    // Perpendicularity
    const perp = this.detector.detectPerpendicular(id1, v1, id2, v2);
    if (perp) candidates.push(perp);

    // Coaxiality
    if (origin1 && origin2) {
      const coaxial = this.detector.detectCoaxial(id1, origin1, v1, id2, origin2, v2);
      if (coaxial) candidates.push(coaxial);
    }

    candidates.forEach(intent => {
      this.graph.addIntent(intent);
      this.recordEvidence(intent, 'INTENT_DETECTED');
    });

    return candidates;
  }

  public analyzeFeatureGroup(
    ids: string[], 
    positions: Vector3D[]
  ): DesignIntent | null {
    const pattern = this.recognizer.recognizePatternIntent(ids, positions);
    if (pattern) {
      this.graph.addIntent(pattern);
      this.recordEvidence(pattern, 'INTENT_DETECTED');
    }
    return pattern;
  }

  public verifyIntent(id: string): boolean {
    const result = this.graph.verifyIntent(id);
    const intent = this.graph.getIntent(id);
    if (intent && result) {
      this.recordEvidence(intent, 'INTENT_VERIFIED');
    }
    return result;
  }

  public applyIntent(id: string) {
    const intent = this.graph.getIntent(id);
    if (intent) {
      intent.status = 'APPLIED';
      this.recordEvidence(intent, 'INTENT_APPLIED');
    }
  }

  public getIntents(): DesignIntent[] {
    return this.graph.getIntents();
  }

  public getEvidenceLedger(): IntentEvidenceEvent[] {
    return [...this.evidenceLedger];
  }

  private recordEvidence(intent: DesignIntent, eventType: IntentEvidenceEvent['eventType']) {
    const eventId = `ev_intent_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const event: IntentEvidenceEvent = {
      eventId,
      eventType,
      intentId: intent.id,
      intentType: intent.type,
      timestamp: new Date().toISOString(),
      hash: `hash_${eventId}_${intent.status}`
    };
    this.evidenceLedger.push(event);
  }
}
