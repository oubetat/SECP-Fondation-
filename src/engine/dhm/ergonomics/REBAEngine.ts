/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 006
 * REBA Assessment Engine (Rapid Entire Body Assessment)
 * 
 * Based on: Hignett, S., & McAtamney, L. (2000). Rapid Entire Body Assessment (REBA). 
 * Applied Ergonomics, 31(2), 201-205.
 */

import { REBAInput, ErgonomicEvidence, ErgonomicMethodology } from './types';
import { HumanForwardKinematicsEngine } from '../kinematics/HumanForwardKinematicsEngine';
import { AnatomicalRegion } from '../types/SkeletalTopologyTypes';
import { AnthropometricDatasetRegistry } from '../anthropometry/AnthropometricDatasetRegistry';
import { SkeletalTopologyEngine } from '../topology/SkeletalTopologyEngine';

export class REBAEngine {
  public static readonly VERSION = '1.0.0-PROD';

  // Table A: Trunk (1-5), Neck (1-3), Legs (1-4)
  private static readonly TABLE_A: number[][][] = [
    // Trunk 1
    [[1, 2, 3, 4], [2, 3, 4, 5], [2, 4, 5, 6]], // Neck 1, 2, 3 -> Legs 1, 2, 3, 4
    // Trunk 2
    [[1, 2, 3, 4], [3, 4, 5, 6], [4, 6, 7, 8]],
    // Trunk 3
    [[2, 3, 4, 5], [4, 5, 6, 7], [5, 7, 8, 9]],
    // Trunk 4
    [[3, 4, 5, 6], [5, 6, 7, 8], [6, 8, 9, 9]],
    // Trunk 5
    [[4, 5, 6, 7], [6, 7, 8, 9], [7, 9, 9, 9]]
  ];

  // Table B: Upper Arm (1-6), Lower Arm (1-2), Wrist (1-3)
  private static readonly TABLE_B: number[][][] = [
    // Upper Arm 1
    [[1, 2, 2], [1, 2, 3]], // Lower Arm 1, 2 -> Wrist 1, 2, 3
    // Upper Arm 2
    [[1, 2, 3], [2, 3, 4]],
    // Upper Arm 3
    [[3, 4, 5], [4, 5, 5]],
    // Upper Arm 4
    [[4, 5, 5], [5, 6, 7]],
    // Upper Arm 5
    [[6, 7, 8], [7, 8, 8]],
    // Upper Arm 6
    [[7, 8, 8], [8, 9, 9]]
  ];

  // Table C: Score A (1-12), Score B (1-12)
  private static readonly TABLE_C: number[][] = [
    [1, 1, 1, 2, 3, 3, 4, 5, 6, 7, 7, 7],
    [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7, 8],
    [2, 3, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8],
    [3, 4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9],
    [4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9, 9],
    [6, 6, 6, 7, 8, 8, 9, 9, 10, 10, 10, 10],
    [7, 7, 7, 8, 9, 9, 9, 10, 10, 11, 11, 11],
    [8, 8, 8, 9, 10, 10, 10, 10, 10, 11, 11, 11],
    [9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12],
    [10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12],
    [11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12],
    [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12]
  ];

