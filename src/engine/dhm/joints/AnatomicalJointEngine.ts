/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 002
 * Anatomical Joint Engine & Range of Motion (ROM) Validator
 * 
 * Defines standard anatomical joints with traceable ROM limits based on NASA STD-3001 Vol 2
 * and AAOS (American Academy of Orthopaedic Surgeons) clinical norms.
 */

import { AnatomicalRegion } from '../types/SkeletalTopologyTypes';
import {
  AnatomicalJoint,
  AnatomicalJointType,
  JointValidationResult
} from '../types/JointModelTypes';

export class AnatomicalJointEngine {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Builds full set of anatomical joints for the 19-segment skeletal topology
   */
  public static buildAnatomicalJoints(): Map<string, AnatomicalJoint> {
    const joints = new Map<string, AnatomicalJoint>();

    // Helper builder
    const addJoint = (
      jointId: string,
      name: string,
      type: AnatomicalJointType,
      parent: AnatomicalRegion,
      child: AnatomicalRegion,
      dof: number,
      flexExt: { minDeg: number; maxDeg: number; neutralDeg: number },
      abdAdd?: { minDeg: number; maxDeg: number; neutralDeg: number },
      intExt?: { minDeg: number; maxDeg: number; neutralDeg: number },
      reference: string = 'NASA-STD-3001 Vol 2 / AAOS Clinical Norms'
    ) => {
      joints.set(jointId, {
        jointId,
        name,
        type,
        parentSegmentId: parent,
        childSegmentId: child,
        degreesOfFreedom: dof,
        rangeOfMotion: {
          flexionExtension: flexExt,
          abductionAdduction: abdAdd,
          internalExternalRotation: intExt
        },
        currentAnglesDeg: {
          flexionExtension: flexExt.neutralDeg,
          abductionAdduction: abdAdd?.neutralDeg,
          internalExternalRotation: intExt?.neutralDeg
        },
        romReferenceSource: reference
      });
    };

    // 1. Cervical / Neck Joint (C1-C7)
    addJoint(
      'J_NECK',
      'Cervical Spine / Neck Joint',
      AnatomicalJointType.SPHERICAL_3DOF,
      AnatomicalRegion.THORACIC_SPINE,
      AnatomicalRegion.NECK,
      3,
      { minDeg: -60, maxDeg: 50, neutralDeg: 0 },  // Extension / Flexion
      { minDeg: -45, maxDeg: 45, neutralDeg: 0 },  // Lateral Bending
      { minDeg: -80, maxDeg: 80, neutralDeg: 0 }   // Axial Rotation
    );

    // 2. Lumbar Spine Joint (L1-L5)
    addJoint(
      'J_LUMBAR',
      'Lumbar Spine Joint',
      AnatomicalJointType.COMPOUND_SPINE,
      AnatomicalRegion.PELVIS,
      AnatomicalRegion.LUMBAR_SPINE,
      3,
      { minDeg: -30, maxDeg: 75, neutralDeg: 0 },  // Extension / Flexion
      { minDeg: -35, maxDeg: 35, neutralDeg: 0 },  // Lateral Bending
      { minDeg: -45, maxDeg: 45, neutralDeg: 0 }   // Axial Rotation
    );

    // 3. Glenohumeral / Shoulder Joint (Left & Right)
    addJoint(
      'J_LEFT_SHOULDER',
      'Left Shoulder Joint (Glenohumeral)',
      AnatomicalJointType.SPHERICAL_3DOF,
      AnatomicalRegion.LEFT_CLAVICLE,
      AnatomicalRegion.LEFT_UPPER_ARM,
      3,
      { minDeg: -60, maxDeg: 180, neutralDeg: 0 }, // Extension / Flexion
      { minDeg: -50, maxDeg: 180, neutralDeg: 0 }, // Adduction / Abduction
      { minDeg: -90, maxDeg: 90, neutralDeg: 0 }   // External / Internal Rotation
    );

    addJoint(
      'J_RIGHT_SHOULDER',
      'Right Shoulder Joint (Glenohumeral)',
      AnatomicalJointType.SPHERICAL_3DOF,
      AnatomicalRegion.RIGHT_CLAVICLE,
      AnatomicalRegion.RIGHT_UPPER_ARM,
      3,
      { minDeg: -60, maxDeg: 180, neutralDeg: 0 },
      { minDeg: -50, maxDeg: 180, neutralDeg: 0 },
      { minDeg: -90, maxDeg: 90, neutralDeg: 0 }
    );

    // 4. Humeroulnar / Elbow Joint (Left & Right)
    addJoint(
      'J_LEFT_ELBOW',
      'Left Elbow Joint (Humeroulnar)',
      AnatomicalJointType.HINGE_1DOF,
      AnatomicalRegion.LEFT_UPPER_ARM,
      AnatomicalRegion.LEFT_FOREARM,
      1,
      { minDeg: 0, maxDeg: 145, neutralDeg: 0 }    // Full Extension (0) to Flexion (145)
    );

    addJoint(
      'J_RIGHT_ELBOW',
      'Right Elbow Joint (Humeroulnar)',
      AnatomicalJointType.HINGE_1DOF,
      AnatomicalRegion.RIGHT_UPPER_ARM,
      AnatomicalRegion.RIGHT_FOREARM,
      1,
      { minDeg: 0, maxDeg: 145, neutralDeg: 0 }
    );

    // 5. Radiocarpal / Wrist Joint (Left & Right)
    addJoint(
      'J_LEFT_WRIST',
      'Left Wrist Joint (Radiocarpal)',
      AnatomicalJointType.UNIVERSAL_2DOF,
      AnatomicalRegion.LEFT_FOREARM,
      AnatomicalRegion.LEFT_HAND,
      2,
      { minDeg: -70, maxDeg: 75, neutralDeg: 0 },  // Extension / Flexion
      { minDeg: -20, maxDeg: 35, neutralDeg: 0 }   // Radial / Ulnar Deviation
    );

    addJoint(
      'J_RIGHT_WRIST',
      'Right Wrist Joint (Radiocarpal)',
      AnatomicalJointType.UNIVERSAL_2DOF,
      AnatomicalRegion.RIGHT_FOREARM,
      AnatomicalRegion.RIGHT_HAND,
      2,
      { minDeg: -70, maxDeg: 75, neutralDeg: 0 },
      { minDeg: -20, maxDeg: 35, neutralDeg: 0 }
    );

    // 6. Acetabulofemoral / Hip Joint (Left & Right)
    addJoint(
      'J_LEFT_HIP',
      'Left Hip Joint (Acetabulofemoral)',
      AnatomicalJointType.SPHERICAL_3DOF,
      AnatomicalRegion.PELVIS,
      AnatomicalRegion.LEFT_THIGH,
      3,
      { minDeg: -30, maxDeg: 120, neutralDeg: 0 }, // Extension / Flexion
      { minDeg: -30, maxDeg: 45, neutralDeg: 0 },  // Adduction / Abduction
      { minDeg: -45, maxDeg: 45, neutralDeg: 0 }   // Internal / External Rotation
    );

    addJoint(
      'J_RIGHT_HIP',
      'Right Hip Joint (Acetabulofemoral)',
      AnatomicalJointType.SPHERICAL_3DOF,
      AnatomicalRegion.PELVIS,
      AnatomicalRegion.RIGHT_THIGH,
      3,
      { minDeg: -30, maxDeg: 120, neutralDeg: 0 },
      { minDeg: -30, maxDeg: 45, neutralDeg: 0 },
      { minDeg: -45, maxDeg: 45, neutralDeg: 0 }
    );

    // 7. Tibiofemoral / Knee Joint (Left & Right)
    addJoint(
      'J_LEFT_KNEE',
      'Left Knee Joint (Tibiofemoral)',
      AnatomicalJointType.HINGE_1DOF,
      AnatomicalRegion.LEFT_THIGH,
      AnatomicalRegion.LEFT_LOWER_LEG,
      1,
      { minDeg: -5, maxDeg: 140, neutralDeg: 0 }   // Hyperextension (-5) to Flexion (140)
    );

    addJoint(
      'J_RIGHT_KNEE',
      'Right Knee Joint (Tibiofemoral)',
      AnatomicalJointType.HINGE_1DOF,
      AnatomicalRegion.RIGHT_THIGH,
      AnatomicalRegion.RIGHT_LOWER_LEG,
      1,
      { minDeg: -5, maxDeg: 140, neutralDeg: 0 }
    );

    // 8. Talocrural / Ankle Joint (Left & Right)
    addJoint(
      'J_LEFT_ANKLE',
      'Left Ankle Joint (Talocrural)',
      AnatomicalJointType.UNIVERSAL_2DOF,
      AnatomicalRegion.LEFT_LOWER_LEG,
      AnatomicalRegion.LEFT_FOOT,
      2,
      { minDeg: -45, maxDeg: 20, neutralDeg: 0 },  // Plantarflexion (-45) / Dorsiflexion (20)
      { minDeg: -20, maxDeg: 30, neutralDeg: 0 }   // Eversion / Inversion
    );

    addJoint(
      'J_RIGHT_ANKLE',
      'Right Ankle Joint (Talocrural)',
      AnatomicalJointType.UNIVERSAL_2DOF,
      AnatomicalRegion.RIGHT_LOWER_LEG,
      AnatomicalRegion.RIGHT_FOOT,
      2,
      { minDeg: -45, maxDeg: 20, neutralDeg: 0 },
      { minDeg: -20, maxDeg: 30, neutralDeg: 0 }
    );

    return joints;
  }

