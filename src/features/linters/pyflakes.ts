import { CancellationToken, OutputChannel, TextDocument, Uri } from 'coc.nvim';
import { ILinterInfo, ILintMessage, LintMessageSeverity } from '../../types';
import { BaseLinter } from './baseLinter';

const REGEX = '(?<file>.*.py):(?<line>\\d+):(?<column>\\d+): (?<message>.*)\\r?(\\n|$)';

export class Pyflakes extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const messages = await this.run([Uri.parse(document.uri).fsPath], document, cancellation, REGEX);
    messages.forEach((msg) => {
      msg.severity = LintMessageSeverity.Warning;
    });

    return messages;
  }
}
