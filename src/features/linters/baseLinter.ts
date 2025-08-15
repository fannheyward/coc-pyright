// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { spawn } from 'node:child_process';
import { type CancellationToken, type OutputChannel, type TextDocument, Uri, workspace } from 'coc.nvim';
import namedRegexp from 'named-js-regexp';
import { PythonSettings } from '../../configSettings';
import { PythonExecutionService } from '../../processService';
import {
  type ExecutionInfo,
  type ILinter,
  type ILinterInfo,
  type ILintMessage,
  type IPythonSettings,
  type LinterId,
  LintMessageSeverity,
} from '../../types';
import { splitLines } from '../../utils';

// Allow negative column numbers (https://github.com/PyCQA/pylint/issues/1822)
const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>\\w+\\d+):(?<message>.*)\\r?(\\n|$)';

interface IRegexGroup {
  line: number;
  column: number;
  code: string;
  message: string;
  type: string;
  file?: string;
}

function matchNamedRegEx(data: string, regex: string): IRegexGroup | undefined {
  const compiledRegexp = namedRegexp(regex, 'g');
  const rawMatch = compiledRegexp.exec(data);
  if (rawMatch) {
    // @ts-expect-error
    return rawMatch.groups() as IRegexGroup;
  }

  return undefined;
}

function parseLine(line: string, regex: string, linterID: LinterId, colOffset = 0): ILintMessage | undefined {
  const match = matchNamedRegEx(line, regex)!;
  if (!match) {
    return;
  }

  match.line = Number(match.line as any);
  match.column = Number(match.column as any);

  return {
    code: match.code,
    message: match.message,
    column: Number.isNaN(match.column) || match.column <= 0 ? 0 : match.column - colOffset,
    line: match.line,
    type: match.type,
    provider: linterID,
    file: match.file,
  };
}

export abstract class BaseLinter implements ILinter {
  protected readonly isWindows = process.platform === 'win32';

  private _pythonSettings: IPythonSettings;
  private _info: ILinterInfo;

  protected get pythonSettings(): IPythonSettings {
    return this._pythonSettings;
  }

  constructor(
    info: ILinterInfo,
    protected readonly outputChannel: OutputChannel,
    protected readonly columnOffset = 0,
  ) {
    this._info = info;
    this._pythonSettings = PythonSettings.getInstance();
  }

  public get info(): ILinterInfo {
    return this._info;
  }

  public async lint(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    return this.runLinter(document, cancellation);
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
            return LintMessageSeverity[severityName] as any as LintMessageSeverity;
          }
        }
      }
    }
    return LintMessageSeverity.Information;
  }

  private async stdinRun(executionInfo: ExecutionInfo, document: TextDocument): Promise<string> {
    let command = executionInfo.execPath;
    let args = executionInfo.args;
    if (executionInfo.moduleName) {
      command = this.pythonSettings.pythonPath;
      args = ['-m', executionInfo.moduleName, ...args];
    }
    const child = spawn(command, args, { cwd: workspace.root });
    return new Promise((resolve) => {
      child.stdin.setDefaultEncoding('utf8');
      child.stdin.write(document.getText());
      child.stdin.end();

      let result = '';
      child.stdout.on('data', (data) => {
        result += data.toString('utf-8').trim();
      });
      child.on('close', () => {
        resolve(result);
      });
    });
  }

  protected async run(
    args: string[],
    document: TextDocument,
    token: CancellationToken,
    regEx = REGEX,
  ): Promise<ILintMessage[]> {
    if (!this.info.isEnabled(Uri.parse(document.uri))) {
      return [];
    }

    try {
      const executionInfo = this.info.getExecutionInfo(args, Uri.parse(document.uri));
      this.outputChannel.appendLine(`${'#'.repeat(10)} Run linter ${this.info.id}:`);
      this.outputChannel.appendLine(JSON.stringify(executionInfo));
      this.outputChannel.appendLine('');

      let result = '';
      if (this.info.stdinSupport) {
        result = await this.stdinRun(executionInfo, document);
      } else {
        const service = new PythonExecutionService();
        result = (await service.exec(executionInfo, { cwd: workspace.root, token, mergeStdOutErr: false })).stdout;
      }

      this.outputChannel.append(`${'#'.repeat(10)} Linting Output - ${this.info.id} ${'#'.repeat(10)}\n`);
      this.outputChannel.append(result);
      this.outputChannel.appendLine('');

      return await this.parseMessages(result, document, regEx);
    } catch (error) {
      this.outputChannel.appendLine(`Linting with ${this.info.id} failed:`);
      if (error instanceof Error) {
        this.outputChannel.appendLine(error.message.toString());
      }
      return [];
    }
  }

  protected async parseMessages(output: string, _document: TextDocument, regEx: string) {
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
      } catch (err) {
        this.outputChannel.appendLine(`${'#'.repeat(10)} Linter ${this.info.id} failed to parse the line:`);
        this.outputChannel.appendLine(line);
        if (typeof err === 'string') {
          this.outputChannel.appendLine(err);
        } else if (err instanceof Error) {
          this.outputChannel.appendLine(err.message);
        }
      }
    }
    return messages;
  }
}
