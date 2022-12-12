import { ChildProcess } from 'child_process';
import { CancellationToken, DiagnosticSeverity, DiagnosticTag, TextDocument, Uri } from 'coc.nvim';
import { Observable } from 'rxjs';

export interface ExecutionInfo {
  execPath: string;
  moduleName?: string;
  args: string[];
  product?: Product;
}

export interface ExecutionResult<T extends string | Buffer> {
  stdout: T;
  stderr?: T;
}

export interface Output<T extends string | Buffer> {
  source: 'stdout' | 'stderr';
  out: T;
}

export interface ObservableExecutionResult<T extends string | Buffer> {
  proc: ChildProcess | undefined;
  out: Observable<Output<T>>;
  dispose(): void;
}

export enum Product {
  pylint = 1,
  flake8 = 2,
  pycodestyle = 3,
  pylama = 4,
  prospector = 5,
  pydocstyle = 6,
  mypy = 7,
  bandit = 8,
  pytype = 9,
  yapf = 10,
  autopep8 = 11,
  black = 12,
  darker = 13,
  rope = 14,
  blackd = 15,
  pyflakes = 16,
  ruff = 17,
}

export type LinterId = 'bandit' | 'flake8' | 'mypy' | 'ruff' | 'pycodestyle' | 'prospector' | 'pydocstyle' | 'pyflakes' | 'pylama' | 'pylint' | 'pytype';
export type FormatterId = 'yapf' | 'black' | 'autopep8' | 'darker' | 'blackd';
export type TestingFramework = 'unittest' | 'pytest';

export interface ILinterInfo {
  readonly id: LinterId;
  readonly product: Product;
  readonly pathSettingName: string;
  readonly argsSettingName: string;
  readonly enabledSettingName: string;
  readonly configFileNames: string[];
  readonly stdinSupport: boolean;
  isEnabled(resource?: Uri): boolean;
  pathName(resource?: Uri): string;
  linterArgs(resource?: Uri): string[];
  getExecutionInfo(customArgs: string[], resource?: Uri): ExecutionInfo;
}

export enum LintMessageSeverity {
  Hint,
  Error,
  Warning,
  Information,
}

export interface ILintMessage {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  code: string | undefined;
  message: string;
  type: string;
  severity?: LintMessageSeverity;
  tags?: DiagnosticTag[];
  provider: string;
  file?: string;
  fix?: any;
}

export interface ILinter {
  readonly info: ILinterInfo;
  lint(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]>;
}

export interface PylintCategorySeverity {
  readonly convention: DiagnosticSeverity;
  readonly refactor: DiagnosticSeverity;
  readonly warning: DiagnosticSeverity;
  readonly error: DiagnosticSeverity;
  readonly fatal: DiagnosticSeverity;
}

export interface PycodestyleCategorySeverity {
  readonly W: DiagnosticSeverity;
  readonly E: DiagnosticSeverity;
}
export interface Flake8CategorySeverity {
  readonly F: DiagnosticSeverity;
  readonly E: DiagnosticSeverity;
  readonly W: DiagnosticSeverity;
}
export interface MypyCategorySeverity {
  readonly error: DiagnosticSeverity;
  readonly note: DiagnosticSeverity;
}

export interface ILintingSettings {
  readonly enabled: boolean;
  readonly lintOnSave: boolean;
  readonly ignorePatterns: string[];
  readonly maxNumberOfProblems: number;
  readonly banditEnabled: boolean;
  readonly banditArgs: string[];
  readonly flake8Enabled: boolean;
  readonly flake8Args: string[];
  readonly flake8CategorySeverity: Flake8CategorySeverity;
  readonly mypyEnabled: boolean;
  readonly mypyArgs: string[];
  readonly mypyCategorySeverity: MypyCategorySeverity;
  readonly ruffEnabled: boolean;
  readonly prospectorEnabled: boolean;
  readonly prospectorArgs: string[];
  readonly pylintEnabled: boolean;
  readonly pylintArgs: string[];
  readonly pylintCategorySeverity: PylintCategorySeverity;
  readonly pycodestyleEnabled: boolean;
  readonly pycodestyleArgs: string[];
  readonly pycodestyleCategorySeverity: PycodestyleCategorySeverity;
  readonly pyflakesEnabled: boolean;
  readonly pylamaEnabled: boolean;
  readonly pylamaArgs: string[];
  readonly pydocstyleEnabled: boolean;
  readonly pydocstyleArgs: string[];
  banditPath: string;
  flake8Path: string;
  mypyPath: string;
  ruffPath: string;
  prospectorPath: string;
  pylintPath: string;
  pycodestylePath: string;
  pyflakesPath: string;
  pylamaPath: string;
  pydocstylePath: string;
}
export interface IFormattingSettings {
  readonly provider: FormatterId;
  autopep8Path: string;
  readonly autopep8Args: string[];
  blackPath: string;
  readonly blackArgs: string[];
  yapfPath: string;
  readonly yapfArgs: string[];
  darkerPath: string;
  readonly darkerArgs: string[];
  blackdPath: string;
  readonly blackdHTTPURL: string;
  readonly blackdHTTPHeaders: Record<string, any>;
}
export interface ISortImportSettings {
  path: string;
  readonly args: string[];
}

export interface IPythonSettings {
  pythonPath: string;
  readonly stdLibs: string[];
  readonly linting: ILintingSettings;
  readonly formatting: IFormattingSettings;
  readonly sortImports: ISortImportSettings;
}

export namespace LinterErrors {
  export namespace pylint {
    export const InvalidSyntax = 'E0001';
  }
  export namespace prospector {
    export const InvalidSyntax = 'F999';
  }
  export namespace flake8 {
    export const InvalidSyntax = 'E999';
  }
}

export interface IStringDictionary<V> {
  [name: string]: V;
}

export interface ISystemVariables {
  resolve(value: string): string;
  resolve(value: string[]): string[];
  resolve(value: IStringDictionary<string>): IStringDictionary<string>;
  resolve(value: IStringDictionary<string[]>): IStringDictionary<string[]>;
  resolve(value: IStringDictionary<IStringDictionary<string>>): IStringDictionary<IStringDictionary<string>>;
  resolveAny<T>(value: T): T;
  [key: string]: any;
}
