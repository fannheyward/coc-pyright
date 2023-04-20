import { CancellationToken, OutputChannel, TextDocument, Uri } from 'coc.nvim';
import { ILinterInfo, ILintMessage } from '../../types';
import { BaseLinter } from './baseLinter';

const COLUMN_OFF_SET = 1;
const REGEX = '(?<file>[^:]+):(?<line>\\d+)(:(?<column>\\d+))?: (?<type>\\w+): (?<message>.*)\\r?(\\n|$)';

export class MyPy extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const args = ['--python-executable', this.pythonSettings.pythonPath, Uri.parse(document.uri).fsPath];
    const messages = await this.run(args, document, cancellation, REGEX);
    messages.forEach((msg) => {
      msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.mypyCategorySeverity);
      msg.code = msg.type;
    });
    return messages;
  }
}
