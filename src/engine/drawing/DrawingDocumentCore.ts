import { DrawingDocument } from './DrawingTypes';
export class DrawingDocumentCore {
  constructor(public title?: string) {}
  getDocument(): DrawingDocument {
    return {} as DrawingDocument;
  }
}
