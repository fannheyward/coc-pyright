# coc-pyright

[Pyright](https://github.com/microsoft/pyright) extension for coc.nvim

<img width="603" alt="1" src="https://user-images.githubusercontent.com/345274/64470245-bda9a780-d172-11e9-9fda-48af0617a2ee.png">

## Install

`:CocInstall coc-pyright`

## Commands

- `python.runLinting`: Run linting
- `pyright.organizeimports`: Organize imports
- `pyright.restartserver`: This command forces the type checker to discard all of its cached type information and restart analysis. It is useful in cases where new type stubs or libraries have been installed.
- `pyright.createtypestub`: Creates Type Stubs with given module name, for example `:CocCommand pyright.createtypestub numpy`

## Configurations

- `python.analysis.autoImportCompletions`: Determines whether pyright offers auto-import completions, default: `true`
- `python.analysis.autoSearchPaths`: Automatically add common search paths like 'src', default: `true`
- `python.analysis.diagnosticMode`: Analyzes and reports errors for open only or all files in workspace, default: `openFilesOnly`
- `python.analysis.stubPath`: Path to directory containing custom type stub files, default: `typings`
- `python.analysis.typeshedPaths`: Paths to look for typeshed modules, default: `[]`
- `python.analysis.diagnosticSeverityOverrides`: Override the severity levels for individual diagnostics, default: `{}`
- `python.analysis.typeCheckingMode`: Defines the default rule set for type checking, default: `basic`
- `python.analysis.useLibraryCodeForTypes`: Use library implementations to extract type information, default: `true`
- `python.pythonPath`: Path to Python, default: `python`
- `python.venvPath`: Path to folder with a list of Virtual Environments, default: `""`
- `python.formatting.provider`: Provider for formatting, default: `autopep8`
- `python.formatting.blackPath`: Custom path to black, default: `black`
- `python.formatting.blackArgs`: Arguments passed to black, default: `[]`
- `python.formatting.yapfPath`: Custom path to yapf, default: `yapf`
- `python.formatting.yapfArgs`: Arguments passed to yapf, default: `[]`
- `python.formatting.autopep8Path`: Custom path to autopep8, default: `autopep8`
- `python.formatting.autopep8Args`: Arguments passed to autopep8, default: `[]`
- `python.linting.enabled`: Whether to lint Python files, default: `true`
- `python.linting.flake8Enabled`: Whether to lint with flake8, default: `false`
- `python.linting.banditEnabled`: Whether to lint with bandit, default: `false`
- `python.linting.mypyEnabled`: Whether to lint with mypy, default: `false`
- `python.linting.pytypeEnabled`: Whether to lint with pytype, default: `false`
- `python.linting.pep8Enabled`: Whether to lint with pep8, default: `false`
- `python.linting.prospectorEnabled`: Whether to lint with prospector, default: `false`
- `python.linting.pydocstyleEnabled`: Whether to lint with pydocstyleEnabled, default: `false`
- `python.linting.pylamaEnabled`: Whether to lint with pylama, default: `false`
- `python.linting.pylintEnabled`: Whether to lint with pylint, default: `false`
- `pyright.disableCompletion`: Disables completion only, left other LSP features work, default: `false`
- `pyright.disableLanguageServices`: Disables type completion, definitions and references, default: `false`
- `pyright.disableOrganizeImports`: Disables the `Organize Imports` command, default: `false`

See [Pyright Settings](https://github.com/microsoft/pyright/blob/master/docs/settings.md) for more configurations.

Pyright supports [configuration files](https://github.com/microsoft/pyright/blob/master/docs/configuration.md) that provide granular control over settings. For more details, refer to the [README](https://github.com/Microsoft/pyright/blob/master/README.md) on the Pyright GitHub site.

## Python typing and stub files

To provide best experience, Pyright requires packages to be type annotated
and/or have stub files. The Python community is currently in a transition phase
where package authors are actively looking to provide that. Meanwhile, stub
files for well-known packages may also be obtained from 3rd party, for example:

- [Awesome Python Typing # stub-packages](https://github.com/typeddjango/awesome-python-typing#stub-packages)

## Links

- [Fixing coc-pyright and anaconda import errors](https://hanspinckaers.com/fixing-coc-pyright-and-anaconda-import-errors)

## License

MIT

---

> This extension is created by [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
