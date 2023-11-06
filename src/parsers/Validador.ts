import { InputStream } from "./InputStream";

export interface Position {
    line: number;
    character: number;
}

var parenteses = 0;
var escaped = "";
var parsed_position: Position = undefined;

/* Confere divergencias, se tiver sucesso retorna a nova posição do cursor */
export function conferir_divergencias(
    text,
    formated,
    ori_position: Position = undefined
) {
    let tori = new InputStream(text);
    let tprs = new InputStream(formated);

    parenteses = 0;
    escaped = "";
    parsed_position = undefined;
    if (ori_position) parsed_position = { line: -1, character: -1 };

    tori.first_nom_empty();
    tprs.first_nom_empty();

    while (!tori.eof() && !tprs.eof()) {
        validar_char(tori, tprs, ori_position);
        tori.next_nom_empty();
        tprs.next_nom_empty();

        /* Ignora \\ em strings */
        while (escaped == '"' && tori.peek() == "\\") {
            tori.next_nom_empty();
        }
        while (escaped == '"' && tprs.peek() == "\\") {
            tprs.next_nom_empty();
        }
    }

    validar_eof(tori, tprs, ori_position);
    return parsed_position;
}

function validar_char(
    tori: InputStream,
    tprs: InputStream,
    ori_position: Position = undefined
) {
    tratar_selection(tori, tprs, ori_position);
    validar_parenteses(tori, tprs);

    if (
        String(tori.peek()).toUpperCase() != String(tprs.peek()).toUpperCase()
    ) {
        /* Verifica se é um fim sem ; */
        if (checkar_ponto_e_virgula_diff(tori, tprs)) {
            /* Diff por falta do ponto e virgula, avançar o tprs e comparar */
            tprs.next_nom_empty();
            return validar_char(tori, tprs);
        } else if (checkar_string_diff(tori, tprs)) {
            tprs.next_nom_empty();
            return validar_char(tori, tprs);
        } else {
            return erro(tori, tprs, "Divergencia");
        }
    }

    if (escaped == "@" && tori.peek() == "@") escaped = "";
    else if (escaped == "/*" && tori.peek() == "*" && tori.peek_plus() == "/")
        escaped = "";
    else if (escaped == '"' && tori.peek() == '"') escaped = "";
    else if (escaped == "") {
        if (tori.peek() == '"') escaped = '"';
        else if (tori.peek() == "@") escaped = "@";
        else if (tori.peek() == "/" && tori.peek_plus() == "*") escaped = "/*";
    }
    return true;
}

function checkar_ponto_e_virgula_diff(tori: InputStream, tprs: InputStream) {
    if (
        tprs.peek() == ";" &&
        tori.peek_back(3) &&
        tori.peek_back(3).toLowerCase() == "f" &&
        tori.peek_back(2).toLowerCase() == "i" &&
        tori.peek_back(1).toLowerCase() == "m"
    )
        return true;
    else if (get_last_n_digits(tori, 14).toLowerCase() == ".abrircursor()")
        return true;
    else return false;
}

function checkar_string_diff(tori: InputStream, tprs: InputStream) {
    if (tprs.peek() == "\\" && escaped == '"') return true;
    else return false;
}

function get_last_n_digits(input: InputStream, qtd: number) {
    let retorno = "";
    for (let i = 1; i <= qtd; i++) {
        let ch = input.peek_back(i);
        if (ch == null) break;
        retorno = ch + retorno;
    }
    return retorno;
}

function validar_parenteses(tori: InputStream, tprs: InputStream) {
    if (escaped != "") return;
    if (tori.peek() == "(" && tprs.peek() != "(") {
        parenteses += 1;
        tori.next_nom_empty();
        return validar_parenteses(tori, tprs);
    }
    if (tori.peek() == ")" && parenteses > 0) {
        parenteses -= 1;
        tori.next_nom_empty();
        return validar_parenteses(tori, tprs);
    }
}

function validar_eof(
    tori: InputStream,
    tprs: InputStream,
    ori_position: Position = undefined
) {
    if (tori.eof() != tprs.eof()) {
        /* Verifica se é o caso de um ponto e virgula no final */
        if (tprs.peek() == ";" && tori.eof()) {
            tprs.next_nom_empty();
            return validar_eof(tori, tprs);
        }
        erro(tori, tprs, "Um arquivo terminou antes do outro");
    }
    tratar_selection(tori, tprs, ori_position);
}

function tratar_selection(
    tori: InputStream,
    tprs: InputStream,
    ori_position: Position = undefined
) {
    if (!ori_position) return;

    /* Ainda não achou o inicio da seleção */
    if (parsed_position.line == -1) {
        if (
            (tori.line == ori_position.line + 1 &&
                tori.col >= ori_position.character) ||
            tori.line > ori_position.line + 1 ||
            tori.eof()
        ) {
            parsed_position.line = tprs.line - 1;
            parsed_position.character = tprs.col;
        }
    }
}

function erro(tori: InputStream, tprs: InputStream, mensagem: string) {
    let ch = "";
    if (!tori.eof()) ch = tori.peek();
    tori.croak(mensagem + ' | Erro no caractere "' + ch + '"');
}
