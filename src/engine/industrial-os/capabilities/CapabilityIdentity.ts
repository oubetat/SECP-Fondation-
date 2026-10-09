import * as crypto from 'crypto';

export class CapabilityIdentity {
  public readonly canonicalId: string;
  public readonly namespace: string;
  public readonly version: string;
  public readonly hash: string;

  private constructor(canonicalId: string, version: string, namespace: string, hash: string) {
    this.canonicalId = canonicalId;
    this.version = version;
    this.namespace = namespace;
    this.hash = hash;
  }

  public static parse(rawId: string, version: string): CapabilityIdentity {
    // 1. Enforce canonical structure: must start with 'capability:'
    if (!rawId.startsWith('capability:')) {
      throw new Error(`Invalid capability ID: '${rawId}'. Must start with 'capability:' prefix.`);
    }

    const path = rawId.substring('capability:'.length);
    const parts = path.split('.');

    // Must have at least two dots, e.g., 'cad.brep.boolean' has 'cad', 'brep', 'boolean'
    if (parts.length < 2 || parts.some(p => !p || p.trim() === '')) {
      throw new Error(`Invalid canonical capability structure for '${rawId}'. Must follow 'capability:namespace.subspace.action' pattern.`);
    }

    const namespace = parts[0];
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
    if (!semverRegex.test(version)) {
      throw new Error(`Invalid capability version: '${version}'. Must be valid SemVer format.`);
    }

    // Determine secure SHA-256 hash
    const inputForHash = `${rawId}::${version}`;
    const hash = crypto.createHash('sha256').update(inputForHash).digest('hex');

    return new CapabilityIdentity(rawId, version, namespace, hash);
  }

  public matches(other: CapabilityIdentity): boolean {
    return this.canonicalId === other.canonicalId && this.version === other.version;
  }
}
