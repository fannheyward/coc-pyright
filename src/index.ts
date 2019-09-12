import { commands, ExtensionContext, LanguageClient, LanguageClientOptions, ServerOptions, services, TransportKind, workspace } from 'coc.nvim';
import { TextEdit, WorkspaceEdit } from 'vscode-languageserver-protocol';
import { ProgressReporting } from './progress';

export async function activate(context: ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath('server/server.js');
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6600'] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  };

  const outputChannel = workspace.createOutputChannel('Pyright');
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'python' }],
    synchronize: {
      configurationSection: ['python', 'pyright']
    },
    outputChannel
  };

  const client: LanguageClient = new LanguageClient('pyright', 'Pyright Server', serverOptions, clientOptions);
  context.subscriptions.push(services.registLanguageClient(client));

  const progressReporting = new ProgressReporting(client);
  context.subscriptions.push(progressReporting);

  const textEditorCommands = ['pyright.organizeimports', 'pyright.addoptionalforparam'];
  textEditorCommands.forEach((commandName: string) => {
    context.subscriptions.push(
      commands.registerCommand(commandName, async (offset: number) => {
        const doc = await workspace.document;
        const cmd = {
          command: commandName,
          arguments: [doc.uri.toString(), offset]
        };

        const edits = await client.sendRequest<TextEdit[] | undefined>('workspace/executeCommand', cmd);
        if (!edits) {
          return;
        }

        const wsEdit: WorkspaceEdit = {
          changes: {
            [doc.uri]: edits
          }
        };
        await workspace.applyEdit(wsEdit);
      })
    );
  });

  // const genericCommands = [cmdCreateTypeStub];
  // genericCommands.forEach((command: string) => {
  //   context.subscriptions.push(
  //     commands.registerCommand(command, (...args: any[]) => {
  //       client.sendRequest('workspace/executeCommand', { command, arguments: args });
  //     })
  //   );
  // });
}
