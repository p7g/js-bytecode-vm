const nearley = require('nearley');
const grammar = require('../include/grammar');
const { assert } = require('./utils');

class Parser extends nearley.Parser {
  constructor() {
    super(nearley.Grammar.fromCompiled(grammar));
  }

  get result() {
    const { results } = this;
    if (results.length > 1) {
      /* eslint-disable no-console */
      console.error('Got >1 parses');
      console.dir(results, { depth: 100 });
      /* eslint-enable no-console */
    }

    return results[0];
  }
}

module.exports = Parser;
