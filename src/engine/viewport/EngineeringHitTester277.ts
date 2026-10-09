/**
 * PATCH-277: Engineering Hit Tester
 * Converts viewport ray intersections to stable engineering entity hits.
 */

import * as THREE from 'three';
import { HitResult } from './SelectionTypes277';
import { SelectionType } from './ViewportTypes276';

export class EngineeringHitTester {
  private raycaster: THREE.Raycaster;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line = { threshold: 0.1 };
    this.raycaster.params.Points = { threshold: 0.1 };
  }

  public test(
    ndc: { x: number; y: number },
    camera: THREE.Camera,
    scene: THREE.Scene
  ): HitResult | null {
    const coords = new THREE.Vector2(ndc.x, ndc.y);
    this.raycaster.setFromCamera(coords, camera);
    const intersects = this.raycaster.intersectObjects(scene.children, true);

    if (intersects.length === 0) return null;

    // Sort by distance and priority logic
    for (const intersect of intersects) {
      const obj = intersect.object;
      // We look for objects with explicit engineering metadata in userData
      if (obj.userData && obj.userData.id) {
        return {
          entityId: obj.userData.id,
          entityType: this.mapObjectType(obj),
          distance: intersect.distance,
          point: [intersect.point.x, intersect.point.y, intersect.point.z],
          normal: intersect.face ? [intersect.face.normal.x, intersect.face.normal.y, intersect.face.normal.z] : undefined,
          parentPartId: obj.userData.partId || 'PART-P001',
          parentBodyId: obj.userData.bodyId || 'BODY-B001',
          isVisualOnly: false
        };
      }
    }

    return null;
  }

  private mapObjectType(obj: THREE.Object3D): SelectionType {
    if (obj instanceof THREE.Mesh) return 'FACE';
    if (obj instanceof THREE.Line || obj instanceof THREE.LineSegments) return 'EDGE';
    if (obj instanceof THREE.Points) return 'VERTEX';
    return 'BODY';
  }
}
