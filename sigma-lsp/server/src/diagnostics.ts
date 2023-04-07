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
import {requiredTypes} from './sigmaRequiredTypes';
import { fieldOrder, subFieldOrderLogSource } from './sigmaFieldOrder';


// Code adapted from https://github.com/humpalum/vscode-sigma/blob/main/src/diagnostics.ts

export function handleDiagnostics(doc: TextDocument, parsedToJS: Record<string, unknown>) {
    const lines = doc.getText().split('\n');
	const diagnostics: Diagnostic[] = [];

	
	diagnostics.push(...checkRequiredFields(doc,lines,parsedToJS));

	diagnostics.push(...checkForWrongKeys(doc, lines, parsedToJS));
	//diagnostics.push(...checkInvalidFields(doc,lines,parsedToJS));

	// flatten parsedToJS so that nested keys exist at the top level
	// this helps loop through all keys in checkType
	const flatParsedToJS = flattenObject(parsedToJS);
	//console.log('flattened parsedToJS', flatParsedToJS);
	// call checkType on all keys including nested keys
	diagnostics.push(...checkTypeOfAllKeys(flatParsedToJS, doc,lines));

	if("tags" in parsedToJS) {
		//console.log('tags attribute exists');
		const tempArr = checkLowercaseTags(doc, lines, parsedToJS);
		//const tempArr2 = checkType("array", "tags", doc, lines, parsedToJS);
		diagnostics.push(...tempArr);
		//diagnostics.push(...tempArr2);
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
		// Recommendation: "Use a short title with less than 50 characters as an alert name"
		// Sigma Docs: https://github.com/SigmaHQ/sigma/wiki/Rule-Creation-Guide
		// Absolute max length is 256 chars https://github.com/SigmaHQ/sigma-specification/blob/main/Sigma_specification.md#description-optional
		if (line.match(/^title:.{50,}/)) {
			if (line.match(/^title:.{256,}/)) {
				diagnostics.push(createDiaTitleTooLong(doc, line, i, 256));
			} else {
				diagnostics.push(createDiaTitleTooLong(doc, line, i, 50));
			}
		}
		const whitespaceMatch = line.match(/[\s]+$/);
		if (whitespaceMatch) {
			diagnostics.push(createDiaTrailingWhitespace(doc, line, i, whitespaceMatch[0].length));
		}

	}
	return diagnostics;
}

/**
 * Checks that the type of each key matches the required type as in sigmaRequiredTypes.ts
 * 
 * @param {Record<string, unknown>} flatParsedToJS flattened parsedToJs (parsed yaml)
 * @param {TextDocument} doc has the contents of the current file
 * @param {Array<string>} docLines each line of the file as a string
 * @return {flatParsedToJS} flattened version of the object
 */
function checkTypeOfAllKeys(flatParsedToJS: Record<string, unknown>, doc: TextDocument, docLines: Array<string>){
	const diagnostics: Diagnostic[] = [];
	const keysArr = Object.keys(flatParsedToJS);
	let lastCheckedLine = 0; // this keeps track of how far we've iterated through the file
	// checks that the type of each value matches the required type specified in sigmaRequiredTypes.js
	for (let i=0; i<keysArr.length; i++){
		const key = keysArr[i];
		const value = flatParsedToJS[key as keyof typeof flatParsedToJS];
		if (key in requiredTypes){
			const requiredType = requiredTypes[key as keyof typeof requiredTypes];
			const returnVal = checkType(requiredType,key,doc,docLines,flatParsedToJS,lastCheckedLine);
			const tempArr:Diagnostic[] = returnVal[0];
			lastCheckedLine = returnVal[1];
			diagnostics.push(...tempArr);
		}
	}
	return diagnostics;
}

/**
 * Flattens a javascript object so that nested fields become top-level fields
 * Used to call checkType on each field sequentially
 * Note: Only checks for one level of nesting
 * 
 * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
 * @return {flatParsedToJS} flattened version of the object
 */
