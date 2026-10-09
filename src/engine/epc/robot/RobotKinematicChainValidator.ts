/**
 * SECP Industrial OS — EPC-043: Robot Kinematic Chain Validator
 * Validates robotic kinematic chain definitions against rules CHAIN-001 through CHAIN-012:
 * CHAIN-001: Root Validation
 * CHAIN-002: Parent/Child Hierarchy Validation
 * CHAIN-003: Joint Reference Validation
 * CHAIN-004: Link Reference Validation
 * CHAIN-005: DOF Mapping Validation
 * CHAIN-006: Axis Validation
 * CHAIN-007: Reference Frame Validation
 * CHAIN-008: Cycle Detection
 * CHAIN-009: Disconnected Component Detection
 * CHAIN-010: Joint Limit Validation
 * CHAIN-011: Transform Matrix Validation
 * CHAIN-012: Assembly Consistency Validation
 */

import {
  KinematicChainModel,
  KinematicChainValidationReport,
  KinematicChainValidationIssue,
  KinematicStatus
} from './RobotKinematicTypes';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';

export class RobotKinematicChainValidator {
  /**
   * Validate full kinematic chain model
   */
  public static validate(
    chain: KinematicChainModel,
    options: {
      assemblyPartIds?: Set<string>;
      assemblyInstanceIds?: Set<string>;
      enforceLimits?: boolean;
      timestamp?: string;
    } = {}
  ): KinematicChainValidationReport {
    const issues: KinematicChainValidationIssue[] = [];
    const enforceLimits = options.enforceLimits !== false;
    const timestamp = options.timestamp || new Date().toISOString();

    // -----------------------------------------------------------------------
    // CHAIN-001: Root Validation
    // -----------------------------------------------------------------------
    let rootValid = true;
    const rootLink = chain.links.find((l) => l.linkId === chain.rootLinkId);
    if (!rootLink) {
      rootValid = false;
      issues.push({
        ruleId: 'CHAIN-001',
        field: 'rootLinkId',
        severity: 'ERROR',
        message: `Root link '${chain.rootLinkId}' not found in kinematic chain links`,
        value: chain.rootLinkId
      });
    } else {
      if (rootLink.parentLinkId !== null) {
        rootValid = false;
        issues.push({
          ruleId: 'CHAIN-001',
          field: 'rootLinkId.parentLinkId',
          severity: 'ERROR',
          message: `Root link '${chain.rootLinkId}' must have parentLinkId set to null, but found '${rootLink.parentLinkId}'`,
          value: rootLink.parentLinkId
        });
      }
      if (options.assemblyInstanceIds && !options.assemblyInstanceIds.has(rootLink.assemblyInstanceId)) {
        rootValid = false;
        issues.push({
          ruleId: 'CHAIN-001',
          field: 'rootLinkId.assemblyInstanceId',
          severity: 'ERROR',
          message: `Root link instance '${rootLink.assemblyInstanceId}' not found in assembly instances`,
          value: rootLink.assemblyInstanceId
        });
      }
    }

    // Check single root link rule
    const nullParentLinks = chain.links.filter((l) => l.parentLinkId === null);
    if (nullParentLinks.length > 1) {
      rootValid = false;
      issues.push({
        ruleId: 'CHAIN-001',
        field: 'links',
        severity: 'ERROR',
        message: `Multiple root links found in kinematic chain: ${nullParentLinks.map((l) => l.linkId).join(', ')}`,
        value: nullParentLinks.length
      });
    }

    // -----------------------------------------------------------------------
    // CHAIN-002 & CHAIN-003: Parent/Child and Joint Reference Validation
    // -----------------------------------------------------------------------
    let parentChildValid = true;
    let jointRefsValid = true;
    const linkMap = new Map(chain.links.map((l) => [l.linkId, l]));

    for (const joint of chain.joints) {
      const parentLink = linkMap.get(joint.parentLinkId);
      const childLink = linkMap.get(joint.childLinkId);

      if (!parentLink) {
        jointRefsValid = false;
        issues.push({
          ruleId: 'CHAIN-003',
          field: `joint.${joint.jointId}.parentLinkId`,
          severity: 'ERROR',
          message: `Joint '${joint.jointId}' references non-existent parent link '${joint.parentLinkId}'`,
          value: joint.parentLinkId
        });
      }

      if (!childLink) {
        jointRefsValid = false;
        issues.push({
          ruleId: 'CHAIN-003',
          field: `joint.${joint.jointId}.childLinkId`,
          severity: 'ERROR',
          message: `Joint '${joint.jointId}' references non-existent child link '${joint.childLinkId}'`,
          value: joint.childLinkId
        });
      }

      if (parentLink && childLink) {
        if (childLink.parentLinkId !== parentLink.linkId) {
          parentChildValid = false;
          issues.push({
            ruleId: 'CHAIN-002',
            field: `link.${childLink.linkId}.parentLinkId`,
            severity: 'ERROR',
            message: `Link '${childLink.linkId}' parentLinkId '${childLink.parentLinkId}' does not match joint '${joint.jointId}' parentLinkId '${parentLink.linkId}'`,
            value: { linkParent: childLink.parentLinkId, jointParent: parentLink.linkId }
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // CHAIN-004: Link Reference Validation
    // -----------------------------------------------------------------------
    let linkRefsValid = true;
    for (const link of chain.links) {
      if (!link.linkId || link.linkId.trim() === '') {
        linkRefsValid = false;
        issues.push({
          ruleId: 'CHAIN-004',
          field: 'link.linkId',
          severity: 'ERROR',
          message: 'Kinematic link ID cannot be empty',
          value: link.linkId
        });
      }

      if (options.assemblyPartIds && !options.assemblyPartIds.has(link.partId)) {
        linkRefsValid = false;
        issues.push({
          ruleId: 'CHAIN-004',
          field: `link.${link.linkId}.partId`,
          severity: 'ERROR',
          message: `Link '${link.linkId}' references unknown CAD part definition '${link.partId}'`,
          value: link.partId
        });
      }

      if (options.assemblyInstanceIds && !options.assemblyInstanceIds.has(link.assemblyInstanceId)) {
        linkRefsValid = false;
        issues.push({
          ruleId: 'CHAIN-004',
          field: `link.${link.linkId}.assemblyInstanceId`,
          severity: 'ERROR',
          message: `Link '${link.linkId}' references unknown assembly instance '${link.assemblyInstanceId}'`,
          value: link.assemblyInstanceId
        });
      }
    }

    // -----------------------------------------------------------------------
    // CHAIN-005: DOF Mapping Validation
    // -----------------------------------------------------------------------
    let dofMappingValid = true;
    const dofMap = new Map(chain.dofMapping.map((d) => [d.dofId, d]));

    for (const joint of chain.joints) {
      if (joint.jointType === 'FIXED') continue;

      if (!joint.dofId) {
        dofMappingValid = false;
        issues.push({
          ruleId: 'CHAIN-005',
          field: `joint.${joint.jointId}.dofId`,
          severity: 'ERROR',
          message: `Active joint '${joint.jointId}' has no DOF ID assigned`,
          value: joint.dofId
        });
        continue;
      }

      const binding = dofMap.get(joint.dofId);
      if (!binding) {
        dofMappingValid = false;
        issues.push({
          ruleId: 'CHAIN-005',
          field: `joint.${joint.jointId}.dofId`,
          severity: 'ERROR',
          message: `Joint '${joint.jointId}' references missing DOF mapping '${joint.dofId}'`,
          value: joint.dofId
        });
      }
    }

    // -----------------------------------------------------------------------
    // CHAIN-006: Axis Validation
    // -----------------------------------------------------------------------
    let axesValid = true;
    for (const joint of chain.joints) {
      const axis = joint.axis;
      if (!axis || typeof axis.x !== 'number' || typeof axis.y !== 'number' || typeof axis.z !== 'number') {
        axesValid = false;
        issues.push({
          ruleId: 'CHAIN-006',
          field: `joint.${joint.jointId}.axis`,
          severity: 'ERROR',
          message: `Joint '${joint.jointId}' has invalid axis coordinates`,
          value: axis
        });
        continue;
      }

      if (!isFinite(axis.x) || !isFinite(axis.y) || !isFinite(axis.z)) {
        axesValid = false;
        issues.push({
          ruleId: 'CHAIN-006',
          field: `joint.${joint.jointId}.axis`,
          severity: 'ERROR',
          message: `Joint '${joint.jointId}' axis contains non-finite values`,
          value: axis
        });
        continue;
      }

      const lenSq = axis.x * axis.x + axis.y * axis.y + axis.z * axis.z;
      if (lenSq < 1e-12) {
        axesValid = false;
        issues.push({
          ruleId: 'CHAIN-006',
          field: `joint.${joint.jointId}.axis`,
          severity: 'ERROR',
          message: `Joint '${joint.jointId}' has zero-length axis vector (0,0,0)`,
          value: axis
        });
      }
    }

    // -----------------------------------------------------------------------
    // CHAIN-007: Reference Frame Validation
    // -----------------------------------------------------------------------
    let referenceFramesValid = true;
    const frameMap = new Map(chain.frames.map((f) => [f.frameId, f]));

    for (const frame of chain.frames) {
      if (frame.parentFrameId && !frameMap.has(frame.parentFrameId)) {
        referenceFramesValid = false;
        issues.push({
          ruleId: 'CHAIN-007',
          field: `frame.${frame.frameId}.parentFrameId`,
          severity: 'ERROR',
          message: `Frame '${frame.frameId}' references missing parent frame '${frame.parentFrameId}'`,
          value: frame.parentFrameId
        });
      }
    }

    // -----------------------------------------------------------------------
    // CHAIN-008: Cycle Detection
    // -----------------------------------------------------------------------
    let cycleFree = true;
    const visited = new Set<string>();
    const stack = new Set<string>();

    const checkCycle = (linkId: string, path: string[]): boolean => {
      visited.add(linkId);
      stack.add(linkId);

      const link = linkMap.get(linkId);
      if (link) {
        for (const childId of link.childLinkIds) {
          if (!visited.has(childId)) {
            if (checkCycle(childId, [...path, childId])) return true;
          } else if (stack.has(childId)) {
            cycleFree = false;
            issues.push({
              ruleId: 'CHAIN-008',
              field: 'links',
              severity: 'ERROR',
              message: `Kinematic cycle detected involving links: ${[...path, childId].join(' -> ')}`,
              value: [...path, childId]
            });
            return true;
          }
        }
      }

      stack.delete(linkId);
      return false;
    };

    if (rootLink) {
      checkCycle(rootLink.linkId, [rootLink.linkId]);
    }

    // -----------------------------------------------------------------------
    // CHAIN-009: Disconnected Component Detection
    // -----------------------------------------------------------------------
    let connected = true;
    const reachableLinks = new Set<string>();

    const traverse = (linkId: string) => {
      if (reachableLinks.has(linkId)) return;
      reachableLinks.add(linkId);
      const link = linkMap.get(linkId);
      if (link) {
        for (const childId of link.childLinkIds) {
          traverse(childId);
        }
      }
    };

    if (rootLink) {
      traverse(rootLink.linkId);
    }

    for (const link of chain.links) {
      if (!reachableLinks.has(link.linkId)) {
        connected = false;
        issues.push({
          ruleId: 'CHAIN-009',
          field: `link.${link.linkId}`,
          severity: 'ERROR',
          message: `Orphan/unreachable link '${link.linkId}' is disconnected from root link '${chain.rootLinkId}'`,
          value: link.linkId
        });
      }
    }

    // -----------------------------------------------------------------------
    // CHAIN-010: Joint Limit Validation
    // -----------------------------------------------------------------------
    let limitsValid = true;
    for (const joint of chain.joints) {
      if (joint.jointType === 'FIXED') continue;
      const pos = joint.state.position;
      const min = joint.limits.minimumPosition;
      const max = joint.limits.maximumPosition;

      if (enforceLimits && (pos < min || pos > max)) {
        limitsValid = false;
        issues.push({
          ruleId: 'CHAIN-010',
          field: `joint.${joint.jointId}.state.position`,
          severity: 'ERROR',
          message: `Joint '${joint.jointId}' position ${pos} exceeds limits [${min}, ${max}]`,
          value: { position: pos, min, max }
        });
      }
    }

    // -----------------------------------------------------------------------
    // CHAIN-011: Transform Validation
    // -----------------------------------------------------------------------
    let transformsValid = true;
    for (const frame of chain.frames) {
      if (!TransformMatrix.isValidTransform(frame.localTransform)) {
        transformsValid = false;
        issues.push({
          ruleId: 'CHAIN-011',
          field: `frame.${frame.frameId}.localTransform`,
          severity: 'ERROR',
          message: `Frame '${frame.frameId}' has invalid local transform matrix`,
          value: frame.localTransform
        });
      }

      if (!TransformMatrix.isValidTransform(frame.worldTransform)) {
        transformsValid = false;
        issues.push({
          ruleId: 'CHAIN-011',
          field: `frame.${frame.frameId}.worldTransform`,
          severity: 'ERROR',
          message: `Frame '${frame.frameId}' has invalid world transform matrix`,
          value: frame.worldTransform
        });
      }
    }

    // -----------------------------------------------------------------------
    // CHAIN-012: Assembly Consistency Validation
    // -----------------------------------------------------------------------
    let assemblyConsistent = true;
    if (options.assemblyPartIds || options.assemblyInstanceIds) {
      if (chain.links.length === 0 || chain.joints.length === 0) {
        assemblyConsistent = false;
        issues.push({
          ruleId: 'CHAIN-012',
          field: 'assembly',
          severity: 'ERROR',
          message: 'Kinematic chain model is empty or inconsistent with assembly',
          value: { linkCount: chain.links.length, jointCount: chain.joints.length }
        });
      }
    }

    // -----------------------------------------------------------------------
    // Summary and Status Determination
    // -----------------------------------------------------------------------
    let status: KinematicStatus = 'VALID';
    if (!cycleFree) {
      status = 'CYCLE_DETECTED';
    } else if (!connected) {
      status = 'DISCONNECTED';
    } else if (!jointRefsValid || !linkRefsValid) {
      status = 'BROKEN';
    } else if (!rootValid || !parentChildValid || !dofMappingValid || !axesValid || !referenceFramesValid || !limitsValid || !transformsValid || !assemblyConsistent) {
      status = 'INVALID';
    }

    const valid = status === 'VALID' && issues.length === 0;

    return {
      valid,
      status,
      issues,
      checks: {
        rootValid,
        parentChildValid,
        jointRefsValid,
        linkRefsValid,
        dofMappingValid,
        axesValid,
        referenceFramesValid,
        cycleFree,
        connected,
        limitsValid,
        transformsValid,
        assemblyConsistent
      },
      timestamp
    };
  }
}
