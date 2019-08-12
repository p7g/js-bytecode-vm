# A small bytecode VM in javascript

This is a pretty simple bytecode VM implemented in javascript. I have also
written a little language to go with it and to try stuff out, though the
semantics of that language are mostly defined by the abstract syntax tree, and
the VM can be made to work very differently.

## How to

1. Compile the grammar by running `make`
1. Check out the sweet railroad diagrams generated at `grammar/grammar.html`
1. Write a cool script in a file (good luck figuring out how the language works)
1. Run it `npm run start -- mycoolscript.jsbcvm`

Here's a snippet of the language:

```js
function multiplier(a) {
  return b => a * b;
}

var times2 = multiplier(2);

print(times2(4));
```

## Next steps

- other datatypes (object, array, string, etc)
- error handling
- modules
