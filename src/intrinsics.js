const { Scope } = require('./ast');
const { makeBuiltinFunction } = require('./value');

function intrinsicPrint(value) {
  console.log(value.value); // eslint-disable-line no-console
  return 0;
}

function getIntrinsics() {
  const scope = new Scope();
  const environment = [];

  scope.declareVariable('print');
  environment.push(makeBuiltinFunction(intrinsicPrint));

  return [scope, environment];
}

module.exports = {
  getIntrinsics,
};
