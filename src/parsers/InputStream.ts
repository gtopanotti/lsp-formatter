export class InputStream {
    pos: number = 0;
    line: number = 1;
    col: number = 0;
    input: string;

    constructor(input: string) {
        this.input = input;
    }

    next() {
        let ch = this.input.charAt(this.pos++);
        if (ch == "\n") this.line++, (this.col = 0);
        else this.col++;
        return ch;
    }

    peek() {
        return this.input.charAt(this.pos);
    }
    peek_plus() {
        return this.input.charAt(this.pos + 1);
    }
    eof() {
        return this.peek() == "";
    }
    croak(msg: string) {
        throw new Error(msg + " (" + this.line + ":" + this.col + ")");
    }

    // * daqui pra baixo usado apenas na validação
    next_nom_empty() {
        let ch = this.next();
        while (!this.eof() && this.is_whitespace(this.peek())) {
            this.next();
        }
        if (this.eof()) return null;
        return ch;
    }

    first_nom_empty() {
        if (this.is_whitespace(this.peek())) this.next_nom_empty();
    }

    is_whitespace(ch: string) {
        return " \t\n\r".indexOf(ch) >= 0;
    }
    peek_back(qtd: number) {
        if (!this.pos) return null;
        let postemp = this.pos - 1;
        let qtdatu = 0;
        while (postemp >= 0) {
            if (!this.is_whitespace(this.input.charAt(postemp))) qtdatu += 1;
            if (qtdatu == qtd) return this.input.charAt(postemp);
            postemp--;
        }
        return null;
    }
}
