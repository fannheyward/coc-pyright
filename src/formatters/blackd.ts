import { CancellationToken, FormattingOptions, fetch, OutputChannel, Range, TextDocument, TextEdit, Thenable, window } from 'coc.nvim';
import { IPythonSettings } from '../types';
import { BaseFormatter } from './baseFormatter';
import { spawn, ChildProcess } from 'child_process';
import { getTextEditsFromPatch } from '../common';

export class BlackdFormatter extends BaseFormatter {
  private blackdServer: ChildProcess | null = null;
  private blackdHTTPURL = '';
  constructor(public readonly pythonSettings: IPythonSettings, public readonly outputChannel: OutputChannel) {
    super('blackd', pythonSettings, outputChannel);

    this.blackdHTTPURL = this.pythonSettings.formatting.blackdHTTPURL;
    if (!this.blackdHTTPURL.length) {
      const blackdPath = this.pythonSettings.formatting.blackdPath;
      this.blackdServer = spawn(blackdPath).on('error', (e) => {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('spawn blackd HTTP server error');
        this.outputChannel.appendLine(e.message);
        this.outputChannel.appendLine('make sure you have installed blackd by `pip install "black[d]"`');
        this.blackdServer = null;
      });
    }
  }

  private async handle(document: TextDocument): Promise<TextEdit[]> {
    try {
      const _url = this.blackdHTTPURL || 'http://127.0.0.1:45484';
      const headers = Object.assign({ 'X-Diff': 1 }, this.pythonSettings.formatting.blackdHTTPHeaders);
      const patch = await fetch(_url, { method: 'POST', data: document.getText(), headers });

      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`${'#'.repeat(10)} ${this.Id} output:`);
      this.outputChannel.appendLine(patch.toString());

      return getTextEditsFromPatch(document.getText(), patch.toString());
    } catch (e) {
      window.showErrorMessage('blackd request error');
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`${'#'.repeat(10)} blackd request error:`);
      if (typeof e === 'string') {
        this.outputChannel.appendLine(e);
      } else if (e instanceof Error) {
        this.outputChannel.appendLine(e.message);
      }
      return [];
    }
  }

  public formatDocument(document: TextDocument, _options: FormattingOptions, _token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const errorMessage = async (msg: string) => {
      this.outputChannel.appendLine(msg);
      window.showErrorMessage(msg);
      return [] as TextEdit[];
    };

    if (range) return errorMessage('Black does not support the "Format Selection" command');
    if (!this.blackdServer && !this.blackdHTTPURL) {
      return errorMessage('blackd server error');
    }

    return this.handle(document);
  }
}
