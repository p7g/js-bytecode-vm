const OpCodes = require('./opcode');
const { ValueType } = require('./value');

const instructionNames = [];
Object.entries(OpCodes).forEach(([k, v]) => { instructionNames[v] = k; });

function printStack(stack) {
  let buf = '[';
  for (let i = 0; i < stack.length; i += 1) {
    if (i !== 0) {
      buf += ', ';
    }

    const item = stack[i];
    if (typeof item === 'object') {
      const { type, value } = item;

      switch (type) {
        case ValueType.FUNCTION:
          buf += `fn@${value.address}`;
          break;

        case ValueType.BUILTIN_FUNCTION:
          buf += `fn ${value.name}`;
          break;

        default:
          buf += value;
          break;
      }
    } else {
      buf += `&${item}`;
    }
  }

  buf += ']';

  return buf;
}

function disassemble(bytecode_) {
  const bytecode = [...bytecode_];

  let i = -1;
  function shift() {
    i += 1;
    return bytecode.shift();
  }

  function read16() {
    return ((shift() << 8) + shift()).toString(10);
  }

  while (bytecode.length) {
    const instruction = shift();
    let buf = `${i}: ${instructionNames[instruction]}`;

    switch (instruction) {
      case OpCodes.OP_CONST:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_LOAD:
        buf += ` ${read16()} ${read16()}`;
        break;

      case OpCodes.OP_LOAD0:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_LOAD1:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_LOADARG:
        buf += ` ${read16()} ${read16()}`;
        break;

      case OpCodes.OP_LOADARG0:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_LOADARG1:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_SET:
        buf += ` ${read16()} ${read16()}`;
        break;

      case OpCodes.OP_SET0:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_SET1:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_SETARG:
        buf += ` ${read16()} ${read16()}`;
        break;

      case OpCodes.OP_SETARG0:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_SETARG1:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_JMP:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_TJMP:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_FJMP:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_NEWFUNCTION:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_LOADBOUND:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_ENCFUNCTION:
        buf += ` ${read16()}`;
        break;

      case OpCodes.OP_RET:
        buf += ` ${read16()}`;
        break;

      default:
        if (!instructionNames[instruction]) {
          throw new Error(`Unknown opcode ${instruction}`);
        }
        break;
    }
    console.log(buf); // eslint-disable-line no-console
  }
}

module.exports = {
  disassemble,
  instructionNames,
  printStack,
};
