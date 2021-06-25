import { commands, Document, OutputChannel, Position, Range, TextDocument, Uri, window, workspace } from 'coc.nvim';
import { getTextEditsFromPatch } from './common';
import { PythonSettings } from './configSettings';
import { PythonExecutionService } from './processService';
import { RefactorProxy } from './refactorProxy';

interface RenameResponse {
  results: [{ diff: string }];
}

async function checkDocument(doc: Document): Promise<boolean> {
  if (!doc) return false;

  const modified = await doc.buffer.getOption('modified');
  if (modified != 0) {
    window.showMessage('Buffer not saved, please save the buffer first!', 'warning');
    return false;
  }

  return true;
}

function validateDocumentForRefactor(doc: Document): Promise<void> {
  if (!doc.dirty) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    workspace.nvim.command('write').then(() => {
      return resolve();
    }, reject);
  });
}

export async function extractVariable(root: string, document: TextDocument, range: Range, outputChannel: OutputChannel): Promise<any> {
  const doc = workspace.getDocument(document.uri);
  const valid = await checkDocument(doc);
  if (!valid) return;

  const pythonToolsExecutionService = new PythonExecutionService();
  const rope = await pythonToolsExecutionService.isModuleInstalled('rope');
  if (!rope) {
    window.showMessage(`Module rope not installed`, 'warning');
    return;
  }

  const workspaceFolder = workspace.getWorkspaceFolder(doc.uri);
  const workspaceRoot = workspaceFolder ? Uri.parse(workspaceFolder.uri).fsPath : workspace.cwd;

  const pythonSettings = PythonSettings.getInstance();
  return validateDocumentForRefactor(doc).then(() => {
    const newName = `newvariable${new Date().getMilliseconds().toString()}`;
    const proxy = new RefactorProxy(root, pythonSettings, workspaceRoot);
    const rename = proxy.extractVariable<RenameResponse>(doc.textDocument, newName, Uri.parse(doc.uri).fsPath, range).then((response) => {
      return response.results[0].diff;
    });

    return extractName(doc, newName, rename, outputChannel);
  });
}

export async function extractMethod(root: string, document: TextDocument, range: Range, outputChannel: OutputChannel): Promise<any> {
  const doc = workspace.getDocument(document.uri);
  const valid = await checkDocument(doc);
  if (!valid) return;

  const pythonToolsExecutionService = new PythonExecutionService();
  const rope = await pythonToolsExecutionService.isModuleInstalled('rope');
  if (!rope) {
    window.showMessage(`Module rope not installed`, 'warning');
    return;
  }

  const workspaceFolder = workspace.getWorkspaceFolder(doc.uri);
  const workspaceRoot = workspaceFolder ? Uri.parse(workspaceFolder.uri).fsPath : workspace.cwd;

  const pythonSettings = PythonSettings.getInstance();
  return validateDocumentForRefactor(doc).then(() => {
    const newName = `newmethod${new Date().getMilliseconds().toString()}`;
    const proxy = new RefactorProxy(root, pythonSettings, workspaceRoot);
    const rename = proxy.extractMethod<RenameResponse>(doc.textDocument, newName, Uri.parse(doc.uri).fsPath, range).then((response) => {
      return response.results[0].diff;
    });

    return extractName(doc, newName, rename, outputChannel);
  });
}

export async function addImport(root: string, document: TextDocument, name: string, parent: boolean, outputChannel: OutputChannel): Promise<void> {
  const doc = workspace.getDocument(document.uri);
  const valid = await checkDocument(doc);
  if (!valid) return;

  const pythonToolsExecutionService = new PythonExecutionService();
  const rope = await pythonToolsExecutionService.isModuleInstalled('rope');
  if (!rope) {
    window.showMessage(`Module rope not installed`, 'warning');
    return;
  }

  let parentModule = '';
  if (parent) parentModule = await window.requestInput('Module:');

  const workspaceFolder = workspace.getWorkspaceFolder(doc.uri);
  const workspaceRoot = workspaceFolder ? Uri.parse(workspaceFolder.uri).fsPath : workspace.cwd;
  const pythonSettings = PythonSettings.getInstance();
  return validateDocumentForRefactor(doc).then(() => {
    const proxy = new RefactorProxy(root, pythonSettings, workspaceRoot);
    const resp = proxy.addImport<RenameResponse>(doc.textDocument, Uri.parse(doc.uri).fsPath, name, parentModule).then((response) => {
      return response.results[0].diff;
    });

    return applyImports(doc, resp, outputChannel);
  });
}

async function applyImports(doc: Document, resp: Promise<string>, outputChannel: OutputChannel): Promise<any> {
  try {
    const diff = await resp;
    if (diff.length === 0) return;

    const edits = getTextEditsFromPatch(doc.getDocumentContent(), diff);
    await doc.applyEdits(edits);
  } catch (error) {
    let errorMessage = `${error}`;
    if (typeof error === 'string') {
      errorMessage = error;
    }
    if (typeof error === 'object' && error.message) {
      errorMessage = error.message;
    }
    outputChannel.appendLine(`${'#'.repeat(10)}Rope Output${'#'.repeat(10)}`);
    outputChannel.appendLine(`Error in add import:\n${errorMessage}`);
    outputChannel.appendLine('');
    window.showMessage(`Cannot perform addImport using selected element(s).`, 'error');
    return await Promise.reject(error);
  }
}

async function extractName(textEditor: Document, newName: string, renameResponse: Promise<string>, outputChannel: OutputChannel): Promise<any> {
  let changeStartsAtLine = -1;
  try {
    const diff = await renameResponse;
    if (diff.length === 0) {
      return [];
    }
    const edits = getTextEditsFromPatch(textEditor.getDocumentContent(), diff);
    edits.forEach((edit) => {
      if (changeStartsAtLine === -1 || changeStartsAtLine > edit.range.start.line) {
        changeStartsAtLine = edit.range.start.line;
      }
    });
    await textEditor.applyEdits(edits);
    if (changeStartsAtLine >= 0) {
      let newWordPosition: Position | undefined;
      for (let lineNumber = changeStartsAtLine; lineNumber < textEditor.lineCount; lineNumber += 1) {
        const line = textEditor.getline(lineNumber);
        const indexOfWord = line.indexOf(newName);
        if (indexOfWord >= 0) {
          newWordPosition = Position.create(lineNumber, indexOfWord);
          break;
        }
      }
      return workspace.jumpTo(textEditor.uri, newWordPosition).then(() => {
        return newWordPosition;
      });
    }
    const newWordPosition_1 = null;
    if (newWordPosition_1) {
      return workspace.nvim.command('wa').then(() => {
        // Now that we have selected the new variable, lets invoke the rename command
        return commands.executeCommand('editor.action.rename', textEditor.uri, newWordPosition_1);
      });
    }
  } catch (error) {
    let errorMessage = `${error}`;
    if (typeof error === 'string') {
      errorMessage = error;
    }
    if (typeof error === 'object' && error.message) {
      errorMessage = error.message;
    }
    outputChannel.appendLine(`${'#'.repeat(10)}Refactor Output${'#'.repeat(10)}`);
    outputChannel.appendLine(`Error in refactoring:\n${errorMessage}`);
    outputChannel.appendLine('');
    window.showMessage(`Cannot perform refactoring using selected element(s).`, 'error');
    return await Promise.reject(error);
  }
}
