import { CodeAction, CodeActionKind, CodeActionProvider, Command, ProviderResult, Range, TextDocument, workspace } from 'coc.nvim';

export class PythonCodeActionProvider implements CodeActionProvider {
  public provideCodeActions(document: TextDocument, range: Range): ProviderResult<(CodeAction | Command)[]> {
    const config = workspace.getConfiguration('python');
    const actions: (CodeAction | Command)[] = [];
    actions.push({
      title: 'Pyright Organize Imports',
      kind: CodeActionKind.SourceOrganizeImports,
      command: {
        title: '',
        command: 'pyright.organizeimports',
      },
    });

    actions.push({
      command: 'python.refactorExtractVariable',
      title: 'Extract Variable',
      arguments: [document, range],
    });
    actions.push({
      command: 'python.refactorExtractMethod',
      title: 'Extract Method',
      arguments: [document, range],
    });

    return actions;
  }
}
