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
    fatarrow: '=>',
    less: '<',
    more: '>',
    equal: '==',
    oneequal: '=',
    notequal: '!=',
    semicolon: ';',
    comma: ',',
    string: /"(?:[^"\n]|\\[n"])*"/,
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
            include: 'include',
            null_: 'null',
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
           | includeStatement {% id %}

includeStatement -> %include %string %semicolon {%
    function([, name]) {
        return new AST.IncludeStatement(name.value.substring(1, name.value.length - 1));
    }
%}

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

expression -> arrowFunctionExpression {% id %}
            | assignmentExpression {% id %}

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
                   | stringExpression {% id %}
                   | callExpression {% id %}
                   | nullExpression {% id %}
                   | functionExpression {% id %}
                   | identifier {% ([ident]) => new AST.IdentifierExpression(ident) %}
                   | %lparen expression %rparen {% (([, expr, _]) => expr) %}

stringExpression -> %string {% ([s]) => new AST.StringExpression(s.value.substring(1, s.value.length - 1)) %}

booleanExpression -> ( %true_ | %false_ ) {%
    function([[kw]]) {
        return new AST.BooleanExpression(kw === 'true');
    }
%}

nullExpression -> %null_ {% () => new AST.NullExpression() %}

callExpression -> primaryExpression %lparen argumentList %rparen {%
    function([expr, _, args]) {
        return new AST.CallExpression(expr, args);
    }
%}

functionExpression -> %function_ identifier:? %lparen parameterList %rparen block {%
    function([, name, , params, , body]) {
        return new AST.FunctionDeclaration(name, params, body.statements, true);
    }
%}

arrowFunctionExpression -> ( identifier | %lparen parameterList %rparen ) %fatarrow ( assignmentExpression | block ) {%
    function([[params], , [body]]) {
        let actualParams;
        if (Array.isArray(params)) {
            [, actualParams, ] = params;
        } else {
            actualParams = [params];
        }
        let actualBody;
        if (body instanceof AST.Block) {
            actualBody = body.statements;
        } else {
            actualBody = [new AST.ReturnStatement(body)];
        }
        return new AST.FunctionDeclaration(null, actualParams, actualBody, true);
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
