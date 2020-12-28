import { TextDocument, FormattingOptions, CancellationToken, Range, Thenable, TextEdit, OutputChannel } from 'coc.nvim';
import { IPythonSettings } from '../types';
import { BaseFormatter } from './baseFormatter';

export class YapfFormatter extends BaseFormatter {
  constructor(public readonly pythonSettings: IPythonSettings, public readonly outputChannel: OutputChannel) {
    super('yapf', pythonSettings, outputChannel);
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const formatSelection = range ? range : false;

    const yapfArgs = ['--diff'];
    if (this.pythonSettings.formatting.yapfArgs.length > 0) {
      yapfArgs.push(...this.pythonSettings.formatting.yapfArgs);
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
