import { InputStream } from "../InputStream";

// { type: "punc", value: "(" }           // punctuation: parens, comma, semicolon etc.
// { type: "num", value: 5 }              // numbers
// { type: "str", value: "Hello World!" } // strings
// { type: "kw", value: "lambda" }        // keywords
// { type: "var", value: "a" }            // identifiers
// { type: "op", value: "!=" }            // operators

// Custom
// { type: "comment@", value: "*** comentario x *** }
// { type: "comment/", value: "*** comentario x *** }
// { type: "empty", value: "     " }


type LSPTokenType =
    | "punc"
    | "num"
    | "str"
    | "kw"
    | "var_type"
    | "var"
    | "op"
    | "empty"
    | "comment@"
    | "comment/";

export interface LSPToken {
    type: LSPTokenType;
    value: any;
    delimiter?: '"' | "'";
}

export class LSPTokenStream {
    static var_types = " numero alfa data cursor grid tabela lista funcao ";
    static keywords: string =
    LSPTokenStream.var_types +
        " se senao enquanto para e ou definir inicio fim execsql continue pare regra vapara ";

    current: LSPToken = null;
    input: InputStream;

    constructor(input: InputStream) {
        this.input = input;
    }

    static is_keyword(x) {
        return (
            LSPTokenStream.keywords
                .toLowerCase()
                .indexOf(" " + x.toLowerCase() + " ") >= 0
        );
    }
    static is_var_type(x) {
        return (
            LSPTokenStream.var_types
                .toLowerCase()
                .indexOf(" " + x.toLowerCase() + " ") >= 0
        );
    }
    static is_digit(ch) {
        return /[0-9]/i.test(ch);
    }
    static is_id_start(ch) {
        return /[a-zλ_áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]/i.test(ch);
    }
    static is_id(ch) {
        return LSPTokenStream.is_id_start(ch) || "0123456789".indexOf(ch) >= 0;
    }
    static is_op_char(ch) {
        return "+-*/%=<>!".indexOf(ch) >= 0;
    }
    static is_punc(ch) {
        // return ",;(){}[]".indexOf(ch) >= 0;
        return ",;:(){}.[]".indexOf(ch) >= 0;
    }
    static is_whitespace(ch) {
        return " \t\n\r".indexOf(ch) >= 0;
    }
    read_while(predicate) {
        let str = "";
        while (!this.input.eof() && predicate(this.input.peek()))
            str += this.input.next();
        return str;
    }
    read_number(): LSPToken {
        let has_dot = false;
        let number = this.read_while(function (ch) {
            if (ch == ".") {
                if (has_dot) return false;
                has_dot = true;
                return true;
            }
            return LSPTokenStream.is_digit(ch);
        });
        return { type: "num", value: number };
    }
    read_ident(): LSPToken {
        let id = this.read_while(LSPTokenStream.is_id);
        if (LSPTokenStream.is_var_type(id))
            return {
                type: "var_type",
                value: id,
            };

        if (LSPTokenStream.is_keyword(id))
            return {
                type: "kw",
                value: id,
            };

        return {
            type: "var",
            value: id,
        };
    }
    read_escaped(end) {
        let escaped = false;
        let str = "";
        this.input.next();
        while (!this.input.eof()) {
            let ch = this.input.next();
            if (escaped) {
                str += ch;
                escaped = false;
            } else if (ch == "\\") {
                str += ch;
                escaped = true;
            } else if (ch == end) {
                break;
            } else {
                str += ch;
            }
        }
        return str;
    }
    read_comment_char(comment_char) {
        let asteristico = false;
        let str = "";
        this.input.next();
        while (!this.input.eof()) {
            let ch = this.input.next();
            if (comment_char == "@" && ch == "@") {
                break;
            } else if (comment_char == "/*" && asteristico && ch == "/") {
                break;
            } else {
                str += ch;
            }
            if (ch == "*") {
                asteristico = true;
            } else {
                asteristico = false;
            }
        }
        return str;
    }
    read_string(escape_symbol): LSPToken {
        return {
            type: "str",
            value: this.read_escaped(escape_symbol),
            delimiter: escape_symbol,
        };
    }

    read_comment(comment_char): LSPToken {
        return {
            type: comment_char == "@" ? "comment@" : "comment/",
            value: this.read_comment_char(comment_char),
        };
    }

    read_empty(): LSPToken {
        return {
            type: "empty",
            value: this.read_while(LSPTokenStream.is_whitespace),
        };
    }

    read_next(): LSPToken {
        let ch = this.input.peek();

        if (this.input.eof()) return null;

        if (LSPTokenStream.is_whitespace(ch)) return this.read_empty();

        if (ch == "@") return this.read_comment("@");
        if (ch == "/" && this.input.peek_plus() == "*")
            return this.read_comment("/*");
        if (ch == '"') return this.read_string('"');
        if (ch == "'") return this.read_string("'");
        if (LSPTokenStream.is_digit(ch)) return this.read_number();
        if (LSPTokenStream.is_id_start(ch)) return this.read_ident();
        if (LSPTokenStream.is_punc(ch))
            return {
                type: "punc",
                value: this.input.next(),
            };
        if (LSPTokenStream.is_op_char(ch))
            return {
                type: "op",
                value: this.read_while(LSPTokenStream.is_op_char),
            };
        this.input.croak("Não foi possivel lidar com o char: " + ch);
    }
    peek() {
        return this.current || (this.current = this.read_next());
    }
    next() {
        let tok = this.current;
        this.current = null;
        return tok || this.read_next();
    }
    eof() {
        return this.peek() == null;
    }

    croak(msg) {
        return this.input.croak(msg);
    }

    peek_nom_empty() {
        let current = this.current;
        let col = this.input.col;
        let pos = this.input.pos;
        let line = this.input.line;

        let tok = this.peek();

        while (!this.input.eof() && tok.type == "empty") {
            tok = this.next();
            if (this.input.eof()) tok = null;
        }

        this.input.col = col;
        this.input.pos = pos;
        this.input.line = line;
        this.current = current;
        return tok;
    }
}
