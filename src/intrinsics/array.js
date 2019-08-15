const value = require('../value');

const { ValueType } = value;

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

function getModule() {
  return Object.entries({
    array_new: intrinsicArrayNew,
    array_get: intrinsicArrayGet,
    array_set: intrinsicArraySet,
    array_length: intrinsicArrayLength,
  }).reduce((acc, [k, v]) => {
    acc[k] = value.makeBuiltinFunction(v);
    return acc;
  }, {});
}

module.exports = {
  getModule,
};
