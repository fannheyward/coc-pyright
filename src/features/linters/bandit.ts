// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, OutputChannel, TextDocument, Uri } from 'coc.nvim';
import { LintMessageSeverity, ILinterInfo, ILintMessage } from '../../types';
import { BaseLinter } from './baseLinter';

const severityMapping: Record<string, LintMessageSeverity | undefined> = {
  LOW: LintMessageSeverity.Information,
  MEDIUM: LintMessageSeverity.Warning,
  HIGH: LintMessageSeverity.Error,
};

export class Bandit extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    // View all errors in bandit <= 1.5.1 (https://github.com/PyCQA/bandit/issues/371)
    const messages = await this.run(['-f', 'custom', '--msg-template', '{line},0,{severity},{test_id}:{msg}', '-n', '-1', Uri.parse(document.uri).fsPath], document, cancellation);

    messages.forEach((msg) => {
      msg.severity = severityMapping[msg.type];
    });
    return messages;
  }
}
