import { commands, DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, ProviderResult, workspace } from 'coc.nvim';
import { CancellationToken, Disposable, FormattingOptions, Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AutoPep8Formatter } from './formatters/autopep8';
import { BaseFormatter } from './formatters/base';
import { BlackFormatter } from './formatters/black';
import { YapfFormatter } from './formatters/yapf';

export class PythonFormattingEditProvider implements DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider {
  private formatters = new Map<string, BaseFormatter>();
  private disposables: Disposable[] = [];
  private documentVersionBeforeFormatting = -1;
  private formatterMadeChanges = false;

  constructor() {
    this.formatters.set('black', new BlackFormatter());
    this.formatters.set('yapf', new YapfFormatter());
    this.formatters.set('autopep8', new AutoPep8Formatter());
    this.disposables.push(workspace.onDidSaveTextDocument((e) => this.onSaveDocument(e)));
  }

  private async _provideEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Promise<TextEdit[]> {
    const provider = workspace.getConfiguration('python').get('formatting.provider') as string;
    const formater = this.formatters.get(provider);
    if (!formater) return [];

    // Remember content before formatting so we can detect if
    // formatting edits have been really applied
    const editorConfig = workspace.getConfiguration('coc.preferences', document.uri);
    if (editorConfig.get<string[]>('formatOnSaveFiletypes', []).includes('python')) {
      this.documentVersionBeforeFormatting = document.version;
    }

    const edits = await formater.formatDocument(document, options, token, range);
    this.formatterMadeChanges = edits.length > 0;
    return edits;
  }

  private async onSaveDocument(document: TextDocument): Promise<void> {
    const doc = workspace.getDocument(document.uri);
    if (!doc) return;
    // Promise was rejected = formatting took too long.
    // Don't format inside the event handler, do it on timeout
    setTimeout(async () => {
      try {
        if (this.formatterMadeChanges && !doc.dirty && document.version === this.documentVersionBeforeFormatting) {
          // Formatter changes were not actually applied due to the timeout on save.
          // Force formatting now and then save the document.
          await commands.executeCommand('editor.action.format');
        }
      } finally {
        this.documentVersionBeforeFormatting = -1;
        this.formatterMadeChanges = false;
      }
    }, 50);
  }

  provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
    return this._provideEdits(document, options, token);
  }

  provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
    return this._provideEdits(document, options, token, range);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
