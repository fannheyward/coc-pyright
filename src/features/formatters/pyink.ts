import type {
  CancellationToken,
  FormattingOptions,
  OutputChannel,
  Range,
  TextDocument,
  TextEdit,
  Thenable,
} from 'coc.nvim';
import type { IPythonSettings } from '../../types';
import { BaseFormatter } from './baseFormatter';

export class PyinkFormatter extends BaseFormatter {
  constructor(
    public readonly pythonSettings: IPythonSettings,
    public readonly outputChannel: OutputChannel,
  ) {
    super('pyink', pythonSettings, outputChannel);
  }

  public formatDocument(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken,
    range?: Range,
  ): Thenable<TextEdit[]> {
    const args = ['--diff', '--quiet'];
    if (this.pythonSettings.formatting.pyinkArgs.length > 0) {
      args.push(...this.pythonSettings.formatting.pyinkArgs);
    }

    if (range) {
      args.push(`--pyink-lines=${range.start.line + 1}-${range.end.line}`);
    }

    const promise = super.provideDocumentFormattingEdits(document, options, token, args);
    return promise;
  }
}
