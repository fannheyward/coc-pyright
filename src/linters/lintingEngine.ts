// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DiagnosticCollection, languages, OutputChannel, Uri, workspace } from 'coc.nvim';
import fs from 'fs-extra';
import { Minimatch } from 'minimatch';
import path from 'path';
import { CancellationTokenSource, Diagnostic, DiagnosticSeverity, DocumentFilter, Position, Range } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PythonSettings } from '../configSettings';
import { ILinter, ILinterInfo, ILintMessage, LinterErrors, LintMessageSeverity, Product } from '../types';
import { Bandit } from './bandit';
import { Flake8 } from './flake8';
import { LinterInfo } from './linterInfo';
import { MyPy } from './mypy';
import { Pep8 } from './pep8';
import { Prospector } from './prospector';
import { PyDocStyle } from './pydocstyle';
import { PyLama } from './pylama';
import { Pylint } from './pylint';
import { Pytype } from './pytype';

const PYTHON: DocumentFilter = { language: 'python' };

const lintSeverityToVSSeverity = new Map<LintMessageSeverity, DiagnosticSeverity>();
lintSeverityToVSSeverity.set(LintMessageSeverity.Error, DiagnosticSeverity.Error);
lintSeverityToVSSeverity.set(LintMessageSeverity.Hint, DiagnosticSeverity.Hint);
lintSeverityToVSSeverity.set(LintMessageSeverity.Information, DiagnosticSeverity.Information);
lintSeverityToVSSeverity.set(LintMessageSeverity.Warning, DiagnosticSeverity.Warning);

class DisabledLinter implements ILinter {
  constructor(private configService: PythonSettings) {}
  public get info() {
    return new LinterInfo(Product.pylint, 'pylint', this.configService);
  }
  public async lint(): Promise<ILintMessage[]> {
    return [];
  }
}

export class LintingEngine {
  private diagnosticCollection: DiagnosticCollection;
  private pendingLintings = new Map<string, CancellationTokenSource>();
  private configService: PythonSettings;
  private outputChannel: OutputChannel;
  protected linters: ILinterInfo[];

  constructor() {
    this.outputChannel = workspace.createOutputChannel('coc-pyright-linting');
    this.diagnosticCollection = languages.createDiagnosticCollection('python');
    this.configService = PythonSettings.getInstance();
    this.linters = [
      new LinterInfo(Product.bandit, 'bandit', this.configService),
      new LinterInfo(Product.flake8, 'flake8', this.configService),
      new LinterInfo(Product.pylint, 'pylint', this.configService, ['.pylintrc', 'pylintrc']),
      new LinterInfo(Product.mypy, 'mypy', this.configService),
      new LinterInfo(Product.pep8, 'pep8', this.configService),
      new LinterInfo(Product.prospector, 'prospector', this.configService),
      new LinterInfo(Product.pydocstyle, 'pydocstyle', this.configService),
      new LinterInfo(Product.pylama, 'pylama', this.configService),
      new LinterInfo(Product.pytype, 'pytype', this.configService),
    ];
  }

  public get diagnostics(): DiagnosticCollection {
    return this.diagnosticCollection;
  }

  public clearDiagnostics(document: TextDocument): void {
    if (this.diagnosticCollection.has(document.uri)) {
      this.diagnosticCollection.delete(document.uri);
    }
  }

  public async lintOpenPythonFiles(): Promise<DiagnosticCollection> {
    this.diagnosticCollection.clear();
    const promises = workspace.textDocuments.map(async (document) => this.lintDocument(document));
    await Promise.all(promises);
    return this.diagnosticCollection;
  }

