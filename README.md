# coc-pyright

<!-- markdownlint-disable no-inline-html -->
<a href="https://github.com/sponsors/fannheyward"><img src="https://user-images.githubusercontent.com/345274/133218454-014a4101-b36a-48c6-a1f6-342881974938.png" alt="GitHub Sponsors" /></a>
<a href="https://patreon.com/fannheyward"><img src="https://c5.patreon.com/external/logo/become_a_patron_button.png" alt="Patreon donate button" /></a>
<a href="https://paypal.me/fannheyward"><img src="https://user-images.githubusercontent.com/345274/104303610-41149f00-5505-11eb-88b2-5a95c53187b4.png" alt="PayPal donate button" /></a>

[Pyright](https://github.com/microsoft/pyright) extension for coc.nvim

<!-- markdownlint-disable-next-line -->
<img width="603" alt="1" src="https://user-images.githubusercontent.com/345274/64470245-bda9a780-d172-11e9-9fda-48af0617a2ee.png">

## Install

`:CocInstall coc-pyright`

Note: Pyright may not work as expected if can't detect *project root* correctly, check [#521](https://github.com/fannheyward/coc-pyright/issues/521#issuecomment-858530052) and [Using workspaceFolders](https://github.com/neoclide/coc.nvim/wiki/Using-workspaceFolders#resolve-workspace-folder) in coc.nvim.

## Commands

- `python.runLinting`: Run linting
- `python.sortImports`: Sort imports by `isort`
- `pyright.version`: Show the currently used Pyright version in `:messages`
- `pyright.organizeimports`: Organize imports by Pyright
- `pyright.restartserver`: This command forces the type checker to discard all of its cached type information and restart analysis. It is useful in cases where new type stubs or libraries have been installed.
- `pyright.createtypestub`: Creates Type Stubs with given module name, for example `:CocCommand pyright.createtypestub numpy`

## Configurations

These configurations are used by `coc-pyright`, you need to set them in your `coc-settings.json`.

| Configuration                               | Description                                                         | Default       |
| ------------------------------------------- | ------------------------------------------------------------------- | ------------- |
| pyright.enable                              | Enable coc-pyright extension                                        | true          |
| python.analysis.autoImportCompletions       | Determines whether pyright offers auto-import completions           | true          |
| python.analysis.autoSearchPaths             | Automatically add common search paths like 'src'                    | true          |
| python.analysis.diagnosticMode              | Analyzes and reports errors for open only or all files in workspace | openFilesOnly |
| python.analysis.stubPath                    | Path to directory containing custom type stub files                 | typings       |
| python.analysis.typeshedPaths               | Paths to look for typeshed modules                                  | []            |
| python.analysis.diagnosticSeverityOverrides | Override the severity levels for individual diagnostics             | {}            |
| python.analysis.typeCheckingMode            | Defines the default rule set for type checking                      | basic         |
| python.analysis.useLibraryCodeForTypes      | Use library implementations to extract type information             | true          |
| python.pythonPath                           | Path to Python                                                      | python        |
| python.venvPath                             | Path to folder with a list of Virtual Environments                  | ""            |
| python.formatting.provider                  | Provider for formatting                                             | autopep8      |
| python.formatting.blackPath                 | Custom path to black                                                | black         |
| python.formatting.blackArgs                 | Arguments passed to black                                           | []            |
| python.formatting.blackdPath                | Custom path to blackd                                               | blackd        |
| python.formatting.blackdHTTPURL             | Custom blackd server url                                            | ""            |
| python.formatting.blackdHTTPHeaders         | Custom blackd request headers                                       | {}            |
| python.formatting.yapfPath                  | Custom path to yapf                                                 | yapf          |
| python.formatting.yapfArgs                  | Arguments passed to yapf                                            | []            |
| python.formatting.autopep8Path              | Custom path to autopep8                                             | autopep8      |
| python.formatting.autopep8Args              | Arguments passed to autopep8                                        | []            |
| python.linting.enabled                      | Whether to lint Python files with external linters                  | true          |
| python.linting.flake8Enabled                | Whether to lint with flake8                                         | false         |
| python.linting.banditEnabled                | Whether to lint with bandit                                         | false         |
| python.linting.mypyEnabled                  | Whether to lint with mypy                                           | false         |
| python.linting.pytypeEnabled                | Whether to lint with pytype                                         | false         |
| python.linting.pycodestyleEnabled           | Whether to lint with pycodestyle                                    | false         |
| python.linting.prospectorEnabled            | Whether to lint with prospector                                     | false         |
| python.linting.pydocstyleEnabled            | Whether to lint with pydocstyleEnabled                              | false         |
| python.linting.pylamaEnabled                | Whether to lint with pylama                                         | false         |
| python.linting.pylintEnabled                | Whether to lint with pylint                                         | false         |
| python.sortImports.path                     | Path to isort script, default using inner version                   | ''            |
| python.sortImports.args                     | Arguments passed to isort                                           | []            |
| pyright.server                              | Custom `pyright-langserver` path                                    | ''            |
| pyright.disableCompletion                   | Disables completion from Pyright, left other LSP features work      | false         |
| pyright.disableDiagnostics                  | Disable diagnostics from Pyright                                    | false         |
| pyright.completion.importSupport            | Enable `python-import` completion source support                    | true          |
| pyright.completion.snippetSupport           | Enable completion snippets support                                  | true          |
| pyright.organizeimports.provider            | Organize imports provider, `pyright` or `isort`                     | pyright       |

Additional configuration options can be found in [package.json](./package.json).

## pyrightconfig.json

Pyright supports [pyrightconfig.json](https://github.com/microsoft/pyright/blob/master/docs/configuration.md) that provide granular control over settings.

## Python typing and stub files

To provide best experience, Pyright requires packages to be type annotated
and/or have stub files. The Python community is currently in a transition phase
where package authors are actively looking to provide that. Meanwhile, stub
files for well-known packages may also be obtained from 3rd party, for example:

- [Awesome Python Typing # stub-packages](https://github.com/typeddjango/awesome-python-typing#stub-packages)
- [typeshed](https://github.com/python/typeshed)
- [python-type-stubs](https://github.com/microsoft/python-type-stubs)

## Conda setup

1. Create the following file:
```
#!/bin/bash
python "$@"
```
2. Make it executable: `chmod +x $path`
3. Add the following to your `coc-settings.json`:
```
"python.pythonPath": "<PUT PATH HERE>"
```
4. Activate the environment before starting vim

This way python from your currently activated environment will be used

## My Workflow with Pyright

1. create venv in project: `python3 -m venv .venv`
2. `source .venv/bin/activate`
3. install modules with pip and work with Pyright
4. `deactivate`

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
