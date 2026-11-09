/// <reference types="vite/client" />

declare module '*/firebase-applet-config.json' {
  const config: { [key: string]: any; firestoreDatabaseId?: string };
  export default config;
}

declare module 'opencascade.js' {
  const occt: any;
  export default occt;
}

declare module '@testing-library/jest-dom';
declare module '@testing-library/react';

declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(options?: any);
    models: any;
  }
  export const Type: any;
}

