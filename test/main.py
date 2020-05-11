#!/usr/bin/env python3

from test import m

m.greeting(1)

class ClsWithCallFunc:
    def __init__(self, *init_args, **init_kwargs):
        print("INIT")

    def __call__(self, *call_args, **call_kwargs):
        print("CALL")

if __name__ == '__main__':
    a = ClsWithCallFunc()
    a(3, 5)
