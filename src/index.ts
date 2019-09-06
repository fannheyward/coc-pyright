import { commands, ExtensionContext, LanguageClient, LanguageClientOptions, ServerOptions, services, TransportKind, workspace } from 'coc.nvim';

export async function activate(context: ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath('server/server.js');

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'python' }],
    synchronize: {
      configurationSection: ['python', 'pyright']
    }
  };

  const client: LanguageClient = new LanguageClient('pyright', 'Pyright Server', serverOptions, clientOptions);
  context.subscriptions.push(services.registLanguageClient(client));

  context.subscriptions.push(
    commands.registerCommand('coc-pyright.Command', async () => {
      workspace.showMessage(`coc-pyright Commands works!`);
    })
  );

  client.onReady().then(() => {
    workspace.showMessage(`Pyright works`);
  });
}
