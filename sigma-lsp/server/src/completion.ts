import {
	TextDocuments,
	CompletionItemKind,
	TextDocumentPositionParams
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

export function handleCompletion(documents: TextDocuments<TextDocument>, textDocumentPosition: TextDocumentPositionParams){
        // Get the current line number and text of the document being edited
        const lineNumber = textDocumentPosition.position.line;
        const document = documents.get(textDocumentPosition.textDocument.uri);
        const lineText = document?.getText({
            start: { line: lineNumber, character: 0 },
            end: { line: lineNumber, character: Number.MAX_VALUE }
        });
    
        // Get a list of words that have already been written in the current text document
        const existingWords = new Set<string>();
        for (let i = 0; i < document!.lineCount; i++) {
            const line = document!.getText({
                start: { line: i, character: 0 },
                end: { line: i, character: Number.MAX_VALUE }
            });
            const words = line.trim().split(/\s+/);
            for (const word of words) {
				existingWords.add(word);
			}
        }

        const filteredItems = [
            {
                label: 'title:',
                kind: CompletionItemKind.Text,
                data: 1
            },
            {
                label: 'description:',
                kind: CompletionItemKind.Text,
                data: 2
            }
        ].filter(item => !existingWords.has(item.label));

        // Return the filtered completion items if the current line does not contain one yet
        if (!lineText?.includes('title') && !lineText?.includes('description')) {
            return filteredItems;
        } else {
            return [];
        }
}
