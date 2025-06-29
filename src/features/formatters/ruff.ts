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

export class RuffFormatter extends BaseFormatter {
  constructor(
    public readonly pythonSettings: IPythonSettings,
    public readonly outputChannel: OutputChannel,
  ) {
    super('ruff', pythonSettings, outputChannel);
  }

  public formatDocument(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken,
    range?: Range,
  ): Thenable<TextEdit[]> {
    const ruffArgs = ['format', '--diff', '--silent'];
    if (range) {
      ruffArgs.push(`--range=${range.start.line + 1}-${range.end.line + 1}`);
    }
    if (this.pythonSettings.formatting.ruffArgs.length > 0) {
      ruffArgs.push(...this.pythonSettings.formatting.ruffArgs);
    }
    return super.provideDocumentFormattingEdits(document, options, token, ruffArgs);
  }
}
