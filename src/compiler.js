const fs = require('fs');

const { Scope } = require('./ast');
const { getIntrinsics } = require('./intrinsics');
const { DEBUG } = require('./config');
const { Parser } = require('./parser');
const { evaluate } = require('./vm');
const { disassemble } = require('./disassemble');
const { Bytecode } = require('./ast');

class Compiler {
  static withIntrinsics() {
    const compiler = new Compiler();
    getIntrinsics(compiler);
    return compiler;
  }

  constructor() {
    this.environment = [];
    this.stringTable = [];
    this.initialScope = new Scope();
  }

  internString(str) {
    return this.stringTable.push(str) - 1;
  }

  addToEnvironment(name, value) {
    this.initialScope.declareVariable(name);
    this.environment.push(value);
  }

  static async evalFile(filename, compiler = Compiler.withIntrinsics()) {
    const parser = new Parser();
    const readStream = fs.createReadStream(filename);

    for await (const data of readStream) {
      parser.feed(data.toString());
    }

    const ast = parser.result;

    if (DEBUG) {
      console.dir(ast, { depth: 100 }); // eslint-disable-line no-console
    }

    const bytecode = new Bytecode(compiler).compile(ast);

    if (DEBUG) {
      disassemble(bytecode);
    }

    evaluate(compiler, bytecode);

    return compiler;
  }
}

module.exports = Compiler;
