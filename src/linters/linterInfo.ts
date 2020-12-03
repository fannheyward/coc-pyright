// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'coc.nvim';
import * as path from 'path';
import { PythonSettings } from '../configSettings';
import { ExecutionInfo, ILinterInfo, LinterId, Product } from '../types';

export class LinterInfo implements ILinterInfo {
  private _id: LinterId;
  private _product: Product;
  private _configFileNames: string[];

  constructor(product: Product, id: LinterId, protected configService: PythonSettings, configFileNames: string[] = []) {
    this._product = product;
    this._id = id;
    this._configFileNames = configFileNames;
  }

  public get id(): LinterId {
    return this._id;
  }
  public get product(): Product {
    return this._product;
  }

  public get pathSettingName(): string {
    return `${this.id}Path`;
  }
  public get argsSettingName(): string {
    return `${this.id}Args`;
  }
  public get enabledSettingName(): string {
    return `${this.id}Enabled`;
  }
  public get configFileNames(): string[] {
    return this._configFileNames;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public isEnabled(_resource?: Uri): boolean {
    const settings = this.configService;
    return (settings.linting as any)[this.enabledSettingName] as boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public pathName(_resource?: Uri): string {
    const settings = this.configService;
    return (settings.linting as any)[this.pathSettingName] as string;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public linterArgs(_resource?: Uri): string[] {
    const settings = this.configService;
    const args = (settings.linting as any)[this.argsSettingName];
    return Array.isArray(args) ? (args as string[]) : [];
  }
  public getExecutionInfo(customArgs: string[], resource?: Uri): ExecutionInfo {
    const execPath = this.pathName(resource);
    const args = this.linterArgs(resource).concat(customArgs);
    let moduleName: string | undefined;

    // If path information is not available, then treat it as a module,
    if (path.basename(execPath) === execPath) {
      moduleName = execPath;
    }

    return { execPath, moduleName, args, product: this.product };
  }
}
