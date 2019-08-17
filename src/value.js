const { assert, RuntimeError } = require('./utils');

let _i = 0;
function inst() {
  return _i++;
}

const ValueType = {
  NULL: inst(),
  INTEGER: inst(),
  BOOLEAN: inst(),
  FUNCTION: inst(),
  STRING: inst(),
  ARRAY: inst(),
  BUILTIN_FUNCTION: inst(),
};

const typeNames = Object.entries(ValueType).reduce((a, [n, i]) => {
  a[i] = n;
  return a;
}, []);

function value(type, v) {
  return { type, value: v };
}

function makeString(s) {
  return value(ValueType.STRING, s);
}

function makeBuiltinFunction(fn) {
  return value(ValueType.BUILTIN_FUNCTION, fn);
}

function makeFunction(address) {
  return value(ValueType.FUNCTION, { address, bindings: [] });
}

function makeInteger(v) {
  return value(ValueType.INTEGER, v);
}

function makeBoolean(v) {
  return value(ValueType.BOOLEAN, v);
}

function makeArray(length) {
  return value(ValueType.ARRAY, new Array(length));
}

function makeNull() {
  return value(ValueType.NULL);
}

function isTruthy(v) {
  switch (v.type) {
    case ValueType.INTEGER:
      return v.value !== 0;
    case ValueType.BOOLEAN:
      return v.value === true;
    case ValueType.STRING:
    case ValueType.ARRAY:
      return v.value.length > 0;
    default:
      return true;
  }
}

function eq(a, b) {
  if (a.type !== b.type) {
    return makeBoolean(false);
  }

  switch (a.type) {
    case ValueType.INTEGER:
    case ValueType.BOOLEAN:
    case ValueType.FUNCTION:
    case ValueType.BUILTIN_FUNCTION:
      return makeBoolean(a.value === b.value);

    case ValueType.ARRAY:
    case ValueType.STRING:
      if (a.value.length !== b.value.length) {
        return makeBoolean(false);
      }
      for (let i = 0; i < a.value.length; i += 1) {
        if (a.value[i] !== b.value[i]) {
          return makeBoolean(false);
        }
      }
      return makeBoolean(true);

    default:
      return makeBoolean(false);
  }
}

function toString(val) {
  switch (val.type) {
    case ValueType.INTEGER:
      return val.value.toString(10);
    case ValueType.STRING:
      return val.value;
    case ValueType.NULL:
      return 'null';
    case ValueType.BOOLEAN:
      return val.value.toString();

    default:
      return null;
  }
}

function add(a, b) {
  if (a.type === ValueType.INTEGER) {
    assert(b.type === ValueType.INTEGER, 'if one val is int, both must be');
  } else if (a.type === ValueType.STRING) {
    assert(b.type === ValueType.STRING, 'if one val is string, both must be');
  } else {
    throw new RuntimeError(`Unsupported type for +: ${typeNames[a.type]}`);
  }

  if (a.type === ValueType.INTEGER) {
    return makeInteger(a.value + b.value);
  }
  return makeString(a.value + b.value);
}

module.exports = {
  ValueType,
  add,
  eq,
  isTruthy,
  makeArray,
  makeBoolean,
  makeBuiltinFunction,
  makeFunction,
  makeInteger,
  makeNull,
  makeString,
  toString,
  typeNames,
};

const intOperations = [
  ['add', (a, b) => a + b],
  ['sub', (a, b) => a - b],
  ['mul', (a, b) => a * b],
  ['div', (a, b) => Math.floor(a / b)],
  ['mod', (a, b) => a % b],
  ['neg', a => -a],
  ['or', (a, b) => a | b],
  ['and', (a, b) => a & b],
  ['not', a => ~a],
  ['boolnot', a => !a, makeBoolean, ValueType.BOOLEAN],
  ['ne', (a, b) => a !== b, makeBoolean],
  ['lt', (a, b) => a < b, makeBoolean],
  ['gt', (a, b) => a > b, makeBoolean],
];

for (const [name, op, ret, type] of intOperations) {
  if (!module.exports[name]) {
    const t = type || ValueType.INTEGER;
    // eslint-disable-next-line no-loop-func
    module.exports[name] = (a, b) => {
      if (op.length === 2) {
        assert(a.type === b.type && a.type === t,
          `can only ${name} ${typeNames[t]}s, got ${typeNames[a.type]} and `
          + `${typeNames[b.type]}`);
        return (ret || makeInteger)(op(a.value, b.value));
      }
      if (op.length === 1) {
        assert(a.type === t, `can only ${name} an ${typeNames[t]}`);
        return (ret || makeInteger)(op(a.value));
      }
      throw new Error(
        `Expected op function to have 1 or 2 args, got ${op.length}`,
      );
    };
  }

  if (op.length === 2 && !module.exports[`${name}1`]) {
    module.exports[`${name}1`] = (a) => {
      assert(a.type === ValueType.INTEGER, `can only ${name} 1 to an int`);
      return (ret || makeInteger)(op(a.value, 1));
    };
  }
}
