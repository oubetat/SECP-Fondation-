/**
 * PATCH-SECP-066: Technician Authorization Engine
 * Enforces competency-based maintenance execution.
 */

import { TechnicianAuthorization } from './MaintenanceGovernanceTypes';

export class TechnicianAuthorizationEngine {
  public static authorize(techId: string, requiredCompetency: number, authorizations: TechnicianAuthorization[]): boolean {
    const auth = authorizations.find(a => a.technicianId === techId);
    if (!auth) return false;
    if (auth.status !== 'ACTIVE') return false;
    
    // Check competency level
    return auth.competencyClass >= requiredCompetency;
  }
}
