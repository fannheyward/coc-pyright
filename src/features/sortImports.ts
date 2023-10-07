import { OutputChannel, TextDocument, window, workspace } from 'coc.nvim';
import fs from 'fs';
import * as path from 'path';
import which from 'which';
import { PythonSettings } from '../configSettings';
import { PythonExecutionService } from '../processService';
import { ExecutionInfo } from '../types';
import { getTextEditsFromPatch, getTempFileWithDocumentContents } from '../utils';

function getSortProviderInfo(provider: 'pyright' | 'isort' | 'ruff', extensionRoot: string): ExecutionInfo | null {
  const pythonSettings = PythonSettings.getInstance();
  let execPath = '';
  let args = ['--diff'];
  if (provider === 'isort') {
    const isortPath = pythonSettings.sortImports.path;
    const isortArgs = pythonSettings.sortImports.args;

    if (isortPath.length > 0) {
      execPath = isortPath;
      args = args.concat(isortArgs);
    } else {
      const isortScript = path.join(extensionRoot, 'pythonFiles', 'sortImports.py');
      execPath = pythonSettings.pythonPath;
      args = [isortScript].concat(args).concat(isortArgs);
    }
  } else if (provider === 'ruff') {
    const ruffPath = pythonSettings.linting.ruffPath;
    execPath = which.sync(workspace.expand(ruffPath), { nothrow: true }) || '';
    args = ['--quiet', '--diff', '--select', 'I001'];
  }

  return execPath ? { execPath, args } : null;
}

async function generateImportsDiff(document: TextDocument, extensionRoot: string): Promise<string> {
  const config = workspace.getConfiguration('pyright');
  const provider = config.get<'pyright' | 'isort' | 'ruff'>('organizeimports.provider', 'pyright');
  const executionInfo = getSortProviderInfo(provider, extensionRoot);
  if (!executionInfo) return '';

  const tempFile = await getTempFileWithDocumentContents(document);
  executionInfo.args.push(tempFile);

  const pythonToolsExecutionService = new PythonExecutionService();
  const result = await pythonToolsExecutionService.exec(executionInfo, { throwOnStdErr: true });
  await fs.promises.unlink(tempFile);
  return result.stdout;
}

export async function sortImports(extensionRoot: string, outputChannel: OutputChannel): Promise<void> {
  const doc = await workspace.document;
  if (!doc || doc.filetype !== 'python' || doc.lineCount <= 1) {
    return;
  }

  try {
    const patch = await generateImportsDiff(doc.textDocument, extensionRoot);
    const edits = getTextEditsFromPatch(doc.getDocumentContent(), patch);
    await doc.applyEdits(edits);

    outputChannel.appendLine(`${'#'.repeat(10)} sortImports Output ${'#'.repeat(10)}`);
    outputChannel.appendLine(patch);
  } catch (err) {
    let message = '';
    if (typeof err === 'string') {
      message = err;
    } else if (err instanceof Error) {
      message = err.message;
    }
    outputChannel.appendLine(`${'#'.repeat(10)} sortImports Error ${'#'.repeat(10)}`);
    outputChannel.appendLine(message);
    window.showErrorMessage(`Failed to sort imports`);
  }
}
