import { ChildProcess } from 'child_process';
import { Disposable, Document, OutputChannel, Position, Range, TextDocument, Uri, window, workspace } from 'coc.nvim';
import * as path from 'path';
import fs from 'fs';
import { createDeferred, Deferred } from '../async';
import { PythonSettings } from '../configSettings';
import { PythonExecutionService } from '../processService';
import { IPythonSettings } from '../types';
import { getTextEditsFromPatch, getWindowsLineEndingCount, splitLines, getTempFileWithDocumentContents } from '../utils';

class RefactorProxy implements Disposable {
  protected readonly isWindows = process.platform === 'win32';
  private _process?: ChildProcess;
  private _extensionDir: string;
  private _previousOutData = '';
  private _previousStdErrData = '';
  private _startedSuccessfully = false;
  private _commandResolve?: (value?: any | PromiseLike<any>) => void;
  private _commandReject!: (reason?: any) => void;
  private initialized!: Deferred<void>;
  constructor(extensionDir: string, readonly pythonSettings: IPythonSettings, private workspaceRoot: string) {
    this._extensionDir = extensionDir;
  }

  public dispose() {
    try {
      this._process!.kill();
    } catch (ex) {}
    this._process = undefined;
  }

  private getOffsetAt(document: TextDocument, position: Position): number {
    if (this.isWindows) {
      return document.offsetAt(position);
    }

    // get line count
    // Rope always uses LF, instead of CRLF on windows, funny isn't it
    // So for each line, reduce one character (for CR)
    // But Not all Windows users use CRLF
    const offset = document.offsetAt(position);
    const winEols = getWindowsLineEndingCount(document, offset);

    return offset - winEols;
  }

  public async addImport<T>(document: TextDocument, filePath: string, name: string, parent: string): Promise<T> {
    const options = await workspace.getFormatOptions();
    const command = {
      lookup: 'add_import',
      id: '1',
      file: filePath,
      text: document.getText(),
      name,
      parent,
      indent_size: options.tabSize,
    };
    return await this.sendCommand<T>(JSON.stringify(command));
  }

  public async extractVariable<T>(document: TextDocument, name: string, filePath: string, range: Range): Promise<T> {
    const options = await workspace.getFormatOptions();
    const command = {
      lookup: 'extract_variable',
      file: filePath,
      start: this.getOffsetAt(document, range.start).toString(),
      end: this.getOffsetAt(document, range.end).toString(),
      id: '2',
      name,
      indent_size: options.tabSize,
    };
    return await this.sendCommand<T>(JSON.stringify(command));
  }

  public async extractMethod<T>(document: TextDocument, name: string, filePath: string, range: Range): Promise<T> {
    const options = await workspace.getFormatOptions();
    // Ensure last line is an empty line
    // if (!document.lineAt(document.lineCount - 1).isEmptyOrWhitespace && range.start.line === document.lineCount - 1) {
    //   return Promise.reject<T>('Missing blank line at the end of document (PEP8).')
    // }
    const command = {
      lookup: 'extract_method',
      file: filePath,
      start: this.getOffsetAt(document, range.start).toString(),
      end: this.getOffsetAt(document, range.end).toString(),
      id: '3',
      name,
      indent_size: options.tabSize,
    };
    return await this.sendCommand<T>(JSON.stringify(command));
  }

  private async sendCommand<T>(command: string): Promise<T> {
    await this.initialize();
    return await new Promise<T>((resolve, reject) => {
      this._commandResolve = resolve;
      this._commandReject = reject;
      this._process!.stdin!.write(command + '\n');
    });
  }

  private async initialize(): Promise<void> {
    this.initialized = createDeferred<void>();
    const cwd = path.join(this._extensionDir, 'pythonFiles');
    const args = ['refactor.py', this.workspaceRoot];
    const pythonToolsExecutionService = new PythonExecutionService();
    const result = pythonToolsExecutionService.execObservable(this.pythonSettings.pythonPath, args, { cwd });
    this._process = result.proc;
    result.out.subscribe({
      next: (output) => {
        if (output.source === 'stdout') {
          if (!this._startedSuccessfully && output.out.startsWith('STARTED')) {
            this._startedSuccessfully = true;
            return this.initialized.resolve();
          }
          this.onData(output.out);
        } else {
          this.handleStdError(output.out);
        }
      },
      error: (error) => this.handleError(error),
    });

    return this.initialized.promise;
  }

  private handleStdError(data: string) {
    // Possible there was an exception in parsing the data returned
    // So append the data then parse it
    const dataStr = (this._previousStdErrData = this._previousStdErrData + data + '');
    let errorResponse: { message: string; traceback: string; type: string }[];
    try {
      errorResponse = dataStr
        .split(/\r?\n/g)
        .filter((line) => line.length > 0)
        .map((resp) => JSON.parse(resp));
      this._previousStdErrData = '';
    } catch (ex) {
      console.error(ex);
      // Possible we've only received part of the data, hence don't clear previousData
      return;
    }
    if (errorResponse[0].message.length === 0) {
      errorResponse[0].message = splitLines(errorResponse[0].traceback, { trim: false, removeEmptyEntries: false }).pop()!;
    }
    const errorMessage = errorResponse[0].message + '\n' + errorResponse[0].traceback;

    if (this._startedSuccessfully) {
      this._commandReject(`Refactor failed. ${errorMessage}`);
    } else {
      if (errorResponse[0].type === 'ModuleNotFoundError') {
        this.initialized.reject('Not installed');
        return;
      }

      this.initialized.reject(`Refactor failed. ${errorMessage}`);
    }
  }

