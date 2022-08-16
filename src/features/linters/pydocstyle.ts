import { CancellationToken, OutputChannel, TextDocument, Uri, workspace } from 'coc.nvim';
import * as path from 'path';
import { ILinterInfo, ILintMessage, LintMessageSeverity } from '../../types';
import { BaseLinter } from './baseLinter';

export class PyDocStyle extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const baseFileName = path.basename(Uri.parse(document.uri).fsPath);
    if (/^test_.*\.py$/.test(baseFileName)) return [];
    const messages = await this.run([Uri.parse(document.uri).fsPath], document, cancellation);
    // All messages in pep8 are treated as warnings for now.
    messages.forEach((msg) => {
      msg.severity = LintMessageSeverity.Warning;
    });

    return messages;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async parseMessages(output: string, document: TextDocument, _token: CancellationToken, _regEx: string) {
    let outputLines = output.split(/\r?\n/g);
    const baseFileName = path.basename(Uri.parse(document.uri).fsPath);

    // Remember, the first line of the response contains the file name and line number, the next line contains the error message.
    // So we have two lines per message, hence we need to take lines in pairs.
    const maxLines = this.pythonSettings.linting.maxNumberOfProblems * 2;
    // First line is almost always empty.
    const oldOutputLines = outputLines.filter((line) => line.length > 0);
    outputLines = [];
    for (let counter = 0; counter < oldOutputLines.length / 2; counter += 1) {
      outputLines.push(oldOutputLines[2 * counter] + oldOutputLines[2 * counter + 1]);
    }
    const doc = workspace.getDocument(document.uri);

    return (
      outputLines
        .filter((value, index) => index < maxLines && value.indexOf(':') >= 0)
        .map((line) => {
          // Windows will have a : after the drive letter (e.g. c:\).
          if (this.isWindows) {
            return line.substring(line.indexOf(`${baseFileName}:`) + baseFileName.length + 1).trim();
          }
          return line.substring(line.indexOf(':') + 1).trim();
        })
        // Iterate through the lines (skipping the messages).
        // So, just iterate the response in pairs.
        .map((line) => {
          try {
            if (line.trim().length === 0) {
              return;
            }
            const lineNumber = parseInt(line.substring(0, line.indexOf(' ')), 10);
            const part = line.substring(line.indexOf(':') + 1).trim();
            const code = part.substring(0, part.indexOf(':')).trim();
            const message = part.substring(part.indexOf(':') + 1).trim();

            const sourceLine = doc.getline(lineNumber - 1);
            const trmmedSourceLine = sourceLine.trim();
            const sourceStart = sourceLine.indexOf(trmmedSourceLine);

            return {
              code,
              message,
              column: sourceStart,
              line: lineNumber,
              type: '',
              provider: this.info.id,
            } as ILintMessage;
          } catch (err) {
            this.outputChannel.appendLine(`Failed to parse pydocstyle line '${line}'`);
            if (typeof err === 'string') {
              this.outputChannel.appendLine(err);
            } else if (err instanceof Error) {
              this.outputChannel.appendLine(err.message);
            }
            return;
          }
        })
        .filter((item) => item !== undefined)
        .map((item) => item!)
    );
  }
}
