/* eslint-disable @typescript-eslint/no-var-requires */
import { OutputChannel, Uri, workspace } from 'coc.nvim';
import { Diff, diff_match_patch } from 'diff-match-patch';
import fs from 'fs-extra';
import md5 from 'md5';
import { EOL } from 'os';
import path from 'path';
import { SemVer } from 'semver';
import { promisify } from 'util';
import { CancellationToken, FormattingOptions, Position, Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PythonSettings } from '../configSettings';
import { isNotInstalledError, PythonExecutionService } from '../processService';
import { ExecutionInfo, IPythonSettings } from '../types';

const NEW_LINE_LENGTH = EOL.length;

enum EditAction {
  Delete,
  Insert,
  Replace,
}

class Patch {
  public diffs!: Diff[];
  public start1!: number;
  public start2!: number;
  public length1!: number;
  public length2!: number;
}

class Edit {
  public action: EditAction;
  public start: Position;
  public end!: Position;
  public text: string;

  constructor(action: number, start: Position) {
    this.action = action;
    this.start = start;
    this.text = '';
  }

  public apply(): TextEdit {
    switch (this.action) {
      case EditAction.Insert:
        return TextEdit.insert(this.start, this.text);
      case EditAction.Delete:
        return TextEdit.del(Range.create(this.start, this.end));
      case EditAction.Replace:
        return TextEdit.replace(Range.create(this.start, this.end), this.text);
      default:
        return {
          range: Range.create(0, 0, 0, 0),
          newText: '',
        };
    }
  }
}

export function parsePythonVersion(version: string): SemVer | undefined {
  if (!version || version.trim().length === 0) {
    return;
  }
  const versionParts = version
    .split('.')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((_, index) => index < 4);

  if (versionParts.length > 0 && versionParts[versionParts.length - 1].indexOf('-') > 0) {
    const lastPart = versionParts[versionParts.length - 1];
    versionParts[versionParts.length - 1] = lastPart.split('-')[0].trim();
    versionParts.push(lastPart.split('-')[1].trim());
  }
  while (versionParts.length < 4) {
    versionParts.push('');
  }
  // Exclude PII from `version_info` to ensure we don't send this up via telemetry.
  for (let index = 0; index < 3; index += 1) {
    versionParts[index] = /^\d+$/.test(versionParts[index]) ? versionParts[index] : '0';
  }
  if (['alpha', 'beta', 'candidate', 'final'].indexOf(versionParts[3]) === -1) {
    versionParts.pop();
  }
  const numberParts = `${versionParts[0]}.${versionParts[1]}.${versionParts[2]}`;
  const rawVersion = versionParts.length === 4 ? `${numberParts}-${versionParts[3]}` : numberParts;
  return new SemVer(rawVersion);
}

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

function getTextEditsInternal(before: string, diffs: [number, string][], startLine = 0): Edit[] {
  let line = startLine;
  let character = 0;
  if (line > 0) {
    const beforeLines = before.split(/\r?\n/g);
    beforeLines.filter((_l, i) => i < line).forEach((l) => (character += l.length + NEW_LINE_LENGTH));
  }
  const edits: Edit[] = [];
  let edit: Edit | null = null;

  for (let i = 0; i < diffs.length; i += 1) {
    const start = { line, character };
    // Compute the line/character after the diff is applied.
    for (let curr = 0; curr < diffs[i][1].length; curr += 1) {
      if (diffs[i][1][curr] !== '\n') {
        character += 1;
      } else {
        character = 0;
        line += 1;
      }
    }

    const dmp = require('diff-match-patch') as typeof import('diff-match-patch');
    switch (diffs[i][0]) {
      case dmp.DIFF_DELETE:
        if (edit === null) {
          edit = new Edit(EditAction.Delete, start);
        } else if (edit.action !== EditAction.Delete) {
          throw new Error('cannot format due to an internal error.');
        }
        edit.end = { line, character };
        break;

      case dmp.DIFF_INSERT:
        if (edit === null) {
          edit = new Edit(EditAction.Insert, start);
        } else if (edit.action === EditAction.Delete) {
          edit.action = EditAction.Replace;
        }
        // insert and replace edits are all relative to the original state
        // of the document, so inserts should reset the current line/character
        // position to the start.
        line = start.line;
        character = start.character;
        edit.text += diffs[i][1];
        break;

      case dmp.DIFF_EQUAL:
        if (edit !== null) {
          edits.push(edit);
          edit = null;
        }
        break;
    }
  }

  if (edit !== null) {
    edits.push(edit);
  }

  return edits;
}

