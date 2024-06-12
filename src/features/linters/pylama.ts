import { type CancellationToken, type OutputChannel, type TextDocument, Uri } from 'coc.nvim';
import { type ILinterInfo, type ILintMessage, LintMessageSeverity } from '../../types';
import { BaseLinter } from './baseLinter';

const REGEX =
  '(?<file>.py):(?<line>\\d+):(?<column>\\d+): \\[(?<type>\\w+)\\] (?<code>\\w\\d+):? (?<message>.*)\\r?(\\n|$)';
const COLUMN_OFF_SET = 1;

export class Pylama extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const messages = await this.run(
      ['--format=parsable', Uri.parse(document.uri).fsPath],
      document,
      cancellation,
      REGEX,
    );
    // All messages in pylama are treated as warnings for now.
    for (const msg of messages) {
      msg.severity = LintMessageSeverity.Warning;
    }

    return messages;
  }
}
