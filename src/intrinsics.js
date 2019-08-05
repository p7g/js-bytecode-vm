const { Scope } = require('./ast');

function intrinsicPrint(value) {
  console.log(value); // eslint-disable-line no-console
}

function getIntrinsics() {
  const scope = new Scope();

  scope.declareBuiltin('print', intrinsicPrint);

  return scope;
}

module.exports = {
  getIntrinsics,
};
