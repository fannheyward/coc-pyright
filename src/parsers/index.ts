import { DiagnosticSink } from '@zzzen/pyright-internal/dist/common/diagnosticSink';
import { ParseOptions, ParseResults, Parser } from '@zzzen/pyright-internal/dist/parser/parser';
import { SemanticTokensWalker, TokenTypes } from './semanticTokens';
import { FunctionFormatItemType, TestFrameworkWalker } from './testFramework';
import { TypeInlayHintsItemType, TypeInlayHintsWalker } from './typeInlayHints';

function parse(source: string) {
  let result: ParseResults | undefined = undefined;
  const parserOptions = new ParseOptions();
  const diagSink = new DiagnosticSink();
  const parser = new Parser();
  try {
    result = parser.parseSourceFile(source, parserOptions, diagSink);
  } catch (e) {}
  return result;
}

export { parse, SemanticTokensWalker, TestFrameworkWalker, TypeInlayHintsWalker, FunctionFormatItemType, TypeInlayHintsItemType, TokenTypes };
