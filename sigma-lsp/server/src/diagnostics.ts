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

	
	diagnostics.push(...checkRequiredFields(doc,lines,parsedToJS));
	//diagnostics.push(...checkInvalidFields(doc,lines,parsedToJS));


	if("author" in parsedToJS) {
		const tempArr = checkAuthor(doc, lines, parsedToJS);
		diagnostics.push(...tempArr);
	}

	if("tags" in parsedToJS) {
		console.log('tags attribute exists');
		const tempArr = checkLowercaseTags(doc, lines, parsedToJS);
		diagnostics.push(...tempArr);
	}

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
		// "Use a short title with less than 50 characters as an alert name"
		// Sigma Docs: https://github.com/SigmaHQ/sigma/wiki/Rule-Creation-Guide
		if (line.match(/^title:.{50,}/)) {
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

function createDiaMissingReqField(
	doc: TextDocument,
	lineString: string, 
    lineIndex: number,
	missingTags: string
): Diagnostic { 
	// TODO range should include the next line(s) if the author value is a list
	if (lineString == undefined){
		lineString = '';
	}
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: Range.create(lineIndex, 0, lineIndex, lineString.length),
		message: `Sigma File is missing required tag(s): ${missingTags}`,
		source: 'umn-sigma-lsp',
		code: "sigma_MissingReqField"
	};
	return diagnostic;
}


// this diagnostic could be on multiple lines
// lineStringEnd is the string of the last line
function createDiaAuthorNotString(
    doc: TextDocument,
	lineStringEnd: string, 
    lineIndexStart: number,
	lineIndexEnd: number
): Diagnostic { 
	// TODO range should include the next line(s) if the author value is a list
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: Range.create(lineIndexStart, 0, lineIndexEnd, lineStringEnd.length),
		message: 'Author value must be a string',
		source: 'umn-sigma-lsp',
		code: "sigma_AuthorNotString"
	};
	return diagnostic;
}

function createDiaTagNotSequence(
    doc: TextDocument,
	lineString: string, 
    lineIndex: number,
): Diagnostic {
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: Range.create(lineIndex, 0, lineIndex, lineString.length),
		message: 'Tags value must be a yaml Sequence',
		source: 'umn-sigma-lsp',
		code: "sigma_TagNotSequence"
	};
	return diagnostic;
}

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
		message: 'Tags should be lowercase only',
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


function checkLowercaseTags(doc: TextDocument, docLines: Array<string>, parsedToJS: Record<string, unknown>){
	const tempDiagnostics: Diagnostic[] = [];
	const tagsArr = parsedToJS.tags;
	if(Array.isArray(tagsArr)) {
		const tagsLength = tagsArr.length;
		for (let i = 0; i < doc.lineCount; i++) {
			if (docLines[i].match(/^tags:/)) {
				for (let j=i+1; j <= i + tagsLength; j++) {
					let lineString = docLines[j];
					const commentStart = lineString.indexOf("#");
					if (commentStart !== -1) {
						lineString = lineString.substring(0,commentStart);
					}
					console.log(lineString);
					const uppercaseWords = lineString.match(/\b[A-Z]\S*\b/g);
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
	} else {  // tags field is not a YAML sequence
		for (let i = 0; i < doc.lineCount; i++) {
			const lineString = docLines[i];
			if (docLines[i].match(/^tags:/)) {
				tempDiagnostics.push(createDiaTagNotSequence(doc,lineString,i));
			}
		}
	}
	return tempDiagnostics;
}

function checkAuthor(doc: TextDocument, docLines: Array<string>, parsedToJS: Record<string, unknown>){
	// type of the author field should be a string, not a list, according to https://github.com/SigmaHQ/sigma/wiki/Rule-Creation-Guide
	const tempDiagnostics: Diagnostic[] = [];
	const authorValue = parsedToJS.author;

	// get the next key so that the author diagnostic will be on all lines until the next key
	const keys = Object.keys(parsedToJS);
	const nextIndex = keys.indexOf("author")+1;
	const nextField = keys[nextIndex];

	// need quotation marks around @ symbol if adding twitter handle

	if (typeof authorValue !== 'string' && !(authorValue instanceof String)){
		// get the line that author is on
		for (let i = 0; i < doc.lineCount; i++) {
			const lineString = docLines[i];
			if (lineString.match(/^author:/)) {
				// if (Array.isArray(authorValue)){
				// 	const lineIndexEnd = i + authorValue.length;
				// 	const lastString = docLines[lineIndexEnd] // to get the length of last line to end the diagnostic
				// 	tempDiagnostics.push(createDiaAuthorNotString(doc,lastString,i,lineIndexEnd));
				// }
				const atSymbol = lineString.indexOf("@");
				if (nextField){ // if author isn't the last field
					let j=i+1;
					const currentLine = docLines[j];
					while (!currentLine.match(`/^${nextField}:/`)){
						j++;
					}
					console.log('last line j was at: ', docLines[j]);
					const idxBeforeNextField = j-1;
					const lastString = docLines[idxBeforeNextField];
					tempDiagnostics.push(createDiaAuthorNotString(doc,lastString,i,idxBeforeNextField));
				} else { // if author is for some reason the last field
					tempDiagnostics.push(createDiaAuthorNotString(doc,lineString,i,i));
				}
				
				return tempDiagnostics;
			}
			
		}
	}
	return tempDiagnostics;
}

/**
 * Checks that all required Sigma fields are present in the yaml file
 * @param {TextDocument} doc has the contents of the current file
 * @param {Array<string>} docLines each line of the file as a string
 * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
 * @return {tempDiagnostics} array of diagnostics to be displayed
 */
function checkRequiredFields(doc: TextDocument, docLines: Array<string>, parsedToJS: Record<string, unknown>) {
	const firstLine = docLines[0];
	const tempDiagnostics: Diagnostic[] = [];
	const keys =  Object.keys(parsedToJS);
	const requiredFields = ["title", "logsource"];
	const missingFields = [];
	for(let i = 0; i < requiredFields.length; i++){
		if (keys.includes(requiredFields[i]) != true) {
			missingFields.push(requiredFields[i]);
			console.log('missing: ', requiredFields[i]);
		}
	}
	// TODO underline detection if condition is not there???
	if (!keys.includes("detection")) {
		console.log('detection is missing');
		console.log('condition is missing');
		missingFields.push("detection");
		missingFields.push("condition");
	} else {
		if (!Array.isArray(parsedToJS.detection) || !("condition" in parsedToJS.detection)){
			console.log('condition is missing');
			missingFields.push("condition");
		}
	}
	if (missingFields.length > 0){
		tempDiagnostics.push(createDiaMissingReqField(doc,firstLine,0,missingFields.toString()));
	}
	return tempDiagnostics;
}

/**
 * Checks that all fields are valid sigma keys
 * @param {TextDocument} doc has the contents of the current file
 * @param {Array<string>} docLines each line of the file as a string
 * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
 * @return {tempDiagnostics} array of diagnostics to be displayed
 */

// TODO Ask Caleb what is an invalid field if there are arbitrary custom fields???

// function checkInvalidFields(doc: TextDocument, docLines: Array<string>, parsedToJS: Record<string, unknown>) {
// 	const keys = Object.keys(parsedToJS);
// 	const validKeys = [];
// 	for (let i=0; i<keys.length; i++){
// 		if (!keys[i] in validKeys){

// 		}
// 	}
// }

module.exports = {handleDiagnostics};