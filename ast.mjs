import { OpCodes } from './vm.mjs';

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
    }
  }

  return new Uint8Array(accumulator);
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
  }

  nextIndex() {
    return this.index++;
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

  declare(name) {
    if (this.bindings.has(name)) {
      throw new Error(`ReferenceError: redeclaring identifier ${name}`);
    }
    this.bindings.set(name, this.nextIndex());
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

    return new Uint8Array(opcodes);
  }
}

function binop(scope, lhs, rhs, op) {
  return new Uint8Array([
    ...lhs.compile(scope),
    ...rhs.compile(scope),
    op,
  ]);
}

function binop1(scope, lhs, rhs, op1, op) {
  if (lhs instanceof IntegerLiteral && lhs.value === 1) {
    return new Uint8Array([...rhs.compile(scope), op1]);
  }
  if (rhs instanceof IntegerLiteral && rhs.value === 1) {
    return new Uint8Array([...lhs.compile(scope), op1]);
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
    }

    return new Uint8Array([
      ...this.expr.compile(scope),
      op,
    ]);
  }
}

export class HaltStatement {
  compile() {
    return new Uint8Array([OpCodes.OP_HALT]);
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

    return new Uint8Array([
      ...this.pred.compile(innerScope),
      OpCodes.OP_FJMP,
      otherwise.address,
      ...this.then.compile(innerScope),
      OpCodes.OP_JMP,
      end.address,
      otherwise.label,
      ...this.otherwise.compile(innerScope),
      end.label,
    ]);
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

    return new Uint8Array([
      top.label,
      ...this.pred.compile(scope),
      OpCodes.OP_FJMP,
      exit.address,
      ...this.body.compile(innerScope),
      top.address,
      exit.label,
    ]);
  }
}

export class Block {
  constructor(statements) {
    this.statements = statements;
  }

  compile(scope) {
    const innerScope = new Scope(scope);

    return new Uint8Array(this.statements.flatMap(s => s.compile(innerScope)));
  }
}
