# Language Server Protocol / Sigma Language

Team repository for CSCI 4950 - Senior Software Project

VSCode Language Server Extension Guide:
https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

## Functionality

This LSP works for SIGMA file (in YAML format). It has the following language features:
- Completions
- Diagnostics
- Hover

It also includes partial unit tests.

## Structure

```
sigma-lsp
├── client // Language Client
│   ├── src
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
│   ├── src
│   │   └── server.ts // Language Server entry point
│   │   └── completion.ts // Completions feature entry point
│   │   └── diagnostics.ts // Diagnostics feature entry point
│   │   └── hover.ts // Hover feature entry point
│   ├── test //Unit tests for main features
```

## Running the LSP - SIGMA

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to start compiling the client and server in [watch mode](https://code.visualstudio.com/docs/editor/tasks#:~:text=The%20first%20entry%20executes,the%20HelloWorld.js%20file.).
- Switch to the Run and Debug View in the Sidebar (Ctrl+Shift+D).
- Select `Launch Client` from the drop down (if it is not already).
- Press ▷ to run the launch config (F5).
- In the [Extension Development Host](https://code.visualstudio.com/api/get-started/your-first-extension#:~:text=Then%2C%20inside%20the%20editor%2C%20press%20F5.%20This%20will%20compile%20and%20run%20the%20extension%20in%20a%20new%20Extension%20Development%20Host%20window.) instance of VSCode, open a document in SIGMA/YAML language mode.
  - Type `title` to see completion.
  - Enter text content such as `title: testSigmaFile title is too long and will create a dianostic`. The extension will emit diagnostics for the entire line.
  - Type `title` and hover over the word to see a pop-up.
  
 ## Running Unit Tests for server.ts class
 - From the root folder, run `cd server` and then `npm run test` to execute Jest unit tests on completion.ts, diagnostics.ts, and hover.ts classes
