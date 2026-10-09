export interface DrawingView282 {
  viewId: string;
  name: string;
  scale: number;
  type: 'ORTHO' | 'ISO' | 'SECTION' | 'DETAIL';
}

export interface DrawingState282 {
  modelId: string;
  revision: string;
  views: DrawingView282[];
  sheetSize: string;
  isActive: boolean;
  activeDocument?: {
    revision: string;
    sheets: {
      views: any[];
    }[];
  };
}
