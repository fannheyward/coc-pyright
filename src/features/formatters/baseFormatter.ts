import {
  type CancellationToken,
  type FormattingOptions,
  type OutputChannel,
  type Range,
  type TextDocument,
  type TextEdit,
  type Thenable,
  Uri,
  window,
  workspace,
} from 'coc.nvim';
import fs from 'node:fs';
import md5 from 'md5';
import path from 'node:path';
import which from 'which';
import { isNotInstalledError, PythonExecutionService } from '../../processService';
import type { ExecutionInfo, FormatterId, IPythonSettings } from '../../types';
import { getTextEditsFromPatch } from '../../utils';

function getTempFileWithDocumentContents(document: TextDocument): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const fsPath = Uri.parse(document.uri).fsPath;
    const ext = path.extname(fsPath);
    // Don't create file in temp folder since external utilities
    // look into configuration files in the workspace and are not able
    // to find custom rules if file is saved in a random disk location.
    // This means temp file has to be created in the same folder
    // as the original one and then removed.

    const fileName = `${fsPath}.${md5(document.uri)}${ext}`;
    fs.writeFile(fileName, document.getText(), (ex) => {
      if (ex) {
        reject(new Error(`Failed to create a temporary file, ${ex.message}`));
      }
      resolve(fileName);
    });
  });
}

export abstract class BaseFormatter {
  constructor(
    public readonly Id: FormatterId,
    public readonly pythonSettings: IPythonSettings,
    public readonly outputChannel: OutputChannel,
  ) {}

  public abstract formatDocument(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken,
    range?: Range,
  ): Thenable<TextEdit[]>;
  protected getDocumentPath(document: TextDocument, fallbackPath?: string): string {
    const filepath = Uri.parse(document.uri).fsPath;
    if (fallbackPath && path.basename(filepath) === filepath) {
      return fallbackPath;
    }
    return path.dirname(filepath);
  }
  protected getWorkspaceUri(document: TextDocument): Uri | undefined {
    const filepath = Uri.parse(document.uri).fsPath;
    if (!filepath.startsWith(workspace.root)) return;
    return Uri.file(workspace.root);
  }

  private getExecutionInfo(args: string[]): ExecutionInfo {
    let moduleName: string | undefined;
    let execPath = this.pythonSettings.formatting[`${this.Id}Path`] as string;
    execPath = which.sync(execPath, { nothrow: true }) || execPath;
    if (path.basename(execPath) === execPath) {
      moduleName = execPath;
    }

    return { execPath, moduleName, args };
  }

  protected async provideDocumentFormattingEdits(
    document: TextDocument,
    _options: FormattingOptions,
    token: CancellationToken,
    args: string[],
    root?: string,
  ): Promise<TextEdit[]> {
    if (this.pythonSettings.stdLibs.some((p) => Uri.parse(document.uri).fsPath.startsWith(p))) {
      return [];
    }
    // autopep8 and yapf have the ability to read from the process input stream and return the formatted code out of the output stream.
    // However they don't support returning the diff of the formatted text when reading data from the input stream.
    // Yet getting text formatted that way avoids having to create a temporary file, however the diffing will have
    // to be done here in node (extension), i.e. extension CPU, i.e. less responsive solution.
    const filepath = Uri.parse(document.uri).fsPath;
    const tempFile = await this.createTempFile(document);
    if (this.checkCancellation(filepath, tempFile, 'start', token)) {
      return [];
    }
    args.push(tempFile);

    const executionInfo = this.getExecutionInfo(args);
    this.outputChannel.appendLine(`execPath:   ${executionInfo.execPath}`);
    this.outputChannel.appendLine(`moduleName: ${executionInfo.moduleName}`);
    this.outputChannel.appendLine(`args:       ${executionInfo.args}`);

    const cwd = root?.length ? root : Uri.file(workspace.root).fsPath;
    const pythonToolsExecutionService = new PythonExecutionService();
    const promise = pythonToolsExecutionService
      .exec(executionInfo, { cwd, throwOnStdErr: false, token })
      .then((output) => {
        if (output.stderr) {
          throw new Error(output.stderr);
        }
        return output.stdout;
      })
      .then((data) => {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`${'#'.repeat(10)} ${this.Id} output:`);
        this.outputChannel.appendLine(data);
        if (this.checkCancellation(filepath, tempFile, 'success', token)) {
          return [] as TextEdit[];
        }
        const edits = getTextEditsFromPatch(document.getText(), data);
        if (edits.length) window.showInformationMessage(`Formatted with ${this.Id}`);
        return edits;
      })
      .catch((error) => {
        this.handleError(this.Id, error).catch(() => {});
        if (this.checkCancellation(filepath, tempFile, 'error', token)) {
          return [] as TextEdit[];
        }
        return [] as TextEdit[];
      })
      .finally(() => {
        this.deleteTempFile(filepath, tempFile).catch(() => {});
      });
    return promise;
  }

  protected async handleError(_expectedFileName: string, error: Error) {
    this.outputChannel.appendLine(`${'#'.repeat(10)} Formatting with ${this.Id} failed`);
    this.outputChannel.appendLine(error.message);

    let customError = `Formatting with ${this.Id} failed`;
    if (isNotInstalledError(error)) {
      customError = `${customError}: ${this.Id} module is not installed.`;
    }
    window.showWarningMessage(customError);
  }

  protected createTempFile(document: TextDocument): Promise<string> {
    return getTempFileWithDocumentContents(document);
  }

  private deleteTempFile(originalFile: string, tempFile: string): Promise<any> {
    if (originalFile !== tempFile) {
      return fs.promises.unlink(tempFile);
    }
    return Promise.resolve();
  }

  private checkCancellation(originalFile: string, tempFile: string, state: string, token?: CancellationToken): boolean {
    if (token?.isCancellationRequested) {
      this.outputChannel.appendLine(`${'#'.repeat(10)} ${this.Id} formatting action is canceled on ${state}`);
      this.deleteTempFile(originalFile, tempFile).catch(() => {});
      return true;
    }
    return false;
  }
}
