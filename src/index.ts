import {
  commands,
  type DocumentSelector,
  type ExtensionContext,
  extensions,
  LanguageClient,
  type LanguageClientOptions,
  languages,
  type Range,
  type ServerOptions,
  services,
  type StaticFeature,
  type TextDocument,
  TransportKind,
  Uri,
  window,
  workspace,
} from 'coc.nvim';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import which from 'which';
import { runFileTest, runSingleTest } from './commands';
import { PythonSettings } from './configSettings';
import { PythonCodeActionProvider } from './features/codeAction';
import { PythonFormattingEditProvider } from './features/formatting';
import { ImportCompletionProvider } from './features/importCompletion';
import { TypeInlayHintsProvider } from './features/inlayHints';
import { PythonSemanticTokensProvider } from './features/semanticTokens';
import { sortImports } from './features/sortImports';
import { LinterProvider } from './features/lintting';
import { extractMethod, extractVariable } from './features/refactor';
import { TestFrameworkProvider } from './features/testing';
import {
  configuration,
  handleDiagnostics,
  provideCompletionItem,
  provideHover,
  provideSignatureHelp,
  resolveCompletionItem,
} from './middleware';

const defaultHeapSize = 3072;

const method = 'workspace/executeCommand';
const documentSelector: DocumentSelector = [
  {
    scheme: 'file',
    language: 'python',
  },
];

class PyrightExtensionFeature implements StaticFeature {
  dispose(): void {}
  initialize() {}
  fillClientCapabilities(capabilities: any) {
    // Pyright set activeParameter = -1 when activeParameterSupport enabled
    // this will break signatureHelp
    capabilities.textDocument.signatureHelp.signatureInformation.activeParameterSupport = false;
  }
}

