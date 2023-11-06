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
// { type: "definir", definir_str: "dEfINIr", definir_type: numero, value: AST }
// { type: "function_def", func:AST, args: [ function_arg... ] }
// { type: "function_arg", arg_type: numero, value:NAME.... }

// { type: "let", vars: [ VARS... ], body: AST }

import { InputStream } from "../InputStream";
import { conferir_divergencias } from "../Validador";
import { PSQLParser } from "../plsql/PSQLParser";
import { LSPToken, LSPTokenStream } from "./LSPTokenStream";
import {
    Ast,
    AstCall,
    AstComment,
    AstCurSql,
    AstDefinir,
    AstEmpty,
    AstEnquanto,
    AstExecSql,
    AstPara,
    AstProg,
    AstSe,
    AstSenao,
    AstVal,
    AstFuncao,
    AstVarType,
    AstTypingVar,
    AstVarDot,
    AstRegra,
    AstVaPara,
    AstLabel,
    AstKWCmd,
} from "./Types";

export class LSPParser {
    private token: LSPTokenStream;
    private prog_pos = 0;
    private PRECEDENCE = {
        "=": 1,
        // "||": 2,
        // "&&": 3,
        OU: 2,
        E: 3,
        "<": 7,
        ">": 7,
        "<=": 7,
        ">=": 7,
        // "==": 7,
        "!=": 7,
        "<>": 7,
        "+": 10,
        "-": 10,
        "*": 20,
        "/": 20,
        "%": 20,
    };

    constructor(input: string) {
        this.token = new LSPTokenStream(new InputStream(input));
    }

    private skip_empty() {
        if (!this.is_empty()) return;
        this.token.next();
        return this.skip_empty();
    }

    private is_empty() {
        var tok = this.token.peek();
        return tok && tok.type == "empty" && tok;
    }

    private handle_skip_if_true(ternario, skip_if_true) {
        if (ternario && skip_if_true) this.skip_empty();
        return ternario;
    }

    private is_comment() {
        var tok = this.token.peek();
        return tok && (tok.type == "comment/" || tok.type == "comment@") && tok;
    }

