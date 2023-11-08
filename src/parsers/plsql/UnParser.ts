import {
    PSQLAst,
    PSQLAstAsterisk,
    PSQLAstBin,
    PSQLAstCall,
    PSQLAstCase,
    PSQLAstColumnsExpr,
    PSQLAstComment,
    PSQLAstDelete,
    PSQLAstDot,
    PSQLAstExpr,
    PSQLAstFrom,
    PSQLAstInsert,
    PSQLAstJoin,
    PSQLAstListAgg,
    PSQLAstParam,
    PSQLAstSelect,
    PSQLAstSelectOrderBy,
    PSQLAstTableRef,
    PSQLAstTuple,
    PSQLAstUnary,
    PSQLAstUnion,
    PSQLAstUpdate,
    PSQLAstUpdateSet,
    PSQLAstVal,
    PSQLAstVarDot,
    PSQLAstWhen,
    PSQLAstWhere,
    PSQLPreComment,
} from "./Types";
var tab_level = 0;

function tab_incr() {
    tab_level += 1;
}

function tab_decr() {
    tab_level -= 1;
}

function get_tab(ast: PSQLAst = undefined) {
    return "\t".repeat(tab_level);
}

function unp_union(ast: PSQLAstUnion) {
    let retorno = "";
    retorno += ast.selects
        .map((current) => {
            return unparse(current);
        })
        .join(get_tab() + "UNION " + (ast.all ? "ALL " : ""));
    return retorno;
}

function unp_from(ast: PSQLAstFrom) {
    let retorno = "\n" + get_tab() + "FROM\n";
    tab_incr();
    retorno += ast.value
        .map((current) => get_tab() + unparse(current, ast))
        .join(",\n");
    tab_decr();
    return retorno;
}

function unp_where(ast: PSQLAstWhere) {
    let retorno = "\n" + get_tab() + "WHERE\n";
    tab_incr();
    retorno += get_tab();
    for (const current of ast.value) {
        retorno += unparse(current, ast);
    }
    tab_decr();
    return retorno;
}

function unp_select(ast: PSQLAstSelect) {
    let retorno = "\n" + get_tab() + "SELECT";
    tab_incr();

    retorno += unparse(ast.select, ast);

    tab_decr();

    retorno += unparse(ast.from);

    if (ast?.join?.length) {
        tab_incr();
        for (const current of ast.join) {
            retorno += unparse(current);
        }
        tab_decr();
    }

    if (ast?.where) {
        retorno += unparse(ast.where);
    }

    if (ast?.group_by?.length) {
        retorno += "\n" + get_tab() + "GROUP BY\n";
        tab_incr();
        retorno += ast.group_by
            .map((current) => get_tab() + unparse(current))
            .join(",\n");
        tab_decr();
    }

    if (ast?.order_by?.length) {
        retorno += "\n" + get_tab() + "ORDER BY\n";
        tab_incr();
        retorno += ast.order_by
            .map((current) => get_tab() + unparse(current))
            .join(",\n");
        tab_decr();
    }

    if (ast?.having) {
        retorno += "\n" + get_tab() + "HAVING\n";
        tab_incr();
        retorno += unparse(ast.having);
        tab_decr();
    }

    if (ast?.for_update) retorno += "\n" + get_tab() + "FOR UPDATE ";
    retorno += "\n";
    return retorno;
}

function unp_columns_expr(ast: PSQLAstColumnsExpr, ast_pai: PSQLAst) {
    let retorno = "";
    let space = get_tab();

    // * Provavelmente é uma função de agregação
    if (ast_pai?.type == "call") space = "";

    if (ast?.prefix) {
        if (ast_pai?.type == "call") {
            retorno += ast.prefix.toUpperCase() + " ";
        } else {
            retorno += " " + ast.prefix.toUpperCase() + "\n";
        }
    } else if (ast_pai?.type == "select") {
        retorno += "\n";
    }
    retorno += ast.value
        .map((current) => space + unparse(current))
        .join(ast_pai?.type == "call" ? ", " : ",\n");

    return retorno;
}

function unp_expr(ast: PSQLAstExpr) {
    let retorno = "";

    retorno += unparse(ast.value);
    if (ast?.as) retorno += " AS";
    if (ast?.alias) retorno += " " + unparse(ast.alias);
    return retorno;
}

function unp_table_ref(ast: PSQLAstTableRef) {
    let retorno = "";
    retorno += unparse(ast.value);
    if (ast?.as) retorno += " AS";
    if (ast?.alias) retorno += " " + unparse(ast.alias);
    return retorno;
}