  public async lintDocument(document: TextDocument): Promise<void> {
    this.diagnosticCollection.set(document.uri, []);

    // Check if we need to lint this document
    if (!(await this.shouldLintDocument(document))) {
      return;
    }

    const fsPath = Uri.parse(document.uri).fsPath;
    if (this.pendingLintings.has(fsPath)) {
      this.pendingLintings.get(fsPath)!.cancel();
      this.pendingLintings.delete(fsPath);
    }

    const cancelToken = new CancellationTokenSource();
    cancelToken.token.onCancellationRequested(() => {
      if (this.pendingLintings.has(fsPath)) {
        this.pendingLintings.delete(fsPath);
      }
    });

    this.pendingLintings.set(fsPath, cancelToken);

    const activeLinters = await this.getActiveLinters(Uri.parse(document.uri));
    const promises: Promise<ILintMessage[]>[] = activeLinters.map(async (info: ILinterInfo) => {
      this.outputChannel.appendLine(`${'#'.repeat(10)} active linter: ${info.id}`);
      const linter = await this.createLinter(info, this.outputChannel, Uri.parse(document.uri));
      const promise = linter.lint(document, cancelToken.token);
      return promise;
    });

    // linters will resolve asynchronously - keep a track of all
    // diagnostics reported as them come in.
    let diagnostics: Diagnostic[] = [];
    const settings = this.configService;

    for (const p of promises) {
      const msgs = await p;
      if (cancelToken.token.isCancellationRequested) {
        break;
      }

      const doc = workspace.getDocument(document.uri);
      if (doc) {
        // Build the message and suffix the message with the name of the linter used.
        for (const m of msgs) {
          if (
            doc
              .getline(m.line - 1)
              .trim()
              .startsWith('%') &&
            (m.code === LinterErrors.pylint.InvalidSyntax || m.code === LinterErrors.prospector.InvalidSyntax || m.code === LinterErrors.flake8.InvalidSyntax)
          ) {
            continue;
          }
          diagnostics.push(this.createDiagnostics(m, document));
        }
        // Limit the number of messages to the max value.
        diagnostics = diagnostics.filter((_value, index) => index <= settings.linting.maxNumberOfProblems);
      }
    }
    // Set all diagnostics found in this pass, as this method always clears existing diagnostics.
    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createDiagnostics(message: ILintMessage, _document?: TextDocument): Diagnostic {
    const position = Position.create(message.line - 1, message.column);
    const range = Range.create(position, position);

    const severity = lintSeverityToVSSeverity.get(message.severity!)!;
    const diagnostic = Diagnostic.create(range, message.message, severity);
    diagnostic.code = message.code;
    diagnostic.source = message.provider;
    return diagnostic;
  }

  private async shouldLintDocument(document: TextDocument): Promise<boolean> {
    if (!(await this.isLintingEnabled(Uri.parse(document.uri)))) {
      this.diagnosticCollection.set(document.uri, []);
      return false;
    }

    if (document.languageId !== PYTHON.language) {
      return false;
    }

    const relativeFileName = path.relative(workspace.rootPath, Uri.parse(document.uri).fsPath);
    const settings = this.configService;
    // { dot: true } is important so dirs like `.venv` will be matched by globs
    const ignoreMinmatches = settings.linting.ignorePatterns.map((pattern) => new Minimatch(pattern, { dot: true }));
    if (ignoreMinmatches.some((matcher) => matcher.match(Uri.parse(document.uri).fsPath) || matcher.match(relativeFileName))) {
      return false;
    }
    const u = Uri.parse(document.uri);
    if (u.scheme !== 'file' || !u.fsPath) {
      return false;
    }
    return fs.existsSync(u.fsPath);
  }

  public getAllLinterInfos(): ILinterInfo[] {
    return this.linters;
  }

  public getLinterInfo(product: Product): ILinterInfo {
    const x = this.linters.findIndex((value) => value.product === product);
    if (x >= 0) {
      return this.linters[x];
    }
    throw new Error(`Invalid linter '${Product[product]}'`);
  }

  public async isLintingEnabled(resource?: Uri): Promise<boolean> {
    const settings = this.configService;
    const activeLintersPresent = await this.getActiveLinters(resource);
    return settings.linting.enabled && activeLintersPresent.length > 0;
  }

  public async getActiveLinters(resource?: Uri): Promise<ILinterInfo[]> {
    return this.linters.filter((x) => x.isEnabled(resource));
  }

  public async createLinter(info: ILinterInfo, outputChannel: OutputChannel, resource?: Uri): Promise<ILinter> {
    if (!(await this.isLintingEnabled(resource))) {
      return new DisabledLinter(this.configService);
    }
    const error = 'Linter manager: Unknown linter';
    switch (info.product) {
      case Product.bandit:
        return new Bandit(info, outputChannel);
      case Product.flake8:
        return new Flake8(info, outputChannel);
      case Product.pylint:
        return new Pylint(info, outputChannel);
      case Product.mypy:
        return new MyPy(info, outputChannel);
      case Product.prospector:
        return new Prospector(info, outputChannel);
      case Product.pylama:
        return new PyLama(info, outputChannel);
      case Product.pydocstyle:
        return new PyDocStyle(info, outputChannel);
      case Product.pep8:
        return new Pep8(info, outputChannel);
      case Product.pytype:
        return new Pytype(info, outputChannel);
      default:
        break;
    }
    throw new Error(error);
  }
}
