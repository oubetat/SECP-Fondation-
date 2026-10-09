export class FeatureTreeEngine {
  static getInitialTree() {
    return [
      { id: 'f1', name: 'Base Extrude 01', type: 'EXTRUDE' },
      { id: 'f2', name: 'Fillet Edge 02', type: 'FILLET' }
    ];
  }

  static getFeatures() {
    return [
      { id: 'f1', name: 'Base Extrude 01', type: 'EXTRUDE' },
      { id: 'f2', name: 'Fillet Edge 02', type: 'FILLET' }
    ];
  }
}
