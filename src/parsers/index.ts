import { DiagnosticSink } from '@zzzen/pyright-internal/dist/common/diagnosticSink';
import { ParseOptions, ParseFileResults, Parser } from '@zzzen/pyright-internal/dist/parser/parser';
import { TypeInlayHintsWalker } from './inlayHints';
import { SemanticTokensWalker } from './semanticTokens';
import { FunctionFormatItemType, TestFrameworkWalker } from './testFramework';

function parse(source: string) {
  let result: ParseFileResults | undefined = undefined;
  const parserOptions = new ParseOptions();
  const diagSink = new DiagnosticSink();
  const parser = new Parser();
  try {
    result = parser.parseSourceFile(source, parserOptions, diagSink);
  } catch (e) {}
  return result;
}

export { parse, SemanticTokensWalker, TestFrameworkWalker, TypeInlayHintsWalker, FunctionFormatItemType };
