import OpCodes from './opcode.mjs';
import { instructionNames, disassemble } from './disassemble.mjs';
import * as AST from './ast.mjs';

const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

function evaluate(instructions) {
  const stack = [];
  let ip = 0;
  let bp = 0;
  let sp = 0;

  const push = (n) => { stack[sp++] = n; };

  function pop() {
    const value = stack[--sp];
    stack.pop();
    return value;
  }

  function read() {
    return instructions[ip++];
  }

  function read16() {
    const value = (read() << 8) + read();
    log(`	arg: ${value}`);
    return value;
  }

  // minus 3 to account for stored bp and ip
  function argOffset(n) {
    const value = bp - 3 - n;
    log(`	argOffset:${value}`);
    return value;
  }

  function localOffset(n) {
    const value = bp + n;
    log(`	localOffset:${value}`);
    return value;
  }

  const topOffset = () => sp - 1;

  let op;
  while (true) {
    op = read();
    log('\n' + JSON.stringify(stack) + '\n');
    log(`ip:${ip} sp:${sp} bp:${bp} ${instructionNames[op]}`);
    switch (op) {
      case OpCodes.OP_HALT:
        return pop();

      case OpCodes.OP_CONST:
        push(read16());
        break;

      case OpCodes.OP_CONST0:
        push(0);
        break;

      case OpCodes.OP_CONST1:
        push(1);
        break;

      case OpCodes.OP_LOAD:
        push(stack[localOffset(read16())]);
        break;

      case OpCodes.OP_LOAD0:
        push(stack[localOffset(0)]);
        break;

      case OpCodes.OP_LOAD1:
        push(stack[localOffset(1)]);
        break;

      case OpCodes.OP_LOADARG:
        push(stack[argOffset(read16())]);
        break;

      case OpCodes.OP_LOADARG0:
        push(stack[argOffset(0)]);
        break;

      case OpCodes.OP_LOADARG1:
        push(stack[argOffset(1)]);
        break;

      case OpCodes.OP_SET:
        stack[localOffset(read16())] = pop();
        break;

      case OpCodes.OP_SET0:
        stack[localOffset(0)] = pop();
        break;

      case OpCodes.OP_SET1:
        stack[localOffset(1)] = pop();
        break;

      case OpCodes.OP_SETARG:
        stack[argOffset(read16())] = pop();
        break;

      case OpCodes.OP_SETARG0:
        stack[argOffset(0)] = pop();
        break;

      case OpCodes.OP_SETARG1:
        stack[argOffset(1)] = pop();
        break;

      case OpCodes.OP_ADD: {
        const rhs = pop();
        const lhs = pop();
        push(lhs + rhs);
        break;
      }

      case OpCodes.OP_ADD1:
        stack[topOffset()] += 1;
        break;

      case OpCodes.OP_SUB: {
        const rhs = pop();
        const lhs = pop();
        push(lhs - rhs);
        break;
      }

      case OpCodes.OP_SUB1:
        stack[topOffset()] -= 1;
        break;

      case OpCodes.OP_MUL: {
        const rhs = pop();
        const lhs = pop();
        push(lhs * rhs);
        break;
      }

      case OpCodes.OP_DIV: {
        const rhs = pop();
        const lhs = pop();
        push(Math.floor(lhs / rhs));
        break;
      }

      case OpCodes.OP_NEG:
        stack[topOffset()] *= -1;
        break;

      case OpCodes.OP_AND: {
        const rhs = pop();
        const lhs = pop();
        push(lhs & rhs);
        break;
      }

      case OpCodes.OP_OR: {
        const rhs = pop();
        const lhs = pop();
        push(lhs | rhs);
        break;
      }

      case OpCodes.OP_NOT: {
        push(~pop());
        break;
      }

      case OpCodes.OP_EQ:
        push(+(pop() === pop()));
        break;

      case OpCodes.OP_NE:
        push(+(pop() !== pop()));
        break;

      case OpCodes.OP_LT: {
        const rhs = pop();
        const lhs = pop();
        push(+(lhs < rhs));
        break;
      }

      case OpCodes.OP_GT: {
        const rhs = pop();
        const lhs = pop();
        push(+(lhs > rhs));
        break;
      }

      case OpCodes.OP_JMP:
        ip = read16();
        break;

      case OpCodes.OP_TJMP: {
        const offset = read16();
        if (pop() !== 0) {
          ip = offset;
        } break;
      }

      case OpCodes.OP_FJMP: {
        const offset = read16();
        if (pop() === 0) {
          ip = offset;
        }
        break;
      }

      case OpCodes.OP_CALL: {
        const targetIp = read16();
        push(ip);
        push(bp);
        ip = targetIp;
        bp = sp;
        break;
      }

      case OpCodes.OP_RET: {
        const retval = pop();
        sp = bp;
        bp = pop();
        ip = pop();
        push(retval);
        break;
      }

      default:
        throw new Error(`Unknown opcode ${op}`);
    }
  }
}

/*

function fact(n, acc) {
  if n == 0 {
    return acc;
  }
  return fact(n - 1, acc * n);
}

fact(10, 1);

=== 

const 1
const n
call fact
halt
 
.fact 2
const 0
loadarg 0
eq
fjmp .fact_else
loadarg 1
ret
.fact_else
loadarg 0
loadarg 1
mul
loadarg 0
sub1
call fact
ret

*/

