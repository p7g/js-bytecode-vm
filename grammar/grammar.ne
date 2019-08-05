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
            var_: 'var',
            if_: 'if',
            function_: 'function',
            else_: 'else',
            while_: 'while',
            return_: 'return',
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
           | block {% id %}
           | returnStatement {% id %}
           | declaration {% id %}

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
    function([, , pred, , then, , else_]) {
        if (else_ instanceof Array) {
            [, else_] = else_;
        }
        return new AST.IfStatement(pred, then, else_);
    }
%}

whileStatement -> %while_ %lparen expression %rparen statement {% ([, , pred, , stmt]) => new AST.WhileStatement(pred, stmt) %}

returnStatement -> %return_ expression %semicolon {% ([_, exp]) => new AST.ReturnStatement(exp) %}

expressionStatement -> expression %semicolon {% ([exp]) => new AST.ExpressionStatement(exp) %}

parameterList -> ( identifier ( %comma identifier ):* %comma:? ):? {%
    function([maybeIdent]) {
        if (!maybeIdent) {
            return [];
        }
        const [ident, idents] = maybeIdent;
        const all = [ident];
        if (idents) {
            return all.concat(idents.filter(([_, is]) => is).map(([_, [i]]) => i));
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

assignmentExpression -> identifier %oneequal assignmentExpression {% ([target, _, exp]) => new AST.AssignmentExpression(target, exp) %}
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

unaryExpression -> ( %exclaim | %tilde ) unaryExpression {% ([op, exp]) => new AST.UnaryExpression(op.value, exp) %}
                 | primaryExpression {% id %}

primaryExpression -> integerLiteral {% ([n]) => new AST.IntegerLiteral(n) %}
                   | callExpression {% id %}
                   | identifier {% ([ident]) => new AST.IdentifierExpression(ident) %}
                   | %lparen expression %rparen {% (([, expr, _]) => expr) %}

callExpression -> identifier %lparen argumentList %rparen {% ([ident, _, args]) => new AST.CallExpression(ident, args) %}

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