  private handleError(error: Error) {
    if (this._startedSuccessfully) {
      return this._commandReject(error);
    }
    this.initialized.reject(error);
  }

  private onData(data: string) {
    if (!this._commandResolve) {
      return;
    }

    // Possible there was an exception in parsing the data returned
    // So append the data then parse it
    const dataStr = (this._previousOutData = this._previousOutData + data + '');
    let response: any;
    try {
      response = dataStr
        .split(/\r?\n/g)
        .filter((line) => line.length > 0)
        .map((resp) => JSON.parse(resp));
      this._previousOutData = '';
    } catch (ex) {
      // Possible we've only received part of the data, hence don't clear previousData
      return;
    }
    this.dispose();
    this._commandResolve!(response[0]);
    this._commandResolve = undefined;
  }
}

interface RenameResponse {
  results: [{ diff: string }];
}

function validateDocumentForRefactor(doc: Document): Promise<void> {
  if (!doc.dirty) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    workspace.nvim.command('write').then(() => {
      return resolve();
    }, reject);
  });
}

export async function extractVariable(root: string, document: TextDocument, range: Range, outputChannel: OutputChannel): Promise<any> {
  const pythonToolsExecutionService = new PythonExecutionService();
  const rope = await pythonToolsExecutionService.isModuleInstalled('rope');
  if (!rope) {
    window.showWarningMessage(`Module rope not installed`);
    return;
  }

  const doc = workspace.getDocument(document.uri);
  const tempFile = await getTempFileWithDocumentContents(document);
  const workspaceFolder = workspace.getWorkspaceFolder(doc.uri);
  const workspaceRoot = workspaceFolder ? Uri.parse(workspaceFolder.uri).fsPath : workspace.cwd;

  const pythonSettings = PythonSettings.getInstance();
  return validateDocumentForRefactor(doc).then(() => {
    const newName = `newvariable${new Date().getMilliseconds().toString()}`;
    const proxy = new RefactorProxy(root, pythonSettings, workspaceRoot);
    const rename = proxy.extractVariable<RenameResponse>(doc.textDocument, newName, tempFile, range).then((response) => {
      return response.results[0].diff;
    });

    return extractName(doc, newName, rename, outputChannel, tempFile);
  });
}

export async function extractMethod(root: string, document: TextDocument, range: Range, outputChannel: OutputChannel): Promise<any> {
  const pythonToolsExecutionService = new PythonExecutionService();
  const rope = await pythonToolsExecutionService.isModuleInstalled('rope');
  if (!rope) {
    window.showWarningMessage(`Module rope not installed`);
    return;
  }

  const doc = workspace.getDocument(document.uri);
  const tempFile = await getTempFileWithDocumentContents(document);
  const workspaceFolder = workspace.getWorkspaceFolder(doc.uri);
  const workspaceRoot = workspaceFolder ? Uri.parse(workspaceFolder.uri).fsPath : workspace.cwd;

  const pythonSettings = PythonSettings.getInstance();
  return validateDocumentForRefactor(doc).then(() => {
    const newName = `newmethod${new Date().getMilliseconds().toString()}`;
    const proxy = new RefactorProxy(root, pythonSettings, workspaceRoot);
    const rename = proxy.extractMethod<RenameResponse>(doc.textDocument, newName, tempFile, range).then((response) => {
      return response.results[0].diff;
    });

    return extractName(doc, newName, rename, outputChannel, tempFile);
  });
}

async function extractName(textEditor: Document, newName: string, renameResponse: Promise<string>, outputChannel: OutputChannel, tempFile: string): Promise<any> {
  let changeStartsAtLine = -1;
  try {
    const diff = await renameResponse;
    if (diff.length === 0) {
      return [];
    }
    const edits = getTextEditsFromPatch(textEditor.getDocumentContent(), diff);
    edits.forEach((edit) => {
      if (changeStartsAtLine === -1 || changeStartsAtLine > edit.range.start.line) {
        changeStartsAtLine = edit.range.start.line;
      }
    });
    await textEditor.applyEdits(edits);
    await fs.promises.unlink(tempFile);

    if (changeStartsAtLine >= 0) {
      let newWordPosition: Position | undefined;
      for (let lineNumber = changeStartsAtLine; lineNumber < textEditor.lineCount; lineNumber += 1) {
        const line = textEditor.getline(lineNumber);
        const indexOfWord = line.indexOf(newName);
        if (indexOfWord >= 0) {
          newWordPosition = Position.create(lineNumber, indexOfWord);
          break;
        }
      }
      return workspace.jumpTo(textEditor.uri, newWordPosition).then(() => {
        return newWordPosition;
      });
    }
  } catch (error) {
    let errorMessage = `${error}`;
    if (typeof error === 'string') {
      errorMessage = error;
    }
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    outputChannel.appendLine(`${'#'.repeat(10)}Refactor Output${'#'.repeat(10)}`);
    outputChannel.appendLine(`Error in refactoring:\n${errorMessage}`);
    outputChannel.appendLine('');
    window.showErrorMessage(`Cannot perform refactoring using selected element(s).`);
    return await Promise.reject(error);
  }
}
