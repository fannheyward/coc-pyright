import { Uri, type CancellationToken, type TextDocument } from 'coc.nvim';
import { LintMessageSeverity, type ILintMessage } from '../../types';
import { BaseLinter } from './baseLinter';

const REGEX = '(?<file>.*.py):(?<line>\\d+):(?<column>\\d+): (?<message>.*)\\r?(\\n|$)';

export class Pyflakes extends BaseLinter {
  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const messages = await this.run([Uri.parse(document.uri).fsPath], document, cancellation, REGEX);
    for (const msg of messages) {
      msg.severity = LintMessageSeverity.Warning;
    }

    return messages;
  }
}