function unp_join(ast: PSQLAstJoin) {
    let retorno = "\n" + get_tab() + ast.join_type.toUpperCase() + " ";

    retorno += unparse(ast.table) + " ";
    if (ast?.on) {
        retorno += "ON\n";
        tab_incr();
        retorno += get_tab();
        retorno += unparse(ast.on, ast);
        tab_decr();
    }

    return retorno;
}

function unp_select_order_by(ast: PSQLAstSelectOrderBy) {
    let retorno = "";
    retorno += unparse(ast.value);
    if (ast?.asc_desc) retorno += " " + ast.asc_desc.toUpperCase();
    if (ast?.nulls?.length) retorno += " NULLS " + ast.nulls.toUpperCase();

    return retorno;
}

function unp_insert(ast: PSQLAstInsert) {
    let retorno = "INSERT INTO ";

    retorno += unparse(ast.table_ref);

    if (ast?.columns) retorno += unparse(ast.columns, ast);

    if (ast?.value) {
        if (ast?.value.type == "tuple") retorno += " VALUES ";
        retorno += unparse(ast?.value, ast);
    }

    return retorno;
}

function unp_update(ast: PSQLAstUpdate) {
    let retorno = "UPDATE\n";

    tab_incr();
    retorno += get_tab() + unparse(ast.table_ref);
    tab_decr();

    retorno += "\nSET\n";

    tab_incr();
    retorno += ast.set
        .map((current) => {
            return get_tab() + unparse(current);
        })
        .join(",\n");
    tab_decr();

    if (ast?.where) {
        retorno += unparse(ast.where);
    }

    return retorno;
}

function unp_update_set(ast: PSQLAstUpdateSet) {
    return unparse(ast.column) + " = " + unparse(ast.expression);
}

function unp_delete(ast: PSQLAstDelete) {
    let retorno = "DELETE ";
    if (ast.from) retorno += "FROM ";

    retorno += unparse(ast.table_ref);

    if (ast?.where) {
        retorno += unparse(ast.where);
    }

    return retorno;
}

function unp_case(ast: PSQLAstCase) {
    let retorno = "CASE ";

    for (const current of ast.when) {
        retorno += unparse(current);
    }

    retorno += " ELSE ";
    retorno += unparse(ast.else);
    retorno += " END ";

    return retorno;
}

function unp_case_when(ast: PSQLAstWhen) {
    let retorno = " WHEN ";
    retorno += unparse(ast.when);
    retorno += " THEN ";
    retorno += unparse(ast.then);
    return retorno;
}

function unp_listagg(ast: PSQLAstListAgg) {
    let retorno = "LISTAGG";
    retorno += unparse(ast.column_separator);

    if (ast?.group?.length) {
        retorno += " WITHIN GROUP ( ORDER BY ";
        retorno += ast.group.map((current) => unparse(current)).join(", ");
        retorno += ")";
    }

    if (ast?.over) {
        retorno += " OVER (PARTITION BY ";
        retorno += unparse(ast.over);
        retorno += ")";
    }

    return retorno;
}

function unp_var_dot(ast: PSQLAstVarDot) {
    let retorno = "";
    for (const current of ast.value) {
        retorno += unparse(current);
    }
    return retorno;
}

function unp_val(ast: PSQLAstVal) {
    return (ast?.minus ? "-" : "") + String(ast.value);
}

function unp_dot(ast: PSQLAstDot) {
    return ".";
}

function unp_asterisk(ast: PSQLAstAsterisk) {
    return "*";
}

function unp_str(ast: PSQLAstVal) {
    return "'" + ast.value + "'";
}

function unp_precomment(ast: PSQLPreComment) {
    let retorno = unparse(ast.comment);
    retorno += unparse(ast.right);
    return retorno;
}

function unp_comment(ast: PSQLAstComment) {
    return "/" + String(ast.value) + "/";
}

function unp_param(ast: PSQLAstParam) {
    return ":" + unparse(ast.value);
}

function unp_call(ast: PSQLAstCall) {
    return unparse(ast.func) + unparse(ast.args, ast);
}

