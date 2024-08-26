import {
  type CancellationToken,
  type FormattingOptions,
  type OutputChannel,
  type Range,
  type TextDocument,
  type TextEdit,
  type Thenable,
  window,
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
      ruffArgs.push(`--range=${range.start.line + 1}-${range.end.line}`);
    }
    if (this.pythonSettings.formatting.ruffArgs.length > 0) {
      ruffArgs.push(...this.pythonSettings.formatting.ruffArgs);
    }
    return super.provideDocumentFormattingEdits(document, options, token, ruffArgs);
  }
}
