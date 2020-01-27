# coc-pyright

[Pyright](https://github.com/microsoft/pyright) extension for coc.nvim

<img width="603" alt="1" src="https://user-images.githubusercontent.com/345274/64470245-bda9a780-d172-11e9-9fda-48af0617a2ee.png">

## Install

`:CocInstall coc-pyright`

## Features

The extension supports many time-saving language features including:

- Intelligent type completion of keywords, symbols, and import names appears when editing
- Import statements are automatically inserted when necessary for type completions
- Signature completion tips help when filling in arguments for a call
- Hover over symbols to provide type information and doc strings
- Find Definitions to quickly go to the location of a symbol’s definition
- Find References to find all references to a symbol within a code base
- Rename Symbol to rename all references to a symbol within a code base
- Find Symbols within the current document or within the entire workspace
- Organize Imports command for automatically ordering imports according to PEP8 rules
- Type stub generation for third-party libraries

## Built-in Type Stubs

Pyright includes a recent copy of the stdlib type stubs from [Typeshed](https://github.com/python/typeshed). It can be configured to use another (perhaps more recent or modified) copy of the Typeshed type stubs. Of course, it also works with custom type stub files that are part of your project.

## Commands

- `pyright.organizeimports`: Organize imports
- `pyright.createtypestub`: Creates Type Stubs with given module name, for example `:CocCommand pyright.createtypestub numpy`

## Configurations

- `python.analysis.typeshedPaths`: Paths to look for typeshed modules, default: `[]`
- `python.pythonPath`: Path to Python, default: `python`
- `python.venvPath`: Path to folder with a list of Virtual Environments, default: `""`
- `pyright.disableLanguageServices`: Disables type completion, definitions and references, default: `false`
- See [Pyright Settings](https://github.com/microsoft/pyright/blob/master/docs/settings.md) for more configurations

Pyright supports [configuration files](https://github.com/microsoft/pyright/blob/master/docs/configuration.md) that provide granular control over settings. For more details, refer to the [README](https://github.com/Microsoft/pyright/blob/master/README.md) on the Pyright GitHub site.

## License

MIT

---
> This extension is created by [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
