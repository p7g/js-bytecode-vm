const { assert, num2bytes } = require('./utils');
const OpCodes = require('./opcode');

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

  get(name, num = 0) {
    if (this.bindings.has(name)) {
      return { ...this.bindings.get(name), scopeNum: num };
    }
    if (this.parent === null) {
      throw new Error(`ReferenceError: undefined name ${name}`);
    }
    return this.parent.get(name, num + 1);
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
    this.bindings.set(name, {
      type: 'parameter',
      value: this.nextParamIndex(),
    });
  }

  declareFunction(name, label) {
    if (this.bindings.has(name)) {
      throw new Error(`ReferenceError: redeclaring function ${name}`);
    }
    this.bindings.set(name, { type: 'function', value: label });
    return label;
  }
}

class Context {
  constructor(bc, scope) {
    this.bc = bc;
    this.scope = scope;
  }

  withScope(scope) {
    return new Context(this.bc, scope);
  }

  withNewScope() {
    return this.withScope(new Scope(this.scope));
  }

  write(instructions) {
    for (const instruction of instructions) {
      this.bc.write(instruction);
    }
  }
}

class Label {
  constructor(bc) {
    this.bc = bc;
    this.label_location = null;
    this.address_locations = [];
  }

  address() {
    let location;
    if (this.label_location !== null) {
      location = this.label_location;
    } else {
      this.address_locations.push(this.bc.position);
      location = 0;
    }
    this.bc.write(location & 0xff00);
    this.bc.write(location & 0xff);
  }

  label() {
    this.label_location = this.bc.position;
    for (const addr of this.address_locations) {
      this.bc.update(addr, this.label_location & 0xff00);
      this.bc.update(addr + 1, this.label_location & 0xff);
    }
  }
}

class Bytecode {
  constructor() {
    this.instructions = [];
  }

  get position() {
    return this.instructions.length;
  }

  _validateByte(b) {
    assert((b & 0xff) === b, 'instructions must be one byte');
  }

  write(byte) {
    this._validateByte(byte);
    this.instructions.push(byte);
  }

  update(i, v) {
    this._validateByte(v);
    assert(i < this.position, "can't update instructions that don't exist yet");
    this.instructions[i] = v;
  }

  newLabel() {
    return new Label(this);
  }

  compile(nodes) {
    const ctx = new Context(this, new Scope());

    for (const node of nodes) {
      node.compile(ctx);
    }

    return this.instructions;
  }
}

class IntegerLiteral {
  constructor(value) {
    this.value = value;
  }

  compile(ctx) {
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

    ctx.write(opcodes);
  }
}

function binop(ctx, lhs, rhs, op) {
  lhs.compile(ctx);
  rhs.compile(ctx);
  ctx.bc.write(op);
}

function binop1(ctx, lhs, rhs, op1, op) {
  if (lhs instanceof IntegerLiteral && lhs.value === 1) {
    rhs.compile(ctx);
    ctx.bc.write(op1);
  } else if (rhs instanceof IntegerLiteral && rhs.value === 1) {
    lhs.compile(ctx);
    ctx.bc.write(op1);
  } else {
    binop(ctx, lhs, rhs, op);
  }
}

class BinaryExpression {
  constructor(lhs, op, rhs) {
    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
  }

  compile(ctx) {
    const { lhs, rhs } = this;

    switch (this.op) {
      case '+':
        binop1(ctx, lhs, rhs, OpCodes.OP_ADD1, OpCodes.OP_ADD);
        break;
      case '-':
        binop1(ctx, lhs, rhs, OpCodes.OP_SUB1, OpCodes.OP_SUB);
        break;
      case '*':
        binop(ctx, lhs, rhs, OpCodes.OP_MUL);
        break;
      case '/':
        binop(ctx, lhs, rhs, OpCodes.OP_DIV);
        break;
      case '&':
        binop(ctx, lhs, rhs, OpCodes.OP_AND);
        break;
      case '|':
        binop(ctx, lhs, rhs, OpCodes.OP_OR);
        break;
      case '<':
        binop(ctx, lhs, rhs, OpCodes.OP_LT);
        break;
      case '>':
        binop(ctx, lhs, rhs, OpCodes.OP_GT);
        break;
      case '==':
        binop(ctx, lhs, rhs, OpCodes.OP_EQ);
        break;
      case '!=':
        binop(ctx, lhs, rhs, OpCodes.OP_NE);
        break;
      default:
        throw new Error(`Unknown operator ${this.op}`);
    }
  }
}

