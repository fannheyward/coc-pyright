import { Uri, workspace, type CancellationToken, type TextDocument } from 'coc.nvim';
import fs from 'node:fs';
import * as path from 'node:path';
import { LintMessageSeverity, type ILintMessage } from '../../types';
import { BaseLinter } from './baseLinter';

const pytypecfg = 'pytype.cfg';
const REGEX = '^File \\"(?<file>.*)\\", line (?<line>\\d+), in (<module>|\\w+): (?<message>.*)\\r?(\\n|$)';
const pytypeErrors = [
  // https://google.github.io/pytype/errors.html#error-classes
  'annotation-type-mismatch',
  'attribute-error',
  'bad-concrete-type',
  'bad-function-defaults',
  'bad-return-type',
  'bad-slots',
  'bad-unpacking',
  'base-class-error',
  'container-type-mismatch',
  'duplicate-keyword-argument',
  'ignored-abstractmethod',
  'ignored-metaclass',
  'ignored-type-comment',
  'import-error',
  'invalid-annotation',
  'invalid-directive',
  'invalid-function-definition',
  'invalid-function-type-comment',
  'invalid-namedtuple-arg',
  'invalid-super-call',
  'invalid-typevar',
  'key-error',
  'late-directive',
  'missing-parameter',
  'module-attr',
  'mro-error',
  'name-error',
  'not-callable',
  'not-indexable',
  'not-instantiable',
  'not-supported-yet',
  'not-writable',
  'pyi-error',
  'python-compiler-error',
  'recursion-error',
  'redundant-function-type-comment',
  'reveal-type',
  'unbound-type-param',
  'unsupported-operands',
  'wrong-arg-count',
  'wrong-arg-types',
  'wrong-keyword-args',
];

async function pathExists(p: string) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

export class Pytype extends BaseLinter {
  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const args: string[] = [];
    if (await this.hasConfigurationFile(workspace.root)) {
      args.push('--config', pytypecfg);
    }
    args.push(Uri.parse(document.uri).fsPath);

    return await this.run(args, document, cancellation, REGEX);
  }

  protected async parseMessages(output: string, document: TextDocument, regEx: string): Promise<ILintMessage[]> {
    const outputLines = output.split(/\r?\n/g).filter((line) => line.startsWith('File'));
    const newOutput = outputLines.join('\n');
    const messages = (await super.parseMessages(newOutput, document, regEx)).filter((msg) => {
      return msg.file && msg.file === Uri.parse(document.uri).fsPath;
    });
    for (const msg of messages) {
      msg.type = 'Hint';
      msg.severity = LintMessageSeverity.Hint;
      const match = /\[(.*)\]/g.exec(msg.message);
      if (match && match.length >= 2) {
        if (pytypeErrors.includes(match[1])) {
          msg.severity = LintMessageSeverity.Error;
        }
      }
    }

    return messages;
  }

  private async hasConfigurationFile(folder: string): Promise<boolean> {
    if (await pathExists(path.join(folder, pytypecfg))) {
      return true;
    }

    let current = folder;
    let above = path.dirname(folder);
    do {
      if (!(await pathExists(path.join(current, '__init__.py')))) {
        break;
      }
      if (await pathExists(path.join(current, pytypecfg))) {
        return true;
      }
      current = above;
      above = path.dirname(above);
    } while (!this.arePathsSame(current, above));

    return false;
  }

  private arePathsSame(p1: string, p2: string): boolean {
    const path1 = path.normalize(p1);
    const path2 = path.normalize(p2);
    if (this.isWindows) {
      return path1.toUpperCase() === path2.toUpperCase();
    }
    return path1 === path2;
  }
}
