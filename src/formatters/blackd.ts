import { CancellationToken, FormattingOptions, fetch, OutputChannel, Range, TextDocument, TextEdit, Thenable, window } from 'coc.nvim';
import { IPythonSettings } from '../types';
import { BaseFormatter } from './baseFormatter';
import { spawn, ChildProcess } from 'child_process';
import { getTextEditsFromPatch } from '../common';

export class BlackdFormatter extends BaseFormatter {
  private blackdServer: ChildProcess | null = null;
  constructor(public readonly pythonSettings: IPythonSettings, public readonly outputChannel: OutputChannel) {
    super('blackd', pythonSettings, outputChannel);

    const blackdPath = this.pythonSettings.formatting.blackdPath;
    this.blackdServer = spawn(blackdPath).on('error', (e) => {
      this.outputChannel.appendLine('spawn blackd HTTP server error');
      this.outputChannel.appendLine(e.message);
      this.outputChannel.appendLine('make sure you have installed blackd by `pip install "black[d]"`');
      this.blackdServer = null;
    });
  }

  private async handle(document: TextDocument): Promise<TextEdit[]> {
    // TODO
    const _url = 'http://127.0.0.1:45484';
    const patch = await fetch(_url, { method: 'POST', data: document.getText(), headers: { 'X-Diff': 1 } });

    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(`${'#'.repeat(10)} ${this.Id} output:`);
    this.outputChannel.appendLine(patch.toString());

    return getTextEditsFromPatch(document.getText(), patch.toString());
  }

  public formatDocument(document: TextDocument, _options: FormattingOptions, _token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const errorMessage = async (msg: string) => {
      this.outputChannel.appendLine(msg);
      window.showMessage(msg, 'error');
      return [] as TextEdit[];
    };

    if (range) return errorMessage('Black does not support the "Format Selection" command');
    if (!this.blackdServer) return errorMessage('blackd server launch error');

    return this.handle(document);
  }
}
