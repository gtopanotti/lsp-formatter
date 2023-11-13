import { InputStream } from "../InputStream";
import { PSQLTokenStream } from "./PSQLTokenStream";
import {
    PSQLAst,
    PSQLAstAsterisk,
    PSQLAstCall,
    PSQLAstCase,
    PSQLAstColumnsExpr,
    PSQLAstComment,
    PSQLAstDelete,
    PSQLAstExpr,
    PSQLAstFrom,
    PSQLAstInsert,
    PSQLAstJoin,
    PSQLAstListAgg,
    PSQLAstParam,
    PSQLAstSelectOrderBy,
    PSQLAstTableRef,
    PSQLAstTuple,
    PSQLAstUpdate,
    PSQLAstVal,
    PSQLAstVarDot,
    PSQLAstWhere,
} from "./Types";
import { plsql_unparse_global } from "./UnParser";

export class PSQLParser {
    private token: PSQLTokenStream;
    private PRECEDENCE = {
        // "=": 1,
        // "||": 2,
        // "&&": 3,
        OR: 2,
        AND: 3,
        BETWEEN: 4,
        IN: 7,
        IS: 7,
        LIKE: 7,
        "<": 7,
        ">": 7,
        "<=": 7,
        ">=": 7,
        "=": 7,
        "!=": 7,
        "<>": 7,
        "||": 10,
        "+": 10,
        "-": 10,
        "*": 20,
        "/": 20,
        "%": 20,
    };

    constructor(input: string) {
        this.token = new PSQLTokenStream(new InputStream(input));
    }

    private is_comment() {
        var tok = this.token.peek();
        return tok && tok.type == "comment" && tok;
    }

    private is_str() {
        var tok = this.token.peek();
        return tok && tok.type == "str" && tok;
    }
    private is_punc(ch = undefined) {
        var tok = this.token.peek();
        return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
    }
    private is_kw(kw = undefined) {
        var tok = this.token.peek();
        return (
            tok &&
            tok.type == "kw" &&
            (!kw || tok.value.toLowerCase() == kw.toLowerCase()) &&
            tok
        );
    }
    private is_kw_multiple(kws: string[]) {
        var tok = this.token.peek();

        return (
            tok &&
            tok.type == "kw" &&
            kws.includes(tok.value.toLowerCase()) &&
            tok
        );
    }
    private is_op(op = undefined) {
        var tok = this.token.peek();
        return tok && tok.type == "op" && (!op || tok.value == op) && tok;
    }
    private is_var(vr = undefined) {
        var tok = this.token.peek();
        return tok && tok.type == "var" && (!vr || tok.value == vr) && tok;
    }
    private is_var_case_insentive(vr = undefined) {
        var tok = this.token.peek();
        return (
            tok &&
            tok.type == "var" &&
            (!vr || tok.value.toLowerCase() == vr.toLowerCase()) &&
            tok
        );
    }
    private is_agg_function(ast: PSQLAst) {
        return (
            ast.type == "var" &&
            ["count", "sum", "max", "min", "avg"].includes(
                ast.value.toLowerCase()
            )
        );
    }

    private is_boolean_bin(ast: PSQLAst) {
        if (
            ast.type == "binary" &&
            this.PRECEDENCE[ast?.operator.toUpperCase()] <= 7
        )
            return true;
        return false;
    }

    private skip_punc(ch, optional = false) {
        if (this.is_punc(ch)) this.token.next();
        else if (!optional)
            this.token.croak('Esperando pontuação: "' + ch + '"');
    }
    private skip_kw(kw) {
        if (this.is_kw(kw)) this.token.next();
        else this.token.croak('Esperando keyword: "' + kw + '"');
    }
    private skip_op(op) {
        if (this.is_op(op)) this.token.next();
        else this.token.croak('Esperando operador: "' + op + '"');
    }

    private unexpected(tok) {
        this.token.croak(
            'Char ou token inesperado: "' + String(tok.value) + '"'
        );
    }

    private parse_bool(): PSQLAst {
        return {
            type: "bool",
            value: this.token.next().value.toLowerCase() == "true",
        };
    }

    private parse_asterisk(): PSQLAstAsterisk {
        this.skip_op("*");
        return { type: "asterisk" };
    }

