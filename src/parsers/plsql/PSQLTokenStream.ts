import { InputStream } from "../InputStream";

type PSQLTokenType = "punc" | "num" | "str" | "kw" | "var" | "op" | "comment";

export interface PSQLToken {
    type: PSQLTokenType;
    value: any;
    delimiter?: '"' | "'";
}

export class PSQLTokenStream {
    static keywords: string =
        " select from where group order by inner left right cross join outer on union all insert into values update set delete" +
        " and or in is as like between listagg within over not exists case when then else end asc desc having nulls first last" +
        " distinct ";

    current: PSQLToken = null;
    input: InputStream;

    constructor(input: InputStream) {
        this.input = input;
    }

    static is_keyword(x) {
        return (
            PSQLTokenStream.keywords
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
        return PSQLTokenStream.is_id_start(ch) || "0123456789".indexOf(ch) >= 0;
    }
    static is_op_char(ch) {
        return "+-*/%=<>!|".indexOf(ch) >= 0;
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
    read_number(): PSQLToken {
        let has_dot = false;
        let number = this.read_while(function (ch) {
            if (ch == ".") {
                if (has_dot) return false;
                has_dot = true;
                return true;
            }
            return PSQLTokenStream.is_digit(ch);
        });
        return { type: "num", value: number };
    }
    read_ident(): PSQLToken {
        let id = this.read_while(PSQLTokenStream.is_id);

        if (PSQLTokenStream.is_keyword(id))
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
    read_string(escape_symbol): PSQLToken {
        return {
            type: "str",
            value: this.read_escaped(escape_symbol),
            delimiter: escape_symbol,
        };
    }

    read_comment(comment_char): PSQLToken {
        return {
            type: "comment",
            value: this.read_comment_char(comment_char),
        };
    }

    read_empty() {
        return this.read_while(PSQLTokenStream.is_whitespace);
    }

    read_next(): PSQLToken {
        this.read_empty();
        if (this.input.eof()) return null;
        let ch = this.input.peek();

        if (ch == "@") return this.read_comment("@");
        if (ch == "/" && this.input.peek_plus() == "*")
            return this.read_comment("/*");
        if (ch == '"') return this.read_string('"');
        if (ch == "'") return this.read_string("'");
        if (PSQLTokenStream.is_digit(ch)) return this.read_number();
        if (PSQLTokenStream.is_id_start(ch)) return this.read_ident();
        if (PSQLTokenStream.is_punc(ch))
            return {
                type: "punc",
                value: this.input.next(),
            };
        if (PSQLTokenStream.is_op_char(ch))
            return {
                type: "op",
                value: this.read_while(PSQLTokenStream.is_op_char),
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

    peek_nom_comment() {
        let current = this.current;
        let col = this.input.col;
        let pos = this.input.pos;
        let line = this.input.line;

        let tok = this.peek();

        while (!this.input.eof() && tok.type == "comment") {
            tok = this.next();
            if (this.input.eof()) tok = null;
        }

        this.input.col = col;
        this.input.pos = pos;
        this.input.line = line;
        this.current = current;
        return tok;
    }

    peek_next() {
        let current = this.current;
        let col = this.input.col;
        let pos = this.input.pos;
        let line = this.input.line;

        let tok = this.peek();
        this.next();

        if (this.input.eof()) tok = null;
        else tok = this.peek();

        this.input.col = col;
        this.input.pos = pos;
        this.input.line = line;
        this.current = current;
        return tok;
    }
}
