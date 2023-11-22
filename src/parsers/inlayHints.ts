import { getCallNodeAndActiveParameterIndex } from '@zzzen/pyright-internal/dist/analyzer/parseTreeUtils';
import { ParseTreeWalker } from '@zzzen/pyright-internal/dist/analyzer/parseTreeWalker';
import { ArgumentNode, AssignmentNode, FunctionNode, MemberAccessNode, NameNode, ParseNode, ParseNodeType } from '@zzzen/pyright-internal/dist/parser/parseNodes';
import { ParseResults } from '@zzzen/pyright-internal/dist/parser/parser';

export type TypeInlayHintsItemType = {
  inlayHintType: 'variable' | 'functionReturn' | 'parameter';
  startOffset: number;
  endOffset: number;
  value?: string;
};

function isLeftSideOfAssignment(node: ParseNode): boolean {
  if (node.parent?.nodeType !== ParseNodeType.Assignment) {
    return false;
  }
  return node.start < (node.parent as AssignmentNode).rightExpression.start;
}

export class TypeInlayHintsWalker extends ParseTreeWalker {
  public featureItems: TypeInlayHintsItemType[] = [];

  constructor(private readonly _parseResults: ParseResults) {
    super();
  }

  override visitName(node: NameNode): boolean {
    if (isLeftSideOfAssignment(node)) {
      this.featureItems.push({
        inlayHintType: 'variable',
        startOffset: node.start,
        endOffset: node.start + node.length - 1,
        value: node.value,
      });
    }
    return super.visitName(node);
  }

  override visitMemberAccess(node: MemberAccessNode): boolean {
    if (isLeftSideOfAssignment(node)) {
      this.featureItems.push({
        inlayHintType: 'variable',
        startOffset: node.memberName.start,
        endOffset: node.memberName.start + node.memberName.length - 1,
        value: node.memberName.value,
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
      if (!result?.callNode || result.callNode.arguments[result.activeIndex].name) {
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
