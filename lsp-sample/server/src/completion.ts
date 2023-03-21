// import { CompletionItem, CompletionItemKind, TextDocumentPositionParams } from 'vscode-languageserver';
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
	Range
} from 'vscode-languageserver/node';

import * as YAML from "yaml";

// import {handleDiagnostics} from './diagnostics';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);



interface CompletionHandler {
	(textDocumentPosition: TextDocumentPositionParams, documents: TextDocuments<TextDocument>): CompletionItem[];
  }


  export const onCompletion: CompletionHandler = (textDocumentPosition, documents) => {
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
        for (let word of words) {
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
};




export function onCompletionResolve(item: CompletionItem): CompletionItem {
	if (item.data === 1) {
		item.detail = 'Sigma Attribute [required]';
		item.documentation = 'A brief title for the rule that should contain what the rules is supposed to detect (max. 256 characters)';
		return item;
		
	} else if (item.data === 2) {
		item.detail = 'Sigma Attribute [optional]';
		item.documentation = 'A short description of the rule and the malicious activity that can be detected (max. 65,535 characters)';
		return item;
	}
	return item;
  // the implementation of the onCompletionResolve function goes here
};

// module.exports = {onCompletion, onCompletionResolve};