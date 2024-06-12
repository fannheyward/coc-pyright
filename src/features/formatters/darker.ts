import {
  type CancellationToken,
  type FormattingOptions,
  type OutputChannel,
  type TextDocument,
  type TextEdit,
  type Thenable,
  Uri,
} from 'coc.nvim';
import type { IPythonSettings } from '../../types';
import { BaseFormatter } from './baseFormatter';

export class DarkerFormatter extends BaseFormatter {
  constructor(
    public readonly pythonSettings: IPythonSettings,
    public readonly outputChannel: OutputChannel,
  ) {
    super('darker', pythonSettings, outputChannel);
  }

  createTempFile(document: TextDocument): Promise<string> {
    return new Promise<string>((resolve) => {
      resolve(Uri.parse(document.uri).fsPath);
    });
  }

  public formatDocument(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken,
  ): Thenable<TextEdit[]> {
    const darkerArgs = ['--diff'];
    if (this.pythonSettings.formatting.darkerArgs.length > 0) {
      darkerArgs.push(...this.pythonSettings.formatting.darkerArgs);
    }
    return super.provideDocumentFormattingEdits(document, options, token, darkerArgs);
  }
}
