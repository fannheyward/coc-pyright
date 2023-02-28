// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, OutputChannel, TextDocument, Uri } from 'coc.nvim';
import { ILinterInfo, ILintMessage } from '../../types';
import { BaseLinter } from './baseLinter';

const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>[\\w-]+):(?<message>.*)\\r?(\\n|$)';

export class Pylint extends BaseLinter {
  constructor(info: ILinterInfo, outputChannel: OutputChannel) {
    super(info, outputChannel);
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const args = ["--msg-template='{line},{column},{category},{symbol}:{msg}'", '--exit-zero', '--reports=n', '--output-format=text'];
    if (this.info.stdinSupport) {
      args.push('--from-stdin');
    }
    args.push(Uri.parse(document.uri).fsPath);
    const messages = await this.run(args, document, cancellation, REGEX);
    messages.forEach((msg) => {
      msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
    });

    return messages;
  }
}