function unp_tuple(ast: PSQLAstTuple, ast_pai: PSQLAst): string {
    let retorno = "";

    let space = "";
    if (ast_pai?.type == "insert") {
        if (ast.values.length == 1 && ast.values[0].type == "select") {
            space = "";
        } else {
            space = "\n" + get_tab();
        }
    }

    retorno += ast.values
        .map((current) => {
            return space + unparse(current, ast_pai);
        })
        .join(", ");

    if (space.length > 0) retorno += "\n";

    return retorno;
}

function unp_binary(ast: PSQLAstBin, ast_pai: PSQLAst = undefined): string {
    let retorno = "";
    let space = " ";
    if (
        ast_pai &&
        (ast_pai.type == "where" || ast_pai.type == "join") &&
        (ast.operator.toLowerCase() == "and" ||
            ast.operator.toLowerCase() == "or")
    )
        space = "\n" + get_tab();

    retorno += unparse(ast.left, ast_pai);
    retorno += space + (ast?.not ? "NOT " : "") + ast.operator.toUpperCase();
    retorno += " " + unparse(ast.right, ast_pai);
    return retorno;
}

function unp_unary(ast: PSQLAstUnary): string {
    return ast.operator.toUpperCase() + " " + unparse(ast.right);
}

function unp_parenteses(ast: PSQLAst, ast_pai: PSQLAst) {
    let retorno = "(";
    tab_incr();
    retorno += unparse(ast, ast_pai);
    tab_decr();

    if (retorno[retorno.length - 1] == "\n") retorno += get_tab();
    retorno += ")";

    return retorno;
}

function unparse_ast(ast: PSQLAst, ast_pai: PSQLAst): string {
    if (ast["parenteses"] == true) {
        ast["parenteses"] = undefined;
        return unp_parenteses(ast, ast_pai);
    }
    if (ast.type == "precomment") return unp_precomment(ast);
    else if (ast.type == "comment") return unp_comment(ast);
    else if (ast.type == "binary") return unp_binary(ast, ast_pai);
    else if (ast.type == "unary") return unp_unary(ast);
    else if (ast.type == "union") return unp_union(ast);
    else if (ast.type == "from") return unp_from(ast);
    else if (ast.type == "where") return unp_where(ast);
    else if (ast.type == "select") return unp_select(ast);
    else if (ast.type == "columns_expr") return unp_columns_expr(ast, ast_pai);
    else if (ast.type == "expr") return unp_expr(ast);
    else if (ast.type == "table_ref") return unp_table_ref(ast);
    else if (ast.type == "select_order_by") return unp_select_order_by(ast);
    else if (ast.type == "join") return unp_join(ast);
    else if (ast.type == "insert") return unp_insert(ast);
    else if (ast.type == "update") return unp_update(ast);
    else if (ast.type == "update_set") return unp_update_set(ast);
    else if (ast.type == "delete") return unp_delete(ast);
    else if (ast.type == "case") return unp_case(ast);
    else if (ast.type == "when") return unp_case_when(ast);
    else if (ast.type == "listagg") return unp_listagg(ast);
    else if (ast.type == "call") return unp_call(ast);
    else if (ast.type == "tuple") return unp_tuple(ast, ast_pai);
    else if (ast.type == "param") return unp_param(ast);
    else if (ast.type == "var_dot") return unp_var_dot(ast);
    else if (ast.type == "dot") return unp_dot(ast);
    else if (ast.type == "asterisk") return unp_asterisk(ast);
    else if (ast.type == "str") return unp_str(ast);
    else if (ast.type == "var" || ast.type == "num") return unp_val(ast);
    else throw new Error(" (" + ast.type + ")");
}

function unparse(ast: PSQLAst, ast_pai: PSQLAst = undefined): string {
    // let breakline = get_breakline(ast);
    // let tab = "";
    // if (breakline.indexOf("\n") > -1) tab = get_tab(ast);
    // breakline + tab +
    return unparse_ast(ast, ast_pai);
}

export function plsql_unparse_global(ast: PSQLAst) {
    tab_level = 0;
    let retorno = unparse(ast);

    while (
        retorno.startsWith("\r\n") ||
        retorno[0] == "\n" ||
        retorno[0] == " "
    ) {
        if (retorno.startsWith("\r\n")) retorno = retorno.substring(2);
        else retorno = retorno.substring(1);
    }
    while (
        retorno.endsWith("\r\n") ||
        retorno[retorno.length - 1] == "\n" ||
        retorno[retorno.length - 1] == " "
    ) {
        if (retorno.endsWith("\r\n")) retorno = retorno.slice(0, -2);
        else retorno = retorno.slice(0, -1);
    }
    return retorno;
}
