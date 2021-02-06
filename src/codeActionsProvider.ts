import { CodeAction, CodeActionKind, CodeActionProvider, ProviderResult, Range, TextDocument, workspace } from 'coc.nvim';

export class PythonCodeActionProvider implements CodeActionProvider {
  private equal(a: Range, b: Range): boolean {
    return a.start.line === b.start.line && a.start.character === b.start.character && a.end.line === b.end.line && a.end.character === b.end.character;
  }

  public provideCodeActions(document: TextDocument, range: Range): ProviderResult<CodeAction[]> {
    const actions: CodeAction[] = [];

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

    const doc = workspace.getDocument(document.uri);
    const whole = Range.create(0, 0, doc.lineCount, 0);
    if (!this.equal(whole, range)) {
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
