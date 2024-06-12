// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri, type CancellationToken, type TextDocument } from 'coc.nvim';
import type { ILintMessage } from '../../types';
import { BaseLinter } from './baseLinter';

const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>[\\w-]+):(?<message>.*)\\r?(\\n|$)';

export class Pylint extends BaseLinter {
  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const args = [
      "--msg-template='{line},{column},{category},{symbol}:{msg}'",
      '--exit-zero',
      '--reports=n',
      '--output-format=text',
    ];
    if (this.info.stdinSupport) {
      args.push('--from-stdin');
    }
    args.push(Uri.parse(document.uri).fsPath);
    const messages = await this.run(args, document, cancellation, REGEX);
    for (const msg of messages) {
      msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
    }

    return messages;
  }
}
