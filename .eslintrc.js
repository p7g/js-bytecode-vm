module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "no-plusplus": 0,
    "no-bitwise": 0,
    "no-underscore-dangle": 0,
    "class-methods-use-this": 0,
    "no-restricted-syntax": 0,
    "no-tabs": 0,
    "no-param-reassign": 0,
    "no-self-compare": 0,
    "no-unused-vars": 1,
    "no-use-before-define": 0,
  },
};
