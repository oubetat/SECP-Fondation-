import { EngineeringPolicy } from './types';

export const DEFAULT_POLICIES: EngineeringPolicy[] = [
  {
    id: 'POLICY-001',
    name: 'Strict Versioning',
    description: 'Enforces semantic versioning for all engineering objects.'
  },
  {
    id: 'POLICY-002',
    name: 'Integrity Verification',
    description: 'Requires hash verification before object mutation.'
  }
];

export const INITIAL_SECP_POLICIES = DEFAULT_POLICIES;

export class DefaultPolicyProvider {
  public static getDefaultPolicies(): EngineeringPolicy[] {
    return DEFAULT_POLICIES;
  }
}
