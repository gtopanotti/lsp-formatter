// { type: "num", value: NUMBER }
// { type: "str", value: STRING }
// { type: "bool", value: true or false }
// { type: "var", value: NAME }
// { type: "lambda", vars: [ NAME... ], body: AST }
// { type: "call", func: AST, args: [ AST... ] }
// { type: "se", delimitador:"{", cond: AST, then: AST, else: AST }
// { type: "assign", operator: "=", left: AST, right: AST }
// { type: "binary", operator: OPERATOR, parenteses:false, left: AST, right: AST }
// { type: "prog", prog: [ AST... ] }

// Custom
// { type: "empty", value: STRING }
// { type: "comment/", value: STRING }
// { type: "comment@", value: STRING }
// { type: "definir", definir_str: "dEfINIr", definir_type: numero, value: AST }
// { type: "function_def", func:AST, args: [ function_arg... ] }
// { type: "function_arg", arg_type: numero, value:NAME.... }

// { type: "let", vars: [ VARS... ], body: AST }

export interface AstVal {
    type: "num" | "str" | "bool" | "var";
    value: any;
    delimiter?: '"' | "'";
    minus?: false;
    sql?: boolean;
}
export interface AstRegra {
    type: "regra";
    value: Ast;
}
export interface AstVaPara {
    type: "vapara";
    value: Ast;
}
export interface AstLabel {
    type: "label";
    value: Ast;
}
export interface AstVarDot {
    type: "var_dot";
    value: (AstVal | AstDot | AstBracket)[];
}
export interface AstDot {
    type: "dot";
}
export interface AstBracket {
    type: "bracket";
    value: Ast;
}
export interface AstVarType {
    type: "var_type";
    value: string;
}
export interface AstCall {
    type: "call";
    func: Ast;
    args: Ast[];
}
export interface AstAssign {
    type: "assign";
    operator: string;
    left: Ast;
    right: Ast;
}
export interface AstBin {
    type: "binary";
    operator: string;
    parenteses?: boolean;
    left: Ast;
    right: Ast;
}
export interface AstUnary {
    type: "unary";
    operator: string;
    left: Ast;
}
export interface AstProg {
    type: "prog";
    prog: Ast[];
    delimitador?: "{" | "INICIO";
}

export interface AstSe {
    type: "se";
    cond: Ast;
    tem_senao?: boolean;
}

export interface AstSenao {
    type: "senao";
}
export interface AstEnquanto {
    type: "enquanto";
    cond: Ast;
}
export interface AstPara {
    type: "para";
    valor_inicial: Ast;
    cond: Ast;
    contador: Ast;
}

export interface AstEmpty {
    type: "empty";
    value: string;
}

export interface AstComment {
    type: "comment/" | "comment@";
    value: string;
}

export interface AstDefinir {
    type: "definir";
    value: AstTypingVar;
}

export interface AstFuncao {
    type: "funcao";
    func: Ast;
    args: AstTypingVar[];
}

export interface AstTypingVar {
    type: "typing_var";
    var_type: AstVarType | AstVarDot;
    value: Ast;
}
export interface AstCurSql {
    type: "cur_sql";
    func: AstVal;
    sql: AstVal;
}

export interface AstExecSql {
    type: "execsql";
    sql: AstVal;
}
/* Para comandos simples de uma linha como Pare, Continue */
export interface AstKWCmd {
    type: "kw_cmd";
    value: string;
}

export type Ast =
    | AstVal
    | AstRegra
    | AstVaPara
    | AstLabel
    | AstVarType
    | AstVarDot
    | AstDot
    | AstBracket
    | AstCall
    | AstSe
    | AstSenao
    | AstEnquanto
    | AstPara
    | AstAssign
    | AstBin
    | AstUnary
    | AstProg
    | AstEmpty
    | AstComment
    | AstDefinir
    | AstTypingVar
    | AstFuncao
    | AstCurSql
    | AstExecSql
    | AstKWCmd;
