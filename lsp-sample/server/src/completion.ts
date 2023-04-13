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
    Position,
    integer,
    InsertTextFormat
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
        let logNum= 0
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
            if (line.trim().startsWith('logsource')) {
                logNum=i;
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
                insertText:'title:'
            },
            {
                label: 'description',
                kind: CompletionItemKind.Text,
                data: 3,
                insertText:'description:'
            },{
                label: 'id',
                kind: CompletionItemKind.Text,
                data: 4,
                insertText:'id:'
            },{
                label: 'author',
                kind: CompletionItemKind.Text,
                data: 5,
                insertText:'author:'
            },
            {
                label: 'logsource',
                kind: CompletionItemKind.Text,
                data: 6,
                insertText:'logsource:\n\t'
            },
            {
                label: 'detection',
                kind: CompletionItemKind.Text,
                data: 9,
                insertText: 'detection:\n'
            },
            {
                label: 'falsepositives',
                kind: CompletionItemKind.Text,
                data: 10,
                insertText: 'falsepositives:\n  - '
            },
            {
                label: 'level',
                kind: CompletionItemKind.Text,
                data: 11,
                insertText: 'level:'
            },
            {
                label: 'tags',
                kind: CompletionItemKind.Text,
                data: 12,
                insertText: 'tags:\n  - '
            },
            {
                label: 'status',
                kind: CompletionItemKind.Text,
                data: 13,
                insertText: 'status:'
            },
            {
                label: 'author',
                kind: CompletionItemKind.Text,
                data: 14,
                insertText: 'author:'
            },
            {
                label: 'date',
                kind: CompletionItemKind.Text,
                data: 15,
                insertText: 'date:'
            },
            {
                label: 'license',
                kind: CompletionItemKind.Text,
                data: 16,
                insertText: 'license:'
            },
            {
                label: 'updated',
                kind: CompletionItemKind.Text,
                data: 17,
                insertText: 'updated:'
            },
            {
                label: 'references',
                kind: CompletionItemKind.Text,
                data: 18,
                insertText: 'references:\n  - '
            },
            {
                label: 'fields',
                kind: CompletionItemKind.Text,
                data: 19,
                insertText: 'fields:\n  - '
            },
            {
                label: 'condition',
                kind: CompletionItemKind.Text,
                data: 20,
                insertText: 'condition:'
            },
            {
                label: 'aggregation',
                kind: CompletionItemKind.Text,
                data: 21,
                insertText: 'aggregation:'
            }
            
            
        ].filter(item => !existingWords.has(item.label));

        //new rule option if at start of file
        if (lineNumber <= 2) {
            filteredItems.push({
                label: "newrule",
                kind: CompletionItemKind.Text,
                data: 4,
                insertText: [
                    "title: ",
                    "id: ",
                    "description: ",
                    "author: ",
                    "date: ",
                    "updated: ",
                    "license: ",
                    "status: ",
                    "references:\n  - ",
                    "tags:\n  - ",
                    "level: ",
                    "logsource:\n  category: \n  product: ",
                    "detection:\n  ",
                    "falsepositives:\n  - ",
                    "fields:\n  - ",
                    "condition: ",
                    "aggregation: "
                ].join('\n')
            });
        }

        // checks the "logsource" line number
        if ((lineNumber-logNum ==1 || lineNumber - logNum == 2) && logNum!=0) {
            filteredItems.push(
                {
                    label: 'category',
                    kind: CompletionItemKind.Text,
                    data: 7,
                    insertText: 'category: '
                },
                {
                    label: 'product',
                    kind: CompletionItemKind.Text,
                    data: 8,
                    insertText: 'product: ',
                    
                }
            );

        }
        if (lineText?.trim().startsWith('product: ')) {
            filteredItems.push(
                {
                    label: 'windows',
                    kind: CompletionItemKind.Text,
                    data: 100,
                    insertText: 'windows'
                },
                {
                    label: 'linux',
                    kind: CompletionItemKind.Text,
                    data: 101,
                    insertText: 'linux'
                },
                {
                    label: 'azure',
                    kind: CompletionItemKind.Text,
                    data: 102,
                    insertText: 'azure'
                },
                {
                    label: 'macos',
                    kind: CompletionItemKind.Text,
                    data: 103,
                    insertText: 'macos'
                },
                {
                    label: 'aws',
                    kind: CompletionItemKind.Text,
                    data: 104,
                    insertText: 'aws'
                }
            );
        }
        

        
            

        // Return the filtered completion items if the current line does not contain one yet
        // if (!lineText?.includes('title') && !lineText?.includes('description')) {
        //     return filteredItems;
        // } else {
        //     return [];
        // }
        
        return filteredItems;
};

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
    }else if (item.data === 7) {
        item.detail = 'Subheading under "logsource"';
        item.documentation = 'The category subheading that goes under the logsource';
        return item;
    }
    else if (item.data === 8) {
        item.detail = 'Subheading under "logsource"';
        item.documentation = 'The product subheading that goes under the logsource';
        return item;
    }
    //TODO - more resolve items
    return item;     
};