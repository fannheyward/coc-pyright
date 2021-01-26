import {
  commands,
  DocumentSelector,
  ExtensionContext,
  extensions,
  LanguageClient,
  LanguageClientOptions,
  languages,
  Location,
  NodeModule,
  Range,
  services,
  StaticFeature,
  TextDocument,
  TextEdit,
  TransportKind,
  window,
  workspace,
  WorkspaceEdit,
} from 'coc.nvim';
import { existsSync } from 'fs';
import { lt } from 'semver';
import { PythonCodeActionProvider } from './codeActionsProvider';
import { PythonFormattingEditProvider } from './formatProvider';
import { sortImports } from './isortProvider';
import { LinterProvider } from './linterProvider';
import { extractMethod, extractVariable } from './refactorProvider';

const documentSelector: DocumentSelector = [{ scheme: 'file', language: 'python' }];

class PyrightExtensionFeature implements StaticFeature {
  constructor() {}
  dispose(): void {}
  initialize() {}
  fillClientCapabilities(capabilities: any) {
    // TODO: use DiagnosticTag.Deprecated
    capabilities.textDocument.publishDiagnostics.tagSupport = { valueSet: [2] };
  }
}

export async function activate(context: ExtensionContext): Promise<void> {
  const state = extensions.getExtensionState('coc-python');
  if (state.toString() === 'activated') {
    window.showMessage(`coc-python is installed and activated, coc-pyright will be disabled`, 'warning');
    return;
  }
  if (lt(process.versions.node, '12.0.0')) {
    window.showMessage(`Pyright needs Node.js v12+ to work, your Node.js is ${process.version}.`, 'error');
    return;
  }
  const module = context.asAbsolutePath('node_modules/pyright/langserver.index.js');
  if (!existsSync(module)) {
    window.showMessage(`Pyright file doesn't exist, please reinstall coc-pyright`, 'error');
    return;
  }

  const serverOptions: NodeModule = {
    module,
    transport: TransportKind.ipc,
  };

  const outputChannel = window.createOutputChannel('Pyright');
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: ['python', 'pyright'],
    },
    outputChannel,
    progressOnInitialization: true,
    middleware: {
      provideDefinition: async (document, position, token, next) => {
        const locations = await next(document, position, token);
        if (!locations) {
          return;
        }
        if (Location.is(locations)) return locations;

        let pyiFirst = false;
        if (Array.isArray(locations) && locations.length > 1) {
          const first = locations[0];
          const uri = Location.is(first) ? first.uri : first.targetUri;
          if (uri.length && uri.endsWith('.pyi')) {
            pyiFirst = true;
          }
        }

        return pyiFirst ? locations.reverse() : locations;
      },
    },
  };

  const client: LanguageClient = new LanguageClient('pyright', 'Pyright Server', serverOptions, clientOptions);
  client.registerFeature(new PyrightExtensionFeature());
  context.subscriptions.push(services.registLanguageClient(client));

  const formatProvider = new PythonFormattingEditProvider();
  context.subscriptions.push(languages.registerDocumentFormatProvider(documentSelector, formatProvider));
  context.subscriptions.push(languages.registerDocumentRangeFormatProvider(documentSelector, formatProvider));

  context.subscriptions.push(new LinterProvider(context));

  const codeActionProvider = new PythonCodeActionProvider();
  context.subscriptions.push(languages.registerCodeActionProvider(documentSelector, codeActionProvider, 'Pyright'));

  const textEditorCommands = ['pyright.organizeimports', 'pyright.addoptionalforparam', 'pyright.restartserver'];
  textEditorCommands.forEach((commandName: string) => {
    context.subscriptions.push(
      commands.registerCommand(commandName, async (offset: number) => {
        const doc = await workspace.document;
        const cmd = {
          command: commandName,
          arguments: [doc.uri.toString(), offset],
        };

        const edits = await client.sendRequest<TextEdit[] | undefined>('workspace/executeCommand', cmd);
        if (!edits) {
          return;
        }

        const wsEdit: WorkspaceEdit = {
          changes: {
            [doc.uri]: edits,
          },
        };
        await workspace.applyEdit(wsEdit);
      })
    );
  });

  const genericCommands = ['pyright.createtypestub'];
  genericCommands.forEach((command: string) => {
    context.subscriptions.push(
      commands.registerCommand(command, async (...args: any[]) => {
        const root = workspace.root;
        const module = args.pop();
        if (!module) {
          window.showMessage(`Module name is missing`, 'warning');
          return;
        }

        const cmd = {
          command,
          arguments: [root, module],
        };
        client.sendRequest('workspace/executeCommand', cmd);
      })
    );
  });

  let disposable = commands.registerCommand(
    'python.refactorExtractVariable',
    async (document: TextDocument, range: Range) => {
      await extractVariable(context.extensionPath, document, range, outputChannel).catch(() => {});
    },
    null,
    true
  );
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand(
    'python.refactorExtractMethod',
    async (document: TextDocument, range: Range) => {
      await extractMethod(context.extensionPath, document, range, outputChannel).catch(() => {});
    },
    null,
    true
  );
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand('python.sortImports', async () => {
    await sortImports(context.extensionPath, outputChannel).catch(() => {});
  });
  context.subscriptions.push(disposable);
}
