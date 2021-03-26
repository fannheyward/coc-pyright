import { CodeAction, CodeActionKind, CodeActionProvider, Document, Position, ProviderResult, Range, TextDocument, TextEdit, workspace } from 'coc.nvim';

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

  public provideCodeActions(document: TextDocument, range: Range): ProviderResult<CodeAction[]> {
    const doc = workspace.getDocument(document.uri);
    const actions: CodeAction[] = [];

    // sort imports actions
    const config = workspace.getConfiguration('pyright');
    const provider = config.get<'pyright' | 'isort'>('organizeimports.provider', 'pyright');
    if (provider === 'pyright') {
      actions.push({
        title: 'Organize Imports by Pyright',
        kind: CodeActionKind.SourceOrganizeImports,
        command: {
          title: '',
          command: 'pyright.organizeimports',
        },
      });
    } else if (provider === 'isort') {
      actions.push({
        title: 'Sort Imports by isort',
        kind: CodeActionKind.SourceOrganizeImports,
        command: {
          title: '',
          command: 'python.sortImports',
        },
      });
    }

    // ignore action for whole file
    if (this.wholeRange(doc, range) || this.cursorRange(range)) {
      let pos = Position.create(0, 0);
      if (doc.getline(0).startsWith('#!')) {
        pos = Position.create(1, 0);
      }
      const edit = TextEdit.insert(pos, '# type: ignore\n');
      actions.push({
        title: 'Ignore Pyright typing check for whole file',
        edit: {
          changes: {
            [doc.uri]: [edit],
          },
        },
      });
    }

    // ignore action for current line
    if (range.start.line === range.end.line && range.start.character === 0) {
      const line = doc.getline(range.start.line);
      if (line && !line.startsWith('#') && line.length === range.end.character) {
        const edit = TextEdit.replace(range, line + '  # type: ignore');
        actions.push({
          title: 'Ignore Pyright typing check for current line',
          edit: {
            changes: {
              [doc.uri]: [edit],
            },
          },
        });
      }
    }

    if (!this.wholeRange(doc, range) && !this.cursorRange(range)) {
      // extract actions should only work on range text
      actions.push({
        title: 'Extract Method',
        kind: CodeActionKind.RefactorExtract,
        command: {
          command: 'python.refactorExtractMethod',
          title: '',
          arguments: [document, range],
        },
      });

      actions.push({
        title: 'Extract Variable',
        kind: CodeActionKind.RefactorExtract,
        command: {
          title: '',
          command: 'python.refactorExtractVariable',
          arguments: [document, range],
        },
      });
    }

    return actions;
  }
}
