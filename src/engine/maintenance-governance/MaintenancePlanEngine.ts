/**
 * PATCH-SECP-066: Maintenance Plan Engine
 * Manages versioned maintenance plans and policies.
 */

import { MaintenancePlan } from './MaintenanceGovernanceTypes';

export class MaintenancePlanEngine {
  private static plans: Map<string, MaintenancePlan[]> = new Map();

  public static createPlan(plan: MaintenancePlan): MaintenancePlan {
    const history = this.plans.get(plan.planId) || [];
    const newVersion = history.length + 1;
    const versionedPlan = { ...plan, version: newVersion };
    
    history.push(versionedPlan);
    this.plans.set(plan.planId, history);
    
    return versionedPlan;
  }

  public static getActivePlan(planId: string): MaintenancePlan | undefined {
    const history = this.plans.get(planId);
    return history?.find(p => p.isActive);
  }
}
