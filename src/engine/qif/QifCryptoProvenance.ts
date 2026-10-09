/**
 * SECP Industrial OS v2 — Cryptographic Provenance Engine
 * Production-grade SHA-256 canonical hashing for QIF 3.0 Design Authority Chains.
 * No dummy hashes (0x99aabbcc) or FNV shortcuts.
 */

import * as crypto from 'crypto';

export interface DesignAuthorityBindingInput {
  readonly designAuthorityId: string;
  readonly canonicalDocumentId: string;
  readonly revisionId: string;
  readonly geometryPersistentId: string;
  readonly pmiId: string;
  readonly qualityCharacteristicId: string;
  readonly measurementFeatureId: string;
  readonly qifResultId: string;
}

export interface MeasurementPayloadInput {
  readonly resultId: string;
  readonly featureId: string;
  readonly characteristicId: string;
  readonly designRevisionId: string;
  readonly partSerialNumber: string;
  readonly lotId: string;
  readonly nominalValue: number;
  readonly measuredValue: number;
  readonly deviationMm: number;
  readonly expandedUncertaintyMm: number;
  readonly instrumentId: string;
  readonly calibrationId: string;
  readonly traceabilityHash: string;
}

export class QifCryptoProvenance {

  /**
   * Computes deterministic SHA-256 hash for 12-node Design Authority Binding Chain.
   */
  public static computeTraceabilityHash(binding: DesignAuthorityBindingInput): string {
    const canonicalPayload = [
      `da:${binding.designAuthorityId || ''}`,
      `doc:${binding.canonicalDocumentId || ''}`,
      `rev:${binding.revisionId || ''}`,
      `geom:${binding.geometryPersistentId || ''}`,
      `pmi:${binding.pmiId || ''}`,
      `char:${binding.qualityCharacteristicId || ''}`,
      `feat:${binding.measurementFeatureId || ''}`,
      `res:${binding.qifResultId || ''}`
    ].join('|');

    const digest = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
    return `sha256:${digest}`;
  }

  /**
   * Computes deterministic SHA-256 evidence hash for a measurement result.
   */
  public static computeMeasurementEvidenceHash(input: MeasurementPayloadInput): string {
    const canonicalPayload = [
      `res:${input.resultId || ''}`,
      `feat:${input.featureId || ''}`,
      `char:${input.characteristicId || ''}`,
      `rev:${input.designRevisionId || ''}`,
      `sn:${input.partSerialNumber || ''}`,
      `lot:${input.lotId || ''}`,
      `nom:${input.nominalValue.toFixed(6)}`,
      `meas:${input.measuredValue.toFixed(6)}`,
      `dev:${input.deviationMm.toFixed(6)}`,
      `unc:${input.expandedUncertaintyMm.toFixed(6)}`,
      `inst:${input.instrumentId || ''}`,
      `cal:${input.calibrationId || ''}`,
      `trace:${input.traceabilityHash || ''}`
    ].join('|');

    const digest = crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
    return `sha256:${digest}`;
  }

  /**
   * Computes SHA-256 hash for QIF Inspection Plan.
   */
  public static computePlanHash(planId: string, daId: string, revId: string, featureCount: number, charCount: number): string {
    const payload = `plan:${planId}|da:${daId}|rev:${revId}|fc:${featureCount}|cc:${charCount}`;
    return `sha256:${crypto.createHash('sha256').update(payload, 'utf8').digest('hex')}`;
  }

  /**
   * Computes SHA-256 hash for Closed-Loop Engineering Feedback proposal.
   */
  public static computeFeedbackHash(feedbackId: string, triggerResultId: string, srcRev: string, propRev: string, devMm: number): string {
    const payload = `fb:${feedbackId}|trig:${triggerResultId}|src:${srcRev}|prop:${propRev}|dev:${devMm.toFixed(6)}`;
    return `sha256:${crypto.createHash('sha256').update(payload, 'utf8').digest('hex')}`;
  }

  /**
   * Computes SHA-256 digest over complete raw QIF XML text stream.
   */
  public static computeXmlStreamHash(xmlText: string): string {
    return `sha256:${crypto.createHash('sha256').update(xmlText, 'utf8').digest('hex')}`;
  }
}
