import {
	TextDocuments,
	TextDocumentPositionParams,
	MarkupKind,
	Hover,
	Range
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// Mapping SIGMA attributes to their meaning
const sigmaKeysMap = new Map<string, string>([
	['title', 'A brief title for the rule that should contain what the rules is supposed to detect (max. 256 characters)'],
	['status', 'Declares the status of the rule (e.g. experimental, stable)'],
	['description', 'A short description of the rule and the malicious activity that can be detected (max. 65,535 characters)'],
	['author', 'Creator of the rule'],
	['logsource', 'Describes the log data on which the detection is meant to be applied to'],
	['references', 'References to the source that the rule was derived from'],
	['tags', 'A Sigma rule can be categorised with tags'],
	['detection', 'A set of search-identifiers that represent properties of searches on log data'],
	['condition', 'Condition for the Sigma rule to match'],
	['falsepositives', 'List of known false positives for the Sigma rule'],
	['level', 'Severity level of the Sigma rule'],
	['fields', 'Additional fields used in the Sigma rule'],
	['options', 'Options for the Sigma rule']
]);

// Main logic
export function handleHover(textDocumentPosition: TextDocumentPositionParams, documents: TextDocuments<TextDocument>): Hover | null {
    const document = documents.get(textDocumentPosition.textDocument.uri);
	
    if (!document) {
        return null;
    }
	
	const { line, character } = textDocumentPosition.position;

	//destructuring the document
	const lineText = getLineText(document, line);

    const wordRange = getWordRange(lineText, character);

	//find the word being pointed
    const word = lineText.substring(wordRange.start.character, wordRange.end.character);

	const hoverMessage = getHoverMessage(word);
    
	//Forming Hover object where the message is presented in Markup kind
	const hover: Hover = {
		contents: {
			kind: MarkupKind.Markdown,
			value: hoverMessage
		},
		range: wordRange
    };
	
	return hover;
}

function getLineText(document: TextDocument, line: number): string {
	return document.getText({
		start: { line, character: 0 },
		end: { line: line + 1, character: 0 },
	});
}

//Helper function to get Word Range
function getWordRange(lineText: string, character: number): Range {
	const word = findWordAtCharacter(lineText, character);

	if (word) {
		const index = lineText.indexOf(word);
		return createRange(0, index, 0, index + word.length);
	} else {
		//empty Range
		return createRange(0, 0, 0, 0);
	}
}

function findWordAtCharacter(lineText: string, character: number): string | null {
	//look for a complete word before the colon -- indicating SIGMA attribute
	const regex = /\w+(?=\s*:)/g;
	
	let match = regex.exec(lineText);

	while (match !== null) {
		const isCharacterAfterStart = (character >= match.index);
		const isCharacterBeforeEnd = (character < match.index + match[0].length);
		if (isCharacterAfterStart && isCharacterBeforeEnd) {
			return match[0];
		}
    
		match = regex.exec(lineText);
	}
  
	return null;
}
  
function createRange(startingLine: number, startingCharacter: number, endingLine: number, endingCharacter: number): Range {
	return {
		start: { line: startingLine, character: startingCharacter },
		end: { line: endingLine, character: endingCharacter }
	};
}

function getHoverMessage(word: string): string {
	if (word.length === 0) {
		return "No word found";
	}
  
	if (sigmaKeysMap.has(word)) {
		const definition = sigmaKeysMap.get(word);
		return formatHoverMessage(definition);
	}
	
	//Not showing anything if the word does not match any keys in the sigmaKeysMap
	return "";
}

function formatHoverMessage(definition: string | undefined): string {
	if (definition === undefined) {
		return "";
	}

	return [`| Description |`,
			`| --- |`,
			`| ${definition} |`
			].join("\n");
}

module.exports = {handleHover};
