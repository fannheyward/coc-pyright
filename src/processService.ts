import { type ExecOptions, spawn, type SpawnOptions as ChildProcessSpawnOptions } from 'node:child_process';
import type { CancellationToken } from 'coc.nvim';
import * as iconv from 'iconv-lite';
import { homedir } from 'node:os';
import { Observable } from 'rxjs';
import { createDeferred } from './async';
import { PythonSettings } from './configSettings';
import type { ExecutionInfo, ExecutionResult, ObservableExecutionResult, Output } from './types';

const DEFAULT_ENCODING = 'utf8';

type ShellOptions = ExecOptions & { throwOnStdErr?: boolean };
type SpawnOptions = ChildProcessSpawnOptions & {
  encoding?: string;
  token?: CancellationToken;
  mergeStdOutErr?: boolean;
  throwOnStdErr?: boolean;
};

class BufferDecoder {
  public decode(buffers: Buffer[], value: string = DEFAULT_ENCODING): string {
    const encoding = iconv.encodingExists(value) ? value : DEFAULT_ENCODING;
    return iconv.decode(Buffer.concat(buffers), encoding);
  }
}

class ModuleNotInstalledError extends Error {
  constructor(moduleName: string) {
    super(`Module '${moduleName}' not installed.`);
  }
}

export function isNotInstalledError(error: Error): boolean {
  const isError = typeof error === 'object' && error !== null;
  const errorObj = <any>error;
  if (!isError) {
    return false;
  }
  if (error instanceof ModuleNotInstalledError) {
    return true;
  }

  const isModuleNoInstalledError = error.message.indexOf('No module named') >= 0;
  return errorObj.code === 'ENOENT' || errorObj.code === 127 || isModuleNoInstalledError;
}

class ProcessService {
  private readonly decoder = new BufferDecoder();

  public static isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  public static kill(pid: number): void {
    const killProcessTree = require('tree-kill');
    try {
      killProcessTree(pid);
    } catch {
      // Ignore.
    }
  }

  public execObservable(file: string, args: string[], options: SpawnOptions = {}): ObservableExecutionResult<string> {
    const spawnOptions = this.getDefaultOptions(options);
    const encoding = spawnOptions.encoding ? spawnOptions.encoding : DEFAULT_ENCODING;
    const proc = spawn(file, args, spawnOptions);
    let procExited = false;

    const output = new Observable<Output<string>>((subscriber) => {
      if (options.token) {
        options.token.onCancellationRequested(() => {
          if (!procExited && !proc.killed) {
            proc.kill();
            procExited = true;
          }
        });
      }

      const sendOutput = (source: 'stdout' | 'stderr', data: Buffer) => {
        const out = this.decoder.decode([data], encoding);
        if (source === 'stderr' && options.throwOnStdErr) {
          subscriber.error(new Error(out));
        } else {
          subscriber.next({ source, out });
        }
      };
      proc.stdout!.on('data', (data: Buffer) => sendOutput('stdout', data));
      proc.stderr!.on('data', (data: Buffer) => sendOutput('stderr', data));

      const onExit = (ex?: any) => {
        if (procExited) return;
        procExited = true;
        if (ex) subscriber.error(ex);
        subscriber.complete();
      };

      proc.once('close', () => {
        onExit();
      });
      proc.once('error', onExit);
    });

    return {
      proc,
      out: output,
      dispose: () => {
        if (proc && !proc.killed) {
          ProcessService.kill(proc.pid as number);
        }
      },
    };
  }

  public exec(file: string, args: string[], options: SpawnOptions = {}): Promise<ExecutionResult<string>> {
    const cmd = file.startsWith('~/') ? file.replace('~', homedir()) : file;
    const spawnOptions = this.getDefaultOptions(options);
    const encoding = spawnOptions.encoding ? spawnOptions.encoding : DEFAULT_ENCODING;
    const proc = spawn(cmd, args, spawnOptions);
    const deferred = createDeferred<ExecutionResult<string>>();

    if (options.token) {
      options.token.onCancellationRequested(() => {
        if (!proc.killed && !deferred.completed) {
          proc.kill();
        }
      });
    }

    const stdoutBuffers: Buffer[] = [];
    proc.stdout!.on('data', (data: Buffer) => stdoutBuffers.push(data));
    const stderrBuffers: Buffer[] = [];
    proc.stderr!.on('data', (data: Buffer) => {
      if (options.mergeStdOutErr) {
        stdoutBuffers.push(data);
        stderrBuffers.push(data);
      } else {
        stderrBuffers.push(data);
      }
    });

    proc.once('close', () => {
      if (deferred.completed) {
        return;
      }
      const stderr = stderrBuffers.length === 0 ? undefined : this.decoder.decode(stderrBuffers, encoding);
      if (stderr && stderr.length > 0 && options.throwOnStdErr) {
        deferred.reject(new Error(stderr));
      } else {
        const stdout = this.decoder.decode(stdoutBuffers, encoding);
        deferred.resolve({ stdout, stderr });
      }
    });
    proc.once('error', (ex) => {
      console.error('once error:', ex);
      deferred.reject(ex);
    });

    return deferred.promise;
  }

  private getDefaultOptions<T extends ShellOptions | SpawnOptions>(options: T): T {
    const defaultOptions = { ...options };
    if (!defaultOptions.env || Object.keys(defaultOptions.env).length === 0) {
      defaultOptions.env = { ...process.env };
    } else {
      defaultOptions.env = { ...defaultOptions.env };
    }

    // Always ensure we have unbuffered output.
    defaultOptions.env.PYTHONUNBUFFERED = '1';
    if (!defaultOptions.env.PYTHONIOENCODING) {
      defaultOptions.env.PYTHONIOENCODING = 'utf-8';
    }

    return defaultOptions;
  }
}

export class PythonExecutionService {
  private readonly procService = new ProcessService();
  private readonly pythonSettings = PythonSettings.getInstance();

  public async isModuleInstalled(moduleName: string): Promise<boolean> {
    return this.procService
      .exec(this.pythonSettings.pythonPath, ['-c', `import ${moduleName}`], { throwOnStdErr: true })
      .then(() => true)
      .catch(() => false);
  }

  public execObservable(cmd: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
    const opts: SpawnOptions = { ...options };
    return this.procService.execObservable(cmd, args, opts);
  }

  async exec(executionInfo: ExecutionInfo, options: SpawnOptions): Promise<ExecutionResult<string>> {
    const opts: SpawnOptions = { ...options };
    const { execPath, moduleName, args } = executionInfo;

    if (moduleName && moduleName.length > 0) {
      const result = await this.procService.exec(this.pythonSettings.pythonPath, ['-m', moduleName, ...args], opts);

      // If a module is not installed we'll have something in stderr.
      if (
        result.stderr &&
        (result.stderr.indexOf(`No module named ${moduleName}`) > 0 ||
          result.stderr.indexOf(`No module named '${moduleName}'`) > 0)
      ) {
        throw new ModuleNotInstalledError(moduleName!);
      }

      return result;
    }

    return this.procService.exec(execPath, args, opts);
  }
}