const factRecursive = n => new Uint8Array([
  // arguments for fact:
  // acc = 1
  OpCodes.OP_CONST1,
  // n = 3
  OpCodes.OP_CONST, 0, n,

  // call fact, then halt
  OpCodes.OP_CALL, 0, 8,
  OpCodes.OP_HALT,

  // fact/2
  OpCodes.OP_CONST0,
  // load arg 0 -> n
  OpCodes.OP_LOADARG0,

  // if arg0 !== 0, jump to else
  OpCodes.OP_EQ,
  OpCodes.OP_FJMP, 0, 16,

  // otherwise return acc
  OpCodes.OP_LOADARG1,
  OpCodes.OP_RET,

  // else
  // acc * n
  OpCodes.OP_LOADARG1,
  OpCodes.OP_LOADARG0,
  OpCodes.OP_MUL,
  // n - 1
  OpCodes.OP_LOADARG0,
  OpCodes.OP_SUB1,
  // recur
  OpCodes.OP_CALL, 0, 8,
  OpCodes.OP_RET,
]);

/*

function fact_iterative(n) {
  let acc = 1;
  while (n > 0) {
    acc *= n;
    n -= 1;
  }
  return acc;
}

===

const n
call fact_iterative
halt

.fact_iterative 1
const 1
.fact_iterative_while
const 0
loadarg 0
gt
fjmp .fact_iterative_after_while
loadarg 0
load 0
mul
set 0
loadarg 0
sub1
setarg 0
jmp .fact_iterative_while
load 0
ret

*/

const factIterative = n => new Uint8Array([
  // load n, call fact, then halt
  OpCodes.OP_CONST, 0, n,
  OpCodes.OP_CALL, 0, 7,
  OpCodes.OP_HALT,

  // fact_iterative/1
  // "declare" and define accumulator
  OpCodes.OP_CONST1,
  // while loop top (condition)
  OpCodes.OP_LOADARG0,
  OpCodes.OP_CONST0,
  OpCodes.OP_GT,
  // if n is not greater than 0, exit loop
  OpCodes.OP_FJMP, 0, 24,
  // otherwise, set acc to acc * n
  OpCodes.OP_LOADARG0,
  OpCodes.OP_LOAD0,
  OpCodes.OP_MUL,
  OpCodes.OP_SET0,
  // then decrement n
  OpCodes.OP_LOADARG0,
  OpCodes.OP_SUB1,
  OpCodes.OP_SETARG0,
  // jump back to top of loop
  OpCodes.OP_JMP, 0, 8,

  // return acc
  OpCodes.OP_LOAD0,
  OpCodes.OP_RET,
]);


const factIterativeAST = new AST.Bytecode().compile(
  new AST.Block([
    new AST.FunctionDeclaration('fact', ['n'], 1,
      new AST.Block([
        new AST.VariableDeclaration('acc'),
        new AST.AssignmentExpression('acc', new AST.IntegerLiteral(1)),
        new AST.WhileStatement(
          new AST.BinaryExpression(
            new AST.IdentifierExpression('n'),
            '>',
            new AST.IntegerLiteral(0),
          ),
          new AST.Block([
            new AST.AssignmentExpression(
              'acc',
              new AST.BinaryExpression(
                new AST.IdentifierExpression('acc'),
                '*',
                new AST.IdentifierExpression('n'),
              ),
            ),
            new AST.AssignmentExpression(
              'n',
              new AST.BinaryExpression(
                new AST.IdentifierExpression('n'),
                '-',
                new AST.IntegerLiteral(1),
              ),
            ),
          ]),
        ),
        new AST.ReturnStatement(new AST.IdentifierExpression('acc')),
      ]),
    ),
    new AST.CallExpression('fact', [new AST.IntegerLiteral(3)]),
    new AST.HaltStatement(),
  ]),
);


/*

function fact(n, acc) {
  if n == 0 {
    return acc;
  }
  return fact(n - 1, acc * n);
}

fact(10, 1);

*/

const factRecursiveAST = new AST.Bytecode().compile(
  new AST.Block([
    new AST.FunctionDeclaration('fact', ['n', 'acc'], 0, new AST.Block([
      new AST.IfStatement(
        new AST.BinaryExpression(
          new AST.IdentifierExpression('n'),
          '==',
          new AST.IntegerLiteral(0),
        ),
        new AST.ReturnStatement(new AST.IdentifierExpression('acc')),
        new AST.ReturnStatement(new AST.CallExpression('fact', [
          new AST.BinaryExpression(
            new AST.IdentifierExpression('n'),
            '-',
            new AST.IntegerLiteral(1),
          ),
          new AST.BinaryExpression(
            new AST.IdentifierExpression('acc'),
            '*',
            new AST.IdentifierExpression('n'),
          ),
        ])),
      ),
    ])),

    new AST.CallExpression('fact', [
      new AST.IntegerLiteral(3),
      new AST.IntegerLiteral(1),
    ]),
  ]),
);


for (const bc of [factIterativeAST, factRecursiveAST]) {
  console.log(bc);
  console.log(disassemble(bc) || ' ');
  console.log('result', evaluate(bc));
}
