const nearley = require('nearley');
const grammar = require('../include/grammar');
const { assert } = require('./utils');

function parse(input) {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));

  parser.feed(input);

  const { results } = parser;
  assert(
    results.length <= 1,
    `Got >1 parses: ${JSON.stringify(parser.results)}\
    in input:\n${input}`,
  );

  return results[0];
}

module.exports = { parse };