function flattenObject(parsedToJS:Record<string, unknown>){
	const flatParsedToJS:Record<string, unknown> = {};
	const keysArr = Object.keys(parsedToJS);
	for (let i=0; i<keysArr.length; i++){
		const key = keysArr[i];
		const value = parsedToJS[key as keyof typeof parsedToJS];
		if (typeof value === 'object' && !Array.isArray(value) && value !== null){ // if it's an object (contains nested fields)
			flatParsedToJS[key] = value; // add the field itself before adding nested fields
			const subKeysArr = Object.keys(value);
			for (let j=0; j<subKeysArr.length; j++){
				const subKey = subKeysArr[j];
				const subValue = value[subKey as keyof typeof value];
				flatParsedToJS[subKey] = subValue; // add each nested field
			}
		} else { // it's not an object
			flatParsedToJS[key] = value;
		}
	}
	return flatParsedToJS;
}

/**
 * Checks all the sigma fields order and returns an array of keys that are in the incorrect order. 
 * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
 * @return {wrongKeys} array of keys that were in the incorrect order. 
 */
function checkFieldOrder(parsedToJS:Record<string, unknown>){
	const ordering:any = {}; // map for efficient lookup of sortIndex
    const sortOrder = fieldOrder; //fieldOrder is the correct order according to sigma docs
	//console.log("sortOrder: ", sortOrder);
	const keysArr = Object.keys(parsedToJS);
	// create a copy of keysArr to avoid mutating when sorting
	const sortedKeysArr = [...keysArr]; // this array will be sorted, representing the correct ordering
	for (let i=0; i<sortOrder.length; i++){
		ordering[sortOrder[i]] = i;
	}
	//console.log("ordering: ", ordering);
	sortedKeysArr.sort(function(a, b) {
		return (ordering[a] - ordering[b]);
	});
	console.log("keysArr: ", keysArr);
	console.log("sortedKeysArr: ", sortedKeysArr);
	const wrongKeys = []; 
	for(let i=0; i<keysArr.length; i++){ 
		const actualKey = keysArr[i];
		const correctKey = sortedKeysArr[i];
		console.log(`actual key: ${actualKey}, correct key: ${correctKey}`);
		if(actualKey != correctKey){
			wrongKeys.push(actualKey);
		}
	}
	return wrongKeys;
}

/**
 * Checks whether the keys are in incorrect order and pushes a diagnostic
 * @param {TextDocument} doc has the contents of the current file
 * @param {Array<string>} docLines each line of the file as a string
 * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
 * @return {tempDiagnostics} array of diagnostics to be displayed
 */
