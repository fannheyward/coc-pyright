import { StatusBarItem, workspace, LanguageClient } from 'coc.nvim';
import { Disposable } from 'vscode-languageserver-protocol';

export class ProgressReporting implements Disposable {
  private statusBarItem: StatusBarItem = workspace.createStatusBarItem(0, { progress: true });

  constructor(client: LanguageClient) {
    client.onReady().then(() => {
      client.onNotification('pyright/beginProgress', async () => {});

      client.onNotification('pyright/reportProgress', (message: string) => {
        this.statusBarItem.text = `Pyright: ${message}`;
        this.statusBarItem.show();
      });

      client.onNotification('pyright/endProgress', () => {
        this.statusBarItem.hide();
      });
    });
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
