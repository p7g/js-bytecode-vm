import nearley from 'nearley';
import grammar from '../include/grammar.js';

const test = `
fact(n) {
  let acc = 1;
  while (n > 0) {
    acc = acc * n;
    n = n - 1;
  }
  return acc;
}
`;

const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));

parser.feed(test);

console.log(parser.results); // eslint-disable-line no-console
