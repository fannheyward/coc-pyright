import { CodeAction, CodeActionContext, CodeActionKind, CodeActionProvider, Diagnostic, Position, ProviderResult, Range, TextDocument, TextEdit, workspace } from 'coc.nvim';

export class PythonCodeActionProvider implements CodeActionProvider {
  private wholeRange(doc: TextDocument, range: Range): boolean {
    const whole = Range.create(0, 0, doc.lineCount, 0);
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
    const provider = config.get<'pyright' | 'isort'>('organizeimports.provider', 'pyright');
    const command = provider === 'pyright' ? 'pyright.organizeimports' : 'python.sortImports';
    const title = provider === 'pyright' ? 'Organize Imports by Pyright' : 'Sort Imports by isort';
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
    if (this.wholeRange(document, range) || this.cursorRange(range)) {
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

  private fixAction(document: TextDocument, diag: Diagnostic): CodeAction[] {
    if (diag.code === 'reportUndefinedVariable') {
      const msg = diag.message;
      const match = msg.match(/"(.*)" is not defined/);
      if (match) {
        return [
          {
            title: `Add "import ${match[1]}"`,
            kind: CodeActionKind.QuickFix,
            command: {
              title: '',
              command: 'pyright.addImport',
              arguments: [document, match[1], false],
            },
          },

          {
            title: `Add "from _ import ${match[1]}"`,
            kind: CodeActionKind.QuickFix,
            command: {
              title: '',
              command: 'pyright.addImport',
              arguments: [document, match[1], true],
            },
          },
        ];
      }
    }

    // @ts-ignore
    if (diag.fix) {
      const title = `Fix: ${diag.message.split(':')[0]}`;
      const action: CodeAction = {
        title,
        kind: CodeActionKind.QuickFix,
        // @ts-ignore
        edit: diag.fix,
      };
      return [action];
    }
    return [];
  }

  public provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): ProviderResult<CodeAction[]> {
    const actions: CodeAction[] = [];

    if (context.diagnostics.length) {
      for (const diag of context.diagnostics) {
        actions.push(...this.fixAction(document, diag));
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
