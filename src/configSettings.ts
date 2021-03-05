import * as child_process from 'child_process';
import { ConfigurationChangeEvent, Disposable, Uri, workspace, WorkspaceConfiguration } from 'coc.nvim';
import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import which from 'which';
import { SystemVariables } from './systemVariables';
import { IFormattingSettings, ILintingSettings, IPythonSettings, ISortImportSettings } from './types';

export class PythonSettings implements IPythonSettings {
  private workspaceRoot: string;

  private static pythonSettings: Map<string, PythonSettings> = new Map<string, PythonSettings>();
  public linting!: ILintingSettings;
  public formatting!: IFormattingSettings;
  public sortImports!: ISortImportSettings;

  private disposables: Disposable[] = [];
  private _pythonPath = '';

  constructor() {
    this.workspaceRoot = workspace.root ? workspace.root : __dirname;
    this.initialize();
  }

  public static getInstance(): PythonSettings {
    const workspaceFolder = workspace.workspaceFolders.length > 0 ? workspace.workspaceFolders[0] : undefined;
    const workspaceFolderUri: Uri | undefined = workspaceFolder ? Uri.parse(workspaceFolder.uri) : undefined;
    const workspaceFolderKey = workspaceFolderUri ? workspaceFolderUri.fsPath : '';

    if (!PythonSettings.pythonSettings.has(workspaceFolderKey)) {
      const settings = new PythonSettings();
      PythonSettings.pythonSettings.set(workspaceFolderKey, settings);
    }
    return PythonSettings.pythonSettings.get(workspaceFolderKey)!;
  }

  public static dispose() {
    PythonSettings.pythonSettings.forEach((item) => item && item.dispose());
    PythonSettings.pythonSettings.clear();
  }

  public dispose() {
    this.disposables.forEach((disposable) => disposable && disposable.dispose());
    this.disposables = [];
  }

  private resolvePythonFromVENV(): string | undefined {
    try {
      // `pyenv local` creates `.python-version`, but not `PYENV_VERSION`
      let p = path.join(this.workspaceRoot, '.python-version');
      if (fs.existsSync(p)) {
        if (!process.env.PYENV_VERSION) {
          // pyenv local can special multiple Python, use first one only
          process.env.PYENV_VERSION = fs.readFileSync(p).toString().trim().split('\n')[0];
        }
        return;
      }

      // pipenv
      p = path.join(this.workspaceRoot, 'Pipfile');
      if (fs.existsSync(p)) {
        return child_process.spawnSync('pipenv', ['--py'], { encoding: 'utf8' }).stdout.trim();
      }

      // poetry
      p = path.join(this.workspaceRoot, 'poetry.lock');
      if (fs.existsSync(p)) {
        const list = child_process.spawnSync('poetry', ['env', 'list', '--full-path'], { encoding: 'utf8' }).stdout.trim();
        let info = '';
        for (const item of list.split('\n')) {
          if (item.includes('(Activated)')) {
            info = item.replace(/\(Activated\)/, '').trim();
            break;
          }
          info = item;
        }
        if (info) return path.join(info, 'bin', 'python');
      }
    } catch (e) {
      console.error(e);
    }
  }

