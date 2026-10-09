export class DrawingTypes {}
export interface DrawingDocument {
  id: string;
  sheets: Array<{
    views: any[];
  }>;
}
