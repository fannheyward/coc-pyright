import { CancellationToken, DiagnosticTag, OutputChannel, Range, TextDocument, TextEdit, Uri, WorkspaceEdit } from 'coc.nvim';
import { ILinterInfo, ILintMessage, LintMessageSeverity } from '../../types';
import { BaseLinter } from './baseLinter';

const COLUMN_OFF_SET = 1;

interface IRuffLocation {
  row: number;
  column: number;
}

interface IRuffFixEdit {
  content: string;
  location: IRuffLocation;
  end_location: IRuffLocation;
}

interface IRuffFix {
  message: string;
  edits: IRuffFixEdit[];
}

// {
//   "code": "F401",
//   "message": "`numpy` imported but unused",
//   "fix": {
//     "message": "Remove unused import: `numpy`",
//     "edits": [
//       {
//         "content": "",
//         "location": {
//           "row": 3,
//           "column": 0
//         },
//         "end_location": {
//           "row": 4,
//           "column": 0
//         }
//       }
//     ]
//   },
//   "location": {
//     "row": 3,
//     "column": 8
//   },
//   "end_location": {
//     "row": 3,
//     "column": 19
//   },
//   "filename": "/path/to/bug.py"
//   "noqa_row": 1
// },

interface IRuffLintMessage {
  kind: string | { [key: string]: any[] };
  code: string;
  message: string;
  fix: IRuffFix;
  location: IRuffLocation;
  end_location: IRuffLocation;
  filename: string;
  noqa_row: number;
}

export class Ruff extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel, COLUMN_OFF_SET);
  }

  private fixToWorkspaceEdit(filename: string, fix: IRuffFix): WorkspaceEdit | null {
    if (!fix) return null;

    // TODO: Support multiple edits.
    const edit = fix.edits[0];

    const u = Uri.parse(filename).toString();
    const range = Range.create(edit.location.row - 1, edit.location.column, edit.end_location.row - 1, edit.end_location.column);
    return {
      changes: {
        [u]: [TextEdit.replace(range, fix.message)],
      },
    };
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
