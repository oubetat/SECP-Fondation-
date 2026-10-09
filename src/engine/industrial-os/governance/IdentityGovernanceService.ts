import { EngineeringRole } from './types';

export class IdentityGovernanceService {
  private static instance: IdentityGovernanceService;
  private userRoles = new Map<string, EngineeringRole[]>();
  private userOrgs = new Map<string, string>();
  private userCapabilities = new Map<string, string[]>();

  private constructor() {
    // Seed some default data
    this.userRoles.set('Engineer-001', [EngineeringRole.DESIGN_ENGINEER, EngineeringRole.ENGINEERING_LEAD]);
    this.userRoles.set('cascade-eng', [EngineeringRole.DESIGN_ENGINEER, EngineeringRole.ENGINEERING_LEAD]);
    this.userRoles.set('cad-engineer-195', [EngineeringRole.DESIGN_ENGINEER, EngineeringRole.ENGINEERING_LEAD]);
    this.userOrgs.set('Engineer-001', 'SECP_ENTERPRISE');
    this.userOrgs.set('cascade-eng', 'SECP_ENTERPRISE');
    this.userOrgs.set('cad-engineer-195', 'SECP_ENTERPRISE');
  }

  public static getInstance(): IdentityGovernanceService {
    if (!IdentityGovernanceService.instance) {
      IdentityGovernanceService.instance = new IdentityGovernanceService();
    }
    return IdentityGovernanceService.instance;
  }

  public getRoles(userId: string): EngineeringRole[] {
    return this.userRoles.get(userId) || [EngineeringRole.DESIGN_ENGINEER, EngineeringRole.ENGINEERING_LEAD];
  }

  public getOrganizationId(userId: string): string {
    return this.userOrgs.get(userId) || 'DEFAULT_ORG';
  }

  public assignRole(userId: string, roles: EngineeringRole[]): void {
    this.userRoles.set(userId, roles);
  }

  public assignOrg(userId: string, orgId: string): void {
    this.userOrgs.set(userId, orgId);
  }

  public assignCapabilities(userId: string, capabilities: string[]): void {
    this.userCapabilities.set(userId, capabilities);
  }

  public getCapabilities(userId: string): string[] {
    const explicit = this.userCapabilities.get(userId) || [];
    const fromRoles: string[] = [];
    const roles = this.getRoles(userId);
    
    if (roles.includes(EngineeringRole.ADMIN) || roles.includes(EngineeringRole.ENGINEERING_LEAD)) {
      fromRoles.push('RELEASE_AUTHORITY');
    }
    
    return Array.from(new Set([...explicit, ...fromRoles]));
  }
}
