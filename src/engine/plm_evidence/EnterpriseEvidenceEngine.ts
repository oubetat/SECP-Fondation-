import { 
  EnterpriseEvidence, 
  EvidenceLink, 
  EvidenceProvenance, 
  EvidenceManifest, 
  EnterpriseEvidenceBundle,
  EvidenceStatus,
  EvidenceType,
  EvidenceScope,
  EvidenceVerdict
} from './types';
import { EvidenceCanonicalizer } from './EvidenceCanonicalizer';

export class EnterpriseEvidenceEngine {
  private evidenceStore: Map<string, EnterpriseEvidence> = new Map();
  private linkStore: Map<string, EvidenceLink> = new Map();
  private bundles: Map<string, EnterpriseEvidenceBundle> = new Map();

  public generateEvidence(input: Partial<EnterpriseEvidence>): EnterpriseEvidence {
    const evidence: EnterpriseEvidence = {
      evidenceId: `EVID-${EvidenceCanonicalizer.sha256(input.subjectId! + Date.now()).substring(0, 8)}`,
      evidenceType: input.evidenceType!,
      subjectId: input.subjectId!,
      subjectType: input.subjectType!,
      subjectVersion: input.subjectVersion!,
      subjectHash: input.subjectHash!,
      scope: input.scope!,
      status: 'GENERATED',
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy || 'SYSTEM',
      sourceSystem: input.sourceSystem || 'SECP-PLM',
      sourceVersion: input.sourceVersion || '1.0',
      contentHash: input.contentHash || '0'.repeat(64),
      evidenceHash: '',
      metadata: input.metadata || {}
    };

    evidence.evidenceHash = EvidenceCanonicalizer.computeEvidenceHash(evidence);
    this.evidenceStore.set(evidence.evidenceId, evidence);
    return evidence;
  }

  public addLink(linkInput: Partial<EvidenceLink>): EvidenceLink {
    const link: EvidenceLink = {
      linkId: `LNK-${EvidenceCanonicalizer.sha256(linkInput.sourceEvidenceId! + linkInput.targetEvidenceId! + Date.now()).substring(0, 8)}`,
      sourceEvidenceId: linkInput.sourceEvidenceId!,
      targetEvidenceId: linkInput.targetEvidenceId!,
      relationship: linkInput.relationship!,
      reason: linkInput.reason || 'Engineering relationship',
      actor: linkInput.actor || 'SYSTEM',
      timestamp: new Date().toISOString(),
      linkHash: ''
    };

    link.linkHash = EvidenceCanonicalizer.computeLinkHash(link);
    this.linkStore.set(link.linkId, link);
    return link;
  }

  public createBundle(
    bundleId: string,
    evidenceIds: string[],
    provenance: EvidenceProvenance
  ): EnterpriseEvidenceBundle {
    const evidenceItems = evidenceIds.map(id => {
      const e = this.evidenceStore.get(id);
      if (!e) throw new Error(`EVIDENCE_NOT_FOUND: ${id}`);
      return e;
    });

    const links = Array.from(this.linkStore.values()).filter(l => 
      evidenceIds.includes(l.sourceEvidenceId) && evidenceIds.includes(l.targetEvidenceId)
    );

    const bundle: EnterpriseEvidenceBundle = {
      bundleId,
      bundleVersion: '1.0',
      bundleHash: '',
      subjectHash: evidenceItems[0]?.subjectHash || '0'.repeat(64),
      evidenceItems,
      links,
      provenance,
      generatedAt: new Date().toISOString()
    };

    bundle.bundleHash = EvidenceCanonicalizer.computeBundleHash(bundle);
    this.bundles.set(bundleId, bundle);
    return bundle;
  }

  public getEvidence(evidenceId: string): EnterpriseEvidence | undefined {
    return this.evidenceStore.get(evidenceId);
  }

  public verifyEvidence(evidenceId: string): EvidenceVerdict {
    const evidence = this.evidenceStore.get(evidenceId);
    if (!evidence) return 'INCOMPLETE';

    const recomputed = EvidenceCanonicalizer.computeEvidenceHash(evidence);
    if (evidence.evidenceHash !== recomputed) return 'CORRUPTED';

    if (evidence.status === 'EXPIRED') return 'STALE';
    if (evidence.status === 'REVOKED') return 'INVALID';

    return 'VALID';
  }

  public computeRootHash(): string {
    const hashes = Array.from(this.evidenceStore.values()).map(e => e.evidenceHash);
    return EvidenceCanonicalizer.computeRootHash(hashes);
  }
}
