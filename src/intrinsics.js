const { Scope } = require('./ast');

function intrinsicPrint(value) {
  console.log(value); // eslint-disable-line no-console
  return 0;
}

function getIntrinsics() {
  const scope = new Scope();

  scope.declareBuiltin('print', intrinsicPrint);

  return scope;
}

module.exports = {
  getIntrinsics,
};
