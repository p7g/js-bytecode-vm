const { assert } = require('./utils');

let _i = 0;
function i() {
  return _i++;
}

const ValueType = {
  INTEGER: i(),
  BOOLEAN: i(),
  FUNCTION: i(),
  BUILTIN_FUNCTION: i(),
};

function value(type, v) {
  return { type, value: v };
}

function makeBuiltinFunction(fn) {
  return value(ValueType.BUILTIN_FUNCTION, fn);
}

function makeFunction(address) {
  return value(ValueType.FUNCTION, address);
}

function makeInteger(v) {
  return value(ValueType.INTEGER, v);
}

function makeBoolean(v) {
  return value(ValueType.BOOLEAN, v);
}

function isTruthy(v) {
  switch (v.type) {
    case ValueType.INTEGER:
      return v.value !== 0;
    case ValueType.BOOLEAN:
      return v.value === true;
    default:
      return true;
  }
}

function eq(a, b) {
  if (a.type !== b.type) {
    return makeBoolean(false);
  }

  return makeBoolean(a.value === b.value);
}

module.exports = {
  ValueType,
  isTruthy,
  eq,
  makeInteger,
  makeBoolean,
  makeFunction,
  makeBuiltinFunction,
};

const intOperations = [
  ['add', (a, b) => a + b],
  ['sub', (a, b) => a - b],
  ['mul', (a, b) => a * b],
  ['div', (a, b) => Math.floor(a / b)],
  ['neg', a => -a],
  ['or', (a, b) => a | b],
  ['and', (a, b) => a & b],
  ['not', a => ~a],
  ['ne', (a, b) => a !== b, makeBoolean],
  ['lt', (a, b) => a < b, makeBoolean],
  ['gt', (a, b) => a > b, makeBoolean],
];

for (const [name, op, ret] of intOperations) {
  module.exports[`${name}`] = function(a, b) {
    if (op.length === 2) {
      assert(a.type === b.type && a.type === ValueType.INTEGER,
        `can only ${name} ints, got ${a.type} and ${b.type}`);
      return (ret || makeInteger)(op(a.value, b.value));
    } else if (op.length === 1) {
      assert(a.type === ValueType.INTEGER, `can only ${name} an int`);
      return (ret || makeInteger)(op(a.value));
    }
  };

  if (op.length === 2) {
    module.exports[`${name}1`] = function(a) {
      assert(a.type === ValueType.INTEGER, `can only ${name} 1 to an int`);
      return (ret || makeInteger)(op(a.value, 1));
    };
  }
}
