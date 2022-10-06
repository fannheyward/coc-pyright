import { spawnSync } from 'child_process';
import { CancellationToken, OutputChannel, TextDocument, Uri, workspace } from 'coc.nvim';
import { ILinterInfo, ILintMessage, LintMessageSeverity } from '../../types';
import { BaseLinter } from './baseLinter';

const REGEX = '(?<file>.*.py):(?<line>\\d+):(?<column>\\d+): (?<code>[\\w-]+) (?<message>.*)\\r?(\\n|$)';
const COLUMN_OFF_SET = 1;

export class Ruff extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    if (!this.info.isEnabled(Uri.parse(document.uri))) return [];

    const args = [...this.info.linterArgs(), Uri.parse(document.uri).fsPath];
    const bin = this.info.pathName();

    try {
      this.outputChannel.appendLine(`${'#'.repeat(10)} Run linter ${this.info.id}:`);
      this.outputChannel.appendLine(`${bin} ${args.join(' ')}`);
      this.outputChannel.appendLine('');

      const result = spawnSync(bin, args, { encoding: 'utf8', cwd: workspace.root });

      this.outputChannel.append(`${'#'.repeat(10)} Linting Output - ${this.info.id}${'#'.repeat(10)}\n`);
      this.outputChannel.append(result.stdout);
      this.outputChannel.appendLine('');

      const messages = await super.parseMessages(result.stdout, document, cancellation, REGEX);
      messages.forEach((msg) => {
        msg.severity = LintMessageSeverity.Warning;
      });

      return messages;
    } catch (error) {
      this.outputChannel.appendLine(`Linting with ${this.info.id} failed:`);
      if (error instanceof Error) {
        this.outputChannel.appendLine(error.message.toString());
      }
      return [];
    }
  }
}
