const path = require('path');
const fs = require('fs');

const { assert, num2bytes } = require('./utils');
const OpCodes = require('./opcode');
const Parser = require('./parser');
const { getIntrinsics, getIntrinsicFiles } = require('./intrinsics');

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
  constructor(bc, {
    compiler,
    scope,
    fn,
    loop,
    includedFiles,
  }) {
    this.bc = bc;
    this.compiler = compiler;
    this.scope = scope || compiler.initialScope;
    this.fn = fn || null;
    this.loop = loop || null;
    this.includedFiles = includedFiles || new Set();
  }

  withScope(scope) {
    return new Context(this.bc, { ...this, scope });
  }

  with(options) {
    return new Context(options.bc || this.bc, {
      ...this,
      ...options,
    });
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
    const bytes = num2bytes(location);
    this.bc.write(bytes[0]);
    this.bc.write(bytes[1]);
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
  constructor(compiler) {
    this.instructions = [];
    this.compilationQueue = new Set();
    this.compiler = compiler;
  }

  get position() {
    return this.instructions.length;
  }

  _validateByte(b) {
    assert(typeof b === 'number', 'instructions must be a number');
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

  queueCompilation(filename) {
    this.compilationQueue.add(filename);
  }

  compile(
    nodes,
    ctx = new Context(this, { compiler: this.compiler }),
    addHalt = true,
  ) {
    const uses = [];

    while (nodes[0] instanceof UseStatement
      || nodes[0] instanceof IncludeStatement) {
      uses.push(nodes.shift());
    }

    uses.forEach(u => u.compile(ctx));

    if (this.compilationQueue.size > 0) {
      const asts = [];
      while (this.compilationQueue.size > 0) {
        const file = this.compilationQueue.values().next().value;

        const ast = new Parser().feed(fs.readFileSync(file).toString()).result;
        for (const node of ast) {
          if (node instanceof UseStatement
            || node instanceof IncludeStatement) {
            asts.unshift(node);
          } else {
            asts.push(node);
          }
        }

        this.compilationQueue.delete(file);
      }
      this.compile(asts, ctx, false);
    }

    for (const node of nodes) {
      node.compile(ctx);
    }

    if (addHalt) {
      this.write(OpCodes.OP_HALT);
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
      case '%':
        binop(ctx, lhs, rhs, OpCodes.OP_MOD);
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
      case '!':
        op = OpCodes.OP_BOOLNOT;
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
  constructor(target, op, value) {
    this.target = target;
    this.op = op;
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

    if (this.op !== '=') {
      new IdentifierExpression(this.target).compile(ctx);
    }

    this.value.compile(ctx);

    switch (this.op) {
      case '+=':
        ops.unshift(OpCodes.OP_ADD);
        break;

      case '-=':
        ops.unshift(OpCodes.OP_SUB);
        break;

      case '*=':
        ops.unshift(OpCodes.OP_MUL);
        break;

      case '/=':
        ops.unshift(OpCodes.OP_DIV);
        break;

      case '%=':
        ops.unshift(OpCodes.OP_MOD);
        break;

      default:
        break;
    }

    ctx.write([...ops, ...num2bytes(scopeNum)]);
  }
}

class UseStatement {
  constructor(name) {
    this.name = name;
  }

  compile(ctx) {
    if (ctx.includedFiles.has(this.name)) {
      return;
    }
    ctx.includedFiles.add(this.name);

    const intrinsics = getIntrinsics();
    const intrinsicFiles = getIntrinsicFiles();
    if (intrinsics[this.name] !== undefined) {
      for (const [k, v] of Object.entries(intrinsics[this.name])) {
        ctx.compiler.addToEnvironment(k, v);
      }
    }
    if (intrinsicFiles[this.name] !== undefined) {
      ctx.bc.queueCompilation(intrinsicFiles[this.name]);
    }
  }
}

class IncludeStatement {
  constructor(filename) {
    this.filename = filename;
  }

  compile(ctx) {
    const normalized = path.normalize(this.filename);
    if (ctx.includedFiles.has(normalized)) {
      return;
    }

    ctx.bc.queueCompilation(normalized);

    ctx.includedFiles.add(normalized);
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
      ctx.bc.write(OpCodes.OP_POP);
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
  constructor(name, params, body, asExpression = false) {
    this.name = name;
    this.params = params;
    this.body = body;
    this.asExpression = asExpression;
  }

  compile(ctx) {
    const functionLabel = ctx.bc.newLabel();

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

    if (this.name !== null) {
      // don't declare the function in the outer scope if it's an expression
      (this.asExpression ? innerCtx : ctx).scope.declareVariable(this.name);
    }

    for (const param of this.params) {
      innerScope.declareParameter(param);
    }

    ctx.bc.write(OpCodes.OP_JMP);
    skip.address();
    functionLabel.label();
    for (const statement of this.body) {
      statement.compile(innerCtx);
    }

    const { instructions } = ctx.bc;
    if (instructions[instructions.length - 3] !== OpCodes.OP_RET) {
      new ReturnStatement(new IntegerLiteral(0)).compile(innerCtx);
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

class NullExpression {
  compile(ctx) {
    ctx.bc.write(OpCodes.OP_LOADNULL);
  }
}

class StringExpression {
  constructor(value) {
    this.value = value;
  }

  compile(ctx) {
    const index = ctx.compiler.internString(this.value);

    ctx.write([
      OpCodes.OP_NEWSTRING,
      ...num2bytes(index),
    ]);
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
  IncludeStatement,
  IntegerLiteral,
  NullExpression,
  ReturnStatement,
  StringExpression,
  UnaryExpression,
  UseStatement,
  VariableDeclaration,
  WhileStatement,
};
