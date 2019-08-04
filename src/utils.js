class AssertionError extends Error {}

function assert(cond, msg) {
  if (!cond) {
    throw new AssertionError(msg);
  }
}

function num2bytes(n) {
  return [n & 0xff00, n & 0xff];
}

module.exports = {
  AssertionError,
  assert,
  num2bytes,
};
