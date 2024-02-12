import {
    Ast,
    AstAssign,
    AstBin,
    AstBracket,
    AstCall,
    AstComment,
    AstCurSql,
    AstDefinir,
    AstDot,
    AstEnquanto,
    AstExecSql,
    AstFuncao,
    AstKWCmd,
    AstLabel,
    AstPara,
    AstProg,
    AstRegra,
    AstSe,
    AstSenao,
    AstTypingVar,
    AstUnary,
    AstVaPara,
    AstVal,
    AstVarDot,
    AstVarType,
} from "./Types";

class CurrentProg {
    prog: any[] = [];
    temDelimitador: boolean = false;
    parentRef: CurrentProg | undefined;
    constructor(parentRef: CurrentProg, delimitador?: string) {
        this.parentRef = parentRef;
        if (
            delimitador &&
            (delimitador?.toUpperCase() == "INICIO" || delimitador == "{")
        ) {
            this.temDelimitador = true;
        }
    }
}

const MIN_STR_LINE_SIZE = 100;

var breakline_count = 0;
var tab_level = 0;
var root_prog = true;
var eol_char: "\n" | "\r\n";
var next_sql_spaces = 0;
var global_tabsize = 0;

function get_delimitadores(delimitador: string): { ini: string; fim: string } {
    let ini = "";
    let fim = "";
    if (delimitador) {
        if (delimitador == "{") {
            ini = "{";
            fim = "}";
        }
        if (delimitador.toUpperCase() == "INICIO") {
            ini = "Inicio";
            fim = "Fim;";
        }
        fim = eol_char + get_tab() + fim;
    }

    return { ini, fim };
}

function prog_semicolon(ast: Ast, current_prog: CurrentProg | undefined) {
    if (!ast || !ast.type) return "";
    else if (ast.type == "comment/") return "";
    else if (ast.type == "comment@") return "";
    else if (ast.type == "empty") return "";
    else if (ast.type == "se") return "";
    else if (ast.type == "senao") return "";
    else if (ast.type == "enquanto") return "";
    else if (ast.type == "para") return "";
    else if (ast.type == "funcao") return "";
    else if (ast.type == "label") return "";
    else if (
        ast.type == "definir" &&
        ast.value.var_type.type == "var_type" &&
        ast.value.var_type.value.toLowerCase() == "tabela"
    )
        return " =";
    else {
        let last_comando = last_ast(current_prog?.prog, true);
        if (
            ast.type == "prog" &&
            ast.delimitador == "{" &&
            current_prog.prog.length &&
            last_comando?.type == "definir" &&
            last_comando?.value?.var_type?.type == "var_type" &&
            last_comando?.value?.var_type?.value == "tabela"
        )
            return ";";
        else if (ast.type == "prog") return "";
        else return ";";
    }
}

function get_tab(
    ast: Ast = undefined,
    current_prog: CurrentProg | undefined = undefined
) {
    return "\t".repeat(tab_level);
}

function check_senao_se(ast: Ast, current_prog: CurrentProg | undefined) {
    if (
        ast.type == "se" &&
        current_prog &&
        current_prog.prog.length == 0 &&
        !current_prog.temDelimitador &&
        current_prog.parentRef
    ) {
        let last_parent_cmd = last_ast(current_prog.parentRef.prog, false, 0);
        if (last_parent_cmd && last_parent_cmd.type == "senao") return true;
    }
    return false;
}

