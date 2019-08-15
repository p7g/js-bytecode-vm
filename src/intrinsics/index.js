const path = require('path');

const value = require('../value');
const array = require('./array');
const debug = require('./debug');

function getIntrinsics() {
  return {
    array: array.getModule(),
    debug: debug.getModule(),
  };
}

function getIntrinsicFiles() {
  const lib = path.join(__dirname, '..', 'lib');
  return {
    error: path.join(lib, 'error.jsbcvm'),
    array: path.join(lib, 'array.jsbcvm'),
  };
}

function intrinsicPrint(v) {
  console.log(v.value); // eslint-disable-line no-console
  return value.makeNull();
}

function intrinsicToString(val) {
  const strval = value.toString(val);

  if (strval === null) {
    return value.makeNull();
  }

  return value.makeString(strval);
}

function getGlobals() {
  return {
    print: value.makeBuiltinFunction(intrinsicPrint),
    to_string: value.makeBuiltinFunction(intrinsicToString),
  };
}

module.exports = {
  getIntrinsics,
  getIntrinsicFiles,
  getGlobals,
};
