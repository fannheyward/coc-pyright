// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { OutputChannel, Uri, workspace } from 'coc.nvim';
import namedRegexp from 'named-js-regexp';
import { CancellationToken } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PythonSettings } from '../configSettings';
import { PythonExecutionService } from '../processService';
import { ILinter, ILinterInfo, ILintMessage, IPythonSettings, LinterId, LintMessageSeverity } from '../types';
import { ErrorHandler } from './errorHandlers/errorHandler';

// Allow negative column numbers (https://github.com/PyCQA/pylint/issues/1822)
const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>\\w+\\d+):(?<message>.*)\\r?(\\n|$)';

export interface IRegexGroup {
  line: number;
  column: number;
  code: string;
  message: string;
  type: string;
  file?: string;
}

export function matchNamedRegEx(data: string, regex: string): IRegexGroup | undefined {
  const compiledRegexp = namedRegexp(regex, 'g');
  const rawMatch = compiledRegexp.exec(data);
  if (rawMatch) {
    // @ts-ignore
    return rawMatch.groups() as IRegexGroup;
  }

  return undefined;
}

function splitLines(str: string, splitOptions: { trim: boolean; removeEmptyEntries: boolean }): string[] {
  let lines = str.split(/\r?\n/g);
  if (splitOptions.trim) {
    lines = lines.map((line) => line.trim());
  }
  if (splitOptions.removeEmptyEntries) {
    lines = lines.filter((line) => line.length > 0);
  }
  return lines;
}

export function parseLine(line: string, regex: string, linterID: LinterId, colOffset = 0): ILintMessage | undefined {
  const match = matchNamedRegEx(line, regex)!;
  if (!match) {
    return;
  }

  match.line = Number(match.line as any);
  match.column = Number(match.column as any);

  return {
    code: match.code,
    message: match.message,
    column: isNaN(match.column) || match.column <= 0 ? 0 : match.column - colOffset,
    line: match.line,
    type: match.type,
    provider: linterID,
    file: match.file,
  };
}

export abstract class BaseLinter implements ILinter {
  protected readonly isWindows = process.platform === 'win32';

  private errorHandler: ErrorHandler;
  private _pythonSettings: IPythonSettings;
  private _info: ILinterInfo;

  protected get pythonSettings(): IPythonSettings {
    return this._pythonSettings;
  }

  constructor(info: ILinterInfo, protected readonly outputChannel: OutputChannel, protected readonly columnOffset = 0) {
    this._info = info;
    this.errorHandler = new ErrorHandler(this.info.id, outputChannel);
    this._pythonSettings = PythonSettings.getInstance();
  }

  public get info(): ILinterInfo {
    return this._info;
  }

  public async lint(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    return this.runLinter(document, cancellation);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getWorkspaceRootPath(_document?: TextDocument): string {
    return workspace.rootPath;
  }
  protected abstract runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]>;

  protected parseMessagesSeverity(error: string, categorySeverity: any): LintMessageSeverity {
    if (categorySeverity[error]) {
      const severityName = categorySeverity[error];
      switch (severityName) {
        case 'Error':
          return LintMessageSeverity.Error;
        case 'Hint':
          return LintMessageSeverity.Hint;
        case 'Information':
          return LintMessageSeverity.Information;
        case 'Warning':
          return LintMessageSeverity.Warning;
        default: {
          if (LintMessageSeverity[severityName]) {
            return (LintMessageSeverity[severityName] as any) as LintMessageSeverity;
          }
        }
      }
    }
    return LintMessageSeverity.Information;
  }

  protected async run(args: string[], document: TextDocument, cancellation: CancellationToken, regEx: string = REGEX): Promise<ILintMessage[]> {
    if (!this.info.isEnabled(Uri.parse(document.uri))) {
      return [];
    }
    const executionInfo = this.info.getExecutionInfo(args, Uri.parse(document.uri));
    const cwd = this.getWorkspaceRootPath(document);
    try {
      const pythonToolsExecutionService = new PythonExecutionService();
      const result = await pythonToolsExecutionService.exec(executionInfo, { cwd, token: cancellation, mergeStdOutErr: false });

      this.outputChannel.append(`${'#'.repeat(10)} Linting Output - ${this.info.id}${'#'.repeat(10)}\n`);
      this.outputChannel.append(result.stdout);

      return await this.parseMessages(result.stdout, document, cancellation, regEx);
    } catch (error) {
      await this.errorHandler.handleError(error, Uri.parse(document.uri), executionInfo).catch(() => {});
      return [];
    }
  }

  protected async parseMessages(output: string, _document: TextDocument, _token: CancellationToken, regEx: string) {
    const messages: ILintMessage[] = [];
    const outputLines = splitLines(output, { removeEmptyEntries: false, trim: false });
    for (const line of outputLines) {
      try {
        const msg = parseLine(line, regEx, this.info.id, this.columnOffset);
        if (msg) {
          messages.push(msg);
          if (messages.length >= this.pythonSettings.linting.maxNumberOfProblems) {
            break;
          }
        }
      } catch (ex) {
        this.outputChannel.appendLine(`${'#'.repeat(10)} Linter ${this.info.id} failed to parse the line:`);
        this.outputChannel.appendLine(line);
        this.outputChannel.appendLine(ex);
      }
    }
    return messages;
  }
}
