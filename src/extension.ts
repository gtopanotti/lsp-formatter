// 'use strict';
import * as vscode from "vscode";
import { conferir_divergencias } from "./parsers/Validador";
import { LSPParser } from "./parsers/lsp/LSPParser";
import { unparse_global } from "./parsers/lsp/UnParser";
import { get_text_edits } from "./get_text_edits";

export function activate(context: vscode.ExtensionContext) {
    vscode.languages.registerDocumentFormattingEditProvider("lsp", {
        provideDocumentFormattingEdits(document: vscode.TextDocument): any {
            let text = document.getText();

            let current_position = undefined;

            const editorSelection = vscode.window.activeTextEditor.selection;

            if (editorSelection && editorSelection.active) {
                current_position = {
                    line: editorSelection.active.line,
                    character: editorSelection.active.character,
                };
            }

            try {
                let parser = new LSPParser(text);
                let ast = parser.parse_toplevel();

                let unparsed = unparse_global(
                    ast,
                    document.eol == 2 ? "\r\n" : "\n",
                    vscode.window.activeTextEditor.options.tabSize
                );

                let new_selection = conferir_divergencias(
                    text,
                    unparsed,
                    current_position
                );

                let text_edits: vscode.TextEdit[] = get_text_edits(
                    current_position,
                    new_selection,
                    document,
                    unparsed
                );

                return text_edits;
            } catch (erro) {
                vscode.window.showErrorMessage(erro.message);

                const resultado = erro.message.match(/\(([^)]*)\)[^(]*$/);
                if (resultado && resultado.length > 1) {
                    let pos = resultado[1].trim().split(":");
                    if (!isNaN(pos[0]) && !isNaN(pos[1])) {
                        /* vai para a primeira linha */
                        vscode.window.activeTextEditor.selection =
                            new vscode.Selection(
                                new vscode.Position(0, 0),
                                new vscode.Position(0, 0)
                            );

                        // * Posiciona o cursor no erro
                        vscode.commands
                            .executeCommand("cursorMove", {
                                to: "down",
                                by: "line",
                                value: Number(pos[0]) - 1,
                            })
                            .then(() => {
                                vscode.commands.executeCommand("cursorMove", {
                                    to: "right",
                                    by: "character",
                                    value: Number(pos[1]) - 1,
                                });
                            });
                    }
                }
            }
        },
    });
}

export function deactivate() {}
