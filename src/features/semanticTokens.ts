import { convertOffsetsToRange, convertTextRangeToRange } from '@zzzen/pyright-internal/dist/common/positionUtils';
import {
  CancellationToken,
  DocumentSemanticTokensProvider,
  LinesTextDocument,
  ProviderResult,
  SemanticTokenModifiers,
  SemanticTokenTypes,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
} from 'coc.nvim';
import * as parser from '../parsers';
import { SemanticTokensWalker } from '../parsers';

const tokenTypes: string[] = [
  SemanticTokenTypes.class,
  SemanticTokenTypes.decorator,
  SemanticTokenTypes.enum,
  SemanticTokenTypes.enumMember,
  SemanticTokenTypes.function,
  SemanticTokenTypes.keyword,
  SemanticTokenTypes.method,
  SemanticTokenTypes.namespace,
  SemanticTokenTypes.parameter,
  SemanticTokenTypes.property,
  SemanticTokenTypes.typeParameter,
  SemanticTokenTypes.variable,
];

const tokenModifiers: string[] = [SemanticTokenModifiers.definition, SemanticTokenModifiers.declaration, SemanticTokenModifiers.async];

function encodeTokenType(type: string): number {
  const idx = tokenTypes.indexOf(type);
  if (idx === -1) {
    throw new Error(`Unknown token type: ${type}`);
  }
  return idx;
}

function encodeTokenModifiers(modifiers: string[]): number {
  let data = 0;
  for (const t of modifiers) {
    const idx = tokenModifiers.indexOf(t);
    if (idx === undefined) {
      continue;
    }
    data |= 1 << idx;
  }
  return data;
}

export class PythonSemanticTokensProvider implements DocumentSemanticTokensProvider {
  public readonly legend: SemanticTokensLegend = { tokenTypes, tokenModifiers };

  public provideDocumentSemanticTokens(document: LinesTextDocument, token: CancellationToken): ProviderResult<SemanticTokens> {
    const parsed = parser.parse(document.getText());
    if (!parsed) return null;
    if (token && token.isCancellationRequested) return null;

    const builder = new SemanticTokensBuilder(this.legend);
    // @ts-ignore
    for (const item of parsed.tokenizerOutput.tokens._items) {
      if (item.type === 8 && item.keywordType) {
        const range = convertTextRangeToRange(item, parsed.tokenizerOutput.lines);
        builder.push(range.start.line, range.start.character, item.length, encodeTokenType(SemanticTokenTypes.keyword));
      }
    }

    const walker = new SemanticTokensWalker();
    walker.walk(parsed.parseTree);

    for (const item of walker.semanticItems) {
      const range = convertOffsetsToRange(item.start, item.start + item.length, parsed.tokenizerOutput.lines);
      builder.push(range.start.line, range.start.character, item.length, encodeTokenType(item.type), encodeTokenModifiers(item.modifiers));
    }

    return builder.build();
  }
}
