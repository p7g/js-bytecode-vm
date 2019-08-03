import OpCodes from './opcode';

export const instructionNames = [];
Object.entries(OpCodes).forEach(([k, v]) => { instructionNames[v] = k; });

export function disassemble(bytecode_) {
  const bytecode = [...bytecode_];

  let i = 0;
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
        buf += ' ' + read16();
        break;

      case OpCodes.OP_LOAD:
        buf += ' ' + read16();
        break;

      case OpCodes.OP_LOADARG:
        buf += ' ' + read16();
        break;

      case OpCodes.OP_SET:
        buf += ' ' + read16();
        break;

      case OpCodes.OP_SETARG:
        buf += ' ' + read16();
        break;

      case OpCodes.OP_JMP:
        buf += ' ' + read16();
        break;

      case OpCodes.OP_TJMP:
        buf += ' ' + read16();
        break;

      case OpCodes.OP_FJMP:
        buf += ' ' + read16();
        break;

      case OpCodes.OP_CALL:
        buf += ' ' + read16();
        break;

      default:
        if (!instructionNames[instruction]) {
          throw new Error(`Unknown opcode ${instruction}`);
        }
        break;
    }
    console.log(buf);
  }
}
