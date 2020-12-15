import { OutputChannel, Uri } from 'coc.nvim';
import { ExecutionInfo, LinterId } from '../../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class StandardErrorHandler extends BaseErrorHandler {
  constructor(product: LinterId, outputChannel: OutputChannel) {
    super(product, outputChannel);
  }
  public async handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
    if (typeof error === 'string' && (error as string).indexOf("OSError: [Errno 2] No such file or directory: '/") > 0) {
      return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : Promise.resolve(false);
    }

    this.outputChannel.appendLine('Linting with ${info.id} failed.');
    this.outputChannel.appendLine(error.toString());
    return true;
  }
}
