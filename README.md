# coc-pyright

[Pyright](https://github.com/microsoft/pyright) extension for coc.nvim

<img width="603" alt="1" src="https://user-images.githubusercontent.com/345274/64470245-bda9a780-d172-11e9-9fda-48af0617a2ee.png">

## Install

`:CocInstall coc-pyright`

## Commands

- `pyright.organizeimports`: Organize imports
- `pyright.createtypestub`: Creates Type Stubs with given module name, for example `:CocCommand pyright.createtypestub numpy`

## Configurations

- `python.analysis.autoSearchPaths`: Automatically add common search paths like 'src', default: `true`
- `python.analysis.diagnosticMode`: Analyzes and reports errors for open only or all files in workspace, default: `openFilesOnly`
- `python.analysis.stubPath`: Path to directory containing custom type stub files, default: `""`
- `python.analysis.typeshedPaths`: Paths to look for typeshed modules, default: `[]`
- `python.analysis.diagnosticSeverityOverrides`: Override the severity levels for individual diagnostics, default: `{}`
- `python.analysis.typeCheckingMode`: Defines the default rule set for type checking, default: `basic`
- `python.analysis.useLibraryCodeForTypes`: Use library implementations to extract type information, default: `false`
- `python.pythonPath`: Path to Python, default: `python`
- `python.venvPath`: Path to folder with a list of Virtual Environments, default: `""`
- `pyright.disableCompletion`: Disables completion only, left other LSP features work, default: `false`
- `pyright.disableLanguageServices`: Disables type completion, definitions and references, default: `false`
- `pyright.disableOrganizeImports`: Disables the `Organize Imports` command, default: `false`

See [Pyright Settings](https://github.com/microsoft/pyright/blob/master/docs/settings.md) for more configurations.

Pyright supports [configuration files](https://github.com/microsoft/pyright/blob/master/docs/configuration.md) that provide granular control over settings. For more details, refer to the [README](https://github.com/Microsoft/pyright/blob/master/README.md) on the Pyright GitHub site.

## License

MIT

---

> This extension is created by [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
