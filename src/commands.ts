import * as child_process from 'child_process';
import { Terminal, Uri, window, workspace } from 'coc.nvim';
import path from 'path';
import { PythonSettings } from './configSettings';
import * as testParser from './parsers/testFramework';
import { TestingFramework } from './types';

let terminal: Terminal | undefined;

const framework = workspace.getConfiguration('pyright').get<TestingFramework>('testing.provider', 'unittest');

function validPythonModule(pythonPath: string, moduleName: string) {
  try {
    const pythonProcess = child_process.spawnSync(pythonPath, ['-m', moduleName, '--help'], { encoding: 'utf8' });
    if (pythonProcess.error) return false;
    return pythonProcess.status === 0;
  } catch (ex) {
    return false;
  }
}

async function runTest(uri: string, testFunction?: string) {
  const workspaceUri = Uri.parse(workspace.root).toString();
  const relativeFileUri = uri.replace(workspaceUri + '/', '');
  let testFile = '';
  if (framework === 'pytest') {
    testFile = relativeFileUri.split('/').join(path.sep);
  } else {
    testFile = relativeFileUri.replace(/.py$/, '').split('/').join('.');
  }

  const pythonPath = PythonSettings.getInstance().pythonPath;
  const exists = validPythonModule(pythonPath, framework);
  if (!exists) return window.showErrorMessage(`${framework} does not exist!`);

  if (terminal) {
    if (terminal.bufnr) {
      await workspace.nvim.command(`bd! ${terminal.bufnr}`);
    }
    terminal.dispose();
    terminal = undefined;
  }

  terminal = await window.createTerminal({ name: framework, cwd: workspace.root });
  const args: string[] = [];

  const testArgs = workspace.getConfiguration('pyright').get<string[]>(`testing.${framework}Args`, []);
  if (testArgs) {
    if (Array.isArray(testArgs)) {
      args.push(...testArgs);
    }
  }

  // MEMO: pytest is string concatenation with '::'
  // MEMO: unittest is string concatenation with '.'
  const sep = framework === 'pytest' ? '::' : '.';
  args.push(testFunction ? testFile + sep + testFunction : testFile);

  terminal.sendText(`${pythonPath} -m ${framework} ${args.join(' ')}`);
}

export async function runFileTest() {
  const { document } = await workspace.getCurrentState();

  const fileName = path.basename(Uri.parse(document.uri).fsPath);
  if (document.languageId !== 'python' || (!fileName.startsWith('test_') && !fileName.endsWith('_test.py'))) {
    return window.showErrorMessage('This file is not a python test file!');
  }

  runTest(document.uri);
}

export async function runSingleTest() {
  const { document, position } = await workspace.getCurrentState();
  const fileName = path.basename(Uri.parse(document.uri).fsPath);
  if (document.languageId !== 'python' || (!fileName.startsWith('test_') && !fileName.endsWith('_test.py'))) {
    return window.showErrorMessage('This file is not a python test file!');
  }

  const parsed = testParser.parse(document.getText());
  if (!parsed) return window.showErrorMessage('Test not found');

  const walker = new testParser.TestFrameworkWalker(framework);
  walker.walk(parsed.parseTree);

  let testFunction: string | undefined = undefined;
  for (const item of walker.featureItems) {
    const itemStartPosition = document.positionAt(item.startOffset);
    const itemEndPosition = document.positionAt(item.endOffset);
    if (position.line >= itemStartPosition.line && position.line <= itemEndPosition.line) {
      testFunction = item.value;
    }
  }

  if (!testFunction) return window.showErrorMessage('Test not found');

  runTest(document.uri, testFunction);
}