    private parse_var_dot(func): PSQLAstVarDot {
        let retorno: PSQLAstVarDot;
        if (func.type == "var_dot") {
            retorno = func;
        } else {
            retorno = {
                type: "var_dot",
                value: [func],
            };
        }
        if (this.is_punc(".")) {
            retorno.value.push({
                type: "dot",
            });
            this.skip_punc(".");
        } else if (this.is_var()) {
            retorno.value.push(<PSQLAstVal>this.token.next());
        } else if (this.is_op("*")) retorno.value.push(this.parse_asterisk());
        else {
            this.token.croak("Cadeia de caracteres invalida ");
        }
        return retorno;
    }

    private parse_param(): PSQLAstParam {
        if (!this.is_punc(":")) this.token.croak("esperado :");
        this.skip_punc(":");
        return { type: "param", value: this.parse_atom() };
    }

    private parse_insert(): PSQLAstInsert {
        this.skip_kw("insert");
        this.skip_kw("into");

        if (!this.is_var())
            this.token.croak(
                'var ou var_dot esperado: "' +
                    String(this.token.peek().value) +
                    '"'
            );

        let table_ref = this.maybe_var_dot(() => <PSQLAstVal>this.token.next());

        let columns = undefined;
        if (this.is_punc("(")) columns = this.parse_expression();

        let value;
        if (this.is_kw("values")) {
            this.skip_kw("values");
        }
        value = this.parse_expression();

        return {
            type: "insert",
            table_ref: table_ref,
            columns: columns,
            value: value,
        };
    }

    private parse_listagg(): PSQLAstListAgg {
        this.skip_kw("listagg");
        let column_separator = this.parse_expression();

        let group = [];
        if (this.is_kw("within")) {
            this.skip_kw("within");
            this.skip_kw("group");
            this.skip_punc("(");
            this.skip_kw("order");
            this.skip_kw("by");
            group.push(this.parse_expression());
            while (this.is_punc(",")) {
                this.skip_punc(",");
                group.push(this.parse_expression());
            }

            this.skip_punc(")");
        }

        let over = undefined;
        if (this.is_kw("over")) {
            this.skip_kw("over");
            this.skip_punc("(");
            this.skip_kw("partition");
            this.skip_kw("by");
            over = this.parse_expression();

            this.skip_punc(")");
        }

        return {
            type: "listagg",
            column_separator: column_separator,
            group: group,
            over: over,
        };
    }

    private parse_case(): PSQLAstCase {
        this.skip_kw("case");
        let when: PSQLAst[] = [];
        while (this.is_kw("when")) {
            this.skip_kw("when");
            let when_exp = this.parse_expression();

            this.skip_kw("then");
            let then_exp = this.parse_expression();
            when.push({
                type: "when",
                when: when_exp,
                then: then_exp,
            });
        }
        this.skip_kw("else");
        let else_ast = this.parse_expression();
        this.skip_kw("end");
        return {
            type: "case",
            when: when,
            else: else_ast,
        };
    }

    private parse_delete(): PSQLAstDelete {
        this.skip_kw("delete");
        let from = false;
        if (this.is_kw("from")) {
            from = true;
            this.skip_kw("from");
        }
        let table_ref = this.parse_single_table_ref();

        let where = this.parse_where();

        return {
            type: "delete",
            from: from,
            table_ref: table_ref,
            where: where,
        };
    }

    private parse_update(): PSQLAstUpdate {
        this.skip_kw("update");
        let table_ref = this.parse_single_table_ref();

        this.skip_kw("set");
        let set = [];
        do {
            if (this.is_punc(",")) this.skip_punc(",");
            set.push(this.parse_update_set_item());
        } while (this.is_punc(","));

        let where = this.parse_where();

        return {
            type: "update",
            table_ref: table_ref,
            set: set,
            where: where,
        };
    }

    private parse_update_set_item(): PSQLAst {
        let column = this.maybe_var_dot(() => this.parse_atom());
        this.skip_op("=");
        let expression = this.parse_expression();
        return { type: "update_set", column: column, expression: expression };
    }

