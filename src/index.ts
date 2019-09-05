import { LanguageClient, TransportKind, ServerOptions, commands, ExtensionContext, workspace, Executable, LanguageClientOptions, services } from 'coc.nvim';
import { join } from 'path';

export async function activate(context: ExtensionContext): Promise<void> {
  workspace.showMessage(`coc-pyright is works!`);

  let serverModule = context.asAbsolutePath(join('node_modules', 'pyright', 'index.js'));
  console.error(serverModule);

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
