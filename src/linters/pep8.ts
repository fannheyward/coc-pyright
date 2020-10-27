import { OutputChannel, Uri } from 'coc.nvim';
import { CancellationToken } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ILinterInfo, ILintMessage } from '../types';
import { BaseLinter } from './baseLinter';

const COLUMN_OFF_SET = 1;

export class Pep8 extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const messages = await this.run(['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', Uri.parse(document.uri).fsPath], document, cancellation);
    messages.forEach((msg) => {
      msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pep8CategorySeverity);
    });
    return messages;
  }
}