    private parse_where(): PSQLAstWhere {
        if (!this.is_kw("where")) return undefined;

        this.skip_kw("where");

        let value = [];
        do {
            value.push(this.parse_expression());
        } while (
            (this.is_var_case_insentive("__inserir") &&
                value[value.length - 1].type == "binary") ||
            (value[value.length - 1].type == "call" &&
                !this.token.eof() &&
                !this.is_punc(")") &&
                !this.is_punc(")") &&
                !this.is_kw_multiple(["order", "group", "having", "union"]) &&
                !this.is_var("for"))
        );
        return {
            type: "where",
            value: value,
        };
    }

    private parse_select(): PSQLAst {
        this.skip_kw("select");
        let select = this.parse_columns_expr();

        let from = this.parse_from();

        let join = this.parse_join_itens();

        let where = this.parse_where();

        let group_by = this.parse_group_by_itens();

        let order_by = this.parse_order_by_itens();

        let having = this.parse_having();

        let for_update = false;
        if (this.is_var("for")) {
            this.token.next();
            this.skip_kw("update");
            for_update = true;
        }

        return this.maybe_union({
            type: "select",
            select: select,
            from: from,
            join: join,
            where: where,
            group_by: group_by,
            order_by: order_by,
            having: having,
            for_update: for_update,
        });
    }

    private parse_columns_expr(
        tuple = false
    ): PSQLAstColumnsExpr | PSQLAstTuple {
        if (tuple) this.skip_punc("(");

        let prefix = undefined;
        if (this.is_kw("distinct")) {
            this.skip_kw("distinct");
            prefix = "distinct";
        } else if (this.is_kw("all")) {
            this.skip_kw("all");
            prefix = "all";
        }

        let value = [];

        do {
            if (this.is_punc(",")) this.skip_punc(",");

            value.push(this.parse_single_expr());
        } while (this.is_punc(","));

        if (tuple) this.skip_punc(")");

        let columns_expr: PSQLAstColumnsExpr = {
            type: "columns_expr",
            value: value,
            prefix: prefix,
        };

        if (tuple)
            return {
                type: "tuple",
                parenteses: true,
                values: [columns_expr],
            };
        else return columns_expr;
    }

    private parse_single_expr(): PSQLAstExpr {
        let value;
        if (this.is_op("*")) value = this.parse_asterisk();
        else value = this.parse_expression();

        let as_bool = false;
        if (this.is_kw("as")) {
            this.skip_kw("as");
            as_bool = true;
        }

        let alias = undefined;
        if (!this.is_punc(",") && !this.is_kw("from") && !this.is_punc(")")) {
            alias = this.parse_expression();
        }
        return {
            type: "expr",
            value: value,
            as: as_bool,
            alias: alias,
        };
    }

    private parse_from(): PSQLAstFrom {
        this.skip_kw("from");
        let value: PSQLAstTableRef[] = [];
        do {
            if (this.is_punc(",")) this.skip_punc(",");

            value.push(this.parse_single_table_ref());
        } while (!this.token.eof() && this.is_punc(","));
        return { type: "from", value: value };
    }

    private parse_single_table_ref(): PSQLAstTableRef {
        let value = this.parse_expression();
        let as_bool = false;
        if (this.is_kw("as")) {
            as_bool = true;
            this.skip_kw("as");
        }
        let alias = undefined;
        if (!this.is_punc() && !this.is_kw() && !this.token.eof()) {
            alias = this.parse_expression();
        }
        return {
            type: "table_ref",
            value: value,
            as: as_bool,
            alias: alias,
        };
    }

    private parse_join_itens(): PSQLAstJoin[] {
        if (
            this.token.eof() ||
            this.is_punc(")") ||
            !this.is_kw_multiple([
                "inner",
                "left",
                "right",
                "cross",
                "outer",
                "join",
            ])
        )
            return [];

        let retorno: PSQLAstJoin[] = [];

        do {
            let join_type = "";
            if (
                this.is_kw_multiple([
                    "inner",
                    "left",
                    "right",
                    "cross",
                    "outer",
                    "join",
                ])
            )
                join_type += this.token.next().value.toLowerCase() + " ";
            if (this.is_kw_multiple(["outer", "join"]))
                join_type += this.token.next().value.toLowerCase() + " ";
            if (this.is_kw_multiple(["join"]))
                join_type += this.token.next().value.toLowerCase() + " ";

            join_type = join_type.trim();

            let table_ref = this.parse_single_table_ref();

            this.skip_kw("on");

            let on = this.parse_expression();

            retorno.push({
                type: "join",
                join_type: join_type,
                table: table_ref,
                on: on,
            });
        } while (
            !this.token.eof() &&
            this.is_kw_multiple([
                "inner",
                "left",
                "right",
                "cross",
                "outer",
                "join",
            ])
        );
        return retorno;
    }

