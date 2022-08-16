import { OutputChannel, TextDocument, Uri, window, workspace } from 'coc.nvim';
import fs from 'fs-extra';
import md5 from 'md5';
import * as path from 'path';
import { getTextEditsFromPatch } from '../common';
import { PythonSettings } from '../configSettings';
import { PythonExecutionService } from '../processService';
import { ExecutionInfo } from '../types';

function getTempFileWithDocumentContents(document: TextDocument): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const fsPath = Uri.parse(document.uri).fsPath;
    const fileName = `${fsPath}.${md5(document.uri)}${path.extname(fsPath)}`;
    fs.writeFile(fileName, document.getText(), (ex) => {
      if (ex) {
        reject(new Error(`Failed to create a temporary file, ${ex.message}`));
      }
      resolve(fileName);
    });
  });
}

async function generateIsortFixDiff(extensionRoot: string, document: TextDocument): Promise<string> {
  const pythonSettings = PythonSettings.getInstance();
  const { path: isortPath, args: userArgs } = pythonSettings.sortImports;
  const args = ['--diff'].concat(userArgs);
  const tempFile = await getTempFileWithDocumentContents(document);
  args.push(tempFile);

  const pythonToolsExecutionService = new PythonExecutionService();
  let executionInfo: ExecutionInfo;
  if (typeof isortPath === 'string' && isortPath.length > 0) {
    executionInfo = { execPath: isortPath, args };
  } else {
    const importScript = path.join(extensionRoot, 'pythonFiles', 'sortImports.py');
    executionInfo = { execPath: pythonSettings.pythonPath, args: [importScript].concat(args) };
  }
  const result = await pythonToolsExecutionService.exec(executionInfo, { throwOnStdErr: true });
  await fs.unlink(tempFile);
  return result.stdout;
}

export async function sortImports(extensionRoot: string, outputChannel: OutputChannel): Promise<void> {
  const doc = await workspace.document;
  if (!doc || doc.filetype !== 'python' || doc.lineCount <= 1) {
    return;
  }

  try {
    const patch = await generateIsortFixDiff(extensionRoot, doc.textDocument);
    const edits = getTextEditsFromPatch(doc.getDocumentContent(), patch);
    await doc.applyEdits(edits);
  } catch (err) {
    let message = '';
    if (typeof err === 'string') {
      message = err;
    } else if (err instanceof Error) {
      message = err.message;
    }
    outputChannel.appendLine(`${'#'.repeat(10)} isort Output ${'#'.repeat(10)}`);
    outputChannel.appendLine(`Error from isort:\n${message}`);
    window.showErrorMessage(`Failed to format import by isort`);
  }
}
