export function resolve(...args: string[]): string {
  return args.join('/');
}

export function join(...args: string[]): string {
  return args.join('/').replace(/\/+/g, '/');
}

export function dirname(p: string): string {
  const parts = p.split('/');
  parts.pop();
  return parts.join('/') || '.';
}

const pathMock = {
  resolve,
  join,
  dirname
};

export default pathMock;
