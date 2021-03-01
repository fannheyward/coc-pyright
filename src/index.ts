import {
  CancellationToken,
  commands,
  CompletionContext,
  CompletionItemKind,
  DocumentSelector,
  ExtensionContext,
  extensions,
  InsertTextFormat,
  LanguageClient,
  LanguageClientOptions,
  languages,
  NodeModule,
  Position,
  ProvideCompletionItemsSignature,
  ProvideHoverSignature,
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
import { PythonSettings } from './configSettings';
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
    // Pyright set activeParameter = -1 when activeParameterSupport enabled
    // this will break signatureHelp
    capabilities.textDocument.signatureHelp.signatureInformation.activeParameterSupport = false;
  }
}

async function provideCompletionItem(document: TextDocument, position: Position, context: CompletionContext, token: CancellationToken, next: ProvideCompletionItemsSignature) {
  const result = await next(document, position, context, token);
  if (!result) return;

  const snippetSupport = workspace.getConfiguration('pyright').get<boolean>('completion.snippetSupport');
  if (snippetSupport) {
    const items = Array.isArray(result) ? result : result.items;
    for (const item of items) {
      if (item.data?.funcParensDisabled) continue;
      if (item.kind === CompletionItemKind.Method || item.kind === CompletionItemKind.Function) {
        item.insertText = `${item.label}($1)$0`;
        item.insertTextFormat = InsertTextFormat.Snippet;
      }
    }
  }

  return result;
}
async function provideHover(document: TextDocument, position: Position, token: CancellationToken, next: ProvideHoverSignature) {
  const hover = await next(document, position, token);
  if (!hover) return;

  if (typeof hover.contents === 'object' && 'kind' in hover.contents) {
    if (hover.contents.kind === 'markdown') {
      hover.contents.value = hover.contents.value.replace(/&nbsp;/g, ' ');
    }
  }
  return hover;
}

export async function activate(context: ExtensionContext): Promise<void> {
  const isEnable = workspace.getConfiguration('pyright').get<boolean>('enable', true);
  if (!isEnable) return;

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
  const pythonSettings = PythonSettings.getInstance();
  outputChannel.appendLine(`Using python from ${pythonSettings.pythonPath}\n`);
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: ['python', 'pyright'],
    },
    outputChannel,
    progressOnInitialization: true,
    middleware: {
      provideHover,
      provideCompletionItem,
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