export async function activate(context: ExtensionContext): Promise<void> {
  const pyrightCfg = workspace.getConfiguration('pyright');
  const isEnable = pyrightCfg.get<boolean>('enable', true);
  if (!isEnable) return;

  const state = extensions.getExtensionState('coc-python');
  if (state.toString() === 'activated') {
    window.showWarningMessage('coc-python is installed and activated, coc-pyright will be disabled');
    return;
  }
  let module = pyrightCfg.get<string>('server');
  if (module) {
    module = which.sync(workspace.expand(module), { nothrow: true }) || module;
  } else {
    module = join(context.extensionPath, 'node_modules', 'pyright', 'langserver.index.js');
  }
  if (!existsSync(module)) {
    window.showErrorMessage(`Pyright langserver doesn't exist, please reinstall coc-pyright`);
    return;
  }

  const runOptions = { execArgv: [`--max-old-space-size=${defaultHeapSize}`] };
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6600', `--max-old-space-size=${defaultHeapSize}`] };

  const serverOptions: ServerOptions = {
    run: { module: module, transport: TransportKind.ipc, options: runOptions },
    debug: { module: module, transport: TransportKind.ipc, options: debugOptions },
  };

  const disabledFeatures: string[] = [];
  if (pyrightCfg.get<boolean>('disableCompletion')) {
    disabledFeatures.push('completion');
  }
  if (pyrightCfg.get<boolean>('disableDiagnostics')) {
    disabledFeatures.push('diagnostics');
    disabledFeatures.push('pullDiagnostic');
  }
  if (pyrightCfg.get<boolean>('disableDocumentation')) {
    disabledFeatures.push('hover');
  }
  const disableProgress = pyrightCfg.get<boolean>('disableProgressNotifications');
  if (disableProgress) {
    disabledFeatures.push('progress');
  }
  const outputChannel = window.createOutputChannel('Pyright');
  const pythonSettings = PythonSettings.getInstance();
  outputChannel.appendLine(`Workspace: ${workspace.root}`);
  outputChannel.appendLine(`Using python from ${pythonSettings.pythonPath}\n`);
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: ['python', 'pyright'],
    },
    outputChannel,
    disabledFeatures,
    progressOnInitialization: !disableProgress,
    middleware: {
      workspace: {
        configuration,
      },
      provideHover,
      provideSignatureHelp,
      provideCompletionItem,
      handleDiagnostics,
      resolveCompletionItem,
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

  const importSupport = pyrightCfg.get<boolean>('completion.importSupport');
  if (importSupport) {
    const provider = new ImportCompletionProvider();
    context.subscriptions.push(
      languages.registerCompletionItemProvider('python-import', 'PY', ['python'], provider, [' ']),
    );
  }
  const inlayHintEnable = workspace.getConfiguration('inlayHint').get('enable', true);
  if (inlayHintEnable && typeof languages.registerInlayHintsProvider === 'function') {
    const provider = new TypeInlayHintsProvider(client);
    context.subscriptions.push(languages.registerInlayHintsProvider(documentSelector, provider));
  }
  const semanticTokensEnable = workspace.getConfiguration('semanticTokens').get('enable', true);
  if (semanticTokensEnable && typeof languages.registerDocumentSemanticTokensProvider === 'function') {
    const provider = new PythonSemanticTokensProvider();
    context.subscriptions.push(
      languages.registerDocumentSemanticTokensProvider(documentSelector, provider, provider.legend),
    );
  }
  const testProvider = new TestFrameworkProvider();
  context.subscriptions.push(languages.registerCodeActionProvider(documentSelector, testProvider, 'Pyright'));
  const codeLens = workspace.getConfiguration('codeLens').get<boolean>('enable', false);
  if (codeLens) context.subscriptions.push(languages.registerCodeLensProvider(documentSelector, testProvider));

  const textEditorCommands = ['pyright.organizeimports', 'pyright.addoptionalforparam'];
  for (const commandName of textEditorCommands) {
    context.subscriptions.push(
      commands.registerCommand(commandName, async (offset: number) => {
        const doc = await workspace.document;
        const cmd = {
          command: commandName,
          arguments: [doc.uri.toString(), offset],
        };

        await client.sendRequest(method, cmd);
      }),
    );
  }

  let command = 'pyright.restartserver';
  let disposable = commands.registerCommand(command, async () => {
    await client.sendRequest(method, { command });
  });
  context.subscriptions.push(disposable);

  command = 'pyright.createtypestub';
  disposable = commands.registerCommand(command, async (...args: any[]) => {
    if (!args.length) {
      window.showWarningMessage('Module name is missing');
      return;
    }
    const doc = await workspace.document;
    const filePath = Uri.parse(doc.uri).fsPath;
    if (args[args.length - 1] !== filePath) {
      // args from Pyright   : [root, module, filePath]
      // args from CocCommand: [module]
      args.unshift(workspace.root);
      args.push(filePath);
    }

    const cmd = {
      command,
      arguments: args,
    };
    await client.sendRequest(method, cmd);
  });
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand(
    'python.refactorExtractVariable',
    async (document: TextDocument, range: Range) => {
      await extractVariable(context.extensionPath, document, range, outputChannel).catch(() => {});
    },
    null,
    true,
  );
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand(
    'python.refactorExtractMethod',
    async (document: TextDocument, range: Range) => {
      await extractMethod(context.extensionPath, document, range, outputChannel).catch(() => {});
    },
    null,
    true,
  );
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand('python.sortImports', async () => {
    await sortImports(outputChannel).catch(() => {});
  });
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand('pyright.fileTest', async () => {
    await runFileTest();
  });
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand('pyright.singleTest', async () => {
    await runSingleTest();
  });
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand('pyright.version', () => {
    const pyrightJSON = join(context.extensionPath, 'node_modules', 'pyright', 'package.json');
    const pyrightPackage = JSON.parse(readFileSync(pyrightJSON, 'utf8'));
    const cocPyrightJSON = join(context.extensionPath, 'package.json');
    const cocPyrightPackage = JSON.parse(readFileSync(cocPyrightJSON, 'utf8'));
    window.showInformationMessage(`coc-pyright ${cocPyrightPackage.version} with Pyright ${pyrightPackage.version}`);
  });
  context.subscriptions.push(disposable);
}
