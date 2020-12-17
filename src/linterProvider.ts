import { commands, ConfigurationChangeEvent, DiagnosticCollection, ExtensionContext, Uri, workspace } from 'coc.nvim';
import { Disposable } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PythonSettings } from './configSettings';
import { LintingEngine } from './linters/lintingEngine';

export class LinterProvider implements Disposable {
  private context: ExtensionContext;
  private disposables: Disposable[];
  private configuration: PythonSettings;
  private engine: LintingEngine;

  public constructor(context: ExtensionContext) {
    this.context = context;
    this.disposables = [];

    this.engine = new LintingEngine();
    this.configuration = PythonSettings.getInstance();

    workspace.onDidOpenTextDocument((e) => this.onDocumentOpened(e), this.context.subscriptions);
    workspace.onDidCloseTextDocument((e) => this.onDocumentClosed(e), this.context.subscriptions);
    workspace.onDidSaveTextDocument((e) => this.onDocumentSaved(e), this.context.subscriptions);

    const disposable = workspace.onDidChangeConfiguration(this.lintSettingsChangedHandler.bind(this));
    this.disposables.push(disposable);

    this.disposables.push(commands.registerCommand('python.runLinting', this.runLinting.bind(this)));

    setTimeout(() => this.engine.lintOpenPythonFiles().catch(this.emptyFn), 1200);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }

  private runLinting(): Promise<DiagnosticCollection> {
    return this.engine.lintOpenPythonFiles();
  }

  private lintSettingsChangedHandler(e: ConfigurationChangeEvent) {
    // Look for python files that belong to the specified workspace folder.
    workspace.textDocuments.forEach((document) => {
      if (e.affectsConfiguration('python.linting', document.uri)) {
        this.engine.lintDocument(document).catch(() => {});
      }
    });
  }

  private onDocumentOpened(document: TextDocument): void {
    this.engine.lintDocument(document).catch(() => {});
  }

  private onDocumentSaved(document: TextDocument): void {
    if (document.languageId === 'python' && this.configuration.linting.enabled && this.configuration.linting.lintOnSave) {
      this.engine.lintDocument(document).catch(() => {});
      return;
    }
  }

  private onDocumentClosed(document: TextDocument) {
    if (!document || !Uri.parse(document.uri).fsPath || !document.uri) {
      return;
    }

    this.engine.clearDiagnostics(document);
  }

  private emptyFn(): void {
    // noop
  }
}
