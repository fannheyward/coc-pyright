import { CodeAction, CodeActionKind, CodeActionProvider, CodeLens, CodeLensProvider, events, LinesTextDocument, Position, Range, Uri, workspace } from 'coc.nvim';
import path from 'path';
import * as parser from '../parsers';
import { TestingFramework } from '../types';

function comparePosition(position: Position, other: Position): number {
  if (position.line > other.line) return 1;
  if (other.line == position.line && position.character > other.character) return 1;
  if (other.line == position.line && position.character == other.character) return 0;
  return -1;
}

function positionInRange(position: Position, range: Range): number {
  const { start, end } = range;
  if (comparePosition(position, start) < 0) return -1;
  if (comparePosition(position, end) > 0) return 1;
  return 0;
}

function rangeInRange(r: Range, range: Range): boolean {
  return positionInRange(r.start, range) === 0 && positionInRange(r.end, range) === 0;
}

export class TestFrameworkProvider implements CodeLensProvider, CodeActionProvider {
  private framework = workspace.getConfiguration('pyright').get<TestingFramework>('testing.provider', 'unittest');

  private async parseDocument(document: LinesTextDocument): Promise<parser.FunctionFormatItemType[]> {
    if (events.insertMode) return [];

    const fileName = path.basename(Uri.parse(document.uri).fsPath);
    if (document.languageId !== 'python' || (!fileName.startsWith('test_') && !fileName.endsWith('_test.py'))) {
      return [];
    }

    try {
      const parsed = parser.parse(document.getText());
      if (!parsed) return [];

      const walker = new parser.TestFrameworkWalker(this.framework);
      walker.walk(parsed.parseTree);

      return walker.featureItems;
    } catch (e) {
      return [];
    }
  }

  async provideCodeActions(document: LinesTextDocument, range: Range): Promise<CodeAction[]> {
    if (range.start.line !== range.end.line || range.start.character !== range.end.character) return [];

    const featureItems = await this.parseDocument(document);
    if (!featureItems.length) return [];

    const actions: CodeAction[] = [];
    for (const item of featureItems) {
      if (item.startOffset && item.endOffset) {
        const itemStartPosition = document.positionAt(item.startOffset);
        const itemEndPosition = document.positionAt(item.endOffset);
        if (rangeInRange(range, Range.create(itemStartPosition, itemEndPosition))) {
          actions.push({
            title: `RUN ${item.value} with ${this.framework}`,
            kind: CodeActionKind.Empty,
            command: {
              title: `RUN ${item.value} with ${this.framework}`,
              command: 'pyright.singleTest',
            },
          });
        }
      }
    }
    return actions;
  }

  async provideCodeLenses(document: LinesTextDocument): Promise<CodeLens[]> {
    const featureItems = await this.parseDocument(document);
    if (!featureItems.length) return [];

    const codeLenses: CodeLens[] = [];
    for (const item of featureItems) {
      if (item.startOffset && item.endOffset) {
        const itemStartPosition = document.positionAt(item.startOffset);
        const itemEndPosition = document.positionAt(item.endOffset);

        const lens: CodeLens = {
          range: Range.create(itemStartPosition, itemEndPosition),
          command: {
            title: `>> [RUN ${this.framework}]`,
            command: 'pyright.singleTest',
          },
        };

        codeLenses.push(lens);
      }
    }

    // For some reason, the virtual text does not disappear even when the
    // number of code lens goes from 1 to 0.
    //
    // It may be a bug in coc.nvim itself, but it sends code lens with Range
    // of 0 and forces a refresh.
    if (codeLenses.length === 0) {
      codeLenses.push({
        range: Range.create(Position.create(0, 0), Position.create(0, 0)),
      });
    }

    return codeLenses;
  }
}
