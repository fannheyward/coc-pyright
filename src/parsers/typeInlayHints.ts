import { printParseNodeType } from '@zzzen/pyright-internal/dist/analyzer/parseTreeUtils';
import { ParseTreeWalker } from '@zzzen/pyright-internal/dist/analyzer/parseTreeWalker';
import { DiagnosticSink } from '@zzzen/pyright-internal/dist/common/diagnosticSink';
import { FunctionNode, MemberAccessNode, NameNode, ParseNode } from '@zzzen/pyright-internal/dist/parser/parseNodes';
import { ParseOptions, Parser, ParseResults } from '@zzzen/pyright-internal/dist/parser/parser';

export function parse(source: string) {
  let result: ParseResults | undefined = undefined;
  const parserOptions = new ParseOptions();
  const diagSink = new DiagnosticSink();
  const parser = new Parser();
  try {
    result = parser.parseSourceFile(source, parserOptions, diagSink);
  } catch (e) {}
  return result;
}

export type TypeInlayHintsItemType = {
  inlayHintType: 'variable' | 'functionReturn';
  startOffset: number;
  endOffset: number;
  value?: string;
};

export class TypeInlayHintsWalker extends ParseTreeWalker {
  public featureItems: TypeInlayHintsItemType[] = [];

  override visitNode(node: ParseNode) {
    return super.visitNode(node);
  }

  override visitName(node: NameNode): boolean {
    if (node.parent) {
      const parentNodeType = printParseNodeType(node.parent.nodeType);
      // If the type already exists in the code, do not match.
      // The parent node is "TypeAnnotation" if the type exists.
      if (parentNodeType === 'Assignment') {
        this.featureItems.push({
          inlayHintType: 'variable',
          startOffset: node.start,
          endOffset: node.start + node.length - 1,
          value: node.value,
        });
      }
    }
    return super.visitName(node);
  }

  override visitMemberAccess(node: MemberAccessNode): boolean {
    if (node.parent) {
      const parentNodeType = printParseNodeType(node.parent.nodeType);
      // If the type already exists in the code, do not match.
      // The parent node is "TypeAnnotation" if the type exists.
      if (parentNodeType === 'Assignment') {
        this.featureItems.push({
          inlayHintType: 'variable',
          startOffset: node.memberName.start,
          endOffset: node.memberName.start + node.memberName.length - 1,
          value: node.memberName.value,
        });
      }
    }
    return super.visitMemberAccess(node);
  }

  override visitFunction(node: FunctionNode): boolean {
    // If the code describes a type, do not add the item.
    // Add item only if "node.returnTypeAnnotation" does not exist.
    if (!node.returnTypeAnnotation) {
      this.featureItems.push({
        inlayHintType: 'functionReturn',
        startOffset: node.name.start,
        endOffset: node.suite.start,
        value: node.name.value,
      });
    }
    return super.visitFunction(node);
  }
}
