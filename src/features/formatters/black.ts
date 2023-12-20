import { CancellationToken, FormattingOptions, OutputChannel, Range, TextDocument, TextEdit, Thenable } from 'coc.nvim';
import { IPythonSettings } from '../../types';
import { BaseFormatter } from './baseFormatter';

export class BlackFormatter extends BaseFormatter {
  constructor(public readonly pythonSettings: IPythonSettings, public readonly outputChannel: OutputChannel) {
    super('black', pythonSettings, outputChannel);
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const blackArgs = ['--diff', '--quiet'];
    if (range) {
      blackArgs.push(`--line-ranges=${range.start.line + 1}-${range.end.line}`);
    }
    if (this.pythonSettings.formatting.blackArgs.length > 0) {
      blackArgs.push(...this.pythonSettings.formatting.blackArgs);
    }
    const promise = super.provideDocumentFormattingEdits(document, options, token, blackArgs);
    return promise;
  }
}