/**
 * Parse a textual representation of patches and return a list of Patch objects.
 * @param {string} textline Text representation of patches.
 * @return {!Array.<!diff_match_patch.patch_obj>} Array of Patch objects.
 * @throws {!Error} If invalid input.
 */
function patch_fromText(textline: string): Patch[] {
  const patches: Patch[] = [];
  if (!textline) {
    return patches;
  }
  // Start Modification by Don Jayamanne 24/06/2016 Support for CRLF
  const text = textline.split(/[\r\n]/);
  // End Modification
  let textPointer = 0;
  const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/;
  while (textPointer < text.length) {
    const m = text[textPointer].match(patchHeader);
    if (!m) {
      throw new Error(`Invalid patch string: ${text[textPointer]}`);
    }

    const patch = new (diff_match_patch as any).patch_obj();
    patches.push(patch);
    patch.start1 = parseInt(m[1], 10);
    if (m[2] === '') {
      patch.start1 -= 1;
      patch.length1 = 1;
    } else if (m[2] === '0') {
      patch.length1 = 0;
    } else {
      patch.start1 -= 1;
      patch.length1 = parseInt(m[2], 10);
    }

    patch.start2 = parseInt(m[3], 10);
    if (m[4] === '') {
      patch.start2 -= 1;
      patch.length2 = 1;
    } else if (m[4] === '0') {
      patch.length2 = 0;
    } else {
      patch.start2 -= 1;
      patch.length2 = parseInt(m[4], 10);
    }
    textPointer += 1;
    const dmp = require('diff-match-patch') as typeof import('diff-match-patch');

    while (textPointer < text.length) {
      const sign = text[textPointer].charAt(0);
      let line: string;
      try {
        // var line = decodeURI(text[textPointer].substring(1))
        // For some reason the patch generated by python files don't encode any characters
        // And this patch module (code from Google) is expecting the text to be encoded!!
        // Temporary solution, disable decoding
        // Issue #188
        line = text[textPointer].substring(1);
      } catch (ex) {
        // Malformed URI sequence.
        throw new Error('Illegal escape in patch_fromText');
      }
      if (sign === '-') {
        // Deletion.
        patch.diffs.push([dmp.DIFF_DELETE, line]);
      } else if (sign === '+') {
        // Insertion.
        patch.diffs.push([dmp.DIFF_INSERT, line]);
      } else if (sign === ' ') {
        // Minor equality.
        patch.diffs.push([dmp.DIFF_EQUAL, line]);
      } else if (sign === '@') {
        // Start of next patch.
        break;
      } else if (sign === '') {
        // Blank line?  Whatever.
      } else {
        // WTF?
        throw new Error(`Invalid patch mode '${sign}' in: ${line}`);
      }
      textPointer += 1;
    }
  }
  return patches;
}

function getTextEditsFromPatch(before: string, patch: string): TextEdit[] {
  if (patch.startsWith('---')) {
    // Strip the first two lines
    patch = patch.substring(patch.indexOf('@@'));
  }

  if (patch.length === 0) {
    return [];
  }
  // Remove the text added by unified_diff
  // # Work around missing newline (http://bugs.python.org/issue2142).
  patch = patch.replace(/\\ No newline at end of file[\r\n]/, '');
  const dmp = require('diff-match-patch') as typeof import('diff-match-patch');
  const d = new dmp.diff_match_patch();
  const patches = patch_fromText.call(d, patch);
  if (!Array.isArray(patches) || patches.length === 0) {
    throw new Error('Unable to parse Patch string');
  }
  const textEdits: TextEdit[] = [];

  // Add line feeds and build the text edits
  patches.forEach((p) => {
    p.diffs.forEach((diff) => {
      diff[1] += EOL;
    });
    getTextEditsInternal(before, p.diffs, p.start1).forEach((edit) => textEdits.push(edit.apply()));
  });

  return textEdits;
}

export abstract class BaseFormatter {
  private _pythonSettings: IPythonSettings;
  private _outputChannel: OutputChannel;

  constructor(public readonly Id: string) {
    this._pythonSettings = PythonSettings.getInstance();
    this._outputChannel = workspace.createOutputChannel('coc-pyright-formatting');
  }

  protected get pythonSettings(): IPythonSettings {
    return this._pythonSettings;
  }

