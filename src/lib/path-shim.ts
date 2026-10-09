// Browser shim for Node path module to satisfy client-side bundling of CAM reporting
export function resolve(...args: string[]) {
  return args.filter(Boolean).join('/');
}
export function join(...args: string[]) {
  return args.filter(Boolean).join('/');
}
export default {
  resolve,
  join
};
