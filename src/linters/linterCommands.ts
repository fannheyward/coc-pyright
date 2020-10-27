// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { commands, DiagnosticCollection, Disposable } from 'coc.nvim';
import { LintingEngine } from './lintingEngine';

export class LinterCommands implements Disposable {
  private disposables: Disposable[] = [];

  constructor() {
    commands.registerCommand('python.runLinting', this.runLinting.bind(this));
  }
  public dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  public runLinting(): Promise<DiagnosticCollection> {
    const engine = new LintingEngine();
    return engine.lintOpenPythonFiles();
  }
}
