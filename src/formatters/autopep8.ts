import { workspace } from 'coc.nvim';
import { CancellationToken, FormattingOptions, Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseFormatter } from './base';

export class AutoPep8Formatter extends BaseFormatter {
  constructor() {
    super('autopep8');
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    // const stopWatch = new StopWatch()
    const settings = workspace.getConfiguration('python', document.uri);
    const hasCustomArgs = Array.isArray(settings.formatting.autopep8Args) && settings.formatting.autopep8Args.length > 0;
    const formatSelection = range ? range : false;

    const autoPep8Args = ['--diff'];
    if (hasCustomArgs) {
      autoPep8Args.push(...settings.formatting.autopep8Args);
    }
    if (formatSelection) {
      autoPep8Args.push(...['--line-range', (range!.start.line + 1).toString(), (range!.end.line + 1).toString()]);
    }
    const promise = super.provideDocumentFormattingEdits(document, options, token, autoPep8Args);
    return promise;
  }
}
