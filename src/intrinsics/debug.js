const value = require('../value');

function intrinsicBoundValues(fn) {
  console.log(fn.value.bindings); // eslint-disable-line no-console
  return value.makeNull();
}

function getModule() {
  return Object.entries({
    bound_values: intrinsicBoundValues,
  }).reduce((acc, [k, v]) => {
    acc[k] = value.makeBuiltinFunction(v);
    return acc;
  }, {});
}

module.exports = {
  getModule,
};
