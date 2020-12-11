import { DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, ProviderResult, workspace } from 'coc.nvim';
import { CancellationToken, Disposable, FormattingOptions, Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PythonSettings } from './configSettings';
import { AutoPep8Formatter } from './formatters/autopep8';
import { BaseFormatter } from './formatters/baseFormatter';
import { BlackFormatter } from './formatters/black';
import { YapfFormatter } from './formatters/yapf';
import { DarkerFormatter } from './formatters/darker';

export class PythonFormattingEditProvider implements DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider {
  private formatters = new Map<string, BaseFormatter>();
  private disposables: Disposable[] = [];
  private pythonSettings: PythonSettings;

  constructor() {
    this.pythonSettings = PythonSettings.getInstance();
    this.formatters.set('black', new BlackFormatter());
    this.formatters.set('yapf', new YapfFormatter());
    this.formatters.set('autopep8', new AutoPep8Formatter());
    this.formatters.set('darker', new DarkerFormatter());
  }

  private async _provideEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Promise<TextEdit[]> {
    const provider = this.pythonSettings.formatting.provider;
    const formater = this.formatters.get(provider);
    if (!formater) return [];

    return await formater.formatDocument(document, options, token, range);
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
