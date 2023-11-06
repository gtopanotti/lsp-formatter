import * as vscode from "vscode";
import { Position } from "./parsers/Validador";

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

    let anterior_range = new vscode.Range(
        document.lineAt(0).range.start,
        new vscode.Position(current_position.line, current_position.character)
    );

    let posterior_range = new vscode.Range(
        new vscode.Position(current_position.line, current_position.character),
        document.lineAt(document.lineCount - 1).range.end
    );

    let anterior_replace = unparsed
        .split(eol)
        .slice(0, new_position.line)
        .concat([
            unparsed
                .split(eol)
                [new_position.line].slice(0, new_position.character),
        ])
        .join(eol);

    let posterior_replace = [
        unparsed.split(eol)[new_position.line].slice(new_position.character),
    ]
        .concat(unparsed.split(eol).slice(new_position.line + 1))
        .join(eol);

    return [
        vscode.TextEdit.replace(anterior_range, anterior_replace),
        vscode.TextEdit.replace(posterior_range, posterior_replace),
    ];
}
