const { promises: fs } = require('fs');

const { evaluate } = require('./vm');
const { parse } = require('./parser');
const { Bytecode } = require('./ast');

async function main() {
  const filename = process.argv[2];

  if (!filename) {
    throw new Error('expected filename');
  }

  const contents = await fs.readFile(filename);
  const ast = parse(contents.toString());
  const bytecode = new Bytecode().compile(ast);

  console.log(evaluate(bytecode));
}

main().catch(console.error); // eslint-disable-line no-console
