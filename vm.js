let inst = 0;
const OpCodes = {
  OP_HALT: inst++,
  OP_CONST: inst++,
  OP_LOAD: inst++,
  OP_LOADARG: inst++,
  OP_SET: inst++,
  OP_SETARG: inst++,
  OP_ADD: inst++,
  OP_ADD1: inst++,
  OP_SUB: inst++,
  OP_SUB1: inst++,
  OP_MUL: inst++,
  OP_DIV: inst++,
  OP_NEG: inst++,
  OP_AND: inst++,
  OP_OR: inst++,
  OP_NOT: inst++,
  OP_EQ: inst++,
  OP_NE: inst++,
  OP_LT: inst++,
  OP_GT: inst++,
  OP_JMP: inst++,
  OP_TJMP: inst++,
  OP_FJMP: inst++,
  OP_CALL: inst++,
  OP_RET: inst++,
};

const instructionNames = [];
Object.entries(OpCodes).forEach(([k, v]) => (instructionNames[v] = k));

function log(...args) {
  if (false) {
    console.log(...args);
  }
}

function evaluate(instructions) {
  const stack = [];
  let ip = 0;
  let bp = 0;
  let sp = 0;

  const push = n => (stack[sp++] = n);
  const pop = () => stack[--sp];

  function read() {
    return instructions[ip++];
  }

  function read16() {
    const value = (read() << 8) + read();
    log(`	arg: ${value}`);
    return value;
  }

  // minus 2 to account for stored bp and ip
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
    log('\n' + JSON.stringify(stack.slice(0, sp)) + '\n');
    log(`ip:${ip} sp:${sp} bp:${bp} ${instructionNames[op]}`);
    switch (op) {
      case OpCodes.OP_HALT:
        return pop();

      case OpCodes.OP_CONST:
        push(read16());
        break;

      case OpCodes.OP_LOAD:
        push(stack[bp + read16()]);
        break;

      case OpCodes.OP_LOADARG:
        push(stack[argOffset(read16())]);
        break;

      case OpCodes.OP_SET:
        stack[localOffset(read16())] = pop();
        break;

      case OpCodes.OP_SETARG:
        stack[argOffset(read16())] = pop();
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
  OpCodes.OP_CONST, 0, 1,
  // n = 3
  OpCodes.OP_CONST, 0, n,

  // call fact, then halt
  OpCodes.OP_CALL, 0, 10,
  OpCodes.OP_HALT,

  // fact/2
  OpCodes.OP_CONST, 0, 0,
  // load arg 0 -> n
  OpCodes.OP_LOADARG, 0, 0,

  // if arg0 !== 0, jump to else
  OpCodes.OP_EQ,
  OpCodes.OP_FJMP, 0, 24,

  // otherwise return acc
  OpCodes.OP_LOADARG, 0, 1,
  OpCodes.OP_RET,

  // else
  // acc * n
  OpCodes.OP_LOADARG, 0, 1,
  OpCodes.OP_LOADARG, 0, 0,
  OpCodes.OP_MUL,
  // n - 1
  OpCodes.OP_LOADARG, 0, 0,
  OpCodes.OP_SUB1,
  // recur
  OpCodes.OP_CALL, 0, 10,
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
  OpCodes.OP_CONST, 0, 1,
  // while loop top (condition)
  OpCodes.OP_LOADARG, 0, 0,
  OpCodes.OP_CONST, 0, 0,
  OpCodes.OP_GT,
  // if n is not greater than 0, exit loop
  OpCodes.OP_FJMP, 0, 40,
  // otherwise, set acc to acc * n
  OpCodes.OP_LOADARG, 0, 0,
  OpCodes.OP_LOAD, 0, 0,
  OpCodes.OP_MUL,
  OpCodes.OP_SET, 0, 0,
  // then decrement n
  OpCodes.OP_LOADARG, 0, 0,
  OpCodes.OP_SUB1,
  OpCodes.OP_SETARG, 0, 0,
  // jump back to top of loop
  OpCodes.OP_JMP, 0, 10,

  // return acc
  OpCodes.OP_LOAD, 0, 0,
  OpCodes.OP_RET,
]);

debugger;
console.log(evaluate(factRecursive(10)));
console.log(evaluate(factIterative(10)));
