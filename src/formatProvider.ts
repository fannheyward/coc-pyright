import { DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, ProviderResult } from 'coc.nvim';
import { CancellationToken, Disposable, FormattingOptions, Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AutoPep8Formatter } from './formatters/autopep8';
import { BaseFormatter } from './formatters/base';
import { BlackFormatter } from './formatters/black';
import { YapfFormatter } from './formatters/yapf';

export class PythonFormattingEditProvider implements DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider {
  private formatters = new Map<string, BaseFormatter>();
  private disposables: Disposable[] = [];

  constructor() {
    this.formatters.set('black', new BlackFormatter());
    this.formatters.set('yapf', new YapfFormatter());
    this.formatters.set('autopep8', new AutoPep8Formatter());
  }

  private async _provideEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Promise<TextEdit[]> {
    const formater = this.formatters.get('autopep8');
    if (!formater) {
      return [] as TextEdit[];
    }

    return formater.formatDocument(document, options, token, range);
  }

  provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
    return this._provideEdits(document, options, token);
  }

  provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
    return this._provideEdits(document, options, token, range);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
