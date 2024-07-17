import { printParseNodeType } from '@zzzen/pyright-internal/dist/analyzer/parseTreeUtils';
import { ParseTreeWalker } from '@zzzen/pyright-internal/dist/analyzer/parseTreeWalker';
import type { ClassNode, FunctionNode, SuiteNode } from '@zzzen/pyright-internal/dist/parser/parseNodes';
import type { TestingFramework } from '../types';

export type FunctionFormatItemType = {
  value: string;
  startOffset: number;
  endOffset: number;
};

export class TestFrameworkWalker extends ParseTreeWalker {
  public featureItems: FunctionFormatItemType[] = [];
  private testFramework: TestingFramework;

  constructor(testFramework: TestingFramework) {
    super();
    this.testFramework = testFramework;
  }

  override visitFunction(node: FunctionNode): boolean {
    if (node.d.name.d.value.startsWith('test_')) {
      if (node.parent && printParseNodeType(node.parent.nodeType) === 'Suite') {
        const parentSuiteNode = node.parent as SuiteNode;
        if (parentSuiteNode.parent && printParseNodeType(parentSuiteNode.parent.nodeType) === 'Class') {
          const classNode = parentSuiteNode.parent as ClassNode;

          let combineString: string | undefined = undefined;
          if (this.testFramework === 'unittest') {
            combineString = '.';
          } else if (this.testFramework === 'pytest') {
            combineString = '::';
          }

          this.featureItems.push({
            value: classNode.d.name.d.value + combineString + node.d.name.d.value,
            startOffset: node.start,
            endOffset: node.start + node.length - 1,
          });
        }
      } else {
        if (this.testFramework === 'pytest') {
          this.featureItems.push({
            value: node.d.name.d.value,
            startOffset: node.start,
            endOffset: node.start + node.length - 1,
          });
        }
      }
    }

    return super.visitFunction(node);
  }
}
