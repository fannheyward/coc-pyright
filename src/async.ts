// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-unused-vars */

'use strict';

//======================
// Deferred

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolved: boolean;
  readonly rejected: boolean;
  readonly completed: boolean;
  resolve(value?: T | PromiseLike<T>): void;
  reject(reason?: any): void;
}

class DeferredImpl<T> implements Deferred<T> {
  private _resolve!: (value?: T | PromiseLike<T>) => void;
  private _reject!: (reason?: any) => void;
  private _resolved = false;
  private _rejected = false;
  private _promise: Promise<T>;
  constructor(private scope: any = null) {
    this._promise = new Promise<T>((res, rej) => {
      // @ts-ignore
      this._resolve = res;
      this._reject = rej;
    });
  }
  public resolve(_value?: T | PromiseLike<T>) {
    this._resolve.apply(this.scope ? this.scope : this, arguments as any);
    this._resolved = true;
  }
  public reject(_reason?: any) {
    this._reject.apply(this.scope ? this.scope : this, arguments as any);
    this._rejected = true;
  }
  get promise(): Promise<T> {
    return this._promise;
  }
  get resolved(): boolean {
    return this._resolved;
  }
  get rejected(): boolean {
    return this._rejected;
  }
  get completed(): boolean {
    return this._rejected || this._resolved;
  }
}
export function createDeferred<T>(scope: any = null): Deferred<T> {
  return new DeferredImpl<T>(scope);
}