function get_breakline(ast: Ast, current_prog: CurrentProg | undefined) {
    let current_breakline_count = breakline_count;
    // * se for vazio continua incrementando a contagem de quebras até o proximo comando
    if (ast.type == "empty") {
        breakline_count += String(ast.value).split("\n").length - 1;
        return "";
    } else breakline_count = 0;

    // * Se não é um comando dentro de um prog
    if (!Boolean(current_prog)) return "";
    else {
        /* Abaixo se supõe que é um comando em um prog */

        //* Verifica se é um SE logo apos um SENAO
        if (check_senao_se(ast, current_prog)) {
            return "";
        }

        // * o primeiro comando de um prog
        if (!current_prog.prog.length) return eol_char;

        // * Comment não quebra linha obrigatoriamente,
        if (
            ["comment/", "comment@"].includes(ast.type) &&
            !current_breakline_count
        )
            return " ";

        // * Senao sempre quebra a linha
        if (ast.type == "senao") return eol_char;

        // * Prog com delimitador sempre quebra a linha
        if (ast.type == "prog" && ast.delimitador) return eol_char;

        // * Prog sem delimitador não quebra a linha
        if (ast.type == "prog") return "";

        let ultimo_comando = last_ast(current_prog.prog, true);

        // * Se o comando imediatamente acima é um destes, quebra a linha apenas
        if (["se", "senao", "enquanto", "para"].includes(ultimo_comando?.type))
            return eol_char;

        /* Se o comando acima for uma função, quebra a linha apenas */
        if (
            ultimo_comando?.type == "typing_var" &&
            ultimo_comando?.var_type?.type == "var_type" &&
            ultimo_comando?.var_type?.value == "funcao"
        )
            return eol_char;

        // aguardando um senão
        let penultimo_comando = last_ast(current_prog.prog, true, 1);
        if (penultimo_comando?.type == "se" && penultimo_comando?.tem_senao)
            return eol_char;

        if (current_breakline_count >= 2) return eol_char.repeat(2);

        /* Se é um assign na mesma linha de uma definição mantem na mesma linhas */
        if (
            ast.type == "assign" &&
            last_ast(current_prog.prog, false)?.type == "definir" &&
            current_breakline_count == 0
        )
            return " ";

        return eol_char;
    }
}

function capitalize(val: string) {
    if (!val || !val.length) return val;
    return val.charAt(0).toUpperCase() + val.slice(1);
}

function last_ast(val: Ast[], ignora_comentario, index_anterior = 0) {
    if (!val) return null;
    if (!val.length) return null;

    let match_count = 0;
    return val
        .slice()
        .reverse()
        .find((current) => {
            if (
                !ignora_comentario ||
                (current.type != "comment/" && current.type != "comment@")
            )
                if (match_count < index_anterior) {
                    match_count += 1;
                } else return true;
        });
}

function unp_prog(ast: AstProg, parent_prog: CurrentProg | undefined): string {
    let current_prog = new CurrentProg(parent_prog, ast.delimitador);
    let increase_tab = true;

    if (root_prog) {
        increase_tab = false;
        root_prog = false;
    } else if (
        ast.prog.length > 0 &&
        check_senao_se(ast.prog[0], current_prog)
    ) {
        increase_tab = false;
    }

    let { ini, fim } = get_delimitadores(ast.delimitador);
    if (increase_tab) tab_level += 1;
    let body = "";
    for (let current of ast.prog) {
        body +=
            unparse(current, current_prog) +
            prog_semicolon(current, current_prog);
        if (current.type != "empty") current_prog.prog.push(current);
    }
    if (increase_tab) tab_level -= 1;
    breakline_count = 0;
    let retorno = ini + body + fim;

    return retorno;
}

function unp_assign(ast: AstAssign): string {
    return unparse(ast.left) + " " + ast.operator + " " + unparse(ast.right);
}

function unp_binary(ast: AstBin): string {
    return unparse(ast.left) + " " + ast.operator + " " + unparse(ast.right);
}

function unp_unary(ast: AstUnary): string {
    return unparse(ast.left) + ast.operator;
}

function unp_comment(ast: AstComment): string {
    if (ast.type == "comment@") return "@" + ast.value + "@";
    else return "/" + ast.value + "/";
}

