/**
 * SECP Industrial OS v2 — PATCH-157: Evidence Router
 * Dispatches immutable Evidence Envelopes to subscribers with isolation and deterministic filtering.
 */

import * as crypto from 'crypto';
import {
  EvidenceEnvelope,
  EvidenceFilter,
  EvidenceHandler,
  EvidencePredicate,
  EvidenceRoutingResult,
  EvidenceSubscription
} from './types';

export class EvidenceRouter {
  private subscriptions = new Map<string, EvidenceSubscription>();

  /**
   * Subscribes a handler function with either a declarative filter or a predicate.
   */
  public subscribe(
    filter: EvidenceFilter | EvidencePredicate,
    handler: EvidenceHandler
  ): EvidenceSubscription {
    const subscriptionId = `SUB-${crypto.randomBytes(16).toString("hex")}`;
    const createdAt = new Date().toISOString();

    const subscription: EvidenceSubscription = {
      subscriptionId,
      filter,
      handler,
      createdAt,
      unsubscribe: () => this.unsubscribe(subscriptionId)
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  /**
   * Removes a subscription by ID.
   */
  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Returns active subscription count.
   */
  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clears all subscriptions.
   */
  public clear(): void {
    this.subscriptions.clear();
  }

  /**
   * Routes an EvidenceEnvelope to all matching subscribers with error isolation.
   */
  public async route(evidence: EvidenceEnvelope): Promise<EvidenceRoutingResult> {
    const matchedSubscriptions: EvidenceSubscription[] = [];
    const errors: { subscriptionId: string; error: string }[] = [];
    let successfulDeliveries = 0;
    let failedDeliveries = 0;

    for (const subscription of Array.from(this.subscriptions.values())) {
      if (this.matchesFilter(evidence, subscription.filter)) {
        matchedSubscriptions.push(subscription);
      }
    }

    // Execute handlers with subscriber isolation
    for (const sub of matchedSubscriptions) {
      try {
        const result = sub.handler(evidence);
        if (result instanceof Promise) {
          await result;
        }
        successfulDeliveries++;
      } catch (err: any) {
        failedDeliveries++;
        errors.push({
          subscriptionId: sub.subscriptionId,
          error: err?.message || String(err)
        });
      }
    }

    return {
      evidenceId: evidence.evidenceId,
      matchedSubscriptions: matchedSubscriptions.length,
      successfulDeliveries,
      failedDeliveries,
      errors: Object.freeze(errors)
    };
  }

  /**
   * Synchronous routing variant for pure in-memory dispatch.
   */
  public routeSync(evidence: EvidenceEnvelope): EvidenceRoutingResult {
    const matchedSubscriptions: EvidenceSubscription[] = [];
    const errors: { subscriptionId: string; error: string }[] = [];
    let successfulDeliveries = 0;
    let failedDeliveries = 0;

    for (const subscription of Array.from(this.subscriptions.values())) {
      if (this.matchesFilter(evidence, subscription.filter)) {
        matchedSubscriptions.push(subscription);
      }
    }

    for (const sub of matchedSubscriptions) {
      try {
        sub.handler(evidence);
        successfulDeliveries++;
      } catch (err: any) {
        failedDeliveries++;
        errors.push({
          subscriptionId: sub.subscriptionId,
          error: err?.message || String(err)
        });
      }
    }

    return {
      evidenceId: evidence.evidenceId,
      matchedSubscriptions: matchedSubscriptions.length,
      successfulDeliveries,
      failedDeliveries,
      errors: Object.freeze(errors)
    };
  }

  /**
   * Evaluates whether an EvidenceEnvelope satisfies the given filter or predicate.
   */
  public matchesFilter(
    evidence: EvidenceEnvelope,
    filter: EvidenceFilter | EvidencePredicate
  ): boolean {
    if (typeof filter === 'function') {
      try {
        return filter(evidence);
      } catch {
        return false;
      }
    }

    // Declarative filtering
    if (filter.evidenceType) {
      if (Array.isArray(filter.evidenceType)) {
        if (!filter.evidenceType.includes(evidence.evidenceType)) return false;
      } else {
        if (evidence.evidenceType !== filter.evidenceType) return false;
      }
    }

    if (filter.sourceCapability) {
      if (Array.isArray(filter.sourceCapability)) {
        if (!filter.sourceCapability.includes(evidence.provenance.sourceCapability)) return false;
      } else {
        if (evidence.provenance.sourceCapability !== filter.sourceCapability) return false;
      }
    }

    if (filter.sourceOperation && evidence.provenance.sourceOperation !== filter.sourceOperation) {
      return false;
    }

    if (filter.engineeringObjectId && evidence.correlation.engineeringObjectId !== filter.engineeringObjectId) {
      return false;
    }

    if (filter.workflowId && evidence.correlation.workflowId !== filter.workflowId) {
      return false;
    }

    if (filter.runId && evidence.correlation.runId !== filter.runId) {
      return false;
    }

    if (filter.eventId && evidence.correlation.eventId !== filter.eventId) {
      return false;
    }

    if (filter.parentEvidenceId && evidence.correlation.parentEvidenceId !== filter.parentEvidenceId) {
      return false;
    }

    if (filter.correlationId && evidence.correlation.correlationId !== filter.correlationId) {
      return false;
    }

    if (filter.tag && (!evidence.correlation.tags || !evidence.correlation.tags.includes(filter.tag))) {
      return false;
    }

    if (filter.minSequence !== undefined && evidence.identity.sequence < filter.minSequence) {
      return false;
    }

    if (filter.maxSequence !== undefined && evidence.identity.sequence > filter.maxSequence) {
      return false;
    }

    if (filter.startTime && new Date(evidence.identity.timestamp) < new Date(filter.startTime)) {
      return false;
    }

    if (filter.endTime && new Date(evidence.identity.timestamp) > new Date(filter.endTime)) {
      return false;
    }

    return true;
  }
}