class UnaryExpression {
  constructor(op, expr) {
    this.op = op;
    this.expr = expr;
  }

  compile(ctx) {
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

    this.expr.compile(ctx);
    this.bc.write(op);
  }
}

class IfStatement {
  constructor(pred, then, otherwise) {
    this.pred = pred;
    this.then = then;
    this.otherwise = otherwise;
  }

  compile(ctx) {
    const otherwise = ctx.bc.newLabel();
    const end = ctx.bc.newLabel();

    this.pred.compile(ctx);
    ctx.bc.write(OpCodes.OP_FJMP);
    otherwise.address();
    this.then.compile(ctx);
    ctx.bc.write(OpCodes.OP_JMP);
    end.address();
    otherwise.label();
    this.otherwise.compile(ctx);
    end.label();
  }
}

class AssignmentExpression {
  constructor(target, value) {
    this.target = target;
    this.value = value;
  }

  compile(ctx) {
    const { type, value, scopeNum } = ctx.scope.get(this.target);

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

    this.value.compile(ctx);
    ctx.write([...ops, ...num2bytes(scopeNum)]);
  }
}

class WhileStatement {
  constructor(pred, body) {
    this.pred = pred;
    this.body = body;
  }

  compile(ctx) {
    const top = ctx.bc.newLabel();
    const exit = ctx.bc.newLabel();

    top.label();
    this.pred.compile(ctx);
    ctx.bc.write(OpCodes.OP_FJMP);
    exit.address();
    this.body.compile(ctx);
    ctx.bc.write(OpCodes.OP_JMP);
    top.address();
    exit.label();
  }
}

class Block {
  constructor(statements) {
    this.statements = statements;
  }

  compile(ctx) {
    // const innerScope = new Scope(scope);
    this.statements.forEach(s => s.compile(ctx));
  }
}

class FunctionDeclaration {
  constructor(name, params, body) {
    this.name = name;
    this.params = params;
    this.body = body;
  }

  compile(ctx) {
    const functionLabel = ctx.bc.newLabel();
    ctx.scope.declareFunction(this.name, functionLabel);
    const innerCtx = ctx.withNewScope();
    const innerScope = innerCtx.scope;
    const skip = ctx.bc.newLabel();

    for (const param of this.params) {
      innerScope.declareParameter(param);
    }

    ctx.bc.write(OpCodes.OP_JMP);
    skip.address();
    functionLabel.label();
    for (const statement of this.body) {
      statement.compile(innerCtx);
    }
    skip.label();
  }
}

class VariableDeclaration {
  constructor(name, value = null) {
    this.name = name;
    this.value = value;
  }

  compile(ctx) {
    ctx.scope.declareVariable(this.name);
    if (this.value !== null) {
      this.value.compile(ctx);
    } else {
      new IntegerLiteral(0).compile(ctx);
    }
  }
}

class IdentifierExpression {
  constructor(name) {
    this.name = name;
  }

  compile(ctx) {
    const { type, value, scopeNum } = ctx.scope.get(this.name);

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

    ctx.write([...ops, ...num2bytes(scopeNum)]);
  }
}

class ExpressionStatement {
  constructor(expr) {
    this.expr = expr;
  }

  compile(ctx) {
    this.expr.compile(ctx);
    ctx.bc.write(OpCodes.OP_POP);
  }
}

class CallExpression {
  constructor(name, args) {
    this.name = name;
    this.args = args;
  }

  compile(ctx) {
    const { args } = this;
    args.reverse();

    const { type, value: fnLabel } = ctx.scope.get(this.name);
    if (type !== 'function') {
      throw new Error(`TypeError: cannot call ${this.name} as a function`);
    }

    args.forEach(a => a.compile(ctx));
    ctx.bc.write(OpCodes.OP_CALL);
    fnLabel.address();
  }
}

class ReturnStatement {
  constructor(value) {
    this.value = value;
  }

  compile(ctx) {
    this.value.compile(ctx);
    ctx.bc.write(OpCodes.OP_RET);
  }
}

module.exports = {
  Bytecode,

  AssignmentExpression,
  BinaryExpression,
  Block,
  CallExpression,
  ExpressionStatement,
  FunctionDeclaration,
  IdentifierExpression,
  IfStatement,
  IntegerLiteral,
  ReturnStatement,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
};