  protected get outputChannel(): OutputChannel {
    return this._outputChannel;
  }

  public abstract formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]>;
  protected getDocumentPath(document: TextDocument, fallbackPath?: string): string {
    const filepath = Uri.parse(document.uri).fsPath;
    if (fallbackPath && path.basename(filepath) === filepath) {
      return fallbackPath;
    }
    return path.dirname(filepath);
  }
  protected getWorkspaceUri(document: TextDocument): Uri | undefined {
    const { rootPath } = workspace;
    const filepath = Uri.parse(document.uri).fsPath;
    if (!filepath.startsWith(rootPath)) return;
    return Uri.file(rootPath);
  }

  private getSettingsPropertyNames(): { pathName: string; argsName: string } {
    return {
      argsName: `${this.Id}Args`,
      pathName: `${this.Id}Path`,
    };
  }

  private getExecutionInfo(customArgs: string[]): ExecutionInfo {
    const names = this.getSettingsPropertyNames();

    const execPath = this.pythonSettings.formatting[names.pathName] as string;
    let args = this.pythonSettings.formatting[names.argsName] as string[];
    args = args.concat(customArgs);

    let moduleName: string | undefined;

    // If path information is not available, then treat it as a module,
    if (path.basename(execPath) === execPath) {
      moduleName = execPath;
    }

    return { execPath, moduleName, args };
  }

  protected async provideDocumentFormattingEdits(document: TextDocument, _options: FormattingOptions, token: CancellationToken, args: string[], cwd?: string): Promise<TextEdit[]> {
    if (typeof cwd !== 'string' || cwd.length === 0) {
      cwd = Uri.file(workspace.rootPath).fsPath;
    }

    // autopep8 and yapf have the ability to read from the process input stream and return the formatted code out of the output stream.
    // However they don't support returning the diff of the formatted text when reading data from the input stream.
    // Yet getting text formatted that way avoids having to create a temporary file, however the diffing will have
    // to be done here in node (extension), i.e. extension CPU, i.e. less responsive solution.
    const filepath = Uri.parse(document.uri).fsPath;
    const tempFile = await this.createTempFile(document);
    if (this.checkCancellation(filepath, tempFile, token)) {
      return [];
    }

    const executionInfo = this.getExecutionInfo(args);
    executionInfo.args.push(tempFile);
    const pythonToolsExecutionService = new PythonExecutionService();
    const promise = pythonToolsExecutionService
      .exec(executionInfo, { cwd, throwOnStdErr: false, token })
      .then((output) => output.stdout)
      .then((data) => {
        if (this.checkCancellation(filepath, tempFile, token)) {
          return [] as TextEdit[];
        }
        return getTextEditsFromPatch(document.getText(), data);
      })
      .catch((error) => {
        if (this.checkCancellation(filepath, tempFile, token)) {
          return [] as TextEdit[];
        }
        this.handleError(this.Id, error).catch(() => {});
        return [] as TextEdit[];
      });
    promise.then(
      () => {
        this.deleteTempFile(filepath, tempFile).catch(() => {});
        workspace.showMessage(`Formatted with ${this.Id}`);
        const { nvim } = workspace;
        setTimeout(async () => {
          const line = (await nvim.call('coc#util#echo_line')) as string;
          if (line && /Formatted/.test(line)) nvim.command('echo ""', true);
        }, 2000);
      },
      () => {
        this.deleteTempFile(filepath, tempFile).catch(() => {});
      }
    );
    return promise;
  }

  protected async handleError(_expectedFileName: string, error: Error) {
    let customError = `Formatting with ${this.Id} failed.`;

    if (isNotInstalledError(error)) {
      customError += ` ${this.Id} module is not installed.`;
    }
    this.outputChannel.appendLine(customError);
    this.outputChannel.appendLine(error.message);
    workspace.showMessage(customError, 'warning');
  }

  private createTempFile(document: TextDocument): Promise<string> {
    return getTempFileWithDocumentContents(document);
  }

  private deleteTempFile(originalFile: string, tempFile: string): Promise<any> {
    if (originalFile !== tempFile) {
      return promisify(fs.unlink)(tempFile);
    }
    return Promise.resolve();
  }

  private checkCancellation(originalFile: string, tempFile: string, token?: CancellationToken): boolean {
    if (token && token.isCancellationRequested) {
      this.deleteTempFile(originalFile, tempFile).catch(() => {});
      return true;
    }
    return false;
  }
}
