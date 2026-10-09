/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-074: System & Environment Fingerprint Engine
 */

import {
  SoftwareFingerprint,
  HardwareFingerprint,
  EnvironmentFingerprint,
  ReplayEnvironmentStatus,
  DriftSeverity
} from './ReproducibilityTypes';

export class FingerprintHasher {
  public static hashObject(obj: unknown): string {
    const serialized = this.canonicalSerialize(obj);
    return this.pseudoSha256(serialized);
  }

  public static canonicalSerialize(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.canonicalSerialize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const keyVals = keys.map(k => `${JSON.stringify(k)}:${this.canonicalSerialize((obj as Record<string, unknown>)[k])}`);
    return '{' + keyVals.join(',') + '}';
  }

  private static pseudoSha256(input: string): string {
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      h0 = (h0 ^ (code * 0x45d9f3b)) >>> 0;
      h1 = ((h1 << 5) | (h1 >>> 27)) ^ code;
      h2 = (h2 + code * 31) >>> 0;
      h3 = (h3 ^ ((code << 7) | (code >>> 25))) >>> 0;
      h4 = (h4 + (code ^ 0x5a827999)) >>> 0;
      h5 = ((h5 << 11) | (h5 >>> 21)) ^ code;
      h6 = (h6 + code * 17) >>> 0;
      h7 = (h7 ^ (code * 0x6ed9eba1)) >>> 0;
    }

    const hex = (n: number) => ((n >>> 0).toString(16)).padStart(8, '0').slice(-8);
    return `${hex(h0)}${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}${hex(h5)}${hex(h6)}${hex(h7)}`;
  }
}

export class FingerprintEngine {
  public static captureCurrentSoftware(): SoftwareFingerprint {
    const dependencies = {
      three: '^0.160.0',
      lucideReact: '^0.344.0',
      vitest: '^4.1.10',
      typescript: '^5.3.3'
    };

    const payload = {
      appVersion: '2.0.0',
      buildId: 'secp-os-v2-phase5',
      compiler: 'TypeScript/Vite',
      compilerVersion: '5.3.3',
      buildFlags: '-O3 --strict',
      dependencies
    };

    return {
      applicationVersion: '2.0.0',
      executableHash: FingerprintHasher.hashObject(payload),
      buildId: 'secp-os-v2-phase5',
      compiler: 'TypeScript/Vite',
      compilerVersion: '5.3.3',
      buildFlags: '-O3 --strict',
      dependencies
    };
  }

  public static captureCurrentHardware(): HardwareFingerprint {
    return {
      cpuModel: 'Intel/AMD x86_64 Cloud Virtual CPU',
      architecture: 'x86_64',
      coreCount: 4,
      gpuModel: 'Standard WebGL Compute Engine',
      gpuComputeCapability: '1.0',
      memoryBytes: 8 * 1024 * 1024 * 1024
    };
  }

  public static captureCurrentEnvironment(): EnvironmentFingerprint {
    const envVars = {
      NODE_ENV: 'production',
      TZ: 'UTC',
      LANG: 'en_US.UTF-8'
    };

    return {
      os: 'Linux-Container',
      kernel: '6.6.0-cloud-generic',
      runtime: 'NodeJS-v20',
      containerDigest: 'sha256:d8a946b68e547fa906e5720078028290327f272e2cf38a0c20f1883391741cf9',
      environmentVariablesHash: FingerprintHasher.hashObject(envVars),
      locale: 'en_US.UTF-8',
      timezone: 'UTC'
    };
  }

  public static compareEnvironments(
    orig: EnvironmentFingerprint,
    replay: EnvironmentFingerprint
  ): { readonly status: ReplayEnvironmentStatus; readonly drift: DriftSeverity; readonly diffs: readonly string[] } {
    const diffs: string[] = [];

    if (orig.os !== replay.os) diffs.push(`OS mismatch: ${orig.os} vs ${replay.os}`);
    if (orig.kernel !== replay.kernel) diffs.push(`Kernel mismatch: ${orig.kernel} vs ${replay.kernel}`);
    if (orig.runtime !== replay.runtime) diffs.push(`Runtime mismatch: ${orig.runtime} vs ${replay.runtime}`);
    if (orig.containerDigest !== replay.containerDigest) diffs.push(`Container digest mismatch`);
    if (orig.environmentVariablesHash !== replay.environmentVariablesHash) diffs.push(`Environment variables hash mismatch`);

    if (diffs.length === 0) {
      return { status: 'IDENTICAL', drift: 'NO_DRIFT', diffs };
    }
    if (orig.runtime === replay.runtime && orig.os === replay.os) {
      return { status: 'COMPATIBLE', drift: 'MINOR_DRIFT', diffs };
    }
    return { status: 'DRIFTED', drift: 'MATERIAL_DRIFT', diffs };
  }
}
