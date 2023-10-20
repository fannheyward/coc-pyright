import { CancellationToken, FormattingOptions, OutputChannel, Range, TextDocument, TextEdit, Thenable, window } from 'coc.nvim';
import { IPythonSettings } from '../../types';
import { BaseFormatter } from './baseFormatter';

export class RuffFormatter extends BaseFormatter {
  constructor(public readonly pythonSettings: IPythonSettings, public readonly outputChannel: OutputChannel) {
    super('ruff', pythonSettings, outputChannel);
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const formatSelection = range ? range : false;

    if (formatSelection) {
      const errorMessage = async () => {
        this.outputChannel.appendLine('Ruff does not support the "Format Selection" command');
        window.showErrorMessage('Ruff does not support the "Format Selection" command');
        return [] as TextEdit[];
      };

      return errorMessage();
    }

    const ruffArgs = ['format', '--diff', '--silent'];
    if (this.pythonSettings.formatting.ruffArgs.length > 0) {
      ruffArgs.push(...this.pythonSettings.formatting.ruffArgs);
    }
    return super.provideDocumentFormattingEdits(document, options, token, ruffArgs);
  }
}
