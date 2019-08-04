NODEFLAGS=--experimental-modules

.PHONY: run
run:
	node $(NODEFLAGS) vm.mjs

.PHONY: debug
debug:
	node inspect $(NODEFLAGS) vm.mjs
