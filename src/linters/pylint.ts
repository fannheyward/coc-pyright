// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OutputChannel, Uri } from 'coc.nvim';
import fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { CancellationToken } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ILinterInfo, ILintMessage } from '../types';
import { BaseLinter } from './baseLinter';

const pylintrc = 'pylintrc';
const dotPylintrc = '.pylintrc';

const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>[^:]+):(?<message>.*)\\r?(\\n|$)';

export class Pylint extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    let minArgs: string[] = [];
    // Only use minimal checkers if
    //  a) there are no custom arguments and
    //  b) there is no pylintrc file next to the file or at the workspace root
    const uri = Uri.parse(document.uri);
    const workspaceRoot = this.getWorkspaceRootPath(document);
    const settings = this.pythonSettings;
    if (
      settings.linting.pylintUseMinimalCheckers &&
      this.info.linterArgs(uri).length === 0 &&
      // Check pylintrc next to the file or above up to and including the workspace root
      !(await this.hasConfigrationFileInWorkspace(path.dirname(uri.fsPath), workspaceRoot)) &&
      // Check for pylintrc at the root and above
      !(await this.hasConfigurationFile(this.getWorkspaceRootPath(document)))
    ) {
      // Disable all checkers up front and then selectively add back in:
      // - All F checkers
      // - Select W checkers
      // - All E checkers _manually_
      //   (see https://github.com/Microsoft/vscode-python/issues/722 for
      //    why; see
      //    https://gist.github.com/brettcannon/eff7f38a60af48d39814cbb2f33b3d1d
      //    for a script to regenerate the list of E checkers)
      minArgs = [
        '--disable=all',
        '--enable=F' +
          ',unreachable,duplicate-key,unnecessary-semicolon' +
          ',global-variable-not-assigned,unused-variable' +
          ',unused-wildcard-import,binary-op-exception' +
          ',bad-format-string,anomalous-backslash-in-string' +
          ',bad-open-mode' +
          ',E0001,E0011,E0012,E0100,E0101,E0102,E0103,E0104,E0105,E0107' +
          ',E0108,E0110,E0111,E0112,E0113,E0114,E0115,E0116,E0117,E0118' +
          ',E0202,E0203,E0211,E0213,E0236,E0237,E0238,E0239,E0240,E0241' +
          ',E0301,E0302,E0303,E0401,E0402,E0601,E0602,E0603,E0604,E0611' +
          ',E0632,E0633,E0701,E0702,E0703,E0704,E0710,E0711,E0712,E1003' +
          ',E1101,E1102,E1111,E1120,E1121,E1123,E1124,E1125,E1126,E1127' +
          ',E1128,E1129,E1130,E1131,E1132,E1133,E1134,E1135,E1136,E1137' +
          ',E1138,E1139,E1200,E1201,E1205,E1206,E1300,E1301,E1302,E1303' +
          ',E1304,E1305,E1306,E1310,E1700,E1701',
      ];
    }
    const args = ["--msg-template='{line},{column},{category},{msg_id}:{msg} ({symbol})'", '--reports=n', '--output-format=text', uri.fsPath];
    const messages = await this.run(minArgs.concat(args), document, cancellation, REGEX);
    messages.forEach((msg) => {
      msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
    });

    return messages;
  }

  private async hasConfigurationFile(folder: string): Promise<boolean> {
    // https://pylint.readthedocs.io/en/latest/user_guide/run.html
    // https://github.com/PyCQA/pylint/blob/975e08148c0faa79958b459303c47be1a2e1500a/pylint/config.py
    // 1. pylintrc in the current working directory
    // 2. .pylintrc in the current working directory
    // 3. If the current working directory is in a Python module, Pylint searches
    //    up the hierarchy of Python modules until it finds a pylintrc file.
    //    This allows you to specify coding standards on a module by module basis.
    //    A directory is judged to be a Python module if it contains an __init__.py file.
    // 4. The file named by environment variable PYLINTRC
    // 5. if you have a home directory which isn’t /root:
    //      a) .pylintrc in your home directory
    //      b) .config/pylintrc in your home directory
    // 6. /etc/pylintrc
    if (process.env.PYLINTRC) {
      return true;
    }

    if ((await fs.pathExists(path.join(folder, pylintrc))) || (await fs.pathExists(path.join(folder, dotPylintrc)))) {
      return true;
    }

    let current = folder;
    let above = path.dirname(folder);
    do {
      if (!(await fs.pathExists(path.join(current, '__init__.py')))) {
        break;
      }
      if ((await fs.pathExists(path.join(current, pylintrc))) || (await fs.pathExists(path.join(current, dotPylintrc)))) {
        return true;
      }
      current = above;
      above = path.dirname(above);
    } while (!this.arePathsSame(current, above));

    const home = os.homedir();
    if (await fs.pathExists(path.join(home, dotPylintrc))) {
      return true;
    }
    if (await fs.pathExists(path.join(home, '.config', pylintrc))) {
      return true;
    }

    if (!this.isWindows) {
      if (await fs.pathExists(path.join('/etc', pylintrc))) {
        return true;
      }
    }
    return false;
  }

  private arePathsSame(path1: string, path2: string): boolean {
    path1 = path.normalize(path1);
    path2 = path.normalize(path2);
    if (this.isWindows) {
      return path1.toUpperCase() === path2.toUpperCase();
    } else {
      return path1 === path2;
    }
  }

  private async hasConfigrationFileInWorkspace(folder: string, root: string): Promise<boolean> {
    // Search up from file location to the workspace root
    let current = folder;
    let above = path.dirname(current);
    do {
      if ((await fs.pathExists(path.join(current, pylintrc))) || (await fs.pathExists(path.join(current, dotPylintrc)))) {
        return true;
      }
      current = above;
      above = path.dirname(above);
    } while (!this.arePathsSame(current, root) && !this.arePathsSame(current, above));
    return false;
  }
}
