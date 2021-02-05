import {
  CancellationToken,
  Disposable,
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
  FormattingOptions,
  OutputChannel,
  ProviderResult,
  Range,
  TextDocument,
  TextEdit,
  window,
} from 'coc.nvim';
import { PythonSettings } from './configSettings';
import { AutoPep8Formatter } from './formatters/autopep8';
import { BaseFormatter } from './formatters/baseFormatter';
import { BlackFormatter } from './formatters/black';
import { YapfFormatter } from './formatters/yapf';
import { DarkerFormatter } from './formatters/darker';
import { BlackdFormatter } from './formatters/blackd';
import { FormatterId } from './types';

export class PythonFormattingEditProvider implements DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider {
  private formatters = new Map<FormatterId, BaseFormatter>();
  private disposables: Disposable[] = [];
  private pythonSettings: PythonSettings;
  private outputChannel: OutputChannel;

  constructor() {
    this.pythonSettings = PythonSettings.getInstance();
    this.outputChannel = window.createOutputChannel('coc-pyright-formatting');

    const provider = this.pythonSettings.formatting.provider;
    switch (provider) {
      case 'black':
        this.formatters.set('black', new BlackFormatter(this.pythonSettings, this.outputChannel));
        break;
      case 'blackd':
        this.formatters.set('blackd', new BlackdFormatter(this.pythonSettings, this.outputChannel));
        break;
      case 'yapf':
        this.formatters.set('yapf', new YapfFormatter(this.pythonSettings, this.outputChannel));
        break;
      case 'autopep8':
        this.formatters.set('autopep8', new AutoPep8Formatter(this.pythonSettings, this.outputChannel));
        break;
      case 'darker':
        this.formatters.set('darker', new DarkerFormatter(this.pythonSettings, this.outputChannel));
        break;
      default:
        break;
    }
  }

  private async _provideEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Promise<TextEdit[]> {
    const provider = this.pythonSettings.formatting.provider;
    const formater = this.formatters.get(provider);
    if (!formater) {
      window.showMessage(`No formatter is set. You need to set "python.formatting.provider" in your coc-settings.json`);
      this.outputChannel.appendLine(`${'#'.repeat(10)} Error: python.formatting.provider is ${provider}, which is not supported`);
      return [];
    }

    this.outputChannel.appendLine(`${'#'.repeat(10)} active formattor: ${formater.Id}`);
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
