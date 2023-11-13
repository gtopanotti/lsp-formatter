export interface PSQLPreComment {
    type: "precomment";
    comment: PSQLAstComment;
    right: PSQLAst;
}

export interface PSQLPostComment {
    type: "postcomment";
    left: PSQLAst;
    comment: PSQLAstComment;
}

export interface PSQLAstUnary {
    type: "unary";
    operator: string;
    right: PSQLAst;
}

export interface PSQLAstBin {
    type: "binary";
    operator: string;
    parenteses?: boolean;
    not?: boolean;
    left: PSQLAst;
    right: PSQLAst;
}

export interface PSQLAstBetween {
    type: "between";
    left: PSQLAst;
    right: PSQLAst;
}

export interface PSQLAstCall {
    type: "call";
    func: PSQLAst;
    args: PSQLAst;
}

export interface PSQLAstTuple {
    type: "tuple";
    parenteses?: boolean;
    values: PSQLAst[];
}

export interface PSQLAstComment {
    type: "comment";
    value: any;
}

export interface PSQLAstVal {
    type: "str" | "num" | "bool" | "var";
    value: any;
    minus?: boolean;
}
export interface PSQLAstParam {
    type: "param";
    value: any;
}
export interface PSQLAstDot {
    type: "dot";
}

export interface PSQLAstAsterisk {
    type: "asterisk";
}

export interface PSQLAstVarDot {
    type: "var_dot";
    value: (PSQLAstVal | PSQLAstDot | PSQLAstAsterisk)[];
}

export interface PSQLAstCase {
    type: "case";
    when: PSQLAst[];
    else: PSQLAst;
}

export interface PSQLAstWhen {
    type: "when";
    when: PSQLAst;
    then: PSQLAst;
}

export interface PSQLAstListAgg {
    type: "listagg";
    column_separator: PSQLAst;
    group: PSQLAst[];
    over?: PSQLAst;
}

export interface PSQLAstUnion {
    type: "union";
    all: boolean;
    selects: PSQLAst[];
}

export interface PSQLAstWhere {
    // * intercala binary com a função __inserir
    type: "where";
    value: PSQLAst[];
}

export interface PSQLAstFrom {
    type: "from";
    value: PSQLAst[];
}

export interface PSQLAstSelect {
    type: "select";
    select: PSQLAst;
    from: PSQLAstFrom;
    join?: PSQLAst[];
    where?: PSQLAstWhere;
    group_by?: PSQLAst[];
    order_by?: PSQLAstSelectOrderBy[];
    having?: PSQLAst;
    for_update?: boolean;
    parenteses?: boolean;
}

export interface PSQLAstColumnsExpr {
    type: "columns_expr";
    value: PSQLAstExpr[];
    prefix?: "distinct" | "all";
}

export interface PSQLAstExpr {
    type: "expr";
    value: PSQLAst;
    as?: boolean;
    alias?: PSQLAst;
}

export interface PSQLAstTableRef {
    type: "table_ref";
    value: PSQLAst;
    as?: boolean;
    alias?: PSQLAst;
}

export interface PSQLAstSelectOrderBy {
    type: "select_order_by";
    value: PSQLAst;
    asc_desc?: "asc" | "desc";
    nulls?: "first" | "last";
}

export interface PSQLAstInsert {
    type: "insert";
    table_ref: PSQLAst;
    columns?: PSQLAst;
    value: PSQLAst;
}

export interface PSQLAstUpdate {
    type: "update";
    table_ref: PSQLAstTableRef;
    set: PSQLAst[];
    where?: PSQLAstWhere;
}

export interface PSQLAstUpdateSet {
    type: "update_set";
    column: PSQLAst;
    expression: PSQLAst;
}

export interface PSQLAstDelete {
    type: "delete";
    from: boolean;
    table_ref: PSQLAstTableRef;
    where?: PSQLAstWhere;
}

export interface PSQLAstJoin {
    type: "join";
    join_type: string;
    table: PSQLAstTableRef;
    on: PSQLAst;
}

export type PSQLAst =
    | PSQLAstUnion
    | PSQLAstSelect
    | PSQLAstColumnsExpr
    | PSQLAstExpr
    | PSQLAstTableRef
    | PSQLAstJoin
    | PSQLAstSelectOrderBy
    | PSQLAstInsert
    | PSQLAstUpdate
    | PSQLAstComment
    | PSQLAstVal
    | PSQLAstDot
    | PSQLAstVarDot
    | PSQLPreComment
    | PSQLPostComment
    | PSQLAstBin
    | PSQLAstCall
    | PSQLAstTuple
    | PSQLAstParam
    | PSQLAstUpdateSet
    | PSQLAstDelete
    | PSQLAstAsterisk
    | PSQLAstListAgg
    | PSQLAstUnary
    | PSQLAstCase
    | PSQLAstWhen
    | PSQLAstWhere
    | PSQLAstFrom;
