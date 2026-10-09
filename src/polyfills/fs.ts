export function existsSync(path: string): boolean {
  return false;
}

export function mkdirSync(path: string, options?: any): void {
  // no-op
}

export function writeFileSync(path: string, data: string, options?: any): void {
  // no-op
}

export function readFileSync(path: string, options?: any): string {
  return '';
}

const fsMock = {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync
};

export default fsMock;
