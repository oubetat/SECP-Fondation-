// Browser shim for Node fs module with transparent fallback
export const existsSync = (_path: string) => false;
export const mkdirSync = (_path: string, _options?: any) => null;
export const writeFileSync = (_path: string, _data: any, _options?: any) => null;
export const readFileSync = (_path: string, _options?: any) => '';
export const statSync = (_path: string) => null;
export const readdirSync = (_path: string, _options?: any) => [];

export default {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  readdirSync
};
