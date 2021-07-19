import { CodeAction, CodeActionContext, CodeActionKind, CodeActionProvider, Document, Position, ProviderResult, Range, TextDocument, TextEdit, workspace } from 'coc.nvim';

export class PythonCodeActionProvider implements CodeActionProvider {
  private wholeRange(doc: Document, range: Range): boolean {
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

  private ignoreAction(doc: Document, range: Range): CodeAction | null {
    // ignore action for whole file
    if (this.wholeRange(doc, range) || this.cursorRange(range)) {
      let pos = Position.create(0, 0);
      if (doc.getline(0).startsWith('#!')) {
        pos = Position.create(1, 0);
      }
      const edit = TextEdit.insert(pos, '# type: ignore\n');
      return {
        title: 'Ignore Pyright typing check for whole file',
        edit: {
          changes: {
            [doc.uri]: [edit],
          },
        },
      };
    }

    // ignore action for current line
    if (this.lineRange(range)) {
      const line = doc.getline(range.start.line);
      if (line && line.length && !line.startsWith('#')) {
        const edit = TextEdit.replace(range, `${line} # type: ignore${range.start.line + 1 === range.end.line ? '\n' : ''}`);
        return {
          title: 'Ignore Pyright typing check for current line',
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

  private addImportActions(document: TextDocument, msg: string): CodeAction[] {
    const match = msg.match(/"(.*)" is not defined/);
    if (!match) return [];
    return [
      {
        title: `Add "import ${match[1]}"`,
        kind: CodeActionKind.Source,
        command: {
          title: '',
          command: 'pyright.addImport',
          arguments: [document, match[1], false],
        },
      },

      {
        title: `Add "from _ import ${match[1]}"`,
        kind: CodeActionKind.Source,
        command: {
          title: '',
          command: 'pyright.addImport',
          arguments: [document, match[1], true],
        },
      },
    ];
  }

  public provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): ProviderResult<CodeAction[]> {
    // add import actions
    if (context.diagnostics.length) {
      const diag = context.diagnostics.find((d) => d.code === 'reportUndefinedVariable');
      if (diag) return this.addImportActions(document, diag.message);
    }

    const doc = workspace.getDocument(document.uri);
    const actions: CodeAction[] = [];

    // sort imports actions
    actions.push(this.sortImportsAction());

    // ignore actions
    const ignore = this.ignoreAction(doc, range);
    if (ignore) actions.push(ignore);

    // extract actions
    if (!this.wholeRange(doc, range) && !this.cursorRange(range)) {
      actions.push(...this.extractActions(document, range));
    }

    return actions;
  }
}
