import { spawnSync } from 'child_process';
import { CancellationToken, OutputChannel, TextDocument, Uri, workspace } from 'coc.nvim';
import { ILinterInfo, ILintMessage, LintMessageSeverity } from '../../types';
import { BaseLinter } from './baseLinter';

const COLUMN_OFF_SET = 1;

interface IRuffLocation {
  row: number;
  column: number;
}

interface IRuffLintMessage {
  kind: string | { [key: string]: any[] };
  code: string;
  message: string;
  location: IRuffLocation;
  end_location: IRuffLocation;
  filename: string;
}

export class Ruff extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  protected async runLinter(document: TextDocument, _cancellation: CancellationToken): Promise<ILintMessage[]> {
    if (!this.info.isEnabled(Uri.parse(document.uri))) return [];

    const args = [...this.info.linterArgs(), '--format=json', Uri.parse(document.uri).fsPath];
    const bin = this.info.pathName();

    try {
      this.outputChannel.appendLine(`${'#'.repeat(10)} Run linter ${this.info.id}:`);
      this.outputChannel.appendLine(`${bin} ${args.join(' ')}`);
      this.outputChannel.appendLine('');

      const result = spawnSync(bin, args, { encoding: 'utf8', cwd: workspace.root });

      this.outputChannel.append(`${'#'.repeat(10)} Linting Output - ${this.info.id}${'#'.repeat(10)}\n`);
      this.outputChannel.append(result.stdout);
      this.outputChannel.appendLine('');

      const messages: ILintMessage[] = JSON.parse(result.stdout).map((msg: IRuffLintMessage) => {
        return {
          line: msg.location.row,
          column: msg.location.column - COLUMN_OFF_SET,
          endLine: msg.end_location.row,
          endColumn: msg.end_location.column,
          code: msg.code,
          message: msg.message,
          type: '',
          severity: LintMessageSeverity.Warning, // https://github.com/charliermarsh/ruff/issues/645
          provider: this.info.id,
          file: msg.filename,
        };
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