    private is_str(skip_if_true = true) {
        var tok;
        if (skip_if_true) tok = this.token.peek_nom_empty();
        else tok = this.token.peek();
        return this.handle_skip_if_true(
            tok && tok.type == "str" && tok,
            skip_if_true
        );
    }
    private is_punc(ch, skip_if_true = true) {
        var tok;
        if (skip_if_true) tok = this.token.peek_nom_empty();
        else tok = this.token.peek();
        return this.handle_skip_if_true(
            tok && tok.type == "punc" && (!ch || tok.value == ch) && tok,
            skip_if_true
        );
    }
    private is_kw(kw = undefined, skip_if_true = true) {
        var tok;
        if (skip_if_true) tok = this.token.peek_nom_empty();
        else tok = this.token.peek();
        return this.handle_skip_if_true(
            tok &&
                tok.type == "kw" &&
                (!kw || tok.value.toLowerCase() == kw.toLowerCase()) &&
                tok,
            skip_if_true
        );
    }
    private is_op(op = undefined, skip_if_true = true) {
        var tok;
        if (skip_if_true) tok = this.token.peek_nom_empty();
        else tok = this.token.peek();
        return this.handle_skip_if_true(
            tok && tok.type == "op" && (!op || tok.value == op) && tok,
            skip_if_true
        );
    }
    private is_var(vr = undefined, skip_if_true = true) {
        var tok;
        if (skip_if_true) tok = this.token.peek_nom_empty();
        else tok = this.token.peek();
        return this.handle_skip_if_true(
            tok && tok.type == "var" && (!vr || tok.value == vr) && tok,
            skip_if_true
        );
    }
    private is_var_type(vr = undefined, skip_if_true = true) {
        var tok;
        if (skip_if_true) tok = this.token.peek_nom_empty();
        else tok = this.token.peek();
        return this.handle_skip_if_true(
            tok && tok.type == "var_type" && (!vr || tok.value == vr) && tok,
            skip_if_true
        );
    }
    private is_fim(delimitador) {
        var tok = this.token.peek();
        return (
            tok && tok.value.toUpperCase() == delimitador.toUpperCase() && tok
        );
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

    private skip_var_type(kw, optional = false) {
        if (this.is_var_type(kw)) this.token.next();
        else if (!optional) this.token.croak('Esperando tipo: "' + kw + '"');
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
    private get_end_delimiter(start: undefined | string) {
        if (start && start.toUpperCase() == "INICIO") return "FIM";
        if (start && start.toUpperCase() == "{") return "}";
        return undefined;
    }
    private maybe_binary(left: Ast, my_prec): Ast {
        var tok = this.is_op() || this.is_kw("E") || this.is_kw("OU");
        if (tok) {
            var his_prec = this.PRECEDENCE[tok.value.toUpperCase()];
            if (his_prec > my_prec) {
                this.token.next();
                return this.maybe_binary(
                    {
                        type: tok.value == "=" ? "assign" : "binary",
                        operator: tok.value,
                        left: left,
                        right: this.maybe_binary(
                            this.maybe_var_dot(() => this.parse_atom()),
                            his_prec
                        ),
                    },
                    my_prec
                );
            }
        }
        if (this.is_op("++") || this.is_op("--")) {
            return {
                type: "unary",
                operator: this.token.next().value,
                left: left,
            };
        }
        return left;
    }

    private delimited<T>(start, stop, separator, parser: () => T): T[] {
        let a = [],
            first = true;

        this.skip_punc(start);

        while (!this.token.eof()) {
            if (this.is_punc(stop)) break;

            if (first) first = false;
            else this.skip_punc(separator);
            if (this.is_punc(stop)) break;
            a.push(parser());
        }
        if (this.is_punc(stop)) this.skip_punc(stop);
        return a;
    }
    private parse_call(func): AstCall {
        return {
            type: "call",
            func: func,
            args: this.delimited("(", ")", ",", () => this.parse_call_arg()),
        };
    }
    private parse_call_arg() {
        if (this.is_var_type()) return this.parse_var_type(this.token.next());
        return this.parse_expression();
    }
    private parse_cur_sql(func): AstCurSql {
        return {
            type: "cur_sql",
            func: func,
            sql: this.parse_string(this.token.next(), true),
        };
    }

    private parse_typing_var(): AstTypingVar {
        // * var_type
        let var_type;
        if (this.is_var_type()) {
            var_type = this.parse_var_type(<AstVarType>this.token.next());
        } else if (this.is_var()) {
            var_type = this.parse_expression();
        } else this.token.croak("Esperando tipo");

        let value;
        if (var_type.type == "var_type" && var_type.value == "funcao") {
            value = this.parse_funcao();
        } else if (
            var_type.type == "var_type" &&
            var_type.value == "tabela" &&
            this.is_var()
        ) {
            value = this.maybe_var_dot(() => <AstVal>this.token.next());
        } else if (this.is_var()) {
            value = this.parse_expression();
        } else this.token.croak("Esperando tipo");

        if (
            var_type.type == "var_type" &&
            var_type.value == "tabela" &&
            this.is_op("=")
        )
            this.skip_op("=");

        return {
            type: "typing_var",
            var_type: var_type,
            value: value,
        };
    }

    private parse_var_type(func): AstVarType {
        if (func.type != "var_type") this.token.croak("Esperando tipo");
        return {
            type: "var_type",
            value: func.value.toLowerCase(),
        };
    }

    private parse_var_dot(func): AstVarDot {
        let retorno: AstVarDot;
        if (func.type == "var_dot") {
            retorno = func;
        } else {
            retorno = {
                type: "var_dot",
                value: [func],
            };
        }
        if (this.is_punc("[")) {
            this.skip_punc("[");
            retorno.value.push({
                type: "bracket",
                value: this.parse_expression(),
            });
            this.skip_punc("]");
        } else if (this.is_punc(".")) {
            retorno.value.push({
                type: "dot",
            });
            this.skip_punc(".");
        } else if (this.is_var()) {
            retorno.value.push(<AstVal>this.token.next());
        } else if (this.is_var_type() || this.is_kw()) {
            // * Se é kw ou var_type, devolve forçando var
            retorno.value.push({ type: "var", value: this.token.next().value });
        } else {
            this.token.croak("Cadeia de caracteres invalida ");
        }
        return retorno;
    }
    private parse_definir(): AstDefinir {
        this.skip_kw("definir");

        return {
            type: "definir",
            value: this.parse_typing_var(),
        };
    }
    private parse_funcao(): AstFuncao {
        this.skip_var_type("funcao", true);

        if (!this.is_var()) this.token.croak("Esperado nome da funcao");
        let func = <AstVal>this.token.next();

        let args = this.delimited("(", ")", ",", () => this.parse_typing_var());

        return {
            type: "funcao",
            func: func,
            args: args,
        };
    }

    private parse_senao(): AstSenao {
        this.skip_kw("senao");
        return { type: "senao" };
    }

    private parse_se(): AstSe {
        this.skip_kw("se");
        var cond = this.parse_expression();

        let ret: AstSe = {
            type: "se",
            cond: cond,
        };
        return ret;
    }
    private parse_enquanto(): AstEnquanto {
        this.skip_kw("enquanto");
        var cond = this.parse_expression();

        let ret: AstEnquanto = {
            type: "enquanto",
            cond: cond,
        };
        return ret;
    }
    private parse_para(): AstPara {
        this.skip_kw("para");
        if (!this.is_punc("(")) this.token.croak("Esperando (");
        this.skip_punc("(");

        let valor_inicial = this.parse_expression();
        if (!this.is_punc(";")) this.token.croak("Esperando ;");
        this.skip_punc(";");

        let cond = this.parse_expression();
        if (!this.is_punc(";")) this.token.croak("Esperando ;");
        this.skip_punc(";");

        let contador = this.parse_expression();
        if (!this.is_punc(")")) this.token.croak("Esperando )");
        this.skip_punc(")");

        let ret: AstPara = {
            type: "para",
            valor_inicial: valor_inicial,
            cond: cond,
            contador: contador,
        };
        return ret;
    }

    private parse_regra(): AstRegra {
        this.skip_kw("regra");

        return {
            type: "regra",
            value: this.parse_expression(),
        };
    }

    private parse_va_para(): AstVaPara {
        this.skip_kw("vapara");

        return {
            type: "vapara",
            value: this.parse_expression(),
        };
    }

    private parse_kw_cmd(): AstKWCmd {
        return {
            type: "kw_cmd",
            value: this.token.next().value,
        };
    }

    private parse_bool(): AstVal {
        return {
            type: "bool",
            value: this.token.next().value == "true",
        };
    }
    private maybe_call<T>(expr: () => T): T | AstCall {
        let expr_ = expr();

        return this.is_punc("(") ? this.parse_call(expr_) : expr_;
    }
    private maybe_var_dot<T>(expr: () => T): T | AstVarDot {
        let expr_ = expr();
        let last_symbol = expr_;
        if (expr_["type"] == "var_dot")
            last_symbol = expr_["value"][expr_["value"].length - 1];

        if (
            last_symbol["type"] == "var" &&
            (this.is_punc("[") || this.is_punc("."))
        )
            return this.maybe_var_dot(() => this.parse_var_dot(expr_));

        if (
            last_symbol["type"] == "dot" &&
            (this.is_var() ||
                this.is_kw() ||
                this.is_var_type() ||
                this.is_punc("["))
        )
            return this.maybe_var_dot(() => this.parse_var_dot(expr_));

        if (
            last_symbol["type"] == "bracket" &&
            (this.is_var() ||
                this.is_kw() ||
                this.is_var_type() ||
                this.is_punc("."))
        )
            return this.maybe_var_dot(() => this.parse_var_dot(expr_));

        return expr_;
    }
    private maybe_comando_composto<T>(
        expr: () => T
    ): T | AstCurSql | AstTypingVar | AstLabel {
        let expr_ = expr();
        // * Cur Sql
        if (
            expr_["type"] == "var_dot" &&
            expr_["value"].length > 1 &&
            expr_["value"][expr_["value"].length - 2].type == "dot" &&
            String(
                expr_["value"][expr_["value"].length - 1].value
            ).toLowerCase() == "sql" &&
            this.is_str()
        ) {
            return this.parse_cur_sql(expr_);
        }
        if (expr_["type"] == "var" && this.is_punc(":"))
            return this.parse_label(expr_);

        return expr_;
    }
    private parse_execsql(): AstExecSql {
        this.skip_kw("execsql");
        if (!this.is_str()) this.token.croak("Esperado string");

        return {
            type: "execsql",
            sql: this.parse_string(this.token.next(), true),
        };
    }

    private parse_label(expr_): AstLabel {
        this.skip_punc(":");

        return {
            type: "label",
            value: expr_,
        };
    }

    private parse_atom(): Ast {
        return this.maybe_call(() => {
            if (this.is_punc("(")) {
                this.token.next();
                var exp = this.parse_expression();
                exp["parenteses"] = true;
                this.skip_punc(")");
                return exp;
            }
            if (this.is_punc("{")) return this.parse_prog("{");
            if (this.is_kw("inicio")) return this.parse_prog("inicio");
            if (this.is_kw("definir")) return this.parse_definir();
            if (this.is_kw("se")) return this.parse_se();
            if (this.is_kw("senao")) return this.parse_senao();
            if (this.is_kw("enquanto")) return this.parse_enquanto();
            if (this.is_kw("para")) return this.parse_para();
            if (this.is_kw("execsql")) return this.parse_execsql();
            if (this.is_kw("regra")) return this.parse_regra();
            if (this.is_kw("vapara")) return this.parse_va_para();
            if (this.is_kw("pare") || this.is_kw("continue"))
                return this.parse_kw_cmd();

            if (this.is_kw("true") || this.is_kw("false"))
                return this.parse_bool();
            if (this.is_var_type()) return this.parse_typing_var();
            if (this.is_op("-")) {
                this.token.next();
                let retorno = this.parse_atom();
                retorno["minus"] = true;
                return retorno;
            }

            var tok = this.token.next();
            if (tok.type == "str") return this.parse_string(tok);
            if (tok.type == "var" || tok.type == "num") return <AstVal>tok;
            if (tok.type == "comment@" || tok.type == "comment/")
                return <AstComment>tok;
            if (tok.type == "empty") return this.parse_atom();
            this.unexpected(tok);
        });
    }
    private optional_semicolon(tok) {
        return (
            [
                "empty",
                "comment@",
                "comment/",
                "se",
                "senao",
                "enquanto",
                "para",
                "prog",
                "label",
            ].includes(tok.type) ||
            (tok.type == "definir" &&
                tok.value.var_type.type == "var_type" &&
                tok.value.var_type.value == "tabela") ||
            (tok.type == "call" && tok.func.type == "var_dot")
        );
    }
    private command_comma(prog: Ast[]) {
        let optional_semicolon = this.optional_semicolon(prog[prog.length - 1]);

        if (this.token.eof()) {
            if (!optional_semicolon)
                this.token.croak("Esperando ponto e virgula");
        } else {
            if (this.is_punc(";", false)) this.skip_punc(";");
            else if (!optional_semicolon && this.is_punc(";", true))
                this.skip_punc(";");
            else if (!optional_semicolon)
                this.token.croak("Esperando ponto e virgula");
        }
    }
    parse_toplevel(end_delimiter = undefined): AstProg {
        var prog: Ast[] = [];
        while (
            (!end_delimiter && !this.token.eof()) ||
            (end_delimiter && !this.is_fim(end_delimiter))
        ) {
            prog.push(this.parse_empty_first());

            // * Pula ponto e virgula do comando se necessario
            this.command_comma(prog);
        }

        this.prog_pos = 0;
        prog = this.ajustar_prog(prog);

        return { type: "prog", prog: prog };
    }

    private parse_prog(delimiter = undefined): AstProg {
        delimiter = delimiter ? delimiter.toUpperCase() : delimiter;

        let start = delimiter;
        let stop = this.get_end_delimiter(start);

        if (this.is_punc(start)) this.skip_punc(start);
        else if (this.is_kw(start)) this.skip_kw(start);

        let prog = this.parse_toplevel(stop);
        prog.delimitador = delimiter;

        if (this.is_punc(stop, false)) this.skip_punc(stop);
        else if (this.is_kw(stop, false)) this.skip_kw(stop);

        if (stop.toUpperCase() == "END" && this.is_punc(";", false))
            this.skip_punc(";");

        return prog;
    }
    private parse_expression(): Ast {
        return this.maybe_comando_composto(() => {
            return this.maybe_call(() => {
                return this.maybe_binary(
                    this.maybe_var_dot(() => this.parse_atom()),
                    0
                );
            });
        });
    }

    private parse_empty_first(): Ast {
        if (this.is_empty()) return <AstEmpty>this.token.next();
        if (this.is_comment()) return <AstComment>this.token.next();
        return this.parse_expression();
    }

    /* Abaixo pra ajustar os prog de um comando */
    private ajustar_prog(prog: Ast[]) {
        let retorno: Ast[] = [];
        while (this.prog_pos < prog.length) {
            /* Current Ast */
            let ast = prog[this.prog_pos];

            if (
                ast.type == "empty" ||
                ast.type == "comment/" ||
                ast.type == "comment@"
            ) {
                retorno.push(ast);
                this.prog_pos++;
                continue;
            }

            if (ast.type == "se") {
                retorno.push(...this.handle_se(prog));
                continue;
            } else if (ast.type == "enquanto") {
                retorno.push(...this.handle_loop(prog));
                continue;
            } else if (ast.type == "para") {
                retorno.push(...this.handle_loop(prog));
                continue;
            } else {
                retorno.push(ast);
                this.prog_pos++;
                continue;
            }
        }
        return retorno;
    }

    private handle_se(prog: Ast[]) {
        let body = false;
        let senao = false;
        let senao_body = false;

        let retorno = [];

        let ast_se = prog[this.prog_pos];

        retorno.push(ast_se);
        this.prog_pos++;

        while (this.prog_pos < prog.length) {
            /* Current Ast */
            let ast = prog[this.prog_pos];

            if (
                ast.type == "empty" ||
                ast.type == "comment/" ||
                ast.type == "comment@"
            ) {
                retorno.push(ast);
                this.prog_pos++;
                continue;
            }

            /* Proximo comando é o body */
            if (!body) {
                retorno.push(this.to_prog(prog));
                body = true;
                continue;
            } else if (!senao) {
                if (ast.type == "senao") {
                    senao = true;
                    ast_se["tem_senao"] = true;
                    retorno.push(ast);
                    this.prog_pos++;
                } else {
                    break;
                }
            } else if (!senao_body) {
                senao_body = true;
                retorno.push(this.to_prog(prog));
                break;
            }
        }
        return retorno;
    }

    private handle_loop(prog: Ast[]) {
        let retorno = [];

        retorno.push(prog[this.prog_pos]);
        this.prog_pos++;

        while (this.prog_pos < prog.length) {
            /* Current Ast */
            let ast = prog[this.prog_pos];

            if (
                ast.type == "empty" ||
                ast.type == "comment/" ||
                ast.type == "comment@"
            ) {
                retorno.push(ast);
                this.prog_pos++;
                continue;
            }

            /* Proximo comando é o body */

            retorno.push(this.to_prog(prog));
            break;
        }
        return retorno;
    }

    private to_prog(prog: Ast[]): Ast {
        let ast = prog[this.prog_pos];
        if (ast.type == "prog") {
            this.prog_pos++;
            return ast;
        } else if (ast.type == "se") {
            return {
                type: "prog",
                prog: [...this.handle_se(prog)],
            };
        } else {
            this.prog_pos++;
            return { type: "prog", prog: [ast] };
        }
    }

    temp_global_strings = [];
    temp_get_strings() {
        this.parse_toplevel();
        return this.temp_global_strings;
    }
    // * Abaixo apenas para dar parse em strings
    private parse_string(tok: LSPToken, is_sql = false): AstVal {
        let value = this.remove_string_linebreaks(tok.value);
        let sql: boolean = false;
        if (is_sql) {
            this.temp_global_strings.push(value);
            try {
                let parser = new PSQLParser(value);
                let retorno = parser.parse();
                let retorno_unparsed = PSQLParser.unparse(retorno);
                conferir_divergencias(value, retorno_unparsed);
                value = retorno_unparsed;
                sql = true;
            } catch {}
        }

        return {
            type: "str",
            value: value,
            delimiter: tok.delimiter,
            sql: sql,
        };
    }

    private remove_string_linebreaks(value: string) {
        let retorno = value;
        retorno = retorno.replace(/\r\n/g, "\n");

        if (retorno.indexOf("\n") >= 0) {
            retorno = retorno.replace(/\\\s*$/gm, "");
        }
        return retorno;
    }

}
