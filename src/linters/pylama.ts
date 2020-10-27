import { OutputChannel, Uri } from 'coc.nvim';
import { CancellationToken } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ILinterInfo, ILintMessage, LintMessageSeverity } from '../types';
import { BaseLinter } from './baseLinter';

const REGEX = '(?<file>.py):(?<line>\\d+):(?<column>\\d+): \\[(?<type>\\w+)\\] (?<code>\\w\\d+):? (?<message>.*)\\r?(\\n|$)';
const COLUMN_OFF_SET = 1;

export class PyLama extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const messages = await this.run(['--format=parsable', Uri.parse(document.uri).fsPath], document, cancellation, REGEX);
    // All messages in pylama are treated as warnings for now.
    messages.forEach((msg) => {
      msg.severity = LintMessageSeverity.Warning;
    });

    return messages;
  }
}
