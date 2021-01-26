import { CancellationToken, Document, OutputChannel, Position, TextEdit, Uri, window, workspace, WorkspaceEdit } from 'coc.nvim';
import { EOL } from 'os';
import * as path from 'path';
import { getTextEditsFromPatch } from './common';
import { PythonSettings } from './configSettings';
import { PythonExecutionService } from './processService';
import { ExecutionInfo } from './types';

async function generateIsortFixDiff(extensionRoot: string, uri: string, token?: CancellationToken): Promise<string> {
  const pythonSettings = PythonSettings.getInstance();
  const { path: isortPath, args: userArgs } = pythonSettings.isort;
  const args = ['--diff'].concat(userArgs);
  args.push(uri);
  const options = { throwOnStdErr: true, token };

  if (token && token.isCancellationRequested) {
    return '';
  }

  const pythonToolsExecutionService = new PythonExecutionService();
  let executionInfo: ExecutionInfo;
  if (typeof isortPath === 'string' && isortPath.length > 0) {
    executionInfo = { execPath: isortPath, args };
  } else {
    const importScript = path.join(extensionRoot, 'pythonFiles', 'sortImports.py');
    executionInfo = { execPath: pythonSettings.pythonPath, args: [importScript].concat(args) };
  }
  const result = await pythonToolsExecutionService.exec(executionInfo, options);
  return result.stdout;
}

export async function sortImports(extensionRoot: string, outputChannel: OutputChannel): Promise<void> {
  const doc = await workspace.document;
  if (!doc || doc.filetype !== 'python') {
    window.showMessage('Please open a Python file to sort the imports.', 'error');
    return;
  }
  const uri = Uri.parse(doc.uri);
  if (doc.lineCount <= 1) {
    return;
  }

  // Hack, if the document doesn't contain an empty line at the end, then add it
  // Else the library strips off the last line
  const lastLine = doc.getline(doc.lineCount - 1);
  if (lastLine.trim().length > 0) {
    const position = Position.create(doc.lineCount - 1, lastLine.length);
    const edit: WorkspaceEdit = {
      changes: {
        [uri.toString()]: [TextEdit.insert(position, EOL)],
      },
    };
    await workspace.applyEdit(edit);
  }

  try {
    const patch = await generateIsortFixDiff(extensionRoot, uri.fsPath);
    console.error('------diff', patch);
    const edits = getTextEditsFromPatch(doc.getDocumentContent(), patch);
    await doc.applyEdits(edits);
  } catch (err) {
    const message = typeof err === 'string' ? err : err.message ? err.message : err;
    outputChannel.appendLine(`${'#'.repeat(10)} isort Output ${'#'.repeat(10)}`);
    outputChannel.appendLine(`Error from isort:\n${message}`);
    window.showMessage(`Failed to format import by isort`, 'error');
  }
}
