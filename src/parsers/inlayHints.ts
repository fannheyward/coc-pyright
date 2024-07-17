import { getCallNodeAndActiveParameterIndex } from '@zzzen/pyright-internal/dist/analyzer/parseTreeUtils';
import { ParseTreeWalker } from '@zzzen/pyright-internal/dist/analyzer/parseTreeWalker';
import {
  type ArgumentNode,
  type AssignmentNode,
  type FunctionNode,
  type MemberAccessNode,
  type NameNode,
  type ParseNode,
  ParseNodeType,
} from '@zzzen/pyright-internal/dist/parser/parseNodes';
import type { ParseFileResults } from '@zzzen/pyright-internal/dist/parser/parser';

type TypeInlayHintsItemType = {
  inlayHintType: 'variable' | 'functionReturn' | 'parameter';
  startOffset: number;
  endOffset: number;
  value?: string;
};

function isLeftSideOfAssignment(node: ParseNode): boolean {
  if (node.parent?.nodeType !== ParseNodeType.Assignment) {
    return false;
  }
  return node.start < (node.parent as AssignmentNode).d.rightExpr.start;
}

export class TypeInlayHintsWalker extends ParseTreeWalker {
  public featureItems: TypeInlayHintsItemType[] = [];

  constructor(private readonly _parseResults: ParseFileResults) {
    super();
  }

  override visitName(node: NameNode): boolean {
    if (isLeftSideOfAssignment(node)) {
      this.featureItems.push({
        inlayHintType: 'variable',
        startOffset: node.start,
        endOffset: node.start + node.length - 1,
        value: node.d.value,
      });
    }
    return super.visitName(node);
  }

  override visitMemberAccess(node: MemberAccessNode): boolean {
    if (isLeftSideOfAssignment(node)) {
      this.featureItems.push({
        inlayHintType: 'variable',
        startOffset: node.d.member.start,
        endOffset: node.d.member.start + node.d.member.length - 1,
        value: node.d.member.d.value,
      });
    }
    return super.visitMemberAccess(node);
  }

  override visitArgument(node: ArgumentNode): boolean {
    if (node.parent) {
      if (node.parent.nodeType === ParseNodeType.Assignment) {
        return false;
      }
      const result = getCallNodeAndActiveParameterIndex(node, node.start, this._parseResults.tokenizerOutput.tokens);
      if (!result?.callNode || result.callNode.d.args[result.activeIndex].d.name) {
        return false;
      }
      this.featureItems.push({
        inlayHintType: 'parameter',
        startOffset: node.start,
        endOffset: node.start + node.length - 1,
      });
    }
    return super.visitArgument(node);
  }

  override visitFunction(node: FunctionNode): boolean {
    // If the code describes a type, do not add the item.
    // Add item only if "node.returnTypeAnnotation" does not exist.
    if (!node.d.returnAnnotation) {
      this.featureItems.push({
        inlayHintType: 'functionReturn',
        startOffset: node.d.name.start,
        endOffset: node.d.suite.start,
        value: node.d.name.d.value,
      });
    }
    return super.visitFunction(node);
  }
}
