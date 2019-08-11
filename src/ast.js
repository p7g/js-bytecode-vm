const { assert, num2bytes } = require('./utils');
const OpCodes = require('./opcode');

class Scope {
  constructor(parent = null) {
    this.bindings = new Map();
    this.parent = parent;
    this.index = 0;
    this.paramIndex = 0;
    this.boundIndex = 0;
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

  declare(type, name, index) {
    if (this.bindings.has(name)) {
      throw new Error(`ReferenceError: redeclaring identifier ${name}`);
    }
    this.bindings.set(name, { type, value: index });
  }

  declareVariable(name) {
    this.declare('variable', name, this.index++);
  }

  declareParameter(name) {
    this.declare('parameter', name, this.paramIndex++);
  }

  declareBoundVariable(name) {
    this.declare('bound', name, this.boundIndex++);
  }
}

class Context {
  constructor(bc, scope, fn = null, loop = null) {
    this.bc = bc;
    this.scope = scope;
    this.fn = fn;
    this.loop = loop;
  }

  withScope(scope) {
    return new Context(this.bc, scope);
  }

  withNewScope() {
    return this.withScope(new Scope(this.scope));
  }

  with({
    bc,
    scope,
    fn,
    loop,
  }) {
    return new Context(
      bc || this.bc,
      scope || this.scope,
      fn || this.fn,
      loop || this.loop,
    );
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
    this.labelLocation = null;
    this.addressLocations = [];
  }

  address() {
    let location;
    if (this.labelLocation !== null) {
      location = this.labelLocation;
    } else {
      this.addressLocations.push(this.bc.position);
      location = 0;
    }
    this.bc.write(location & 0xff00);
    this.bc.write(location & 0xff);
  }

  label() {
    this.labelLocation = this.bc.position;
    for (const addr of this.addressLocations) {
      const [ba, bb] = num2bytes(this.labelLocation);
      this.bc.update(addr, ba);
      this.bc.update(addr + 1, bb);
    }
  }
}

class Bytecode {
  constructor(initialScope = new Scope()) {
    this.instructions = [];
    this.initialScope = initialScope;
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
    const ctx = new Context(this, this.initialScope);

    for (const node of nodes) {
      node.compile(ctx);
    }

    this.write(OpCodes.OP_HALT);

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
        opcodes = [OpCodes.OP_CONST, ...num2bytes(this.value)];
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
    ctx.bc.write(op);
  }
}

class IfStatement {
  constructor(pred, then, otherwise = null) {
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
    if (this.otherwise !== null) {
      this.otherwise.compile(ctx);
    }
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

    const innerCtx = ctx.with({
      loop: {
        continueTo: top,
        breakTo: exit,
      },
    });

    top.label();
    this.pred.compile(innerCtx);
    ctx.bc.write(OpCodes.OP_FJMP);
    exit.address();
    this.body.compile(innerCtx);
    ctx.bc.write(OpCodes.OP_JMP);
    top.address();
    exit.label();
  }
}

class ContinueStatement {
  compile(ctx) {
    assert(ctx.loop !== null, 'Cannot continue outside of loop');

    const { continueTo } = ctx.loop;

    ctx.bc.write(OpCodes.OP_JMP);
    continueTo.address();
  }
}

class ForStatement {
  constructor(init, test, incr, body) {
    this.init = init;
    this.test = test;
    this.incr = incr;
    this.body = body;
  }

