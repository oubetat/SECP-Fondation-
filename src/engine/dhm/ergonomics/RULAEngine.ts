/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 006
 * RULA Assessment Engine (Rapid Upper Limb Assessment)
 * 
 * Based on: McAtamney, L., & Corlett, E.N. (1993). RULA: a survey method for the 
 * investigation of work-related upper limb disorders. Applied Ergonomics, 24(2), 91-99.
 */

import { RULAInput, ErgonomicEvidence, ErgonomicMethodology } from './types';
import { HumanForwardKinematicsEngine } from '../kinematics/HumanForwardKinematicsEngine';
import { AnatomicalRegion } from '../types/SkeletalTopologyTypes';
import { AnthropometricDatasetRegistry } from '../anthropometry/AnthropometricDatasetRegistry';
import { SkeletalTopologyEngine } from '../topology/SkeletalTopologyEngine';

export class RULAEngine {
  public static readonly VERSION = '1.0.0-PROD';

  // Table A: Upper Arm (1-6), Lower Arm (1-3), Wrist (1-4), Wrist Twist (1-2)
  private static readonly TABLE_A: number[][][][] = [
    // Upper Arm Score 1
    [
      // Lower Arm Score 1
      [[1, 2], [2, 3], [3, 3], [4, 4]], // Wrist 1, 2, 3, 4
      [[2, 3], [3, 3], [3, 4], [4, 4]],
      [[3, 3], [3, 4], [4, 4], [5, 5]]
    ],
    // Upper Arm Score 2
    [
      [[2, 3], [3, 3], [4, 4], [5, 5]],
      [[3, 3], [3, 4], [4, 5], [5, 5]],
      [[3, 4], [4, 4], [5, 5], [6, 6]]
    ],
    // Upper Arm Score 3
    [
      [[3, 3], [4, 4], [5, 5], [6, 6]],
      [[3, 4], [4, 5], [5, 6], [6, 7]],
      [[4, 4], [5, 5], [6, 6], [7, 7]]
    ],
    // Upper Arm Score 4
    [
      [[4, 4], [5, 5], [6, 6], [7, 7]],
      [[4, 5], [5, 6], [6, 7], [7, 8]],
      [[5, 5], [6, 6], [7, 7], [8, 8]]
    ],
    // Upper Arm Score 5
    [
      [[5, 5], [6, 6], [7, 7], [8, 8]],
      [[5, 6], [6, 7], [7, 8], [8, 9]],
      [[6, 6], [7, 7], [8, 8], [9, 9]]
    ],
    // Upper Arm Score 6
    [
      [[7, 7], [8, 8], [9, 9], [9, 9]],
      [[8, 8], [9, 9], [9, 9], [9, 9]],
      [[9, 9], [9, 9], [9, 9], [9, 9]]
    ]
  ];

  // Table B: Neck (1-6), Trunk (1-6), Legs (1-2)
  private static readonly TABLE_B: number[][][] = [
    // Neck 1
    [[1, 3], [2, 3], [3, 4], [5, 5], [6, 6], [7, 7]], // Trunk 1..6, Leg 1,2
    // Neck 2
    [[2, 3], [2, 3], [4, 5], [5, 5], [6, 7], [7, 7]],
    // Neck 3
    [[3, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 7]],
    // Neck 4
    [[5, 5], [5, 6], [6, 7], [7, 7], [7, 8], [8, 8]],
    // Neck 5
    [[7, 7], [7, 7], [7, 8], [8, 8], [8, 9], [9, 9]],
    // Neck 6
    [[8, 8], [8, 8], [8, 9], [9, 9], [9, 9], [9, 9]]
  ];

  // Table C: Score A (1-8+), Score B (1-7+)
  private static readonly TABLE_C: number[][] = [
    [1, 2, 3, 3, 4, 5, 5],
    [2, 2, 3, 4, 4, 5, 5],
    [3, 3, 3, 4, 4, 5, 6],
    [3, 3, 3, 4, 5, 6, 6],
    [4, 4, 4, 5, 6, 7, 7],
    [4, 4, 5, 6, 6, 7, 7],
    [5, 5, 6, 6, 7, 7, 7],
    [5, 5, 6, 7, 7, 7, 7]
  ];

