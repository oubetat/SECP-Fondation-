/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 006
 * OWAS Assessment Engine (Ovako Working Posture Analysis System)
 * 
 * Based on: Karhu, O., Kansi, P., & Kuorinka, I. (1977). Correcting working postures 
 * in industry: A practical method for analysis. Applied Ergonomics, 8(4), 199-201.
 */

import { OWASInput, ErgonomicEvidence, ErgonomicMethodology } from './types';
import { HumanForwardKinematicsEngine } from '../kinematics/HumanForwardKinematicsEngine';
import { AnatomicalRegion } from '../types/SkeletalTopologyTypes';
import { AnthropometricDatasetRegistry } from '../anthropometry/AnthropometricDatasetRegistry';
import { SkeletalTopologyEngine } from '../topology/SkeletalTopologyEngine';

export class OWASEngine {
  public static readonly VERSION = '1.0.0-PROD';

  // Action Categories Matrix [Back(1-4)][Arms(1-3)][Legs(1-7)]
  // Values: 1: No action, 2: Action needed in future, 3: Action needed soon, 4: Action needed immediately
  private static readonly ACTION_MATRIX: number[][][] = [
    // Back 1 (Straight)
    [
      [1, 1, 1, 1, 1, 1, 1], // Arms 1
      [1, 1, 1, 1, 1, 1, 1], // Arms 2
      [1, 1, 1, 1, 1, 1, 1]  // Arms 3
    ],
    // Back 2 (Bent)
    [
      [2, 2, 2, 2, 2, 2, 2],
      [2, 2, 2, 3, 2, 2, 3],
      [2, 2, 3, 3, 2, 3, 3]
    ],
    // Back 3 (Twisted)
    [
      [2, 2, 3, 2, 2, 3, 2],
      [2, 2, 3, 3, 3, 4, 3],
      [3, 3, 4, 4, 3, 4, 4]
    ],
    // Back 4 (Bent & Twisted)
    [
      [2, 3, 3, 3, 2, 3, 4],
      [3, 3, 4, 4, 3, 4, 4],
      [4, 4, 4, 4, 4, 4, 4]
    ]
  ];

  public static assess(input: OWASInput, profileId: string = 'ANSUR2_MALE_P50'): ErgonomicEvidence {
    const registry = AnthropometricDatasetRegistry.getInstance();
    const profile = registry.getProfile(profileId) || registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(profile);
    const fk = HumanForwardKinematicsEngine.computeFK(skeleton, input.pose);

    const backCode = this.calculateBackCode(input);
    const armsCode = this.calculateArmsCode(input);
    const legsCode = this.calculateLegsCode(input);
    const loadCode = this.calculateLoadCode(input.loadKg);

    const actionCategory = this.ACTION_MATRIX[backCode - 1][armsCode - 1][legsCode - 1];

    return {
      methodology: ErgonomicMethodology.OWAS,
      version: this.VERSION,
      documentId: 'DOC_ERG_001',
      revision: 1,
      dhmProfileId: profileId,
      timestampIso: new Date().toISOString(),
      provenanceHash: this.hashResult(backCode, armsCode, legsCode, loadCode, actionCategory),
      scores: {
        backCode,
        armsCode,
        legsCode,
        loadCode,
        actionCategory
      },
      actionLevel: actionCategory,
      interpretation: this.getInterpretation(actionCategory),
      limitations: [
        'OWAS classifies working postures and defines urgency of corrective actions.',
        'Supports all 7 standard OWAS leg postures (Sitting, Standing both/one straight/bent, Kneeling, Walking).',
        'Back and arm codes are derived from kinematic joint angles with 20°/80° thresholds.'
      ],
      references: {
        source: 'Karhu, O., Kansi, P., & Kuorinka, I. (1977). Correcting working postures in industry: A practical method for analysis. Applied Ergonomics, 8(4), 199-201.',
        tables: ['Action Categories Matrix (p. 200)'],
        pages: ['199-201']
      }
    };
  }

  private static calculateBackCode(input: OWASInput): number {
    const bend = input.pose.jointAngles['J_SPINE_MID']?.flexionExtension || 0;
    const twist = input.pose.jointAngles['J_SPINE_MID']?.axialRotation || 0;
    
    const isBent = Math.abs(bend) > 20;
    const isTwisted = Math.abs(twist) > 20;

    if (!isBent && !isTwisted) return 1; // Straight
    if (isBent && !isTwisted) return 2;  // Bent
    if (!isBent && isTwisted) return 3;  // Twisted
    return 4; // Bent and twisted
  }

  private static calculateArmsCode(input: OWASInput): number {
    const shoulderL = input.pose.jointAngles['J_SHOULDER_L']?.flexionExtension || 0;
    const shoulderR = input.pose.jointAngles['J_SHOULDER_R']?.flexionExtension || 0;
    
    const leftUp = shoulderL > 80;
    const rightUp = shoulderR > 80;

    if (!leftUp && !rightUp) return 1; // Both below shoulder level
    if (leftUp && rightUp) return 3;   // Both at or above shoulder level
    return 2; // One at or above shoulder level
  }

  private static calculateLegsCode(input: OWASInput): number {
    return input.legPosture;
  }

  private static calculateLoadCode(kg: number): number {
    if (kg <= 10) return 1;
    if (kg <= 20) return 2;
    return 3;
  }

  private static getInterpretation(category: number): string {
    switch (category) {
      case 1: return 'Normal posture, no action required.';
      case 2: return 'Postures with harmful effects, action needed in future.';
      case 3: return 'Postures with harmful effects, action needed soon.';
      case 4: return 'Postures with extremely harmful effects, action needed immediately.';
      default: return 'Indeterminate.';
    }
  }

  private static hashResult(...vals: number[]): string {
    return vals.join('|');
  }
}