  protected update(pythonSettings: WorkspaceConfiguration) {
    const systemVariables: SystemVariables = new SystemVariables(this.workspaceRoot ? this.workspaceRoot : undefined);
    const vp = this.resolvePythonFromVENV();
    if (vp) {
      pythonSettings.update('pythonPath', vp);
      this.pythonPath = vp;
    } else {
      this.pythonPath = systemVariables.resolve(pythonSettings.get('pythonPath') as string);
    }

    const lintingSettings = systemVariables.resolveAny(pythonSettings.get<ILintingSettings>('linting'))!;
    if (this.linting) {
      Object.assign<ILintingSettings, ILintingSettings>(this.linting, lintingSettings);
    } else {
      this.linting = lintingSettings;
    }
    this.linting.pylintPath = this.getAbsolutePath(systemVariables.resolveAny(this.linting.pylintPath));
    this.linting.flake8Path = this.getAbsolutePath(systemVariables.resolveAny(this.linting.flake8Path));
    this.linting.pycodestylePath = this.getAbsolutePath(systemVariables.resolveAny(this.linting.pycodestylePath));
    this.linting.pylamaPath = this.getAbsolutePath(systemVariables.resolveAny(this.linting.pylamaPath));
    this.linting.prospectorPath = this.getAbsolutePath(systemVariables.resolveAny(this.linting.prospectorPath));
    this.linting.pydocstylePath = this.getAbsolutePath(systemVariables.resolveAny(this.linting.pydocstylePath));
    this.linting.mypyPath = this.getAbsolutePath(systemVariables.resolveAny(this.linting.mypyPath));
    this.linting.banditPath = this.getAbsolutePath(systemVariables.resolveAny(this.linting.banditPath));

    const formattingSettings = systemVariables.resolveAny(pythonSettings.get<IFormattingSettings>('formatting'))!;
    if (this.formatting) {
      Object.assign<IFormattingSettings, IFormattingSettings>(this.formatting, formattingSettings);
    } else {
      this.formatting = formattingSettings;
    }
    this.formatting.autopep8Path = this.getAbsolutePath(systemVariables.resolveAny(this.formatting.autopep8Path));
    this.formatting.yapfPath = this.getAbsolutePath(systemVariables.resolveAny(this.formatting.yapfPath));
    this.formatting.blackPath = this.getAbsolutePath(systemVariables.resolveAny(this.formatting.blackPath));
    this.formatting.blackdPath = this.getAbsolutePath(systemVariables.resolveAny(this.formatting.blackdPath));
    this.formatting.darkerPath = this.getAbsolutePath(systemVariables.resolveAny(this.formatting.darkerPath));

    const isort = systemVariables.resolveAny(pythonSettings.get<ISortImportSettings>('sortImports'))!;
    if (this.sortImports) {
      Object.assign<ISortImportSettings, ISortImportSettings>(this.sortImports, isort);
    } else {
      this.sortImports = isort;
    }
    this.sortImports.path = this.getAbsolutePath(systemVariables.resolveAny(this.sortImports.path));
  }

  public get pythonPath(): string {
    return this._pythonPath;
  }

  public set pythonPath(value: string) {
    if (this._pythonPath === value) {
      return;
    }
    try {
      this._pythonPath = getPythonExecutable(value);
    } catch (ex) {
      this._pythonPath = value;
    }
  }

  private getAbsolutePath(pathToCheck: string, rootDir?: string): string {
    if (!rootDir) {
      rootDir = this.workspaceRoot;
    }
    pathToCheck = untildify(pathToCheck) as string;
    if (pathToCheck.indexOf(path.sep) === -1) {
      return pathToCheck;
    }
    return path.isAbsolute(pathToCheck) ? pathToCheck : path.resolve(rootDir, pathToCheck);
  }

  protected initialize(): void {
    this.disposables.push(
      workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('python')) {
          const currentConfig = workspace.getConfiguration('python', workspace.root);
          this.update(currentConfig);
        }
      })
    );

    const initialConfig = workspace.getConfiguration('python', workspace.root);
    if (initialConfig) {
      this.update(initialConfig);
    }
  }
}

function getPythonExecutable(pythonPath: string): string {
  pythonPath = untildify(pythonPath) as string;

  // If only 'python'.
  if (pythonPath === 'python' || pythonPath.indexOf(path.sep) === -1 || path.basename(pythonPath) === path.dirname(pythonPath)) {
    const bin = which.sync(pythonPath, { nothrow: true });
    if (bin) {
      pythonPath = bin;
    }
  }

  if (isValidPythonPath(pythonPath)) {
    return pythonPath;
  }

  return pythonPath;
}

function isValidPythonPath(pythonPath: string): boolean {
  try {
    return child_process.spawnSync(pythonPath, ['-c', 'print(1234)'], { encoding: 'utf8' }).stdout.startsWith('1234');
  } catch (ex) {
    return false;
  }
}
