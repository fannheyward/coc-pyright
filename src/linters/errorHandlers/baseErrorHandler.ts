// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OutputChannel, Uri } from 'coc.nvim';
import { ExecutionInfo, IErrorHandler, LinterId } from '../../types';

export abstract class BaseErrorHandler implements IErrorHandler {
  private handler?: IErrorHandler;

  constructor(protected product: LinterId, protected outputChannel: OutputChannel) {}
  protected get nextHandler(): IErrorHandler | undefined {
    return this.handler;
  }
  public setNextHandler(handler: IErrorHandler): void {
    this.handler = handler;
  }
  public abstract handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean>;
}
