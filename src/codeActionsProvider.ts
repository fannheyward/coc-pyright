import { CodeAction, CodeActionProvider, ProviderResult } from 'coc.nvim';

export class PythonCodeActionProvider implements CodeActionProvider {
  public provideCodeActions(): ProviderResult<CodeAction[]> {
    const action: CodeAction = {
      title: '',
      kind: 'source.organizeImports',
      command: {
        title: '',
        command: 'pyright.organizeimports',
      },
    };

    return [action];
  }
}
