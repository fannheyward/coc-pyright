import { ChildProcess } from 'child_process';
import { CancellationToken, DiagnosticSeverity, TextDocument, Uri } from 'coc.nvim';
import { Observable } from 'rxjs/Observable';

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
  pep8 = 3,
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
}

export type LinterId = 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint' | 'bandit' | 'pytype';
export type FormatterId = 'yapf' | 'black' | 'autopep8' | 'darker';

export interface ILinterInfo {
  readonly id: LinterId;
  readonly product: Product;
  readonly pathSettingName: string;
  readonly argsSettingName: string;
  readonly enabledSettingName: string;
  readonly configFileNames: string[];
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
  code: string | undefined;
  message: string;
  type: string;
  severity?: LintMessageSeverity;
  provider: string;
  file?: string;
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

export interface Pep8CategorySeverity {
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
  readonly ignorePatterns: string[];
  readonly prospectorEnabled: boolean;
  readonly prospectorArgs: string[];
  readonly pylintEnabled: boolean;
  readonly pylintArgs: string[];
  readonly pep8Enabled: boolean;
  readonly pep8Args: string[];
  readonly pylamaEnabled: boolean;
  readonly pylamaArgs: string[];
  readonly flake8Enabled: boolean;
  readonly flake8Args: string[];
  readonly pydocstyleEnabled: boolean;
  readonly pydocstyleArgs: string[];
  readonly lintOnSave: boolean;
  readonly maxNumberOfProblems: number;
  readonly pylintCategorySeverity: PylintCategorySeverity;
  readonly pep8CategorySeverity: Pep8CategorySeverity;
  readonly flake8CategorySeverity: Flake8CategorySeverity;
  readonly mypyCategorySeverity: MypyCategorySeverity;
  prospectorPath: string;
  pylintPath: string;
  pep8Path: string;
  pylamaPath: string;
  flake8Path: string;
  pydocstylePath: string;
  mypyEnabled: boolean;
  mypyArgs: string[];
  mypyPath: string;
  banditEnabled: boolean;
  banditArgs: string[];
  banditPath: string;
  readonly pylintUseMinimalCheckers: boolean;
}
export interface IFormattingSettings {
  readonly provider: FormatterId;
  autopep8Path: string;
  readonly autopep8Args: string[];
  blackPath: string;
  readonly blackArgs: string[];
  yapfPath: string;
  readonly yapfArgs: string[];
  darkerPah: string;
  readonly darkerArgs: string[];
}
export interface ISortImportSettings {
  readonly path: string;
  readonly args: string[];
}

export interface IPythonSettings {
  pythonPath: string;
  readonly linting: ILintingSettings;
  readonly formatting: IFormattingSettings;
  readonly sortImports: ISortImportSettings;
  readonly envFile: string;
}

export interface IErrorHandler {
  handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean>;
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