  public static assess(input: REBAInput, profileId: string = 'ANSUR2_MALE_P50'): ErgonomicEvidence {
    const registry = AnthropometricDatasetRegistry.getInstance();
    const profile = registry.getProfile(profileId) || registry.getProfile('ANSUR2_MALE_P50')!;
    const skeleton = SkeletalTopologyEngine.buildSkeleton(profile);
    const fk = HumanForwardKinematicsEngine.computeFK(skeleton, input.pose);

    // Group A
    const trunkScore = this.calculateTrunkScore(input);
    const neckScore = this.calculateNeckScore(input);
    const legsScore = this.calculateLegsScore(input);
    let scoreA = this.TABLE_A[trunkScore - 1][neckScore - 1][legsScore - 1];
    scoreA += this.calculateLoadScore(input.loadKg);

    // Group B
    const upperArmScore = this.calculateUpperArmScore(input);
    const lowerArmScore = this.calculateLowerArmScore(input);
    const wristScore = this.calculateWristScore(input);
    let scoreB = this.TABLE_B[upperArmScore - 1][lowerArmScore - 1][wristScore - 1];
    scoreB += input.coupling;

    // Score C
    let finalScore = this.TABLE_C[Math.min(12, scoreA) - 1][Math.min(12, scoreB) - 1];
    
    // Activity Adjustments
    if (input.activity.staticPosture) finalScore += 1;
    if (input.activity.repeatedAction) finalScore += 1;
    if (input.activity.rapidChange) finalScore += 1;

    return {
      methodology: ErgonomicMethodology.REBA,
      version: this.VERSION,
      documentId: 'DOC_ERG_001',
      revision: 1,
      dhmProfileId: profileId,
      timestampIso: new Date().toISOString(),
      provenanceHash: this.hashResult(finalScore, scoreA, scoreB),
      scores: {
        trunk: trunkScore,
        neck: neckScore,
        legs: legsScore,
        scoreA,
        upperArm: upperArmScore,
        lowerArm: lowerArmScore,
        wrist: wristScore,
        scoreB,
        finalScore
      },
      actionLevel: this.getActionLevel(finalScore),
      interpretation: this.getInterpretation(finalScore),
      limitations: [
        'REBA provides a quick assessment of postural risks for the whole body.',
        'Load and coupling scores are based on user input.'
      ],
      references: {
        source: 'Hignett, S., & McAtamney, L. (2000). Rapid Entire Body Assessment (REBA). Applied Ergonomics, 31(2), 201-205.',
        tables: ['Table A (p. 202)', 'Table B (p. 202)', 'Table C (p. 203)'],
        pages: ['201-205']
      }
    };
  }

  private static calculateTrunkScore(input: REBAInput): number {
    const angle = input.pose.jointAngles['J_SPINE_MID']?.flexionExtension || 0;
    let score = 1;
    if (angle === 0) score = 1;
    else if (Math.abs(angle) <= 20) score = 2;
    else if (angle > 20 && angle <= 60) score = 3;
    else if (angle < -20) score = 3;
    else if (angle > 60) score = 4;
    return score;
  }

  private static calculateNeckScore(input: REBAInput): number {
    const angle = input.pose.jointAngles['J_NECK']?.flexionExtension || 0;
    if (angle >= 0 && angle <= 20) return 1;
    return 2; // > 20 or < 0
  }

  private static calculateLegsScore(input: REBAInput): number {
    // 1: bilateral weight bearing, walking/sitting
    // 2: unilateral, or unstable posture
    let score = input.legSupport;
    
    // Adjustments for knee flexion
    if (input.kneeFlexionDeg > 60) score += 2;
    else if (input.kneeFlexionDeg > 30) score += 1;

    return Math.min(4, score);
  }

  private static calculateUpperArmScore(input: REBAInput): number {
    const angle = input.pose.jointAngles['J_SHOULDER_R']?.flexionExtension || 0;
    let score = 1;
    if (Math.abs(angle) <= 20) score = 1;
    else if (angle > 20 && angle <= 45) score = 2;
    else if (angle < -20) score = 2;
    else if (angle > 45 && angle <= 90) score = 3;
    else if (angle > 90) score = 4;
    return score;
  }

  private static calculateLowerArmScore(input: REBAInput): number {
    const angle = input.pose.jointAngles['J_ELBOW_R']?.flexionExtension || 0;
    if (angle >= 60 && angle <= 100) return 1;
    return 2;
  }

  private static calculateWristScore(input: REBAInput): number {
    const angle = input.pose.jointAngles['J_WRIST_R']?.flexionExtension || 0;
    if (Math.abs(angle) <= 15) return 1;
    return 2;
  }

  private static calculateLoadScore(kg: number): number {
    if (kg < 5) return 0;
    if (kg < 10) return 1;
    return 2;
  }

  private static getActionLevel(score: number): number {
    if (score === 1) return 0;
    if (score <= 3) return 1;
    if (score <= 7) return 2;
    if (score <= 10) return 3;
    return 4;
  }

  private static getInterpretation(score: number): string {
    if (score === 1) return 'Negligible risk.';
    if (score <= 3) return 'Low risk, change may be needed.';
    if (score <= 7) return 'Medium risk, further investigation, change soon.';
    if (score <= 10) return 'High risk, investigate and implement change.';
    return 'Very high risk, implement change now.';
  }

  private static hashResult(...vals: number[]): string {
    return vals.join('|');
  }
}
