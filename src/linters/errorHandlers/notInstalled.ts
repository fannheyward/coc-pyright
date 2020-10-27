import { OutputChannel, Uri } from 'coc.nvim';
import { ExecutionInfo, Product } from '../../types';
import { BaseErrorHandler } from './baseErrorHandler';

export class NotInstalledErrorHandler extends BaseErrorHandler {
  constructor(product: Product, outputChannel: OutputChannel) {
    super(product, outputChannel);
  }
  public async handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean> {
    // TODO
    // const pythonExecutionService = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ resource });
    // const isModuleInstalled = await pythonExecutionService.isModuleInstalled(execInfo.moduleName!);
    // if (isModuleInstalled) {
    //   return this.nextHandler ? this.nextHandler.handleError(error, resource, execInfo) : false;
    // }

    const customError = 'Linter ${info.id} is not installed. Please install it or select another linter.';
    this.outputChannel.appendLine(`\n${customError}\n${error}`);
    return true;
  }
}
