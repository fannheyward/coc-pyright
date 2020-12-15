import { OutputChannel, Uri } from 'coc.nvim';
import { ExecutionInfo, IErrorHandler, LinterId } from '../../types';
import { BaseErrorHandler } from './baseErrorHandler';
import { NotInstalledErrorHandler } from './notInstalled';
import { StandardErrorHandler } from './standard';

export class ErrorHandler implements IErrorHandler {
  private handler: BaseErrorHandler;
  constructor(product: LinterId, outputChannel: OutputChannel) {
    // Create chain of handlers.
    const standardErrorHandler = new StandardErrorHandler(product, outputChannel);
    this.handler = new NotInstalledErrorHandler(product, outputChannel);
    this.handler.setNextHandler(standardErrorHandler);
  }

  public handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
    return this.handler.handleError(error, resource, execInfo);
  }
}
