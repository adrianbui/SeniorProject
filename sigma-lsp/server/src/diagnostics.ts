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

// Code adapted from https://github.com/humpalum/vscode-sigma/blob/main/src/diagnostics.ts


// This function goes line by line and computes diagnostics on the file
export function handleDiagnostics(doc: TextDocument) {
    const lines = doc.getText().split('\n');
	const diagnostics: Diagnostic[] = [];

    for (let i = 0; i < doc.lineCount; i++) {
        const line = lines[i];
        console.log(doc.getText(Range.create(i,0,i,line.length)));
		if (line.includes("contains|")) {
			if (!line.includes("contains|all:")) {
				diagnostics.push(creatDiaContainsInMiddle(doc, line, i));
			}
		}
		if (line.includes("|all:")) {
			if (!line.match(/\|all:\s*$/)) {
				diagnostics.push(creatDiaSingleAll(doc, line, i));
			}
		}
		if (line.match(/^title:.{71,}/)) {
			diagnostics.push(creatDiaTitleTooLong(doc, line, i));
		}
		const whitespaceMatch = line.match(/[\s]+$/);
		if (whitespaceMatch) {
			diagnostics.push(creatDiaTrailingWhitespace(doc, line, i, whitespaceMatch[0].length));
		}
		if (line.match(/^description:.{0,32}$/)) {
			if (!line.match(/^description:\s+\|\s*$/)) {
				diagnostics.push(creatDiaDescTooShort(doc, line, i));
			}
		}
	}
	return diagnostics;
}

// Helper Functions to Create Diagnostics

function creatDiaSingleAll(
    doc: TextDocument,
	lineString: string,
    lineIndex: number,
): Diagnostic {
    // find where in the line the 'contains' is mentioned
    const index = lineString.indexOf("|all");
    const indexLength = "|all".length;

	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Warning,
		range: Range.create(lineIndex, index, lineIndex, index + indexLength),
		message: 'Modifier: "|all" may not be a single entry',
		source: 'umn-sigma-lsp',
		code: "sigma_AllSingle"
	};
	return diagnostic;
}

function creatDiaContainsInMiddle(
    doc: TextDocument,
	lineString: string,
    lineIndex: number,
): Diagnostic {
    // find where in the line the 'contains' is mentioned
    const index = lineString.indexOf("contains|");
    let indexLength = "contains|".length;
    let regexMatch = lineString.match("contains.+:");
    if (regexMatch) {
        indexLength = regexMatch[0].length;
    } else {
        regexMatch = lineString.match("contains.+$");
        if (regexMatch) {
            indexLength = regexMatch[0].length;
        }
    }
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Warning,
		range: Range.create(lineIndex, index, lineIndex, index + indexLength),
		message: "Contains should only be at the end of modifiers",
		source: 'umn-sigma-lsp',
		code: "sigma_containsMiddle"
	};
	return diagnostic;
}


function creatDiaTrailingWhitespace(
    doc: TextDocument,
	lineString: string,
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
	return diagnostic;
}

function creatDiaTitleTooLong(
    doc: TextDocument,
	lineString: string,
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
    return diagnostic;
}

function creatDiaDescTooShort(
    doc: TextDocument,
	lineString: string,
    lineIndex: number,
): Diagnostic {
    // create range that represents, where in the document the word is
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Warning,
		range: Range.create(lineIndex,0,lineIndex,lineString.length),
		message: "Description is too short. Please elaborate",
		source: 'umn-sigma-lsp',
		code: "sigma_DescTooShort"
	};
    return diagnostic;
}

module.exports = {handleDiagnostics};
