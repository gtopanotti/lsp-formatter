import * as vscode from "vscode";
import { Position } from "./Validador";

export function get_text_edits(
    current_position: Position,
    new_position: Position,
    document: vscode.TextDocument,
    unparsed: string
): vscode.TextEdit[] {
    if (!new_position)
        return [
            vscode.TextEdit.replace(
                new vscode.Range(
                    document.lineAt(0).range.start,
                    document.lineAt(document.lineCount - 1).range.end
                ),
                unparsed
            ),
        ];

    let eol = document.eol == 2 ? "\r\n" : "\n";

    let current_ini = position_move(
        new vscode.Position(current_position.line, current_position.character),
        -2,
        document.getText(),
        eol
    );

    let current_fim = position_move(
        new vscode.Position(current_position.line, current_position.character),
        2,
        document.getText(),
        eol
    );

    let anterior_range = new vscode.Range(
        document.lineAt(0).range.start,
        new vscode.Position(current_ini.line, current_ini.character)
    );

    let posterior_range = new vscode.Range(
        new vscode.Position(current_fim.line, current_fim.character),
        document.lineAt(document.lineCount - 1).range.end
    );

    let atual_range = new vscode.Range(
        new vscode.Position(current_ini.line, current_ini.character),
        new vscode.Position(current_fim.line, current_fim.character)
    );

    let unparsed_ini = position_move(
        new vscode.Position(new_position.line, new_position.character),
        -2,
        unparsed,
        eol
    );

    let unparsed_fim = position_move(
        new vscode.Position(new_position.line, new_position.character),
        2,
        unparsed,
        eol
    );

    let anterior_replace = unparsed
        .split(eol)
        .slice(0, unparsed_ini.line)
        .concat([
            unparsed
                .split(eol)
                [unparsed_ini.line].slice(0, unparsed_ini.character),
        ])
        .join(eol);

    let posterior_replace = [
        unparsed.split(eol)[unparsed_fim.line].slice(unparsed_fim.character),
    ]
        .concat(unparsed.split(eol).slice(unparsed_fim.line + 1))
        .join(eol);

    let atual_replace = "";

    if (unparsed_ini.line == unparsed_fim.line)
        atual_replace = unparsed
            .split(eol)
            [unparsed_ini.line].slice(
                unparsed_ini.character,
                unparsed_fim.character
            );
    else {
        atual_replace = [
            unparsed
                .split(eol)
                [unparsed_ini.line].slice(unparsed_ini.character),
        ]
            .concat(
                unparsed
                    .split(eol)
                    .slice(unparsed_ini.line + 1, unparsed_fim.line)
            )
            .concat([
                unparsed
                    .split(eol)
                    [unparsed_fim.line].slice(0, unparsed_fim.character),
            ])
            .join(eol);
    }
    return [
        vscode.TextEdit.replace(posterior_range, posterior_replace),
        vscode.TextEdit.replace(atual_range, atual_replace),
        vscode.TextEdit.replace(anterior_range, anterior_replace),
    ];
}

function position_move(
    position: vscode.Position,
    move: number,
    text: string,
    eol
) {
    if (eol == "\r\n") text = text.replace(/\r\n/g, "\n");

    let linhas = text.split("\n");

    let index = -1;
    let linhaAtual = 0;
    while (linhaAtual <= position.line) {
        if (linhaAtual == position.line) {
            index += position.character + 1;
        } else {
            index += linhas[linhaAtual].length;
            /* Quebra de Linha */
            index += 1;
        }
        linhaAtual++;
    }

    while (move != 0) {
        if (move > 0 && index == text.length - 1) break;
        if (move < 0 && index == 0) break;

        if (move < 0) {
            index--;
            if (![" ", "\n", "\t", "\r"].includes(text[index])) move++;
        } else if (move > 0) {
            index++;
            if (![" ", "\n", "\t", "\r"].includes(text[index])) move--;
        }
    }

    let line = 0;
    let col = -1;

    let last_char = "";
    for (let cont = 0; cont <= index; cont++) {
        if (last_char == "\n") {
            line += 1;
            col = 0;
        } else {
            col += 1;
        }
        last_char = text[cont];
    }

    if (eol == "\r\n") text = text.replace(/\n/g, "\r\n");
    return new vscode.Position(line, col);
}
