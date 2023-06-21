import { CancellationToken, DiagnosticTag, OutputChannel, Range, TextDocument, TextEdit, Uri, WorkspaceEdit } from 'coc.nvim';
import { ILinterInfo, ILintMessage, LintMessageSeverity } from '../../types';
import { BaseLinter } from './baseLinter';

const COLUMN_OFF_SET = 1;

interface IRuffLocation {
  row: number;
  column: number;
}

interface IRuffEdit {
  content: string;
  location: IRuffLocation;
  end_location: IRuffLocation;
}

interface IRuffFix {
  message: string;

  // ruff 0.0.260 or later
  edits?: IRuffEdit[];

  // before 0.0.260
  content?: string;
  location?: IRuffLocation;
  end_location?: IRuffLocation;
}

// fix format
//
// old
// {
//   "message": "Remove unused import: `sys`",
//   "content": "",
//   "location": {"row": 1, "column": 0},
//   "end_location": {"row": 2, "column": 0}
// }
//
// new, from ruff 0.0.260
// {
//   "message": "Remove unused import: `sys`",
//   "edits": [
//     {
//       "content": "",
//       "location": {"row": 1, "column": 0},
//       "end_location": {"row": 2, "column": 0},
//     }
//   ]
// }

interface IRuffLintMessage {
  kind: string | { [key: string]: any[] };
  code: string;
  message: string;
  fix: IRuffFix;
  location: IRuffLocation;
  end_location: IRuffLocation;
  filename: string;
  noqa_row: number;
  url?: string;
}

export class Ruff extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  private fixToWorkspaceEdit(filename: string, fix: IRuffFix): { title: string, edit: WorkspaceEdit } | null {
    if (!fix) return null;

    const u = Uri.parse(filename).toString();
    if (fix.edits && fix.edits.length) {
      const changes = fix.edits.map((edit) => {
        const range = Range.create(edit.location.row - 1, edit.location.column, edit.end_location.row - 1, edit.end_location.column);
        return TextEdit.replace(range, edit.content);
      });
      return {
        title: `Ruff: ${fix.message}`,
        edit: {
          changes: {
            [u]: changes,
          },

        },
      };
    } else if (fix.location && fix.end_location) {
      const range = Range.create(fix.location.row - 1, fix.location.column, fix.end_location.row - 1, fix.end_location.column);
      return {
        title: `Ruff: ${fix.message}`,
        edit: {
          changes: {
            [u]: [TextEdit.replace(range, fix.content || '')],
          },
        },
      };
    }

    return null;
  }

  protected async parseMessages(output: string): Promise<ILintMessage[]> {
    try {
      const messages: ILintMessage[] = JSON.parse(output).map((msg: IRuffLintMessage) => {
        return {
          line: msg.location.row,
          column: msg.location.column - COLUMN_OFF_SET,
          endLine: msg.end_location.row,
          endColumn: msg.end_location.column,
          code: msg.code,
          message: msg.message,
          type: '',
          severity: LintMessageSeverity.Warning, // https://github.com/charliermarsh/ruff/issues/645
          tags: ['F401', 'F841'].includes(msg.code) ? [DiagnosticTag.Unnecessary] : [],
          provider: this.info.id,
          file: msg.filename,
          url: msg.url,
          fix: this.fixToWorkspaceEdit(msg.filename, msg.fix),
        } as ILintMessage;
      });

      return messages;
    } catch (error) {
      this.outputChannel.appendLine(`Linting with ${this.info.id} failed:`);
      if (error instanceof Error) {
        this.outputChannel.appendLine(error.message.toString());
      }
      return [];
    }
  }

  protected async runLinter(document: TextDocument, token: CancellationToken): Promise<ILintMessage[]> {
    const fsPath = Uri.parse(document.uri).fsPath;
    const args = ['--format', 'json', '--exit-zero', '--stdin-filename', fsPath, '-'];
    return this.run(args, document, token);
  }
}
