const { Scope } = require('./ast');

class Compiler {
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
}

module.exports = Compiler;
