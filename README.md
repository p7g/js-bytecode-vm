# A small bytecode VM in javascript

This is a really basic VM, that supports functions and local variables. The only
supported datatype is an integer. In the file, there are 2 implementations of a
factorial function; one recursive, and one iterative. There is no parser or
lexer, nor is there a language to go with the VM, so any code written for it
needs to be in plain bytecode.

The instruction set of the VM is at the very top of the file. There is lots of
room for even basic optimizations, though I don't even have a rough idea of the
performance of this thing.

To see some information while the VM is running, change the `false` in the log
function to `true`.

Note: there is a memory leak of sorts... The stack only ever grows, and does not
shrink. It shouldn't grow infinitely unless your program causes such behaviour,
but the values are not removed from the array, so they won't be cleaned up.

## Next steps

I think the next thing I will try and implement with this is global variables.
Maybe before that I will throw together a lexer and parser to make generating
code (much) easier. Later on down the line, if I feel like it, I might look into
closures, but I have no clue where to start there.
