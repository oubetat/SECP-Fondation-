import { createHash } from 'crypto';
import { Hazard, SafetyControl, SafetyClaim, SafetyCase, SafetyGovernanceState } from './types';

export class SafetyRegistry {
  private hazards: Map<string, Hazard> = new Map();
  private controls: Map<string, SafetyControl> = new Map();
  private claims: Map<string, SafetyClaim> = new Map();
  private cases: Map<string, SafetyCase> = new Map();

  // --- Hazard Methods ---
  public registerHazard(hazard: Hazard): void {
    if (!hazard.hazardId || hazard.hazardId.trim() === '') {
      throw new Error('INVALID_HAZARD_ID: ID must be non-empty string');
    }
    if (!hazard.hazardousCondition || hazard.hazardousCondition.trim() === '') {
      throw new Error('INVALID_HAZARDOUS_CONDITION: Condition description must be provided');
    }
    if (this.hazards.has(hazard.hazardId)) {
      throw new Error(`DUPLICATE_HAZARD_ID: Hazard ${hazard.hazardId} already exists`);
    }
    this.hazards.set(hazard.hazardId, { ...hazard });
  }

  public getHazard(hazardId: string): Hazard | undefined {
    return this.hazards.get(hazardId);
  }

  public getAllHazards(): Hazard[] {
    return Array.from(this.hazards.values());
  }

  public updateHazard(hazard: Hazard): void {
    if (!this.hazards.has(hazard.hazardId)) {
      throw new Error(`HAZARD_NOT_FOUND: ${hazard.hazardId}`);
    }
    this.hazards.set(hazard.hazardId, { ...hazard });
  }

  // --- Safety Control Methods ---
  public registerSafetyControl(control: SafetyControl): void {
    if (!control.controlId || control.controlId.trim() === '') {
      throw new Error('INVALID_CONTROL_ID: ID must be non-empty string');
    }
    if (!this.hazards.has(control.hazardId)) {
      throw new Error(`REFERENCED_HAZARD_NOT_FOUND: ${control.hazardId}`);
    }
    if (control.efficiency < 0.0 || control.efficiency > 1.0) {
      throw new Error(`INVALID_CONTROL_EFFICIENCY: Efficiency ${control.efficiency} must be between 0.0 and 1.0`);
    }
    if (this.controls.has(control.controlId)) {
      throw new Error(`DUPLICATE_CONTROL_ID: Safety Control ${control.controlId} already exists`);
    }
    this.controls.set(control.controlId, { ...control });
  }

  public getSafetyControl(controlId: string): SafetyControl | undefined {
    return this.controls.get(controlId);
  }

  public getAllSafetyControls(): SafetyControl[] {
    return Array.from(this.controls.values());
  }

  public updateSafetyControl(control: SafetyControl): void {
    if (!this.controls.has(control.controlId)) {
      throw new Error(`SAFETY_CONTROL_NOT_FOUND: ${control.controlId}`);
    }
    this.controls.set(control.controlId, { ...control });
  }

  // --- Safety Claim Methods ---
  public registerSafetyClaim(claim: SafetyClaim): void {
    if (!claim.claimId || claim.claimId.trim() === '') {
      throw new Error('INVALID_CLAIM_ID: ID must be non-empty string');
    }
    if (!this.hazards.has(claim.targetHazardId)) {
      throw new Error(`REFERENCED_HAZARD_NOT_FOUND: ${claim.targetHazardId}`);
    }
    if (!this.controls.has(claim.targetControlId)) {
      throw new Error(`REFERENCED_CONTROL_NOT_FOUND: ${claim.targetControlId}`);
    }
    if (this.claims.has(claim.claimId)) {
      throw new Error(`DUPLICATE_CLAIM_ID: Safety Claim ${claim.claimId} already exists`);
    }
    this.claims.set(claim.claimId, { ...claim });
  }

  public getSafetyClaim(claimId: string): SafetyClaim | undefined {
    return this.claims.get(claimId);
  }

  public getAllSafetyClaims(): SafetyClaim[] {
    return Array.from(this.claims.values());
  }

  public updateSafetyClaim(claim: SafetyClaim): void {
    if (!this.claims.has(claim.claimId)) {
      throw new Error(`SAFETY_CLAIM_NOT_FOUND: ${claim.claimId}`);
    }
    this.claims.set(claim.claimId, { ...claim });
  }

  // --- Safety Case Methods ---
  public registerSafetyCase(sCase: SafetyCase): void {
    if (!sCase.caseId || sCase.caseId.trim() === '') {
      throw new Error('INVALID_CASE_ID: ID must be non-empty string');
    }
    if (this.cases.has(sCase.caseId)) {
      throw new Error(`DUPLICATE_CASE_ID: Safety Case ${sCase.caseId} already exists`);
    }
    this.cases.set(sCase.caseId, { ...sCase });
  }

  public getSafetyCase(caseId: string): SafetyCase | undefined {
    return this.cases.get(caseId);
  }

  public getAllSafetyCases(): SafetyCase[] {
    return Array.from(this.cases.values());
  }

  public updateSafetyCase(sCase: SafetyCase): void {
    if (!this.cases.has(sCase.caseId)) {
      throw new Error(`SAFETY_CASE_NOT_FOUND: ${sCase.caseId}`);
    }
    this.cases.set(sCase.caseId, { ...sCase });
  }

  public clearAll(): void {
    this.hazards.clear();
    this.controls.clear();
    this.claims.clear();
    this.cases.clear();
  }
}
