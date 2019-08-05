const fs = require('fs');

const { disassemble } = require('./disassemble');
const { evaluate } = require('./vm');
const Parser = require('./parser');
const { Bytecode } = require('./ast');
const { getIntrinsics } = require('./intrinsics');

async function main() {
  const filename = process.argv[2];

  if (!filename) {
    throw new Error('expected filename');
  }

  const parser = new Parser();
  const readStream = fs.createReadStream(filename);

  for await (const data of readStream) {
    parser.feed(data.toString());
  }

  const ast = parser.result;

  const intrinsics = getIntrinsics();
  const bytecode = new Bytecode(intrinsics).compile(ast);

  disassemble(bytecode);

  evaluate(intrinsics, bytecode);
}

main().catch(console.error); // eslint-disable-line no-console