function checkForWrongKeys(doc: TextDocument, docLines: Array<string>,parsedToJS:Record<string,unknown>){
	const diagnostics: Diagnostic[] = [];
	const wrongKeysArr = checkFieldOrder(parsedToJS);
	const numWrongKeys = wrongKeysArr.length;
	if (numWrongKeys === 0) { // no fields are in the wrong order
		return diagnostics;
	}
	console.log("wrongKeysArr: ", wrongKeysArr);
	let count = 0; // for looping through wrongKeysArr
	let currentKey = wrongKeysArr[count];
	let regex = new RegExp(`^\\s*${currentKey}:`);
	for(let i=0; i<docLines.length; i++){
		console.log("currentKey: ", currentKey);
		console.log("regex: ", regex);
		const regexMatchIndex = docLines[i].search(regex); // first character of the matched key
		console.log("regexMatchIndex", regexMatchIndex);
		if(regexMatchIndex >= 0){
			console.log("found regex match");
			const lineNumber = i;
			diagnostics.push(createDiaFieldOutOfOrder(doc,currentKey,lineNumber,regexMatchIndex));
			
			if (count >= numWrongKeys - 1){   // we've found all the incorrect keys
				return diagnostics;
			} else { // look for the next incorrect key
				console.log("current count:", count);
				console.log("numWrongKeys :", numWrongKeys);
				count++;
				currentKey = wrongKeysArr[count];
				regex = new RegExp(`^\\s*${currentKey}:`);
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
		message: `Sigma File is missing required field(s): ${missingTags}`,
		source: 'umn-sigma-lsp',
		code: "sigma_MissingReqField"
	};
	return diagnostic;
}

// this diagnostic could be on multiple lines
function createDiaIncorrectType(
    doc: TextDocument,
	lastLineString: string, // the string of the last line
    lineIndexStart: number,
	lineIndexEnd: number,
	sigmaKey: string,
	requiredValue: string
): Diagnostic { 
	// TODO range should include the next line(s) if the author value is a list
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: Range.create(lineIndexStart, 0, lineIndexEnd, lastLineString.length),
		message: `Value of key ${sigmaKey} must be of type ${requiredValue}`,
		source: 'umn-sigma-lsp',
		code: "sigma_IncorrectType"
	};
	return diagnostic;
}


// this diagnostic could be on multiple lines
// lineStringEnd is the string of the last line
function createDiaAuthorNotString(
    doc: TextDocument,
	lastLineString: string, 
    lineIndexStart: number,
	lineIndexEnd: number
): Diagnostic { 
	// TODO range should include the next line(s) if the author value is a list
	const diagnostic: Diagnostic = {
		severity: DiagnosticSeverity.Error,
		range: Range.create(lineIndexStart, 0, lineIndexEnd, lastLineString.length),
		message: 'Author value must be a string',
		source: 'umn-sigma-lsp',
		code: "sigma_AuthorNotString"
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
	lengthThreshold: number // 50 (recommended max), or 256 (absolute max)
):  Diagnostic {
    // create range that represents, where in the document the word is
	let message, severity;
	if (lengthThreshold === 50){
		severity = DiagnosticSeverity.Information;
		message = "Title less than 50 characters is recommended (max length is 256)";
	} else { // lengthThreshold === 256
		severity = DiagnosticSeverity.Error;
		message = "Title must be 256 characters or less";
	}
	const diagnostic: Diagnostic = {
		severity: severity,
		range: Range.create(lineIndex,0,lineIndex,lineString.length),
		message: message,
		source: 'umn-sigma-lsp',
		code: "sigma_TitleTooLong"
	};
    return diagnostic;
}
/**
 * Checks whether a sigma value is of the correct type for that key
 * @param {TextDocument} doc has the contents of the current file
 * @param {string} keyString incorrect key that is out of order
 * @param {string} lineIndex number line is on
 * @param {string} regexMatchIndex line the key starts on
 * @return {tempDiagnostics} array of diagnostics to be displayed
 */
function createDiaFieldOutOfOrder(
    doc: TextDocument,
	keyString: string,
    lineIndex: number,
	regexMatchIndex: number
):  Diagnostic {
    // create range that represents, where in the document the word is
	let message, severity;
	
	const diagnostic: Diagnostic = {
		severity: severity,
		range: Range.create(lineIndex,0,lineIndex,keyString.length),
		message: "This field is not in the correct order, Please refer to: https://github.com/SigmaHQ/sigma-specification/blob/main/Sigma_specification.md",
		source: 'umn-sigma-lsp',
		code: "sigma_TitleTooLong"
	};
    return diagnostic;
}

/**
 * Checks whether a sigma value is of the correct type for that key
 * @param {string} requiredType correct type of the sigma value according to sigma docs
 * @param {string} sigmaKey current sigma key
 * @param {TextDocument} doc has the contents of the current file
 * @param {Array<string>} docLines each line of the file as a string
 * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
 * @param {number} lastCheckedLine the line that the last key we checked was on, to avoid re-iterating
 * @return {tempDiagnostics} array of diagnostics to be displayed
 */
function checkType(
		requiredType: string, 
		sigmaKey: string, 
		doc: TextDocument, 
		docLines: Array<string>, 
		parsedToJS: Record<string, unknown>,
		lastCheckedLine: number
	): [Diagnostic[], number]{
	const tempDiagnostics: Diagnostic[] = [];
	const sigmaValue = parsedToJS[sigmaKey]; // parsed value for the current sigma key
	//console.log(`called checkType on key ${sigmaKey}, required type is: ${requiredType}`);
	let wrongType;
	
	if (requiredType === "string") {
		wrongType = typeof sigmaValue !== 'string' && !(sigmaValue instanceof String);
		//return checkString(sigmaKey, doc, docLines, parsedToJS);
	} else if (requiredType === "array") {
		wrongType = !Array.isArray(sigmaValue);
		//return checkArray(sigmaKey, doc, docLines, parsedToJS);
	} else if (requiredType === "object") {
		// TODO implement this
		// wrongType = !Array.isArray(sigmaValue);
		// //return checkArray(sigmaKey, doc, docLines, parsedToJS);
	} else {
		return [tempDiagnostics,lastCheckedLine];
	}


	
	if (wrongType){
		// get the line that sigmaKey is on
		for (let i = lastCheckedLine; i < doc.lineCount; i++) {
			const lineString = docLines[i];
			//console.log('current Line: ', lineString);
			const regex = new RegExp(`^\\s*${sigmaKey}:`); // to find line line that starts with sigmaKey
			//console.log('regex', regex);
			if (lineString.match(regex)) {
				// get the next key so that the current diagnostic will be on all lines until the next key
				
				const keys = Object.keys(parsedToJS);
				const nextIndex = keys.indexOf(sigmaKey)+1;
				const nextField = keys[nextIndex];
				//console.log(`next field after ${sigmaKey}: `, nextField);

				if (nextField){ // if sigmaKey isn't the last field
					let j=i+1;
					// find the line that nextField is on
					// the diagnostic will range from sigmaKey's line to the line before nextField
					// eslint-disable-next-line no-useless-escape
					const regex = new RegExp(`^\\s*${nextField}:`);
					let thisLine, matchedRegex;
					while (!matchedRegex && j<doc.lineCount){
						thisLine = docLines[j];
						matchedRegex = thisLine.match(regex);
						//console.log('matched Regex: ', matchedRegex);
						//console.log('thisLine: ', thisLine);
						j++;
					}
					if (!matchedRegex){ // just in case we didn't find nextField for some reason
						tempDiagnostics.push(createDiaIncorrectType(doc,lineString,i,i,sigmaKey,requiredType));
					} else {
						//console.log('last line j was at: ', thisLine);
						const idxBeforeNextField = j-2;
						lastCheckedLine = idxBeforeNextField; // to pass in the next time we call checkType
						const lastString = docLines[idxBeforeNextField]; // the line before nextField is the last line in the diagnostic
						//console.log('last line in current diagnostic: ', lastString);
						tempDiagnostics.push(createDiaIncorrectType(doc,lastString,i,idxBeforeNextField,sigmaKey,requiredType));
					}
				} else { // if current key is the last field
					tempDiagnostics.push(createDiaIncorrectType(doc,lineString,i,i,sigmaKey,requiredType));
				}
				return [tempDiagnostics, lastCheckedLine];
			}
		}
	}
	return [tempDiagnostics, lastCheckedLine];
	
}

// /**
//  * Checks whether a sigma value is a string
//  * @param {string} sigmaKey target sigma key, ex: "author"
//  * @param {TextDocument} doc has the contents of the current file
//  * @param {Array<string>} docLines each line of the file as a string
//  * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
//  * @return {tempDiagnostics} array of diagnostics to be displayed
//  */
// function checkString(sigmaKey: string, doc: TextDocument, docLines: Array<string>, parsedToJS: Record<string, unknown>){
// 	const tempDiagnostics: Diagnostic[] = [];
// 	const sigmaValue = parsedToJS[sigmaKey]; // parsed value for the current sigma key
// 	console.log(`called checkString on key ${sigmaKey}`);

// 	if (typeof sigmaValue !== 'string' && !(sigmaValue instanceof String)){
// 		// get the line that author is on
// 		for (let i = 0; i < doc.lineCount; i++) {
// 			const lineString = docLines[i];
// 			const regex = new RegExp(`^${sigmaKey}:`); // to find line line that starts with sigmaKey
// 			if (lineString.match(regex)) {
// 				// get the next key so that the author diagnostic will be on all lines until the next key
				
// 				const keys = Object.keys(parsedToJS);
// 				const nextIndex = keys.indexOf(sigmaKey)+1;
// 				const nextField = keys[nextIndex];
// 				console.log(`next field after ${sigmaKey}: `, nextField);

// 				if (nextField){ // if sigmaKey isn't the last field
// 					let j=i+1;
// 					// find the line that nextField is on
// 					// the diagnostic will range from sigmaKey's line to the line before nextField
// 					const regex = new RegExp(`^${nextField}:`);
// 					let lastCheckedLine, matchedRegex;
// 					while (!matchedRegex && j<doc.lineCount){
// 						lastCheckedLine = docLines[j];
// 						matchedRegex = lastCheckedLine.match(regex);
// 						//console.log('matched Regex: ', matchedRegex);
// 						console.log('lastCheckedLine: ', lastCheckedLine);
// 						j++;
// 					}
// 					if (!matchedRegex){ // just in case we didn't find nextField for some reason
// 						tempDiagnostics.push(createDiaIncorrectType(doc,lineString,i,i,sigmaKey,"string"));
// 					} else {
// 						console.log('last line j was at: ', lastCheckedLine);
// 						const idxBeforeNextField = j-2;
// 						const lastString = docLines[idxBeforeNextField]; // the line before nextField is the last line in the diagnostic
// 						console.log('last line in current diagnostic: ', lastString);
// 						tempDiagnostics.push(createDiaIncorrectType(doc,lastString,i,idxBeforeNextField,sigmaKey,"string"));
// 					}
// 				} else { // if author is for some reason the last field
// 					tempDiagnostics.push(createDiaIncorrectType(doc,lineString,i,i,sigmaKey,"string"));
// 				}
// 				return tempDiagnostics;
// 			}
// 		}
// 	}
// 	return tempDiagnostics;
// }


// // Still working on this one
// /**
//  * Checks whether a sigma value is a YAML array/sequence
//  * @param {string} sigmaKey target sigma key, ex: "author"
//  * @param {TextDocument} doc has the contents of the current file
//  * @param {Array<string>} docLines each line of the file as a string
//  * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
//  * @return {tempDiagnostics} array of diagnostics to be displayed
//  */
// function checkArray(sigmaKey: string, doc: TextDocument, docLines: Array<string>, parsedToJS: Record<string, unknown>){
// 	const tempDiagnostics: Diagnostic[] = [];
// 	const sigmaValue = parsedToJS[sigmaKey]; // parsed value for the current sigma key
// 	console.log(`called checkArray on key ${sigmaKey}`);

// 	if (!Array.isArray(sigmaValue)){
// 		console.log(sigmaValue, "is not array");
// 		// get the line that sigmaKey is on
// 		for (let i = 0; i < doc.lineCount; i++) {
// 			const lineString = docLines[i];
// 			const regex = new RegExp(`^${sigmaKey}:`); // to find line line that starts with sigmaKey
// 			if (lineString.match(regex)) {
// 				// get the next key so that the author diagnostic will be on all lines until the next key
				
// 				const keys = Object.keys(parsedToJS);
// 				const nextIndex = keys.indexOf(sigmaKey)+1;
// 				const nextField = keys[nextIndex];
// 				console.log(`next field after ${sigmaKey}: `, nextField);

// 				if (nextField){ // if sigmaKey isn't the last field
// 					let j=i+1;
// 					// find the line that nextField is on
// 					// the diagnostic will range from sigmaKey's line to the line before nextField
// 					const regex = new RegExp(`^${nextField}:`);
// 					let lastCheckedLine, matchedRegex;
// 					while (!matchedRegex && j<doc.lineCount){
// 						lastCheckedLine = docLines[j];
// 						matchedRegex = lastCheckedLine.match(regex);
// 						//console.log('matched Regex: ', matchedRegex);
// 						console.log('lastCheckedLine: ', lastCheckedLine);
// 						j++;
// 					}
// 					if (!matchedRegex){ // just in case we didn't find nextField for some reason
// 						tempDiagnostics.push(createDiaIncorrectType(doc,lineString,i,i,sigmaKey,"array"));
// 					} else {
// 						console.log('last line j was at: ', lastCheckedLine);
// 						const idxBeforeNextField = j-2;
// 						const lastString = docLines[idxBeforeNextField]; // the line before nextField is the last line in the diagnostic
// 						console.log('last line in current diagnostic: ', lastString);
// 						tempDiagnostics.push(createDiaIncorrectType(doc,lastString,i,idxBeforeNextField,sigmaKey,"array"));
// 					}
// 				} else { // if author is for some reason the last field
// 					tempDiagnostics.push(createDiaIncorrectType(doc,lineString,i,i,sigmaKey,"array"));
// 				}
// 				return tempDiagnostics;
// 			}
// 		}
// 	}
// 	return tempDiagnostics;
// }


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
					//console.log(lineString);
					const uppercaseWords = lineString.match(/\b[A-Z]\S*\b/g);
					//console.log(uppercaseWords);
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
	return tempDiagnostics;
}


/**
 * Checks that the value of the author field is the correct type
 * The type of the author field should be a string, not a list, according to https://github.com/SigmaHQ/sigma/wiki/Rule-Creation-Guide
 * If the value of author field is a YAML mapping or sequence, diagnostic may be multiple lines
 * 
 * @param {TextDocument} doc has the contents of the current file
 * @param {Array<string>} docLines each line of the file as a string
 * @param {Record<string, unknown>} parsedToJS javascript object with parsed contents of yaml file
 * @return {tempDiagnostics} array of diagnostics to be displayed
 */
function checkAuthor(doc: TextDocument, docLines: Array<string>, parsedToJS: Record<string, unknown>){
	// 
	const tempDiagnostics: Diagnostic[] = [];
	const authorValue = parsedToJS.author;

	//console.log('checkAuthor called');
	// TODO add diagnostic for needing quotation marks around @ symbol in author value

	// value is invalid if not a string
	if (typeof authorValue !== 'string' && !(authorValue instanceof String)){
		// get the line that author is on
		for (let i = 0; i < doc.lineCount; i++) {
			const lineString = docLines[i];
			if (lineString.match(/^author:/)) {
				// get the next key so that the author diagnostic will be on all lines until the next key
				
				const keys = Object.keys(parsedToJS);
				const nextIndex = keys.indexOf("author")+1;
				const nextField = keys[nextIndex];
				//console.log('next field after author: ', nextField);

				if (nextField){ // if author isn't the last field
					let j=i+1;
					// finds the line that nextField is on
					// the diagnostic will range from author to the line before nextField
					const regex = new RegExp(`^${nextField}:`);
					let lastCheckedLine, matchedRegex;
					while (!matchedRegex && j<doc.lineCount){
						lastCheckedLine = docLines[j];
						matchedRegex = lastCheckedLine.match(regex);
						//console.log('matched Regex: ', matchedRegex);
						//console.log('lastCheckedLine: ', lastCheckedLine);
						j++;
					}
					if (!matchedRegex){ // just in case we didn't find nextField for some reason
						tempDiagnostics.push(createDiaAuthorNotString(doc,lineString,i,i));
					} else {
						//console.log('last line j was at: ', lastCheckedLine);
						const idxBeforeNextField = j-2;
						const lastString = docLines[idxBeforeNextField]; // the line before nextField is the last line in the diagnostic
						//console.log('last line in author diagnostic: ', lastString);
						tempDiagnostics.push(createDiaAuthorNotString(doc,lastString,i,idxBeforeNextField));
					}
				} else { // if author is for some reason the last field
					tempDiagnostics.push(createDiaAuthorNotString(doc,lineString,i,i));
				}
				return tempDiagnostics;
			}
		}
	}
	// } else if (authorValue.includes("@") && !(authorValue.match(/^["'].*["']$/))){ 
	// 	console.log("author Value:",authorValue);
	// 	for (let i = 0; i < doc.lineCount; i++) {
	// 		const lineString = docLines[i];
	// 		if (lineString.match(/^author:/)) {
	// 			tempDiagnostics.push(createDiaAtSymbolNeedsQuotes(doc,lineString, i));
	// 			console.log("at statement reached");
				
	// 		}
	// 	}
	// } 
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
		if (!(typeof parsedToJS.detection === 'object') || parsedToJS.detection === null || !("condition" in parsedToJS.detection)){
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