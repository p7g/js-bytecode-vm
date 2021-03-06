const nearley = require('nearley');

class Parser extends nearley.Parser {
  constructor() {
    // eslint-disable-next-line global-require
    super(nearley.Grammar.fromCompiled(require('../include/grammar')));
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
