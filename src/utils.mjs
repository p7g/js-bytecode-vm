export class AssertionError extends Error {}

export function assert(cond, msg) {
  if (!cond) {
    throw new AssertionError(msg);
  }
}

export function num2bytes(n) {
  return [n & 0xff00, n & 0xff];
}
