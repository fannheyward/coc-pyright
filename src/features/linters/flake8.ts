import { CancellationToken, OutputChannel, TextDocument, Uri } from 'coc.nvim';
import { ILinterInfo, ILintMessage } from '../../types';
import { BaseLinter } from './baseLinter';

const COLUMN_OFF_SET = 1;

export class Flake8 extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const fsPath = Uri.parse(document.uri).fsPath;
    const args = ['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', '--exit-zero'];
    if (this.info.stdinSupport) {
      args.push('--stdin-display-name', fsPath, '-');
    } else {
      args.push(fsPath);
    }
    const messages = await this.run(args, document, cancellation);
    messages.forEach((msg) => {
      msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.flake8CategorySeverity);
    });
    return messages;
  }
}
