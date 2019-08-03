import OpCodes from './opcode';

export function compile(tree) {
  const bytecode = tree.compile(new Scope());
  const accumulator = [];
  const labels = {};
  const labelAddresses = {};

  for (const instruction of bytecode) {
    if (typeof instruction === 'symbol') {
      // if we have already tried to use the address of this label, go fill it
      // in now
      const address = accumulator.length - 1;
      labels[instruction] = address;

      if (labelAddresses[instruction] !== undefined) {
        for (const addr of labelAddresses[instruction]) {
          accumulator[addr] = address & 0xff00;
          accumulator[addr + 1] = address & 0xff;
        }
      }
    } else if (instruction instanceof Label) {
      // if label is in labels, emit address now, otherwise make room for it
      const target = labels[instruction.label];

      if (target !== undefined) {
        accumulator.push(target & 0xff00);
        accumulator.push(target & 0xff);
      } else {
        if (labelAddresses[instruction.label]) {
          labelAddresses[instruction.label].push(accumulator.length);
        } else {
          labelAddresses[instruction.label] = [accumulator.length];
        }
        accumulator.push();
        accumulator.push();
      }
    } else {
      accumulator.push(instruction);
    }
  }

  return accumulator;
}

class Label {
  constructor() {
    this.symbol = Symbol();
  }

  get address() {
    return this;
  }

  get label() {
    return this.symbol;
  }
}

class Scope {
  constructor(parent = null) {
    this.bindings = new Map();
    this.parent = parent;
    this.index = 0;
    this.paramIndex = 0;
  }

  nextIndex() {
    return this.index++;
  }

  nextParamIndex() {
    return this.paramIndex++;
  }

  get(name) {
    if (this.bindings.has(name)) {
      return this.bindings.get(name);
    }
    if (this.parent === null) {
      throw new Error(`ReferenceError: undefined name ${name}`);
    }
    return this.parent.get(name);
  }

  declareVariable(name) {
    if (this.bindings.has(name)) {
      throw new Error(`ReferenceError: redeclaring identifier ${name}`);
    }
    this.bindings.set(name, { type: 'variable', value: this.nextIndex() });
  }

  declareParameter(name) {
    if (this.bindings.has(name)) {
      throw new Error(`ReferenceError: redeclaring parameter ${name}`);
    }
    this.bindings.set(name, { type: 'parameter', value: this.nextParamIndex });
  }

  declareFunction(name) {
    if (this.bindings.has(name)) {
      throw new Error(`ReferenceError: redeclaring function ${name}`);
    }
    const label = new Label();
    this.bindings.set(name, { type: 'function', value: label.address });
    return label.label;
  }
}

export class IntegerLiteral {
  constructor(value) {
    this.value = value;
  }

  compile(_scope) {
    let opcodes;
    switch (this.value) {
      case 0:
        opcodes = [OpCodes.OP_CONST0];
        break;
      case 1:
        opcodes = [OpCodes.OP_CONST1];
        break;
      default:
        opcodes = [OpCodes.OP_CONST, this.value & 0xff00, this.value & 0xff];
        break;
    }

    return opcodes;
  }
}

function binop(scope, lhs, rhs, op) {
  return [
    ...lhs.compile(scope),
    ...rhs.compile(scope),
    op,
  ];
}

function binop1(scope, lhs, rhs, op1, op) {
  if (lhs instanceof IntegerLiteral && lhs.value === 1) {
    return [...rhs.compile(scope), op1];
  }
  if (rhs instanceof IntegerLiteral && rhs.value === 1) {
    return [...lhs.compile(scope), op1];
  }
  return binop(scope, lhs, rhs, op);
}

export class BinaryExpression {
  constructor(lhs, op, rhs) {
    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
  }

  compile(scope) {
    const { lhs, rhs } = this;
    switch (this.op) {
      case '+':
        return binop1(scope, lhs, rhs, OpCodes.OP_ADD1, OpCodes.OP_ADD);
      case '-':
        return binop1(scope, lhs, rhs, OpCodes.OP_SUB1, OpCodes.OP_SUB);
      case '*':
        return binop(scope, lhs, rhs, OpCodes.OP_MUL);
      case '/':
        return binop(scope, lhs, rhs, OpCodes.OP_DIV);
      case '&':
        return binop(scope, lhs, rhs, OpCodes.OP_AND);
      case '|':
        return binop(scope, lhs, rhs, OpCodes.OP_OR);
      case '<':
        return binop(scope, lhs, rhs, OpCodes.OP_LT);
      case '>':
        return binop(scope, lhs, rhs, OpCodes.OP_GT);
      case '==':
        return binop(scope, lhs, rhs, OpCodes.OP_EQ);
      case '!=':
        return binop(scope, lhs, rhs, OpCodes.OP_NE);
      default:
        throw new Error(`Unknown operator ${this.op}`);
    }
  }
}

export class UnaryExpression {
  constructor(op, expr) {
    this.op = op;
    this.expr = expr;
  }

