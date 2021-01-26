import { CodeAction, CodeActionKind, CodeActionProvider, ProviderResult, Range, TextDocument, workspace } from 'coc.nvim';

export class PythonCodeActionProvider implements CodeActionProvider {
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

    return actions;
  }
}
