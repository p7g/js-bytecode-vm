const Compiler = require('./compiler');

async function main() {
  const filename = process.argv[2];

  if (!filename) {
    throw new Error('expected filename');
  }

  await Compiler.evalFile(filename);
}

main().catch(console.error); // eslint-disable-line no-console
