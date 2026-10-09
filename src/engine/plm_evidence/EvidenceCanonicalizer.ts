import * as crypto from 'crypto';

export class EvidenceCanonicalizer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => EvidenceCanonicalizer.canonicalize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const keyValues = keys.map(key => {
      const val = obj[key];
      if (val === undefined) return null;
      return `${JSON.stringify(key)}:${EvidenceCanonicalizer.canonicalize(val)}`;
    }).filter(kv => kv !== null);

    return '{' + keyValues.join(',') + '}';
  }

  public static computeEvidenceHash(evidence: any): string {
    const payload = {
      evidenceType: evidence.evidenceType,
      subjectId: evidence.subjectId,
      subjectType: evidence.subjectType,
      subjectVersion: evidence.subjectVersion,
      subjectHash: evidence.subjectHash,
      scope: evidence.scope,
      contentHash: evidence.contentHash,
      sourceSystem: evidence.sourceSystem,
      sourceVersion: evidence.sourceVersion
    };
    return EvidenceCanonicalizer.sha256(EvidenceCanonicalizer.canonicalize(payload));
  }

  public static computeLinkHash(link: any): string {
    const payload = {
      sourceEvidenceId: link.sourceEvidenceId,
      targetEvidenceId: link.targetEvidenceId,
      relationship: link.relationship,
      reason: link.reason,
      actor: link.actor,
      timestamp: link.timestamp
    };
    return EvidenceCanonicalizer.sha256(EvidenceCanonicalizer.canonicalize(payload));
  }

  public static computeManifestHash(manifest: any): string {
    const payload = {
      subject: manifest.subject,
      evidenceItems: [...manifest.evidenceItems].sort(),
      dependencies: [...manifest.dependencies].sort(),
      sourceVersions: manifest.sourceVersions
    };
    return EvidenceCanonicalizer.sha256(EvidenceCanonicalizer.canonicalize(payload));
  }

  public static computeBundleHash(bundle: any): string {
    const payload = {
      bundleVersion: bundle.bundleVersion,
      subjectHash: bundle.subjectHash,
      evidenceHashes: bundle.evidenceItems.map((e: any) => e.evidenceHash).sort(),
      linkHashes: bundle.links.map((l: any) => l.linkHash).sort(),
      provenanceHash: EvidenceCanonicalizer.sha256(EvidenceCanonicalizer.canonicalize(bundle.provenance))
    };
    return EvidenceCanonicalizer.sha256(EvidenceCanonicalizer.canonicalize(payload));
  }

  public static computeRootHash(hashes: string[]): string {
    if (hashes.length === 0) return '0'.repeat(64);
    const sorted = [...hashes].sort();
    return EvidenceCanonicalizer.sha256(sorted.join('|'));
  }
}
