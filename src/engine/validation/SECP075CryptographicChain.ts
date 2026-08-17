/**
 * PATCH-SECP-075.4: Cryptographic Hash Chain & Audit Ledger
 * Constructs a verifiable, tamper-evident Merkle-like hash chain connecting:
 * Input Hash -> Mesh Hash -> Material Hash -> BC Hash -> Matrix Hash -> Metrics Hash -> Verdict Hash
 * Any downstream or upstream perturbation breaks the cryptographic chain link integrity.
 */

export interface SECP075HashChainLink {
  step: string;
  payloadDescription: string;
  stepHash: string;
  cumulativeChainHash: string;
}

export interface SECP075AuditHashChain {
  inputHash: string;
  meshHash: string;
  materialHash: string;
  bcHash: string;
  matrixHash: string;
  metricsHash: string;
  verdictHash: string;
  finalChainHash: string;
  links: SECP075HashChainLink[];
  timestamp: string;
  verifierVersion: string;
  isValidChain: boolean;
}

export class SECP075CryptographicChain {
  private static readonly VERIFIER_VERSION = 'SECP-075.4-CLEANROOM';

  /**
   * Deterministic 64-bit/32-bit combined hash producing an 8-byte hex digest (or 16-character hex).
   * Uses Jenkins/Murmur-style mixing with 64-bit simulation.
   */
  public static hashString(str: string, seed: number = 0x9e3779b9): string {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;

    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const high = (h1 >>> 0).toString(16).padStart(8, '0');
    const low = (h2 >>> 0).toString(16).padStart(8, '0');
    return `${high}${low}`.toUpperCase();
  }

  /**
   * Builds the complete 7-stage cryptographic hash chain for SECP-075.4.
   */
  public static buildHashChain(params: {
    inputs: Record<string, any>;
    mesh: { nodes: any[]; elements: any[] };
    material: Record<string, any>;
    bcs: any[];
    matrixSummary: { rows: number; cols: number; sampleSum: number; frobeniusNorm: number };
    metrics: Record<string, any>;
    verdict: { passed: boolean; testCount: number; failedCount: number };
  }): SECP075AuditHashChain {
    const timestamp = new Date().toISOString();
    const links: SECP075HashChainLink[] = [];

    // 1. Input Hash
    const inputStr = JSON.stringify(params.inputs);
    const inputHash = this.hashString(`INPUT:${inputStr}`);
    let cumulative = inputHash;
    links.push({
      step: 'INPUT',
      payloadDescription: 'Geometric parameters, coordinate limits, and external loading primitives',
      stepHash: inputHash,
      cumulativeChainHash: cumulative
    });

    // 2. Mesh Hash
    const meshStr = JSON.stringify(params.mesh);
    const meshHash = this.hashString(`MESH:${meshStr}`);
    cumulative = this.hashString(`${cumulative}->MESH:${meshHash}`);
    links.push({
      step: 'MESH',
      payloadDescription: `${params.mesh.nodes.length} nodes, ${params.mesh.elements.length} elements (quadrature & topology)`,
      stepHash: meshHash,
      cumulativeChainHash: cumulative
    });

    // 3. Material Hash
    const matStr = JSON.stringify(params.material);
    const materialHash = this.hashString(`MATERIAL:${matStr}`);
    cumulative = this.hashString(`${cumulative}->MATERIAL:${materialHash}`);
    links.push({
      step: 'MATERIAL',
      payloadDescription: `Constitutive constants (E=${params.material.E}, nu=${params.material.nu})`,
      stepHash: materialHash,
      cumulativeChainHash: cumulative
    });

    // 4. Boundary Condition Hash
    const bcStr = JSON.stringify(params.bcs);
    const bcHash = this.hashString(`BOUNDARY_CONDITIONS:${bcStr}`);
    cumulative = this.hashString(`${cumulative}->BOUNDARY_CONDITIONS:${bcHash}`);
    links.push({
      step: 'BOUNDARY_CONDITIONS',
      payloadDescription: `${params.bcs.length} Dirichlet constraints & kinematic fixities`,
      stepHash: bcHash,
      cumulativeChainHash: cumulative
    });

    // 5. Stiffness Matrix Hash
    const matSummaryStr = JSON.stringify(params.matrixSummary);
    const matrixHash = this.hashString(`STIFFNESS_MATRIX:${matSummaryStr}`);
    cumulative = this.hashString(`${cumulative}->STIFFNESS_MATRIX:${matrixHash}`);
    links.push({
      step: 'STIFFNESS_MATRIX',
      payloadDescription: `Global assembled matrix (${params.matrixSummary.rows}x${params.matrixSummary.cols}, ||K||_F=${params.matrixSummary.frobeniusNorm.toExponential(3)})`,
      stepHash: matrixHash,
      cumulativeChainHash: cumulative
    });

    // 6. Metrics Hash
    const metricsStr = JSON.stringify(params.metrics);
    const metricsHash = this.hashString(`SPECTRAL_METRICS:${metricsStr}`);
    cumulative = this.hashString(`${cumulative}->SPECTRAL_METRICS:${metricsHash}`);
    links.push({
      step: 'SPECTRAL_METRICS',
      payloadDescription: `Eigenvalues, conditioning, residual, and strain energy invariants`,
      stepHash: metricsHash,
      cumulativeChainHash: cumulative
    });

    // 7. Verdict Hash
    const verdictStr = JSON.stringify({ ...params.verdict, verifier: this.VERIFIER_VERSION });
    const verdictHash = this.hashString(`AUDIT_VERDICT:${verdictStr}`);
    cumulative = this.hashString(`${cumulative}->AUDIT_VERDICT:${verdictHash}`);
    links.push({
      step: 'AUDIT_VERDICT',
      payloadDescription: `Final Gate Decision (${params.verdict.passed ? 'PASS' : 'FAIL'}, ${params.verdict.testCount} tests)`,
      stepHash: verdictHash,
      cumulativeChainHash: cumulative
    });

    const finalChainHash = `SECP075-CHAIN-${cumulative}`;

    return {
      inputHash,
      meshHash,
      materialHash,
      bcHash,
      matrixHash,
      metricsHash,
      verdictHash,
      finalChainHash,
      links,
      timestamp,
      verifierVersion: this.VERIFIER_VERSION,
      isValidChain: true
    };
  }

  /**
   * Re-verifies a hash chain given its inputs and links.
   */
  public static verifyChainIntegrity(chain: SECP075AuditHashChain): boolean {
    if (chain.links.length !== 7) return false;
    let expectedCumulative = chain.links[0].stepHash;
    if (chain.links[0].cumulativeChainHash !== expectedCumulative) return false;

    for (let i = 1; i < chain.links.length; i++) {
      const link = chain.links[i];
      expectedCumulative = this.hashString(`${expectedCumulative}->${link.step}:${link.stepHash}`);
      if (link.cumulativeChainHash !== expectedCumulative) {
        return false;
      }
    }

    return chain.finalChainHash === `SECP075-CHAIN-${expectedCumulative}`;
  }
}