  compile(scope) {
    let op;
    switch (this.op) {
      case '-':
        op = OpCodes.OP_NEG;
        break;
      case '~':
        op = OpCodes.OP_NOT;
        break;
      default:
        throw new Error(`Unrecognized unary operator ${this.op}`);
    }

    return [
      ...this.expr.compile(scope),
      op,
    ];
  }
}

export class HaltStatement {
  compile() {
    return [OpCodes.OP_HALT];
  }
}

export class IfStatement {
  constructor(pred, then, otherwise) {
    this.pred = pred;
    this.then = then;
    this.otherwise = otherwise;
  }

  compile(scope) {
    const otherwise = new Label();
    const end = new Label();

    const innerScope = new Scope(scope);

    return [
      ...this.pred.compile(innerScope),
      OpCodes.OP_FJMP,
      otherwise.address,
      ...this.then.compile(innerScope),
      OpCodes.OP_JMP,
      end.address,
      otherwise.label,
      ...this.otherwise.compile(innerScope),
      end.label,
    ];
  }
}

export class AssignmentExpression {
  constructor(target, value) {
    this.target = target;
    this.value = value;
  }

  compile(scope) {
    const { type, value } = scope.get(this.target);

    let ops;
    if (type === 'variable') {
      if (value === 0) {
        ops = [OpCodes.OP_SET0];
      } else if (value === 1) {
        ops = [OpCodes.OP_SET1];
      } else {
        ops = [OpCodes.OP_SET, value & 0xff00, value & 0xff];
      }
    } else if (type === 'parameter') {
      if (value === 0) {
        ops = [OpCodes.OP_SETARG0];
      } else if (value === 1) {
        ops = [OpCodes.OP_SETARG1];
      } else {
        ops = [OpCodes.OP_SETARG, value & 0xff00, value & 0xff];
      }
    } else {
      throw new Error(
        `TypeError: ${this.target} is not a valid assignment target`,
      );
    }

    return [
      ...this.value.compile(scope),
      ...ops,
    ];
  }
}

export class WhileStatement {
  constructor(pred, body) {
    this.pred = pred;
    this.body = body;
  }

  compile(scope) {
    const top = new Label();
    const exit = new Label();

    const innerScope = new Scope(scope);

    return [
      top.label,
      ...this.pred.compile(scope),
      OpCodes.OP_FJMP,
      exit.address,
      ...this.body.compile(innerScope),
      top.address,
      exit.label,
    ];
  }
}

export class Block {
  constructor(statements) {
    this.statements = statements;
  }

  compile(scope) {
    // const innerScope = new Scope(scope);
    let accumulator = [];

    for (const statement of this.statements) {
      accumulator = accumulator.concat(statement.compile(scope));
    }

    return accumulator;
  }
}

export class FunctionDeclaration {
  constructor(name, params, body) {
    this.name = name;
    this.params = params;
    this.body = body;
  }

  compile(scope) {
    const innerScope = new Scope(scope);
    const skip = new Label();

    for (const param of this.params) {
      innerScope.declareParameter(param);
    }

    const body = this.body.compile(innerScope);
    const functionLabel = scope.declareFunction(this.name);

    return [
      OpCodes.OP_JMP,
      skip.address,
      functionLabel.label,
      ...Array(innerScope.index).fill().map(() => OpCodes.OP_CONST0),
      ...body,
      skip.label,
    ];
  }
}

export class VariableDeclaration {
  constructor(name) {
    this.name = name;
  }

  compile(scope) {
    scope.declareVariable(this.name);
    return [];
  }
}

export class IdentifierExpression {
  constructor(name) {
    this.name = name;
  }

  compile(scope) {
    const { type, value } = scope.get(this.name);

    let ops;
    switch (type) {
      case 'variable':
        if (value === 0) {
          ops = [OpCodes.OP_LOAD0];
        } else if (value === 1) {
          ops = [OpCodes.OP_LOAD1];
        } else {
          ops = [OpCodes.OP_LOAD, value & 0xff00, value & 0xff];
        }
        break;

      case 'parameter':
        if (value === 0) {
          ops = [OpCodes.OP_LOADARG0];
        } else if (value === 1) {
          ops = [OpCodes.OP_LOADARG1];
        } else {
          ops = [OpCodes.OP_LOADARG, value & 0xff00, value & 0xff];
        }
        break;

      case 'function':
        throw new Error(`TypeError: can't load function ${this.name}`);

      default:
        throw new Error('unreachable');
    }

    return ops;
  }
}

export class CallExpression {
  constructor(name, args) {
    this.name = name;
    this.args = args;
  }

  compile(scope) {
    const { args } = this;
    args.reverse();

    const { type, value: fnLabel } = scope.get(this.name);
    if (type !== 'function') {
      throw new Error(`TypeError: cannot call ${this.name} as a function`);
    }

    return [
      ...args.flatMap(a => a.compile(scope)),
      OpCodes.OP_CALL,
      fnLabel.address,
    ];
  }
}

export class ReturnStatement {
  constructor(value) {
    this.value = value;
  }

  compile(scope) {
    return [
      ...this.value.compile(scope),
      OpCodes.OP_RET,
    ];
  }
}
