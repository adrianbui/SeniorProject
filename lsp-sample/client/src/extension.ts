/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, languages } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// called only once on document open: checks if first line starts with "title:" or "#sigma"
	workspace.textDocuments.forEach(doc => {
        // if (debug) {
        //     console.log(doc.fileName)
        // }
        if (doc.languageId == 'yaml' && (doc.lineAt(0).text.match(/^title: .*$/) || doc.lineAt(0).text.match(/^\s*#sigma\s*$/))) {
            languages.setTextDocumentLanguage(doc, "sigma")
        }
		//console.log(doc);
		console.log('textDocuments.forEach called')
    })

	// TODO - Problem: this can activate our extension on every type of document (even .json files, etc.)
	// called anytime the text is changed: checks if first line starts with "title:" or "#sigma" if the document is not already sigma
	// context.subscriptions.push(
	// 	workspace.onDidChangeTextDocument(e => {
	// 		if (!(e.document.languageId === "sigma")){
	// 			if (e.document.lineAt(0).text.match(/^title: .*$/) || e.document.lineAt(0).text.match(/^\s*#sigma\s*$/)){
	// 				languages.setTextDocumentLanguage(e.document, "sigma")
	// 			}
	// 		}
	// 	})
	// )

	context.subscriptions.push(
        workspace.onDidOpenTextDocument(doc => {
			console.log('onDidOpenTextDocument called')
			console.log(doc)
            if (doc.languageId == 'yaml' && doc.lineAt(0).text.match(/^title: .*$/)) {
                languages.setTextDocumentLanguage(doc, "sigma")
            }
        }),
    )
	
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [
			{ scheme: 'file', language: 'plaintext' },
			{ scheme: 'file', language: 'sigma' },
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
		// synchronize: {
		// 	// Notify the server about file changes to '.clientrc files contained in the workspace
		// 	//fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		// 	configurationSection: 'yaml',
		// 	fileEvents: workspace.createFileSystemWatcher('**/*.?(e)y?(a)ml')
		// }
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'sigmalsp',
		'Sigma LSP',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
