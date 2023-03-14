/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
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
<<<<<<< HEAD
=======
	MarkupKind,
	Hover,
>>>>>>> ea2d240 (hover working)
	Range
} from 'vscode-languageserver/node';

import * as YAML from "yaml";

import {handleDiagnostics} from './diagnostics';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { error } from 'console';


// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);


let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			hoverProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
	connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);
	//console.log('current textDocument: ', textDocument);
	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];
	
	const newDiagnostics = handleDiagnostics(textDocument);
	diagnostics.push(...newDiagnostics);

	const parsedYamlDoc = YAML.parseDocument(text);

	// console.log('Yaml.parse: ', YAML.parse(text));
	// This could be a good alternative to parsing each line of text
	const parsedToJS = parsedYamlDoc.toJS();
	console.log('parsed to Js: ', parsedToJS);

	const errorsArr = parsedYamlDoc.errors;
	for (let i=0; i<errorsArr.length; i++){
		const err = errorsArr[i];
		if (err instanceof Error) {
			const newDiagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: {
					start: textDocument.positionAt((err as any).pos[0]),
					end: textDocument.positionAt((err as any).pos[1])
				},
				message: err.message,
				source: 'umn-sigma-lsp'
			};
			diagnostics.push(newDiagnostic);
		}
	}

	// credit to https://github.com/humpalum/vscode-sigma/blob/411c66debbdbe5a90b8e815d310f0f82530df12a/src/diagnostics.ts
	// try {
	// 	const parsedYAML = YAML.parse(text);
	// } catch (error) {
	// 	console.log(error);
	// 	if (error instanceof Error) {
	// 		const newDiagnostic: Diagnostic = {
	// 			severity: DiagnosticSeverity.Error,
	// 			range: {
	// 				start: textDocument.positionAt((error as any).pos[0]),
	// 				end: textDocument.positionAt((error as any).pos[1])
	// 			},
	// 			message: error.message,
	// 			source: 'umn-sigma-lsp'
	// 		}
	// 		diagnostics.push(newDiagnostic)
	// 	}
	// }
	
	const pattern = /\b[A-Z]{2,}\b/g;
	const pattern2 = /^title:.{71,}/g;
	let m: RegExpExecArray | null;
	let m2: RegExpExecArray | null;
	let problems = 0;

	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'umn-sigma-lsp'
		};

	
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnostic);
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

connection.onHover((textDocumentPosition: TextDocumentPositionParams): Hover | null => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return null;
    }

    const { line, character } = textDocumentPosition.position;
    
	const lineText = document.getText({
        start: { line, character: 0 },
        end: { line: line + 1, character: 0 }
    });

    const wordRange = getWordRange(lineText, character);
    const word = lineText.substring(wordRange.start.character, wordRange.end.character);

	let hoverMessage;
	if (word.length === 0) {
		hoverMessage = "No word found";
	} else {
		hoverMessage = `We are hoving over this word: '${word}'.`;
	}
    
	const hover: Hover = {
		contents: {
			kind: MarkupKind.Markdown,
			value: hoverMessage
		},
		range: wordRange
    };
	return hover;
});

function getWordRange(lineText: string, position: number): Range {
    const regex = /\w+/g;
    let match: RegExpExecArray | null;

    while (match = regex.exec(lineText)) {
        if (position >= match.index && position < match.index + match[0].length) {
            return {
                start: { line: 0, character: match.index },
                end: { line: 0, character: match.index + match[0].length }
            };
        }
    }

    return {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 }
    };
}

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
	//console.log("onCompletion called");

		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);


// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
