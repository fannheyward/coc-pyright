import { CancellationToken, FormattingOptions, OutputChannel, Range, TextDocument, TextEdit, Thenable, window } from 'coc.nvim';
import { IPythonSettings } from '../types';
import { BaseFormatter } from './baseFormatter';

export class BlackFormatter extends BaseFormatter {
  constructor(public readonly pythonSettings: IPythonSettings, public readonly outputChannel: OutputChannel) {
    super('black', pythonSettings, outputChannel);
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const formatSelection = range ? range : false;

    if (formatSelection) {
      const errorMessage = async () => {
        this.outputChannel.appendLine('Black does not support the "Format Selection" command');
        // Black does not support partial formatting on purpose.
        window.showErrorMessage('Black does not support the "Format Selection" command');
        return [] as TextEdit[];
      };

      return errorMessage();
    }

    const blackArgs = ['--diff', '--quiet'];
    if (this.pythonSettings.formatting.blackArgs.length > 0) {
      blackArgs.push(...this.pythonSettings.formatting.blackArgs);
    }
    const promise = super.provideDocumentFormattingEdits(document, options, token, blackArgs);
    return promise;
  }
}
