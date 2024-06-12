import { spawn } from 'node:child_process';
import {
  type CancellationToken,
  fetch,
  type FormattingOptions,
  type OutputChannel,
  type Range,
  type TextDocument,
  type TextEdit,
  type Thenable,
  Uri,
  window,
} from 'coc.nvim';
import getPort from 'get-port';
import { getTextEditsFromPatch } from '../../utils';
import type { IPythonSettings } from '../../types';
import { BaseFormatter } from './baseFormatter';

export class BlackdFormatter extends BaseFormatter {
  private blackdHTTPURL = '';

  constructor(
    public readonly pythonSettings: IPythonSettings,
    public readonly outputChannel: OutputChannel,
  ) {
    super('blackd', pythonSettings, outputChannel);

    this.blackdHTTPURL = this.pythonSettings.formatting.blackdHTTPURL;
    if (!this.blackdHTTPURL.length) {
      this.launchServer();
    }
  }

  private async launchServer(): Promise<void> {
    const port = await getPort({ port: 45484 });
    this.blackdHTTPURL = `http://127.0.0.1:${port}`;

    const blackdPath = this.pythonSettings.formatting.blackdPath;
    spawn(blackdPath, ['--bind-port', String(port)]).on('error', (e) => {
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine('spawn blackd HTTP server error');
      this.outputChannel.appendLine(e.message);
      this.outputChannel.appendLine('make sure you have installed blackd by `pip install "black[d]"`');
      this.blackdHTTPURL = '';
    });
  }

  private async handle(document: TextDocument): Promise<TextEdit[]> {
    if (!this.blackdHTTPURL.length) {
      return Promise.resolve([]);
    }

    try {
      const headers = Object.assign({ 'X-Diff': 1 }, this.pythonSettings.formatting.blackdHTTPHeaders);
      const patch = await fetch(this.blackdHTTPURL, { method: 'POST', data: document.getText(), headers });

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

  public formatDocument(
    document: TextDocument,
    _options: FormattingOptions,
    _token: CancellationToken,
    range?: Range,
  ): Thenable<TextEdit[]> {
    if (range) {
      const msg = 'blackd does not support range formatting';
      this.outputChannel.appendLine(msg);
      window.showErrorMessage(msg);
      return Promise.resolve([]);
    }
    if (this.pythonSettings.stdLibs.some((p) => Uri.parse(document.uri).fsPath.startsWith(p))) {
      return Promise.resolve([]);
    }

    return this.handle(document);
  }
}