  public static assess(input: RULAInput, profileId: string = 'ANSUR2_MALE_P50'): ErgonomicEvidence {
    const registry = AnthropometricDatasetRegistry.getInstance();
    const profile = registry.getProfile(profileId) || registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(profile);
    const fk = HumanForwardKinematicsEngine.computeFK(skeleton, input.pose);

    // Group A scores
    const upperArmScore = this.calculateUpperArmScore(input);
    const lowerArmScore = this.calculateLowerArmScore(input);
    const wristScore = this.calculateWristScore(input);
    const wristTwistScore = input.wristTwist;

    // Score A from Table A
    let scoreA = this.TABLE_A[upperArmScore - 1][lowerArmScore - 1][wristScore - 1][wristTwistScore - 1];
    
    // Add Muscle/Load for Group A
    const muscleScoreA = input.muscleUse ? 1 : 0;
    const loadScoreA = this.calculateLoadScore(input.loadKg);
    scoreA += muscleScoreA + loadScoreA;

    // Group B scores
    const neckScore = this.calculateNeckScore(input);
    const trunkScore = this.calculateTrunkScore(input);
    const legsScore = this.calculateLegsScore(input);

    // Score B from Table B
    let scoreB = this.TABLE_B[neckScore - 1][trunkScore - 1][legsScore - 1];
    
    // Add Muscle/Load for Group B
    const muscleScoreB = input.muscleUse ? 1 : 0;
    const loadScoreB = this.calculateLoadScore(input.loadKg);
    scoreB += muscleScoreB + loadScoreB;

    // Final Score from Table C
    const finalScore = this.lookupTableC(scoreA, scoreB);

    return {
      methodology: ErgonomicMethodology.RULA,
      version: this.VERSION,
      documentId: 'DOC_ERG_001',
      revision: 1,
      dhmProfileId: profileId,
      timestampIso: new Date().toISOString(),
      provenanceHash: this.hashResult(finalScore, scoreA, scoreB),
      scores: {
        upperArm: upperArmScore,
        lowerArm: lowerArmScore,
        wrist: wristScore,
        wristTwist: wristTwistScore,
        scoreA,
        neck: neckScore,
        trunk: trunkScore,
        legs: legsScore,
        scoreB,
        finalScore
      },
      actionLevel: this.getActionLevel(finalScore),
      interpretation: this.getInterpretation(finalScore),
      limitations: [
        'RULA assesses postural load and force/repetition for upper limbs and trunk.',
        'Assumes standard anatomical ROM and published RULA scoring tables.'
      ],
      references: {
        source: 'McAtamney, L., & Corlett, E.N. (1993). RULA: a survey method for the investigation of work-related upper limb disorders. Applied Ergonomics, 24(2), 91-99.',
        tables: ['Table A (p. 94)', 'Table B (p. 94)', 'Table C (p. 95)'],
        pages: ['91-99']
      }
    };
  }

  private static calculateUpperArmScore(input: RULAInput): number {
    const angle = input.pose.jointAngles['J_SHOULDER_R']?.flexionExtension || 0;
    let score = 1;
    if (angle >= -20 && angle <= 20) score = 1;
    else if (angle > 20 && angle <= 45) score = 2;
    else if (angle < -20) score = 2;
    else if (angle > 45 && angle <= 90) score = 3;
    else if (angle > 90) score = 4;

    // Adjustments
    if (input.shoulderRaised) score += 1;
    if (input.shoulderAbducted) score += 1;
    if (input.armSupported) score -= 1;

    return Math.max(1, Math.min(6, score));
  }

  private static calculateLowerArmScore(input: RULAInput): number {
    const angle = input.pose.jointAngles['J_ELBOW_R']?.flexionExtension || 0;
    let score = 1;
    if (angle >= 60 && angle <= 100) score = 1;
    else score = 2; // < 60 or > 100
    
    // Note: Out to side or crossing midline would add +1. 
    // This could be derived from abduction but for now we keep it simple or require input.
    return score;
  }

  private static calculateWristScore(input: RULAInput): number {
    const angle = input.pose.jointAngles['J_WRIST_R']?.flexionExtension || 0;
    let score = 1;
    if (angle === 0) score = 1;
    else if (Math.abs(angle) <= 15) score = 2;
    else score = 3; // > 15
    return score;
  }

  private static calculateNeckScore(input: RULAInput): number {
    const angle = input.pose.jointAngles['J_NECK']?.flexionExtension || 0;
    let score = 1;
    if (angle >= 0 && angle < 10) score = 1;
    else if (angle >= 10 && angle < 20) score = 2;
    else if (angle >= 20) score = 3;
    else if (angle < 0) score = 4; // Extension

    if (input.neckTwisted) score += 1;
    if (input.neckSideBending) score += 1;
    return Math.min(6, score);
  }

  private static calculateTrunkScore(input: RULAInput): number {
    const angle = input.pose.jointAngles['J_SPINE_MID']?.flexionExtension || 0;
    let score = 1;
    if (angle === 0) score = 1;
    else if (angle > 0 && angle <= 20) score = 2;
    else if (angle > 20 && angle <= 60) score = 3;
    else if (angle > 60) score = 4;

    if (input.trunkTwisted) score += 1;
    if (input.trunkSideBending) score += 1;
    return Math.min(6, score);
  }

  private static calculateLegsScore(input: RULAInput): number {
    // 1: Leg and feet well supported and in balance
    // 2: Not well supported
    return input.legsSupported ? 1 : 2; 
  }

  private static calculateLoadScore(kg: number): number {
    if (kg < 2) return 0;
    if (kg >= 2 && kg <= 10) return 1;
    return 2; // > 10kg
  }

  private static lookupTableC(scoreA: number, scoreB: number): number {
    const row = Math.min(8, scoreA) - 1;
    const col = Math.min(7, scoreB) - 1;
    return this.TABLE_C[row][col];
  }

  private static getActionLevel(score: number): number {
    if (score <= 2) return 1;
    if (score <= 4) return 2;
    if (score <= 6) return 3;
    return 4;
  }

  private static getInterpretation(score: number): string {
    if (score <= 2) return 'Acceptable posture.';
    if (score <= 4) return 'Further investigation needed, may require changes.';
    if (score <= 6) return 'Investigation and changes required soon.';
    return 'Investigation and changes required immediately.';
  }

  private static hashResult(...vals: number[]): string {
    return vals.join('|'); // Simplified hash for trace
  }
}
