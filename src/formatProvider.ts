import {
  CancellationToken,
  Disposable,
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
  FormattingOptions,
  ProviderResult,
  Range,
  TextDocument,
  TextEdit,
} from 'coc.nvim';
import { PythonSettings } from './configSettings';
import { AutoPep8Formatter } from './formatters/autopep8';
import { BaseFormatter } from './formatters/baseFormatter';
import { BlackFormatter } from './formatters/black';
import { YapfFormatter } from './formatters/yapf';
import { DarkerFormatter } from './formatters/darker';
import { FormatterId } from './types';

export class PythonFormattingEditProvider implements DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider {
  private formatters = new Map<FormatterId, BaseFormatter>();
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
