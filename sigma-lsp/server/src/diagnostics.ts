import {
	Diagnostic,
	DiagnosticSeverity,
	Range
} from 'vscode-languageserver/node';

import * as YAML from "yaml";

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { error } from 'console';
import { getTags } from 'yaml/dist/schema/tags';

// Code adapted from https://github.com/humpalum/vscode-sigma/blob/main/src/diagnostics.ts


export function handleDiagnostics(doc: TextDocument, parsedToJS: Record<string, unknown>) {
    const lines = doc.getText().split('\n');
	const diagnostics: Diagnostic[] = [];

	const tempArr = checkLowercaseTags(doc, parsedToJS);
	diagnostics.push(...tempArr);

    for (let i = 0; i < doc.lineCount; i++) {
        const line = lines[i];
        //console.log(doc.getText(Range.create(i,0,i,line.length)));
		if (line.includes("contains|")) {
			if (!line.includes("contains|all:")) {
				diagnostics.push(createDiaContainsInMiddle(doc, line, i));
			}
		}
		if (line.includes("|all:")) {
			if (!line.match(/\|all:\s*$/)) {
				diagnostics.push(createDiaSingleAll(doc, line, i));
			}
		}
		if (line.match(/^title:.{71,}/)) {
			diagnostics.push(createDiaTitleTooLong(doc, line, i));
		}
		const whitespaceMatch = line.match(/[\s]+$/);
		if (whitespaceMatch) {
			diagnostics.push(createDiaTrailingWhitespace(doc, line, i, whitespaceMatch[0].length));
		}
		if (line.match(/^description:.{0,32}$/)) {
			if (!line.match(/^description:\s+\|\s*$/)) {
				diagnostics.push(createDiaDescTooShort(doc, line, i));
			}
		}
	}
	return diagnostics;
}



// Helper Functions to Create Diagnostics

function createDiaLowercaseTag(
    doc: TextDocument,
	lineString: string, 
    lineIndex: number,
	targetString: string
): Diagnostic {
    // find where in the parsed yaml there is uppercase 
    const index = lineString.indexOf(targetString);
    const indexLength = targetString.length;

	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Warning,
		range: Range.create(lineIndex, index, lineIndex, index + indexLength),
		message: 'Tags should only have lowercase words',
		source: 'umn-sigma-lsp',
		code: "sigma_LowercaseTag"
	};
	return diagnostic;
}

function createDiaSingleAll(
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

function createDiaContainsInMiddle(
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

function createDiaTrailingWhitespace(
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

function createDiaTitleTooLong(
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

function createDiaDescTooShort(
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

function checkLowercaseTags(doc: TextDocument, parsedToJS: Record<string, unknown>){
	const lines = doc.getText().split('\n');
	const tempDiagnostics: Diagnostic[] = [];
	if("tags" in parsedToJS) {
		const tagsArr = parsedToJS.tags;
		if(Array.isArray(tagsArr)) {
			const tagsLength = tagsArr.length;
			for (let i = 0; i < doc.lineCount; i++) {
				if (lines[i].match(/^tags:/)) {
					// for (let j=0; j<tagsArr.length; j++){
					// 	const lineIndex = i + j + 1;
					// 	const lineString = tagsArr[j];
					// 	console.log(lineString);
					// 	const uppercaseWords = lineString.match(/\b[A-Z]\w*\b/g);
					// 	console.log(uppercaseWords);
					// 	if (uppercaseWords) {
					// 		for (let k=0; k < uppercaseWords.length; k++){
					// 			const badWord = uppercaseWords[k];
					// 			lineString.indexOf(badWord);
					// 			tempDiagnostics.push(createDiaLowercaseTag(doc,lineString,lineIndex,badWord));
					// 		}
					// 	}
					// }
					for (let j=i+1; j < i + tagsLength; j++) {
						let lineString = lines[j];
						const commentStart = lineString.indexOf("#");
						if (commentStart !== -1) {
							lineString = lineString.substring(0,commentStart);
						}
						console.log(lineString);
						const uppercaseWords = lineString.match(/\b[A-Z]\w*\b/g);
						console.log(uppercaseWords);
						if (uppercaseWords) {
							for (let k=0; k<uppercaseWords.length; k++){
								const badWord = uppercaseWords[k];
								// TODO if the same uppercase word is present twice it only gets marked on the first one
								tempDiagnostics.push(createDiaLowercaseTag(doc,lineString,j,badWord));
							}
						}
					}
					return tempDiagnostics;
				}
			}	
		}
	}
	return tempDiagnostics;
}