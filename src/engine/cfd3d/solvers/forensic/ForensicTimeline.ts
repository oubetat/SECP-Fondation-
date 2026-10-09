/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-073: Forensic Timeline & Anomaly Detection Engine
 */

import { TimelineEvent } from './ForensicTypes';
import { EngineeringClock } from '../../../clock/EngineeringClock';
import { ArtifactHasher } from './ArtifactRegistry';

export class ForensicTimeline {
  private readonly events: TimelineEvent[] = [];

  public recordEvent(eventName: string, runId: string, timestamp?: string, artifactId?: string): TimelineEvent {
    const ts = timestamp ?? EngineeringClock.nowISO();
    const epochMs = new Date(ts).getTime();
    const eventId = `evt-${this.events.length + 1}-${ArtifactHasher.computeHash({ eventName, runId, ts, artifactId }).substring(0, 8)}`;

    const event: TimelineEvent = {
      eventId,
      runId,
      artifactId,
      eventName,
      timestamp: ts,
      epochMs
    };

    this.events.push(event);
    return event;
  }

  public auditTimeline(): { readonly isConsistent: boolean; readonly anomalies: readonly string[] } {
    const anomalies: string[] = [];

    // Check chronological order
    for (let i = 1; i < this.events.length; i++) {
      if (this.events[i].epochMs < this.events[i - 1].epochMs) {
        anomalies.push(`TIME_REVERSAL: event ${this.events[i].eventName} (${this.events[i].timestamp}) occurs before ${this.events[i - 1].eventName} (${this.events[i - 1].timestamp})`);
      }
    }

    // Check logical phases: Geometry -> Mesh -> Solve -> Verification -> Validation -> Forensic
    const phaseOrder = [
      'GEOMETRY_CAPTURED',
      'MESH_GENERATED',
      'CASE_CONFIGURED',
      'SOLVER_STARTED',
      'SOLVER_COMPLETED',
      'RESULTS_CAPTURED',
      'VERIFICATION_EXECUTED',
      'VALIDATION_EXECUTED',
      'FORENSIC_ANALYSIS_EXECUTED'
    ];

    const indices: Record<string, number> = {};
    for (let i = 0; i < this.events.length; i++) {
      indices[this.events[i].eventName] = i;
    }

    for (let p = 1; p < phaseOrder.length; p++) {
      const prevPhase = phaseOrder[p - 1];
      const curPhase = phaseOrder[p];
      if (indices[prevPhase] !== undefined && indices[curPhase] !== undefined) {
        if (indices[curPhase] < indices[prevPhase]) {
          anomalies.push(`LOGICAL_PHASE_ANOMALY: ${curPhase} occurred before ${prevPhase}`);
        }
      }
    }

    return {
      isConsistent: anomalies.length === 0,
      anomalies
    };
  }

  public getEvents(): readonly TimelineEvent[] {
    return [...this.events];
  }
}