    private parse_group_by_itens() {
        if (this.token.eof() || !this.is_kw("group")) return [];

        this.skip_kw("group");
        this.skip_kw("by");

        let retorno = [];
        do {
            if (this.is_punc(",")) this.skip_punc(",");
            retorno.push(this.parse_expression());
        } while (!this.token.eof() && this.is_punc(","));
        return retorno;
    }

    private parse_order_by_itens(): PSQLAstSelectOrderBy[] {
        if (this.token.eof() || this.is_punc(")") || !this.is_kw("order"))
            return [];

        this.skip_kw("order");
        this.skip_kw("by");

        let retorno: PSQLAstSelectOrderBy[] = [];
        do {
            if (this.is_punc(",")) this.skip_punc(",");
            let value = this.parse_expression();
            let asc_desc = undefined;
            if (this.is_kw("asc")) {
                asc_desc = "asc";
                this.skip_kw("asc");
            } else if (this.is_kw("desc")) {
                asc_desc = "desc";
                this.skip_kw("desc");
            }
            let nulls = undefined;
            if (this.is_kw("nulls")) {
                this.skip_kw("nulls");
                if (this.is_kw("first")) {
                    this.skip_kw("first");
                    nulls = "first";
                } else if (this.is_kw("last")) {
                    this.skip_kw("last");
                    nulls = "last";
                }
            }
            retorno.push({
                type: "select_order_by",
                value: value,
                asc_desc: asc_desc,
                nulls: nulls,
            });
        } while (!this.token.eof() && this.is_punc(","));
        return retorno;
    }

    private parse_having() {
        if (this.token.eof() || !this.is_kw("having")) return undefined;
        this.skip_kw("having");
        return this.parse_expression();
    }

    private parse_call(func): PSQLAstCall {
        if (!this.is_punc("(")) this.token.croak("Esperando (");
        let symbol = this.pcomment_symbol(func);
        let args;

        if (this.is_agg_function(symbol)) {
            args = this.parse_columns_expr(true);
        } else {
            args = this.parse_tuple();
        }

        return {
            type: "call",
            func: func,
            args: args,
        };
    }

    private parse_union(func) {
        this.skip_kw("union");
        var retorno;
        if (func.type == "union") {
            retorno = func;
        } else {
            var all = false;
            if (this.is_kw("all")) {
                all = true;
                this.skip_kw("all");
            }
            retorno = {
                type: "union",
                all: all,
                selects: [func],
            };
        }

        retorno.selects.push(this.maybe_union(this.parse_expression()));
        return retorno;
    }
    private parse_tuple(): PSQLAstTuple {
        this.skip_punc("(");
        let values = [];
        do {
            if (this.is_punc(",")) this.skip_punc(",");

            values.push(this.parse_expression());
        } while (this.is_punc(","));

        this.skip_punc(")");

        /* não existe tupla com binario booleano dentro, é um binario com parenteses */
        if (values.length == 1 && this.is_boolean_bin(values[0])) {
            values[0]["parenteses"] = true;
            return values[0];
        }
        return {
            type: "tuple",
            parenteses: true,
            values: values,
        };
    }

    private pcomment_symbol(func) {
        if (func.type == "precomment") return this.pcomment_symbol(func.right);
        else if (func.type == "postcomment")
            return this.pcomment_symbol(func.left);
        else return func;
    }

    private maybe_union(left: PSQLAst): PSQLAst {
        if (
            (this.pcomment_symbol(left.type) == "select" ||
                this.pcomment_symbol(left.type) == "union") &&
            this.is_kw("union")
        )
            return this.parse_union(left);
        return left;
    }

