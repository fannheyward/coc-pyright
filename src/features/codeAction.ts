import {
  CancellationTokenSource,
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  CodeActionProvider,
  CompleteOption,
  Diagnostic,
  Position,
  Range,
  TextDocument,
  TextEdit,
  VimCompleteItem,
  sources,
  workspace,
} from 'coc.nvim';

export class PythonCodeActionProvider implements CodeActionProvider {
  private wholeRange(doc: TextDocument, range: Range): boolean {
    const whole = Range.create(0, 0, doc.lineCount - 1, 0);
    return (
      whole.start.line === range.start.line && whole.start.character === range.start.character && whole.end.line === range.end.line && whole.end.character === whole.end.character
    );
  }

  private cursorRange(r: Range): boolean {
    return r.start.line === r.end.line && r.start.character === r.end.character;
  }

  private lineRange(r: Range): boolean {
    return (r.start.line + 1 === r.end.line && r.start.character === 0 && r.end.character === 0) || (r.start.line === r.end.line && r.start.character === 0);
  }

  private sortImportsAction(): CodeAction {
    const config = workspace.getConfiguration('pyright');
    const provider = config.get<'pyright' | 'isort' | 'ruff'>('organizeimports.provider', 'pyright');
    const command = provider === 'pyright' ? 'pyright.organizeimports' : 'python.sortImports';
    const title = provider === 'pyright' ? 'Organize Imports by Pyright' : `Sort Imports by ${provider}`;
    return {
      title,
      kind: CodeActionKind.SourceOrganizeImports,
      command: {
        title: '',
        command,
      },
    };
  }

  private ignoreAction(document: TextDocument, range: Range): CodeAction | null {
    const ignoreTxt = '# type: ignore';
    const doc = workspace.getDocument(document.uri);
    // ignore action for whole file
    if (this.wholeRange(document, range)) {
      let pos = Position.create(0, 0);
      if (doc.getline(0).startsWith('#!')) pos = Position.create(1, 0);
      if (!doc.getline(pos.line).includes(ignoreTxt)) {
        return {
          title: 'Ignore Pyright typing check for whole file',
          kind: CodeActionKind.Empty,
          edit: {
            changes: {
              [doc.uri]: [TextEdit.insert(pos, ignoreTxt + '\n')],
            },
          },
        };
      }
    }

    // ignore action for current line
    if (this.lineRange(range)) {
      const line = doc.getline(range.start.line);
      if (line && line.length && !line.startsWith('#') && !line.includes(ignoreTxt)) {
        const edit = TextEdit.replace(range, `${line}  ${ignoreTxt}${range.start.line + 1 === range.end.line ? '\n' : ''}`);
        return {
          title: 'Ignore Pyright typing check for current line',
          kind: CodeActionKind.Empty,
          edit: {
            changes: {
              [doc.uri]: [edit],
            },
          },
        };
      }
    }
    return null;
  }

  private extractActions(document: TextDocument, range: Range): CodeAction[] {
    return [
      // extract actions should only work on range text
      {
        title: 'Extract Method',
        kind: CodeActionKind.RefactorExtract,
        command: {
          command: 'python.refactorExtractMethod',
          title: '',
          arguments: [document, range],
        },
      },

      {
        title: 'Extract Variable',
        kind: CodeActionKind.RefactorExtract,
        command: {
          title: '',
          command: 'python.refactorExtractVariable',
          arguments: [document, range],
        },
      },
    ];
  }

  private async fetchImportsByDiagnostic(document: TextDocument, diag: Diagnostic): Promise<ReadonlyArray<VimCompleteItem>> {
    const match = diag.message.match(/"(.*)" is not defined/);
    if (!match) return [];

    const source = sources.sources.find((s) => s.name.includes('pyright'));
    if (!source) return [];

    // @ts-ignore
    const option: CompleteOption = { position: diag.range.end, bufnr: document.uri };
    const tokenSource = new CancellationTokenSource();
    const result = await source.doComplete(option, tokenSource.token);
    tokenSource.cancel();

    // @ts-ignore
    return result ? result.items.filter(x => x.label === match[1]) : [];
  }

  private async fixAction(document: TextDocument, diag: Diagnostic): Promise<CodeAction[]> {
    const actions: CodeAction[] = [];
    if (diag.code === 'reportUndefinedVariable') {
      const items = await this.fetchImportsByDiagnostic(document, diag);
      for (const item of items) {
        // @ts-ignore
        const changes: TextEdit[] = [item.textEdit].concat(item.additionalTextEdits ?? []);
        // @ts-ignore
        const title = item.documentation?.value.replace('```\n', '').replace('\n```', '').trim();
        actions.push({
          title,
          kind: CodeActionKind.QuickFix,
          edit: {
            changes: {
              [document.uri]: changes,
            },
          },
        });
      }
    }

    // @ts-ignore
    if (diag.fix) {
      actions.push({
        // @ts-ignore
        title: diag.fix.title,
        kind: CodeActionKind.QuickFix,
        // @ts-ignore
        edit: diag.fix.edit,
      });
    }

    return actions;
  }

  public async provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): Promise<CodeAction[] | null | undefined> {
    const actions: CodeAction[] = [];

    if (context.diagnostics.length) {
      for (const diag of context.diagnostics) {
        actions.push(...await this.fixAction(document, diag));
      }
    }

    // sort imports actions
    actions.push(this.sortImportsAction());

    // ignore actions
    const ignore = this.ignoreAction(document, range);
    if (ignore) actions.push(ignore);

    // extract actions
    if (!this.wholeRange(document, range) && !this.cursorRange(range)) {
      actions.push(...this.extractActions(document, range));
    }

    return actions;
  }
}