function unp_se(ast: AstSe): string {
    let retorno = "Se" + unparse(ast.cond) + "";
    return retorno;
}
function unp_senao(ast: AstSenao): string {
    let retorno = "Senao ";
    return retorno;
}

function unp_enquanto(ast: AstEnquanto): string {
    let retorno = "Enquanto" + unparse(ast.cond);
    return retorno;
}

function unp_para(ast: AstPara): string {
    let retorno =
        "Para(" +
        unparse(ast.valor_inicial) +
        "; " +
        unparse(ast.cond) +
        "; " +
        unparse(ast.contador) +
        ") ";
    return retorno;
}

function unp_call(ast: AstCall): string {
    let retorno = unparse(ast.func);
    if (ast.func.type == "var" && ast.func.value.toLowerCase() == "execsqlex") {
        next_sql_spaces = retorno.length + 2;
    }
    retorno += "(";
    retorno += ast.args.map((v) => unparse(v)).join(", ");
    retorno += ")";
    return retorno;
}

function unp_definir(ast: AstDefinir) {
    return "Definir " + unparse(ast.value);
}

function unp_vapara(ast: AstVaPara) {
    return "VaPara " + " " + unparse(ast.value);
}

function unp_label(ast: AstLabel) {
    return unparse(ast.value) + ":";
}

function unp_typing_var(ast: AstTypingVar) {
    return unparse(ast.var_type) + " " + unparse(ast.value);
}

function unp_cursql(ast: AstCurSql) {
    let cursql = unparse(ast.func);
    next_sql_spaces = cursql.length + 2;
    return cursql + " " + unparse(ast.sql);
}

function unp_execsql(ast: AstExecSql) {
    next_sql_spaces = "ExecSql".length + 2;
    return "ExecSql " + unparse(ast.sql);
}

function unp_regra(ast: AstRegra) {
    return "Regra " + unparse(ast.value);
}

function unp_funcao(ast: AstFuncao) {
    return (
        unparse(ast.func) +
        "(" +
        ast.args.map((a) => unp_typing_var(a)).join(", ") +
        ")"
    );
}

function unp_val(ast: AstVal) {
    return (ast.minus ? "-" : "") + String(ast.value);
}

function unp_str(ast: AstVal) {
    let conteudo = ast.value;
    let command_length = 0;
    if (ast?.sql) {
        command_length = next_sql_spaces;
        next_sql_spaces = 0;
    }
    conteudo = unp_str_multiline(conteudo, ast?.sql, command_length);
    conteudo = eol_char == "\r\n" ? conteudo.replace(/\n/g, "\r\n") : conteudo;
    return ast.delimiter + conteudo + ast.delimiter;
}

function unp_str_multiline(value: string, is_sql, command_length: number) {
    let retorno = value;

    // substituo as quebras
    retorno = retorno.replace(/\r\n/g, "\n");

    // substituo os tabs por espaços
    retorno = retorno.replace(/\t/gm, " ".repeat(global_tabsize));

    if (is_sql) {
        // * caso seja SQL, Removo os caracteres vazios dos finais das linhas
        retorno = retorno
            .split("\n")
            .map(
                (linha) =>
                    " ".repeat(command_length + tab_level * global_tabsize) +
                    linha.replace(/\s*$/gm, "")
            )
            .join("\n");
    }

    if (retorno.indexOf("\n") >= 0) {
        /* adiciona temporariamente ps espaços do command_length */

        const linhas = retorno.split("\n");

        /* maior linha  */
        let max_length = linhas.reduce(
            (prev, current) => (current.length > prev ? current.length : prev),
            0
        );

        if (max_length < MIN_STR_LINE_SIZE) max_length = MIN_STR_LINE_SIZE;

        /* pega o menor multiplo do global_tab_size */
        max_length = Math.ceil(max_length / global_tabsize) * global_tabsize;

        /* preenche com espaços o necessario para ficarem do mesmo tamanho */
        retorno = linhas
            .map((linha, index) => {
                /* ultima linha não participa */
                if (index == linhas.length - 1) return linha;
                return linha + " ".repeat(max_length - linha.length) + "\\";
            })
            .join("\n");
    }

    if (is_sql)
        retorno = retorno.substring(
            command_length + tab_level * global_tabsize
        );

    return retorno;
}

