const { Scope } = require('./ast');
const { makeBuiltinFunction, makeInteger } = require('./value');

function intrinsicPrint(value) {
  console.log(value.value); // eslint-disable-line no-console
  return makeInteger(0);
}

function instrinsicBoundValues(fn) {
  console.log(fn.value.bindings); // eslint-disable-line no-console
  return makeInteger(0);
}

function getIntrinsics() {
  const scope = new Scope();
  const environment = [];

  scope.declareVariable('print');
  environment.push(makeBuiltinFunction(intrinsicPrint));

  scope.declareVariable('boundValues');
  environment.push(makeBuiltinFunction(instrinsicBoundValues));

  return [scope, environment];
}

module.exports = {
  getIntrinsics,
};