  compile(ctx) {
    const top = ctx.bc.newLabel();
    const incr = ctx.bc.newLabel();
    const exit = ctx.bc.newLabel();

    const innerCtx = ctx.with({
      loop: {
        continueTo: incr,
        breakTo: exit,
      },
    });

    if (this.init !== null) {
      this.init.compile(ctx);
    }
    top.label();
    if (this.test !== null) {
      this.test.compile(ctx);
      ctx.bc.write(OpCodes.OP_FJMP);
      exit.address();
    }
    this.body.compile(innerCtx);
    incr.label();
    if (this.incr !== null) {
      this.incr.compile(ctx);
    }
    ctx.bc.write(OpCodes.OP_JMP);
    top.address();
    exit.label();
  }
}

class BreakStatement {
  compile(ctx) {
    assert(ctx.loop !== null, 'Cannot break outside of loop');

    const { breakTo } = ctx.loop;

    ctx.bc.write(OpCodes.OP_JMP);
    breakTo.address();
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
    ctx.scope.declareVariable(this.name);
    ctx.bc.write(OpCodes.OP_NEWFUNCTION);
    functionLabel.address();

    const innerCtx = ctx.with({
      scope: new Scope(ctx.scope),
      fn: {
        arity: this.params.length,
        bindings: [],
      },
    });
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

    for (const variable of innerCtx.fn.bindings) {
      IdentifierExpression.compileAccess(ctx, {
        ...variable,
        scopeNum: variable.scopeNum - 1,
      });
      ctx.write([
        OpCodes.OP_BINDVAR,
      ]);
    }
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
    const variable = ctx.scope.get(this.name);

    if (ctx.fn !== null && variable.scopeNum > 0) {
      ctx.scope.declareBoundVariable(this.name);
      const index = ctx.fn.bindings.push(variable) - 1;
      ctx.write([
        OpCodes.OP_ENCFUNCTION,
        ...num2bytes(0),
        OpCodes.OP_LOADBOUND,
        ...num2bytes(index),
      ]);
      return;
    }

    IdentifierExpression.compileAccess(ctx, variable);
  }

  static compileAccess(ctx, { type, value, scopeNum }) {
    switch (type) {
      case 'variable': {
        let ops;
        if (value === 0) {
          ops = [OpCodes.OP_LOAD0];
        } else if (value === 1) {
          ops = [OpCodes.OP_LOAD1];
        } else {
          ops = [OpCodes.OP_LOAD, ...num2bytes(value)];
        }
        ctx.write([...ops, ...num2bytes(scopeNum)]);
        break;
      }

      case 'parameter': {
        let ops;
        if (value === 0) {
          ops = [OpCodes.OP_LOADARG0];
        } else if (value === 1) {
          ops = [OpCodes.OP_LOADARG1];
        } else {
          ops = [OpCodes.OP_LOADARG, ...num2bytes(value)];
        }
        ctx.write([...ops, ...num2bytes(scopeNum)]);
        break;
      }

      case 'bound':
        ctx.write([
          OpCodes.OP_ENCFUNCTION,
          ...num2bytes(scopeNum),
          OpCodes.OP_LOADBOUND,
          ...num2bytes(value),
        ]);
        break;

      default:
        throw new Error('unreachable');
    }
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

class BooleanExpression {
  constructor(value) {
    this.value = value;
  }

  compile(ctx) {
    if (this.value) {
      ctx.bc.write(OpCodes.OP_CONSTTRUE);
    } else {
      ctx.bc.write(OpCodes.OP_CONSTFALSE);
    }
  }
}

class CallExpression {
  constructor(expr, args) {
    this.expr = expr;
    this.args = args;
  }

  compile(ctx) {
    const { args, expr } = this;
    args.reverse();
    args.forEach(a => a.compile(ctx));
    expr.compile(ctx);
    ctx.bc.write(OpCodes.OP_CALL);
  }
}

class ReturnStatement {
  constructor(value) {
    this.value = value;
  }

  compile(ctx) {
    this.value.compile(ctx);
    ctx.write([OpCodes.OP_RET, ...num2bytes(ctx.fn.arity)]);
  }
}

module.exports = {
  Bytecode,
  Scope,

  AssignmentExpression,
  BinaryExpression,
  Block,
  BooleanExpression,
  BreakStatement,
  CallExpression,
  ContinueStatement,
  ExpressionStatement,
  ForStatement,
  FunctionDeclaration,
  IdentifierExpression,
  IfStatement,
  IntegerLiteral,
  ReturnStatement,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
};
