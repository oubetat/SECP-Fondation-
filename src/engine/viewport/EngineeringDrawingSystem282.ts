import { DrawingState282 } from './DrawingTypes282';

export class EngineeringDrawingSystem {
  private state: DrawingState282;

  constructor(modelId: string, revision: string) {
    this.state = {
      modelId,
      revision,
      views: [],
      sheetSize: 'A3',
      isActive: false,
      activeDocument: {
        revision: revision,
        sheets: [{ views: [] }]
      }
    };
  }

  public addStandardViews(): void {
    const stdViews = [
      { viewId: 'v1', name: 'Front View', scale: 1.0, type: 'ORTHO' as const },
      { viewId: 'v2', name: 'Top View', scale: 1.0, type: 'ORTHO' as const },
      { viewId: 'v3', name: 'Right View', scale: 1.0, type: 'ORTHO' as const },
      { viewId: 'v4', name: 'Isometric', scale: 0.8, type: 'ISO' as const }
    ];
    this.state.views = [...this.state.views, ...stdViews];
    if (this.state.activeDocument) {
      this.state.activeDocument.sheets[0].views = this.state.views;
    }
  }

  public getState(): DrawingState282 {
    return this.state;
  }
}
