@{%
const moo = require('moo');
const AST = require('../src/ast.js');

function binop([left, op, right]) {
    if (op instanceof Array) {
        [op] = op;
    }
    return new AST.BinaryExpression(left, op.value, right);
}

const lexer = moo.compile({
    ws: /[\t \r]+/,
    newline: { match: /\n/, lineBreaks: true },
    comment: /\/\/.*?$/,
    lparen: '(',
    rparen: ')',
    lbrace: '{',
    rbrace: '}',
    plus: '+',
    minus: '-',
    times: '*',
    divide: '/',
    andand: '&&',
    oror: '||',
    and: '&',
    or: '|',
    caret: '^',
    exclaim: '!',
    tiled: '~',
    less: '<',
    more: '>',
    equal: '==',
    oneequal: '=',
    notequal: '!=',
    semicolon: ';',
    comma: ',',
    identifier: {
        match: /[_a-zA-Z]\w*/,
        type: moo.keywords({
            break_: 'break',
            continue_: 'continue',
            else_: 'else',
            false_: 'false',
            for_: 'for',
            function_: 'function',
            if_: 'if',
            return_: 'return',
            true_: 'true',
            var_: 'var',
            while_: 'while',
        }),
    },
    integer: /0|[1-9][0-9]*/,
});

lexer.next = (next => () => {
    let tok;
    while ((tok = next.call(lexer))) {
        if (tok.type === 'comment'
                || tok.type === 'ws'
                || tok.type === 'newline') {
            continue;
        }
        break;
    }
    return tok;
})(lexer.next);
%}

@lexer lexer

start -> statement:+ {% id %}

declaration -> functionDeclaration {% id %}
             | variableDeclaration {% id %}

statement -> expressionStatement {% id %}
           | ifStatement {% id %}
           | whileStatement {% id %}
           | forStatement {% id %}
           | block {% id %}
           | returnStatement {% id %}
           | declaration {% id %}
           | breakStatement {% id %}
           | continueStatement {% id %}

functionDeclaration -> %function_ identifier %lparen parameterList %rparen block {%
    function([, name, , params, , body]) {
        return new AST.FunctionDeclaration(name, params, body.statements);
    }
%}

variableDeclaration -> %var_ identifier ( %oneequal expression ):? %semicolon {%
    function([, name, maybeExp]) {
        let exp = null;
        if (maybeExp !== null) {
            [, exp] = maybeExp;
        }
        return new AST.VariableDeclaration(name, exp);
    }
%}

ifStatement -> %if_ %lparen expression %rparen statement ( %else_ statement ):? {%
    function([, , pred, , then, else_]) {
        if (else_ !== null) {
            [, else_] = else_;
        }
        return new AST.IfStatement(pred, then, else_);
    }
%}

whileStatement -> %while_ %lparen expression %rparen statement {%
    function([, , pred, , stmt]) {
        return new AST.WhileStatement(pred, stmt);
    }
%}

forStatement -> %for_ %lparen ( statement | %semicolon ) expression:? %semicolon expression:? %rparen statement {%
    function([, , maybeInit, test, , incr, , body]) {
        let init = null;
        if (maybeInit !== null && maybeInit[0].type !== 'semicolon') {
            init = maybeInit[0];
        }

        return new AST.ForStatement(init, test, incr, body);
    }
%}

returnStatement -> %return_ expression %semicolon {%
    function([_, exp]) {
        return new AST.ReturnStatement(exp);
    }
%}

expressionStatement -> expression %semicolon {%
    function([exp]) {
        return new AST.ExpressionStatement(exp);
    }
%}

breakStatement -> %break_ %semicolon {% () => new AST.BreakStatement() %}

continueStatement -> %continue_ %semicolon {% () => new AST.ContinueStatement() %}

parameterList -> ( identifier ( %comma identifier ):* %comma:? ):? {%
    function([maybeIdent]) {
        if (!maybeIdent) {
            return [];
        }
        const [ident, idents] = maybeIdent;
        const all = [ident];
        if (idents) {
            return all.concat(idents.filter(([_, is]) => is).map(([_, i]) => i));
        }
        return all;
    }
%}

block -> %lbrace ( statement ):* %rbrace {%
    function([_, stmts]) {
        if (!(stmts instanceof Array)) {
            stmts = [];
        }
        return new AST.Block(stmts.map(id));
    }
%}

expression -> assignmentExpression {% id %}

assignmentExpression -> identifier %oneequal assignmentExpression {%
    function([target, _, exp]) {
        return new AST.AssignmentExpression(target, exp);
    }
%}
                      | orExpression {% id %}

orExpression -> orExpression %oror andExpression {% binop %}
              | andExpression {% id %}

andExpression -> andExpression %andand bitwiseOrExpression {% binop %}
               | bitwiseOrExpression {% id %}

bitwiseOrExpression -> bitwiseOrExpression %or bitwiseXorExpression {% binop %}
                     | bitwiseXorExpression {% id %}

bitwiseXorExpression -> bitwiseXorExpression %caret bitwiseAndExpression {% binop %}
                      | bitwiseAndExpression {% id %}

bitwiseAndExpression -> bitwiseAndExpression %and equalityExpression {% binop %}
                      | equalityExpression {% id %}

equalityExpression -> equalityExpression ( %equal | %notequal ) comparisonExpression {% binop %}
                    | comparisonExpression {% id %}

comparisonExpression -> comparisonExpression ( %less | %more ) additionExpression {% binop %}
                      | additionExpression {% id %}

additionExpression -> additionExpression ( %plus | %minus ) multiplicationExpression {% binop %}
                    | multiplicationExpression {% id %}

multiplicationExpression -> multiplicationExpression ( %times | %divide ) unaryExpression {% binop %}
                          | unaryExpression {% id %}

unaryExpression -> ( %exclaim | %tilde | %minus ) unaryExpression {%
    function([[op], exp]) {
        return new AST.UnaryExpression(op.value, exp);
    }
%}
                 | primaryExpression {% id %}

primaryExpression -> integerLiteral {% ([n]) => new AST.IntegerLiteral(n) %}
                   | booleanExpression {% id %}
                   | callExpression {% id %}
                   | identifier {% ([ident]) => new AST.IdentifierExpression(ident) %}
                   | %lparen expression %rparen {% (([, expr, _]) => expr) %}

booleanExpression -> ( %true_ | %false_ ) {%
    function([[kw]]) {
        return new AST.BooleanExpression(kw === 'true');
    }
%}

callExpression -> primaryExpression %lparen argumentList %rparen {%
    function([expr, _, args]) {
        return new AST.CallExpression(expr, args);
    }
%}

argumentList -> ( expression ( %comma expression ):* %comma:? ):? {%
    function([maybeExp]) {
        if (!maybeExp) {
            return [];
        }
        const [expr, exprs] = maybeExp;
        const all = [expr];
        if (exprs) {
            return all.concat(exprs.map(([_, exp]) => exp));
        }
        return all;
    }
%}

identifier -> %identifier {% ([ident]) => ident.value %}

integerLiteral -> %integer {% ([n]) => Number.parseInt(n, 10) %}