function unp_var_dot(ast: AstVarDot) {
    return ast.value.reduce((prev, val) => prev + unparse(val), "");
}

function unp_dot(ast: AstDot) {
    return ".";
}

function unp_bracket(ast: AstBracket) {
    return "[" + unparse(ast.value) + "]";
}

function unp_var_type(ast: AstVarType) {
    return capitalize(ast.value);
}

function unp_kw_cmd(ast: AstKWCmd) {
    return capitalize(ast.value.toLowerCase());
}

function unp_parenteses(ast: Ast, current_prog: CurrentProg | undefined) {
    return "(" + unparse(ast, current_prog) + ")";
}

function unparse(
    ast: Ast,
    current_prog: CurrentProg | undefined = undefined
): string {
    let breakline = get_breakline(ast, current_prog);
    let tab = "";
    if (breakline.indexOf(eol_char) > -1) tab = get_tab(ast, current_prog);
    return breakline + tab + unparse_ast(ast, current_prog);
}

function unparse_ast(ast: Ast, current_prog: CurrentProg | undefined): string {
    if (ast["parenteses"] == true) {
        ast["parenteses"] = undefined;
        return unp_parenteses(ast, current_prog);
    }

    if (ast.type == "prog") return unp_prog(ast, current_prog);
    else if (ast.type == "assign") return unp_assign(ast);
    else if (ast.type == "binary") return unp_binary(ast);
    else if (ast.type == "unary") return unp_unary(ast);
    else if (ast.type == "comment/" || ast.type == "comment@")
        return unp_comment(ast);
    else if (ast.type == "se") return unp_se(ast);
    else if (ast.type == "senao") return unp_senao(ast);
    else if (ast.type == "enquanto") return unp_enquanto(ast);
    else if (ast.type == "para") return unp_para(ast);
    else if (ast.type == "call") return unp_call(ast);
    else if (ast.type == "vapara") return unp_vapara(ast);
    else if (ast.type == "label") return unp_label(ast);
    else if (ast.type == "definir") return unp_definir(ast);
    else if (ast.type == "typing_var") return unp_typing_var(ast);
    else if (ast.type == "funcao") return unp_funcao(ast);
    else if (ast.type == "cur_sql") return unp_cursql(ast);
    else if (ast.type == "execsql") return unp_execsql(ast);
    else if (ast.type == "regra") return unp_regra(ast);
    else if (ast.type == "str") return unp_str(ast);
    else if (ast.type == "var" || ast.type == "num") return unp_val(ast);
    else if (ast.type == "var_dot") return unp_var_dot(ast);
    else if (ast.type == "dot") return unp_dot(ast);
    else if (ast.type == "bracket") return unp_bracket(ast);
    else if (ast.type == "var_type") return unp_var_type(ast);
    else if (ast.type == "kw_cmd") return unp_kw_cmd(ast);
    else if (ast.type == "empty") return "";
    else throw new Error(" (" + ast.type + ")");
}

export function unparse_global(ast: Ast, eol: "\n" | "\r\n", tabsize) {
    tab_level = 0;
    breakline_count = 0;
    root_prog = true;
    eol_char = eol;
    next_sql_spaces = 0;
    global_tabsize = tabsize;

    let retorno = unparse(ast, new CurrentProg(undefined));

    while (
        retorno.startsWith("\r\n") ||
        retorno[0] == "\n" ||
        retorno[0] == " "
    ) {
        if (retorno.startsWith("\r\n")) retorno = retorno.substring(2);
        else retorno = retorno.substring(1);
    }
    return retorno;
}
