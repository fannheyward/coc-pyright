import { TextDocument, FormattingOptions, CancellationToken, Range, Thenable, TextEdit } from 'coc.nvim';
import { BaseFormatter } from './baseFormatter';

export class AutoPep8Formatter extends BaseFormatter {
  constructor() {
    super('autopep8');
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const formatSelection = range ? range : false;

    const autoPep8Args = ['--diff'];
    if (this.pythonSettings.formatting.autopep8Args.length > 0) {
      autoPep8Args.push(...this.pythonSettings.formatting.autopep8Args);
    }
    if (formatSelection) {
      autoPep8Args.push(...['--line-range', (range!.start.line + 1).toString(), (range!.end.line + 1).toString()]);
    }
    const promise = super.provideDocumentFormattingEdits(document, options, token, autoPep8Args);
    return promise;
  }
}