  /**
   * Validates proposed joint angles against anatomical Range of Motion (ROM) limits
   */
  public static validateJointAngles(
    joint: AnatomicalJoint,
    anglesDeg: {
      flexionExtension: number;
      abductionAdduction?: number;
      internalExternalRotation?: number;
    }
  ): JointValidationResult {
    const violations: string[] = [];

    if (!joint) {
      return { isValid: false, violations: ['Joint is null or undefined.'] };
    }

    const rom = joint.rangeOfMotion;

    // 1. Flexion / Extension check
    if (rom.flexionExtension) {
      const val = anglesDeg.flexionExtension;
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        violations.push(`Joint '${joint.jointId}' Flexion/Extension angle is non-numeric or non-finite: ${val}`);
      } else if (val < rom.flexionExtension.minDeg || val > rom.flexionExtension.maxDeg) {
        violations.push(
          `Joint '${joint.jointId}' Flexion/Extension angle ${val.toFixed(1)}° violates anatomical ROM limits [${rom.flexionExtension.minDeg}°, ${rom.flexionExtension.maxDeg}°].`
        );
      }
    }

    // 2. Abduction / Adduction check
    if (rom.abductionAdduction && anglesDeg.abductionAdduction !== undefined) {
      const val = anglesDeg.abductionAdduction;
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        violations.push(`Joint '${joint.jointId}' Abduction/Adduction angle is non-numeric: ${val}`);
      } else if (val < rom.abductionAdduction.minDeg || val > rom.abductionAdduction.maxDeg) {
        violations.push(
          `Joint '${joint.jointId}' Abduction/Adduction angle ${val.toFixed(1)}° violates anatomical ROM limits [${rom.abductionAdduction.minDeg}°, ${rom.abductionAdduction.maxDeg}°].`
        );
      }
    }

    // 3. Internal / External Rotation check
    if (rom.internalExternalRotation && anglesDeg.internalExternalRotation !== undefined) {
      const val = anglesDeg.internalExternalRotation;
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        violations.push(`Joint '${joint.jointId}' Internal/External Rotation angle is non-numeric: ${val}`);
      } else if (val < rom.internalExternalRotation.minDeg || val > rom.internalExternalRotation.maxDeg) {
        violations.push(
          `Joint '${joint.jointId}' Internal/External Rotation angle ${val.toFixed(1)}° violates anatomical ROM limits [${rom.internalExternalRotation.minDeg}°, ${rom.internalExternalRotation.maxDeg}°].`
        );
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }
}
