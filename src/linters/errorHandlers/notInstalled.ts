import { OutputChannel, Uri } from 'coc.nvim';
import { ExecutionInfo, LinterId } from '../../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class NotInstalledErrorHandler extends BaseErrorHandler {
  constructor(product: LinterId, outputChannel: OutputChannel) {
    super(product, outputChannel);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handleError(error: Error, _resource: Uri, _execInfo: ExecutionInfo): Promise<boolean> {
    const customError = `Linter ${this.product} is not installed. Please install it or select another linter.`;
    this.outputChannel.appendLine(`\n${customError}\n${error}`);
    return true;
  }
}
