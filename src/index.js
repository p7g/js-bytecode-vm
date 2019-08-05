const { promises: fs } = require('fs');

const { evaluate } = require('./vm');
const { parse } = require('./parser');
const { Bytecode } = require('./ast');
const { getIntrinsics } = require('./intrinsics');

async function main() {
  const filename = process.argv[2];

  if (!filename) {
    throw new Error('expected filename');
  }

  const contents = await fs.readFile(filename);
  const ast = parse(contents.toString());
  const intrinsics = getIntrinsics();
  const bytecode = new Bytecode(intrinsics).compile(ast);

  evaluate(intrinsics, bytecode);
}

main().catch(console.error); // eslint-disable-line no-console