    private maybe_binary(
        left: PSQLAst,
        my_prec,
        is_between: boolean = false
    ): PSQLAst {
        var not = false;
        if (this.is_kw("not")) {
            let next_tok = this.token.peek_next();
            var next_his_prec = this.PRECEDENCE[next_tok.value.toUpperCase()];
            if (next_his_prec > my_prec) {
                not = true;
                this.skip_kw("not");
            }
        }

        var tok =
            this.is_op() ||
            this.is_kw("and") ||
            this.is_kw("or") ||
            this.is_kw("in") ||
            this.is_kw("like") ||
            this.is_kw("is") ||
            this.is_kw("between");
        if (tok) {
            var his_prec = this.PRECEDENCE[tok.value.toUpperCase()];

            if (is_between && his_prec == this.PRECEDENCE["AND"]) {
                is_between = false;
                his_prec = 5;
            }

            if (his_prec > my_prec) {
                this.token.next();

                let prox_is_between = false;
                if (this.PRECEDENCE["BETWEEN"] == his_prec) {
                    prox_is_between = true;
                }

                return this.maybe_binary(
                    {
                        type: "binary",
                        operator: tok.value,
                        not: not,
                        left: left,
                        right: this.maybe_binary(
                            this.maybe_var_dot(() => this.parse_atom()),
                            his_prec,
                            prox_is_between
                        ),
                    },
                    my_prec,
                    is_between
                );
            }
        }

        if (this.is_comment()) {
            return this.maybe_call(() =>
                this.maybe_binary(
                    {
                        type: "postcomment",
                        comment: <PSQLAstComment>this.token.next(),
                        left: left,
                    },
                    0
                )
            );
        }

        return left;
    }

    private maybe_var_dot<T>(expr: () => T): T | PSQLAstVarDot {
        let expr_ = expr();
        let last_symbol = this.pcomment_symbol(expr_);
        if (expr_["type"] == "var_dot")
            last_symbol = this.pcomment_symbol(
                expr_["value"][expr_["value"].length - 1]
            );

        if (last_symbol["type"] == "var" && this.is_punc("."))
            return this.maybe_var_dot(() => this.parse_var_dot(expr_));

        if (last_symbol["type"] == "dot" && (this.is_var() || this.is_op("*")))
            return this.maybe_var_dot(() => this.parse_var_dot(expr_));

        return expr_;
    }

    private maybe_call<T>(expr: () => T): T | PSQLAstCall {
        let expr_ = expr();
        let last_symbol = this.pcomment_symbol(expr_);
        if (this.is_punc("(")) {
            if (last_symbol.type == "var" || last_symbol.type == "var_dot") {
                return this.parse_call(expr_);
            }
        }
        return expr_;
    }

    private parse_atom(): PSQLAst {
        return this.maybe_call(() => {
            if (this.is_punc("(")) return this.parse_tuple();

            if (this.is_punc(":")) return this.parse_param();

            if (this.is_kw("select")) return this.parse_select();
            if (this.is_kw("insert")) return this.parse_insert();
            if (this.is_kw("update")) return this.parse_update();
            if (this.is_kw("delete")) return this.parse_delete();

            if (this.is_kw("listagg")) return this.parse_listagg();
            if (this.is_kw("case")) return this.parse_case();

            if (this.is_kw("true") || this.is_kw("false"))
                return this.parse_bool();

            if (this.is_op("-")) {
                this.token.next();
                let retorno = this.parse_atom();
                retorno["minus"] = true;
                return retorno;
            }

            if (this.is_kw("not") || this.is_kw("exists")) {
                return {
                    type: "unary",
                    operator: this.token.next().value,
                    right: this.parse_expression(),
                };
            }

            var tok = this.token.next();
            if (tok.type == "var" || tok.type == "num" || tok.type == "str")
                return <PSQLAstVal>tok;
            if (tok.type == "comment")
                return {
                    type: "precomment",
                    comment: <PSQLAstComment>tok,
                    right: this.parse_atom(),
                };

            this.unexpected(tok);
        });
    }

    private parse_expression() {
        return this.maybe_call(() =>
            this.maybe_binary(
                this.maybe_var_dot(() => this.parse_atom()),
                0
            )
        );
    }

    parse(): PSQLAst {
        let retorno = this.parse_expression();
        if (this.is_comment())
            this.token.croak("Comentario no final sem adicionar");

        if (!this.token.eof()) {
            this.token.croak("arquivo não finalizado ");
        }
        return retorno;
    }

    static unparse(parsed: PSQLAst) {
        return plsql_unparse_global(parsed);
    }
}
