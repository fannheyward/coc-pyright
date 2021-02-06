import { OutputChannel, Uri, window, workspace } from 'coc.nvim';
import * as path from 'path';
import { getTextEditsFromPatch } from './common';
import { PythonSettings } from './configSettings';
import { PythonExecutionService } from './processService';
import { ExecutionInfo } from './types';

async function generateIsortFixDiff(extensionRoot: string, uri: string): Promise<string> {
  const pythonSettings = PythonSettings.getInstance();
  const { path: isortPath, args: userArgs } = pythonSettings.sortImports;
  const args = ['--diff'].concat(userArgs);
  args.push(uri);

  const pythonToolsExecutionService = new PythonExecutionService();
  let executionInfo: ExecutionInfo;
  if (typeof isortPath === 'string' && isortPath.length > 0) {
    executionInfo = { execPath: isortPath, args };
  } else {
    const importScript = path.join(extensionRoot, 'pythonFiles', 'sortImports.py');
    executionInfo = { execPath: pythonSettings.pythonPath, args: [importScript].concat(args) };
  }
  const result = await pythonToolsExecutionService.exec(executionInfo, { throwOnStdErr: true });
  return result.stdout;
}

export async function sortImports(extensionRoot: string, outputChannel: OutputChannel): Promise<void> {
  const doc = await workspace.document;
  if (!doc || doc.filetype !== 'python') {
    return;
  }
  const uri = Uri.parse(doc.uri);
  if (doc.lineCount <= 1) {
    return;
  }

  try {
    const patch = await generateIsortFixDiff(extensionRoot, uri.fsPath);
    const edits = getTextEditsFromPatch(doc.getDocumentContent(), patch);
    await doc.applyEdits(edits);
  } catch (err) {
    const message = typeof err === 'string' ? err : err.message ? err.message : err;
    outputChannel.appendLine(`${'#'.repeat(10)} isort Output ${'#'.repeat(10)}`);
    outputChannel.appendLine(`Error from isort:\n${message}`);
    window.showMessage(`Failed to format import by isort`, 'error');
  }
}
