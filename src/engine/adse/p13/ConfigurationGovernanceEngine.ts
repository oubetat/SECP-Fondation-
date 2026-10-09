import { ConfigurationRegistry } from './ConfigurationRegistry';

const AUTHORIZED_GOVERNANCE_ROLES = new Set([
  'CHIEF_SYSTEMS_ENGINEER',
  'CHIEF_SAFETY_ENGINEER',
  'SYSTEMS_CHIEF',
  'SAFETY_AUTHORITY',
  'CONFIGURATION_AUTHORITY'
]);

export class ConfigurationGovernanceEngine {
  private registry: ConfigurationRegistry;

  constructor(registry: ConfigurationRegistry) {
    this.registry = registry;
  }

  /**
   * Asserts human-only security authority at the authoritative backend boundary.
   * AI/Synthetic entities may only propose/analyze; human configuration authorities must approve/release.
   */
  public assertHumanGovernanceAuthority(
    actorRole: string,
    actorId: string,
    action: 'AUTHORIZE_CONFIGURATION' | 'APPROVE_BASELINE' | 'RELEASE_CONFIGURATION' | 'OVERRIDE_REVISION' | 'BYPASS_APPLICABILITY' | 'SUPPRESS_CONFLICT' | 'INVALIDATE_EVIDENCE' | 'FORCE_CONFIGURATION_VALID'
  ): void {
    const roleUpper = actorRole.toUpperCase();
    const idLower = actorId.toLowerCase();

    const isAi =
      roleUpper.startsWith('AI_') ||
      roleUpper.includes('SYNTHETIC') ||
      roleUpper.includes('LLM') ||
      idLower.startsWith('ai:') ||
      idLower.includes('synthetic') ||
      idLower.includes('agent');

    if (isAi) {
      throw new Error(`AI_GOVERNANCE_VIOLATION: Synthetic or AI role '${actorRole}' is prohibited from executing action '${action}'. AI can only propose/analyze; Core-authorized human authority must decide.`);
    }

    if (!AUTHORIZED_GOVERNANCE_ROLES.has(roleUpper)) {
      throw new Error(`UNAUTHORIZED_GOVERNANCE_ROLE: Role '${actorRole}' lacks permission to execute '${action}'. Required: CHIEF_SYSTEMS_ENGINEER, SYSTEMS_CHIEF, or CONFIGURATION_AUTHORITY.`);
    }
  }
}
