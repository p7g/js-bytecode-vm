const value = require('./value');

const { ValueType } = value;

function intrinsicPrint(v) {
  console.log(v.value); // eslint-disable-line no-console
  return value.makeNull();
}

function intrinsicBoundValues(fn) {
  console.log(fn.value.bindings); // eslint-disable-line no-console
  return value.makeNull();
}

function intrinsicToString(val) {
  const strval = value.toString(val);

  if (strval === null) {
    return value.makeNull();
  }

  return value.makeString(strval);
}

function intrinsicArrayNew(length) {
  if (length.type !== ValueType.INTEGER) {
    return value.makeNull();
  }

  return value.makeArray(length.value);
}

function intrinsicArrayGet(array, index) {
  if (array.type !== ValueType.ARRAY || index.type !== ValueType.INTEGER) {
    return value.makeNull();
  }

  return array.value[index.value];
}

function intrinsicArraySet(array, index, val) {
  if (array.type !== ValueType.ARRAY || index.type !== ValueType.INTEGER) {
    return value.makeNull();
  }

  array.value[index.value] = val;

  return val;
}

function intrinsicArrayLength(array) {
  if (array.type !== ValueType.ARRAY) {
    return value.makeInteger(-1);
  }

  return value.makeInteger(array.value.length);
}

const intrinsics = {
  print: intrinsicPrint,
  bound_values: intrinsicBoundValues,
  to_string: intrinsicToString,

  array_new: intrinsicArrayNew,
  array_get: intrinsicArrayGet,
  array_set: intrinsicArraySet,
  array_length: intrinsicArrayLength,
};

function getIntrinsics(compiler) {
  for (const [name, fn] of Object.entries(intrinsics)) {
    compiler.addToEnvironment(name, value.makeBuiltinFunction(fn));
  }
}

module.exports = {
  getIntrinsics,
};
