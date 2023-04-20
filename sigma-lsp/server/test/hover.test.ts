import { handleHover } from '../src/hover';
import { TextDocumentPositionParams, TextDocuments, TextDocument } from 'vscode-languageserver/node';

describe("handleHover", () => {
  //Test to check unfound word
  it("returns empty when word is not found in sigmaKeysMap", () => {
    //Mocking
    const textDocumentPosition: TextDocumentPositionParams = {
      textDocument: {
        uri: "uri"
      },
      position: {
        line: 0,
        character: 6
      }
    };

    const documents: TextDocuments<TextDocument> = ({
      get: () => ({
        getText: () => "testing: this is a test"
      }),
    } as unknown) as TextDocuments<TextDocument>;

    //Call method
    const result = handleHover(textDocumentPosition, documents);

    //Compare result
    expect(result).toEqual({
      contents: {
        kind: "markdown",
        value: ""
      },
      range: {
        start: {
          line: 0,
          character: 0
        },
        end: {
          line: 0,
          character: 7
        }
      }
    });
  });

  //Test for happy path
  it("returns hover object with message when word is found in sigmaKeysMap", () => {
    //Mocking
    const textDocumentPosition: TextDocumentPositionParams = {
      textDocument: {
        uri: "uri"
      },
      position: {
        line: 0,
        character: 6
      }
    };

    const documents: TextDocuments<TextDocument> = ({
      get: () => ({
        getText: () => "options: we are testing sigma lsp"
      })
    } as unknown) as TextDocuments<TextDocument>;

    //Call method
    const result = handleHover(textDocumentPosition, documents);

    //Compare result
    expect(result).toEqual({
      contents: {
        kind: "markdown",
        value: "| Description |\n| --- |\n| Options for the Sigma rule |"
      },
      range: {
        start: {
          line: 0,
          character: 0
        },
        end: {
          line: 0,
          character: 7
        }
      }
    });
  });
});