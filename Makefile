.PHONY: all

all: include/grammar.js grammar/grammar.html

include/grammar.js: grammar/grammar.ne
	npx nearleyc grammar/grammar.ne -o include/grammar.js

grammar/grammar.html: grammar/grammar.ne
	npx nearley-railroad grammar/grammar.ne -o grammar/grammar.html
