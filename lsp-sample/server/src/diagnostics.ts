//code from: https://github.com/humpalum/vscode-sigma/blob/main/src/diagnostics.ts
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

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { error } from 'console';

function creatDiaTrailingWhitespace(
    doc: TextDocument,
	lineString: String,
    lineIndex: number,
	matchLen: number
): Diagnostic {
    const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Information,
		range: Range.create(lineIndex, lineString.length - matchLen,lineIndex,lineString.length),
		message: "Trailing Whitespaces",
		source: 'umn-sigma-lsp',
		code: "sigma_trailingWhitespace"
	};
	return diagnostic
}

function creatDiaTitleTooLong(
    doc: TextDocument,
	lineString: String,
    lineIndex: number,
):  Diagnostic {
    // create range that represents, where in the document the word is
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Warning,
		range: Range.create(lineIndex,0,lineIndex,lineString.length),
		message: "Title is too long. Please consider shortening it",
		source: 'umn-sigma-lsp',
		code: "sigma_TitleTooLong"
	};
    return diagnostic
}

export function handleDiagnostics(doc: TextDocument) {
    const lines = doc.getText().split('\n');
	const diagnostics: Diagnostic[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const line = lines[i];
        console.log(doc.getText(Range.create(i,0,i,line.length)));
		if (line.match(/^title:.{71,}/)) {
			diagnostics.push(creatDiaTitleTooLong(doc, line, i));
		}
		let whitespaceMatch = line.match(/[\s]+$/);
		if (whitespaceMatch) {
			diagnostics.push(creatDiaTrailingWhitespace(doc, line, i, whitespaceMatch[0].length))
		}
	}
	return diagnostics
}

module.exports = {handleDiagnostics}
