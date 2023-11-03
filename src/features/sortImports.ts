import { OutputChannel, TextDocument, commands, window, workspace } from 'coc.nvim';
import fs from 'fs';
import which from 'which';
import { PythonSettings } from '../configSettings';
import { PythonExecutionService } from '../processService';
import { ExecutionInfo } from '../types';
import { getTempFileWithDocumentContents, getTextEditsFromPatch } from '../utils';

type SortProvider = 'pyright' | 'isort' | 'ruff';
function getSortProviderInfo(provider: SortProvider): ExecutionInfo {
  const pythonSettings = PythonSettings.getInstance();
  const modulePath = provider === 'isort' ? pythonSettings.sortImports.path : pythonSettings.linting.ruffPath;
  const execPath = which.sync(workspace.expand(modulePath), { nothrow: true }) || '';
  let args = ['--diff'];
  if (provider === 'isort') {
    for (const item of pythonSettings.sortImports.args) {
      args.push(workspace.expand(item));
    }
  } else if (provider === 'ruff') {
    args = args.concat(['--quiet', '--select', 'I001']);
  }

  return { execPath, args };
}

async function generateImportsDiff(provider: SortProvider, document: TextDocument, outputChannel: OutputChannel): Promise<string> {
  const tempFile = await getTempFileWithDocumentContents(document);

  const executionInfo = getSortProviderInfo(provider);
  executionInfo.args.push(tempFile);

  outputChannel.appendLine(`${'#'.repeat(10)} sortImports`);
  outputChannel.appendLine(`execPath:   ${executionInfo.execPath}`);
  outputChannel.appendLine(`args:       ${executionInfo.args.join(' ')} `);

  try {
    const pythonToolsExecutionService = new PythonExecutionService();
    const result = await pythonToolsExecutionService.exec(executionInfo, { throwOnStdErr: true });
    return result.stdout;
  } finally {
    await fs.promises.unlink(tempFile);
  }
}

export async function sortImports(outputChannel: OutputChannel): Promise<void> {
  const doc = await workspace.document;
  if (!doc || doc.filetype !== 'python' || doc.lineCount <= 1) {
    return;
  }

  const provider = workspace.getConfiguration('pyright').get<SortProvider>('organizeimports.provider', 'pyright');
  if (provider === 'pyright') {
    await commands.executeCommand('pyright.organizeimports');
    return;
  }

  try {
    const patch = await generateImportsDiff(provider, doc.textDocument, outputChannel);
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
