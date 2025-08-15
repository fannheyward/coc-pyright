// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { type Uri, workspace } from 'coc.nvim';
import * as path from 'node:path';
import which from 'which';
import type { PythonSettings } from '../../configSettings';
import type { ExecutionInfo, ILinterInfo, LinterId, Product } from '../../types';

export class LinterInfo implements ILinterInfo {
  private _id: LinterId;
  private _product: Product;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: x
  private _configFileNames: string[];

  constructor(
    product: Product,
    id: LinterId,
    protected configService: PythonSettings,
    configFileNames: string[] = [],
  ) {
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
  public get stdinSupport(): boolean {
    const settings = this.configService;
    return (settings.linting as any)[`${this.id}Stdin`] as boolean;
  }

  public isEnabled(_resource?: Uri): boolean {
    const settings = this.configService;
    return (settings.linting as any)[`${this.id}Enabled`] as boolean;
  }

  public pathName(_resource?: Uri): string {
    const settings = this.configService;
    return (settings.linting as any)[`${this.id}Path`] as string;
  }
  public linterArgs(_resource?: Uri): string[] {
    const settings = this.configService;
    const args = (settings.linting as any)[`${this.id}Args`];
    return Array.isArray(args) ? (args as string[]) : [];
  }
  public getExecutionInfo(customArgs: string[], resource?: Uri): ExecutionInfo {
    const cmd = workspace.expand(this.pathName(resource));
    const execPath = which.sync(cmd, { nothrow: true }) || this.pathName(resource);
    const args = this.linterArgs(resource).concat(customArgs);
    let moduleName: string | undefined;

    // If path information is not available, then treat it as a module,
    if (path.basename(execPath) === execPath) {
      moduleName = execPath;
    }

    return { execPath, moduleName, args, product: this.product };
  }
}
