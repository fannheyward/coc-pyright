import { type CancellationToken, OutputChannel, type TextDocument, Uri, workspace } from 'coc.nvim';
import path from 'node:path';
import { ILinterInfo, type ILintMessage } from '../../types';
import { BaseLinter } from './baseLinter';

interface IProspectorResponse {
  messages: IProspectorMessage[];
}
interface IProspectorMessage {
  source: string;
  message: string;
  code: string;
  location: IProspectorLocation;
}
interface IProspectorLocation {
  function: string;
  path: string;
  line: number;
  character: number;
  module: 'beforeFormat';
}

export class Prospector extends BaseLinter {
  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const relativePath = path.relative(workspace.root, Uri.parse(document.uri).fsPath);
    return this.run(['--absolute-paths', '--output-format=json', relativePath], document, cancellation);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async parseMessages(output: string, _document: TextDocument, _regEx: string) {
    let parsedData: IProspectorResponse;
    try {
      parsedData = JSON.parse(output);
    } catch (ex) {
      this.outputChannel.appendLine(`${'#'.repeat(10)}Linting Output - ${this.info.id}${'#'.repeat(10)}`);
      this.outputChannel.append(output);
      return [];
    }
    return parsedData.messages
      .filter((_value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems)
      .map((msg) => {
        const lineNumber = msg.location.line === null || Number.isNaN(msg.location.line) ? 1 : msg.location.line;

        return {
          code: msg.code,
          message: msg.message,
          column: msg.location.character,
          line: lineNumber,
          type: msg.code,
          provider: `${this.info.id} - ${msg.source}`,
        };
      });
  }
}
