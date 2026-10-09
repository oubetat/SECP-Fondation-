import { FaultTree, FTAEvent, FTAGate } from './types';

export class ReliabilityCausalityEngine {
  /**
   * Evaluates the entire Fault Tree, computing and updating probabilities for all events 
   * from the basic event inputs up to the top event using exact probabilistic gate logic.
   */
  public evaluateFaultTree(ft: FaultTree): number {
    const eventMap = new Map<string, FTAEvent>();
    for (const ev of ft.events) {
      eventMap.set(ev.eventId, ev);
    }
    eventMap.set(ft.topEvent.eventId, ft.topEvent);

    const gateMap = new Map<string, FTAGate>();
    for (const g of ft.gates) {
      gateMap.set(g.outputEventId, g);
    }

    const memo = new Map<string, number>();

    const resolveProbability = (eventId: string): number => {
      if (memo.has(eventId)) {
        return memo.get(eventId)!;
      }

      const ev = eventMap.get(eventId);
      if (!ev) {
        throw new Error(`UNRESOLVED_EVENT: Event '${eventId}' is missing from Fault Tree events.`);
      }

      if (ev.isBasicEvent) {
        memo.set(eventId, ev.probability);
        return ev.probability;
      }

      const gate = gateMap.get(eventId);
      if (!gate) {
        throw new Error(`UNBOUND_GATE_OUTPUT: Non-basic event '${eventId}' does not have a corresponding logical gate source.`);
      }

      const inputProbabilities = gate.inputEventIds.map(id => resolveProbability(id));

      let resultProb = 0;
      if (gate.type === 'AND') {
        // AND gate: Probability is the product of all input probabilities (assuming independence)
        resultProb = inputProbabilities.reduce((acc, p) => acc * p, 1);
      } else if (gate.type === 'OR') {
        // OR gate: Probability is 1 - product of all (1 - input probabilities)
        const complementProduct = inputProbabilities.reduce((acc, p) => acc * (1 - p), 1);
        resultProb = 1 - complementProduct;
      } else {
        throw new Error(`UNSUPPORTED_GATE_TYPE: Gate type '${gate.type}' is not supported.`);
      }

      // Bound check to prevent floating-point anomalies
      resultProb = Math.max(0, Math.min(1, resultProb));
      
      ev.probability = resultProb;
      memo.set(eventId, resultProb);
      return resultProb;
    };

    const topProbability = resolveProbability(ft.topEvent.eventId);
    ft.topEvent.probability = topProbability;
    return topProbability;
  }

  /**
   * Formally recalculates reliability metrics of Availability and MTBF/MTTR for a system model.
   */
  public computeReliabilityMetrics(mtbf: number, mttr: number): { availability: number } {
    if (mtbf < 0 || mttr < 0) {
      throw new Error(`INVALID_RELIABILITY_VALUES: MTBF and MTTR must be non-negative.`);
    }
    const availability = mtbf === 0 && mttr === 0 ? 0 : mtbf / (mtbf + mttr);
    return { availability };
  }
}
