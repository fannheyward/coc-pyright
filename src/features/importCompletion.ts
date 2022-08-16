import { CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, LinesTextDocument, Position, Range, sources } from 'coc.nvim';

export class ImportCompletionProvider implements CompletionItemProvider {
  async provideCompletionItems(document: LinesTextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionItem[]> {
    if (context.triggerCharacter !== ' ') return [];
    const line = document.getText(Range.create(position.line, 0, position.line, position.character)).trim();
    if (!line.includes('from') && !line.includes('import')) return [];

    const parts = line.split(' ');
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (first !== last && first === 'from' && last !== 'import' && !last.endsWith(',')) {
      return [{ label: 'import' }];
    }
    const source = sources.sources.find((s) => s.name.includes('pyright'));
    if (!source) return [];
    // @ts-ignore
    const result = await source.doComplete(context.option, token);
    if (!result) return [];
    const items: CompletionItem[] = [];
    for (const o of result.items) {
      // @ts-ignore
      items.push({ label: o.word, sortText: o.sortText, kind: CompletionItemKind.Module, filterText: o.filterText });
    }
    return items;
  }
}
