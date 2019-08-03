export class AssertionError extends Error {}

export function assert(cond, msg) {
  if (!cond) {
    throw new AssertionError(msg);
  }
}
