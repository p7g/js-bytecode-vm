const fs = require('fs');

const { disassemble } = require('./disassemble');
const { evaluate } = require('./vm');
const Parser = require('./parser');
const { Bytecode } = require('./ast');
const { getIntrinsics } = require('./intrinsics');
const { DEBUG } = require('./config');

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

  const [initialScope, env] = getIntrinsics();
  const bytecode = new Bytecode(initialScope).compile(ast);

  if (DEBUG) {
    disassemble(bytecode);
  }

  evaluate(env, bytecode);
}

main().catch(console.error); // eslint-disable-line no-console
