import { convertOffsetsToRange, convertTextRangeToRange } from '@zzzen/pyright-internal/dist/common/positionUtils';
import { CancellationToken, DocumentSemanticTokensProvider, LinesTextDocument, ProviderResult, SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend } from 'coc.nvim';
import * as parser from '../parsers';
import { SemanticTokensWalker } from '../parsers/semanticTokens';

const tokenTypes = Object.keys(parser.TokenTypes).filter((key) => isNaN(Number(key)));
const tokenModifiers: string[] = [];

export class PythonSemanticTokensProvider implements DocumentSemanticTokensProvider {
  public readonly legend: SemanticTokensLegend = { tokenTypes, tokenModifiers };

  public provideDocumentSemanticTokens(document: LinesTextDocument, token: CancellationToken): ProviderResult<SemanticTokens> {
    const parsed = parser.parse(document.getText());
    if (!parsed) return null;
    if (token && token.isCancellationRequested) return null;

    const builder = new SemanticTokensBuilder(this.legend);
    // @ts-ignore
    for (const item of parsed.tokenizerOutput.tokens._items) {
      const range = convertTextRangeToRange(item, parsed.tokenizerOutput.lines);

      if ([0, 1, 2, 3, 4, 7].includes(item.type)) continue;
      if (item.type === 14) item.type = 13;
      if (item.type === 16) item.type = 15;
      if (item.type === 18) item.type = 17;
      if (item.type === 8) item.type = item.keywordType + 23;

      builder.push(range.start.line, range.start.character, item.length, item.type);
    }

    const walker = new SemanticTokensWalker();
    walker.walk(parsed.parseTree);

    for (const item of walker.semanticItems) {
      const range = convertOffsetsToRange(item.start, item.start + item.length, parsed.tokenizerOutput.lines);
      builder.push(range.start.line, range.start.character, item.length, item.type);
    }

    return builder.build();
  }
}
