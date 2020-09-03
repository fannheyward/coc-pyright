import { workspace } from 'coc.nvim';
import { CancellationToken, FormattingOptions, Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseFormatter } from './base';

export class YapfFormatter extends BaseFormatter {
  constructor() {
    super('yapf');
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const settings = workspace.getConfiguration('python', document.uri);
    const hasCustomArgs = Array.isArray(settings.formatting.yapfArgs) && settings.formatting.yapfArgs.length > 0;
    const formatSelection = range ? range : false;

    const yapfArgs = ['--diff'];
    if (hasCustomArgs) {
      yapfArgs.push(...settings.formatting.yapfArgs);
    }
    if (formatSelection) {
      yapfArgs.push(...['--lines', `${range!.start.line + 1}-${range!.end.line + 1}`]);
    }
    // Yapf starts looking for config file starting from the file path.
    const fallbarFolder = this.getWorkspaceUri(document)?.fsPath;
    const cwd = this.getDocumentPath(document, fallbarFolder);
    const promise = super.provideDocumentFormattingEdits(document, options, token, yapfArgs, cwd);
    return promise;
  }
}
