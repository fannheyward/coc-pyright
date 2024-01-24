/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as Path from 'path';
import { IStringDictionary, ISystemVariables } from './types';

const _typeof = {
  number: 'number',
  string: 'string',
  undefined: 'undefined',
  object: 'object',
  function: 'function',
};

/**
 * @returns whether the provided parameter is a JavaScript Array or not.
 */
function isArray(array: any): array is any[] {
  if (Array.isArray) {
    return Array.isArray(array);
  }

  if (array && typeof array.length === _typeof.number && array.constructor === Array) {
    return true;
  }

  return false;
}

/**
 * @returns whether the provided parameter is a JavaScript String or not.
 */
function isString(str: any): str is string {
  if (typeof str === _typeof.string || str instanceof String) {
    return true;
  }

  return false;
}

/**
 *
 * @returns whether the provided parameter is of type `object` but **not**
 *	`null`, an `array`, a `regexp`, nor a `date`.
 */
function isObject(obj: any): obj is any {
  return typeof obj === _typeof.object && obj !== null && !Array.isArray(obj) && !(obj instanceof RegExp) && !(obj instanceof Date);
}

abstract class AbstractSystemVariables implements ISystemVariables {
  public resolve(value: string): string;
  public resolve(value: string[]): string[];
  public resolve(value: IStringDictionary<string>): IStringDictionary<string>;
  public resolve(value: IStringDictionary<string[]>): IStringDictionary<string[]>;
  public resolve(value: IStringDictionary<IStringDictionary<string>>): IStringDictionary<IStringDictionary<string>>;
  public resolve(value: any): any {
    if (isString(value)) {
      return this.__resolveString(value);
    } else if (isArray(value)) {
      return this.__resolveArray(value);
    } else if (isObject(value)) {
      return this.__resolveLiteral(value);
    }

    return value;
  }

  public resolveAny<T>(value: T): T;
  public resolveAny(value: any): any {
    if (isString(value)) {
      return this.__resolveString(value);
    } else if (isArray(value)) {
      return this.__resolveAnyArray(value);
    } else if (isObject(value)) {
      return this.__resolveAnyLiteral(value);
    }

    return value;
  }

  private __resolveString(value: string): string {
    const regexp = /\$\{(.*?)\}/g;
    return value.replace(regexp, (match: string, name: string) => {
      const newValue = (<any>this)[name];
      if (isString(newValue)) {
        return newValue;
      } else {
        return match && (match.indexOf('env.') > 0 || match.indexOf('env:') > 0) ? '' : match;
      }
    });
  }

  private __resolveLiteral(values: IStringDictionary<string | IStringDictionary<string> | string[]>): IStringDictionary<string | IStringDictionary<string> | string[]> {
    const result: IStringDictionary<string | IStringDictionary<string> | string[]> = Object.create(null);
    Object.keys(values).forEach((key) => {
      const value = values[key];
      result[key] = <any>this.resolve(<any>value);
    });
    return result;
  }

  private __resolveAnyLiteral<T>(values: T): T;
  private __resolveAnyLiteral(values: any): any {
    const result: IStringDictionary<string | IStringDictionary<string> | string[]> = Object.create(null);
    Object.keys(values).forEach((key) => {
      const value = values[key];
      result[key] = <any>this.resolveAny(<any>value);
    });
    return result;
  }

  private __resolveArray(value: string[]): string[] {
    return value.map((s) => this.__resolveString(s));
  }

  private __resolveAnyArray<T>(value: T[]): T[];
  private __resolveAnyArray(value: any[]): any[] {
    return value.map((s) => this.resolveAny(s));
  }
}

export class SystemVariables extends AbstractSystemVariables {
  private _workspaceFolder: string;
  private _workspaceFolderName: string;

  constructor(workspaceFolder?: string) {
    super();
    this._workspaceFolder = typeof workspaceFolder === 'string' ? workspaceFolder : __dirname;
    this._workspaceFolderName = Path.basename(this._workspaceFolder);
    Object.keys(process.env).forEach((key) => {
      ((this as any) as Record<string, string | undefined>)[`env:${key}`] = ((this as any) as Record<string, string | undefined>)[`env.${key}`] = process.env[key];
    });
  }

  public get cwd(): string {
    return this.workspaceFolder;
  }

  public get workspaceRoot(): string {
    return this._workspaceFolder;
  }

  public get workspaceFolder(): string {
    return this._workspaceFolder;
  }

  public get workspaceRootFolderName(): string {
    return this._workspaceFolderName;
  }

  public get workspaceFolderBasename(): string {
    return this._workspaceFolderName;
  }
}
