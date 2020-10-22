import { workspace } from 'coc.nvim';
import { CancellationToken, FormattingOptions, Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseFormatter } from './baseFormatter';

export class BlackFormatter extends BaseFormatter {
  constructor() {
    super('black');
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const formatSelection = range ? range : false;

    if (formatSelection) {
      const errorMessage = async () => {
        this.outputChannel.appendLine('Black does not support the "Format Selection" command');
        // Black does not support partial formatting on purpose.
        workspace.showMessage('Black does not support the "Format Selection" command', 'error');
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
