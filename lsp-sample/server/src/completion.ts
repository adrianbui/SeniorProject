import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	Range,
    TextEdit,
    Position
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

export function handleCompletion(documents: TextDocuments<TextDocument>, textDocumentPosition: TextDocumentPositionParams){
        // Get the current line number and text of the document being edited
        const lineNumber = textDocumentPosition.position.line;
        const charNumber = textDocumentPosition.position.character;
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

            //TODO - stop adding words to list after colon, i think this is necessary
            // const colonIndex = line.indexOf(':');  
            // const truncatedLine = colonIndex !== -1 ? line.slice(0, colonIndex) : line.trim(); //stop checking words at colon

            const words = line.trim().split(/\s+|:/); //split on whitespace and colons
            for (const word of words) {
				existingWords.add(word);
			}
        }

        const filteredItems = [
            {
                label: ' | ', // placeholder that will not be removed to prevent vs code from auto filling words. 
                kind: CompletionItemKind.Text,
                data: 1,
                insertText: '', 
            },
            {
                label: 'title',
                kind: CompletionItemKind.Text,
                data: 2,
                insertText:'title: '
            },
            {
                label: 'description',
                kind: CompletionItemKind.Text,
                data: 3,
                insertText:'description: '
            },
            {
                label: 'logsource',
                kind: CompletionItemKind.Text,
                data: 3,
                insertText:'logsource:\n\t'
            },
            
        ].filter(item => !existingWords.has(item.label));

        //new rule option if at start of file
        if (lineNumber <= 2){
            filteredItems.push({
                label: "newrule",
                kind: CompletionItemKind.Text,
                data: 4,
                insertText: "title: \nid: \ndescription: \n",
            });
        }

        if (existingWords.has('logsource') && !existingWords.has('category')){
            filteredItems.push({
                label: "category",
                kind: CompletionItemKind.Text,
                data: 5,
                insertText: "category: ",
            });
        }

        // Return the filtered completion items if the current line does not contain one yet
        // if (!lineText?.includes('title') && !lineText?.includes('description')) {
        //     return filteredItems;
        // } else {
        //     return [];
        // }
        
        return filteredItems;
}

export function handleCompletionResolve(item: CompletionItem){
    if (item.data === 2) {
        item.detail = 'Sigma Attribute [required]';
        item.documentation = 'A brief title for the rule that should contain what the rules is supposed to detect (max. 256 characters)';
        return item;
    }
    else if (item.data === 3) {
        item.detail = 'Sigma Attribute [optional]';
        item.documentation = 'A short description of the rule and the malicious activity that can be detected (max. 65,535 characters)';
        return item;
    }
    //TODO - more resolve items
    return item;     
}