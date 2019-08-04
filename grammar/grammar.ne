start -> (_ declaration _):+

declaration -> functionDeclaration
             | variableDeclaration

statement -> expressionStatement
		   | ifStatement
           | whileStatement
           | block
           | returnStatement
           | declaration

functionDeclaration -> identifier _ "(" _ parameterList _ ")" _ block

variableDeclaration -> "let" __ identifier _ ( "=" _ expression _ ):? ";"

ifStatement -> "if" _ "(" _ expression _ ")" _ statement ( _ "else" _ statement ):?

whileStatement -> "while" _ "(" _ expression _ ")" _ statement

returnStatement -> "return" _ expression _ ";"

expressionStatement -> expression _ ";"

parameterList -> ( identifier _ ( "," _ identifier _ ):* ",":? ):?

block -> "{" _ ( statement _ ):* "}"

expression -> assignmentExpression

assignmentExpression -> identifier _ "=" _ assignmentExpression
                      | orExpression

orExpression -> orExpression _ "||" _ andExpression
              | andExpression

andExpression -> andExpression _ "&&" _ bitwiseOrExpression
               | bitwiseOrExpression

bitwiseOrExpression -> bitwiseOrExpression _ "|" _ bitwiseXorExpression
                     | bitwiseXorExpression

bitwiseXorExpression -> bitwiseXorExpression _ "^" _ bitwiseAndExpression
                      | bitwiseAndExpression

bitwiseAndExpression -> bitwiseAndExpression _ "&" _ equalityExpression
                      | equalityExpression

equalityExpression -> equalityExpression _ ( "==" | "!=" ) _ comparisonExpression
                    | comparisonExpression

comparisonExpression -> comparisonExpression _ [><] _ additionExpression
                      | additionExpression

additionExpression -> additionExpression _ [+-] _ multiplicationExpression
                    | multiplicationExpression

multiplicationExpression -> multiplicationExpression _ [*/] _ unaryExpression
                          | unaryExpression

unaryExpression -> [!~] _ unaryExpression
                 | primaryExpression

primaryExpression -> integerLiteral
                   | callExpression
                   | identifier
                   | "(" _ expression _ ")"

callExpression -> identifier _ "(" _ argumentList _ ")"

argumentList -> ( expression _ ( "," _ expression _ ):* ",":? ):?

integerLiteral -> [1-9] [0-9]:* | "0"

identifier -> [_a-zA-Z] [_a-zA-Z0-9]:*

_ -> __:?

__ -> [\n\t ]:+
