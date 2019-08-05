const nearley = require('nearley');
const grammar = require('../include/grammar');
const { assert } = require('./utils');

class Parser extends nearley.Parser {
  constructor() {
    super(nearley.Grammar.fromCompiled(grammar));
  }

  get result() {
    const { results } = this;
    assert(
      results.length <= 1,
      `Got >1 parses: ${JSON.stringify(results)}`,
    );

    return results[0];
  }
}

module.exports = Parser;
