import { ParseTreeWalker } from '@zzzen/pyright-internal/dist/analyzer/parseTreeWalker';
import { TextRange } from '@zzzen/pyright-internal/dist/common/textRange';
import {
  CallNode,
  ClassNode,
  ConstantNode,
  DecoratorNode,
  FormatStringNode,
  FunctionNode,
  ImportAsNode,
  ImportFromAsNode,
  MemberAccessNode,
  ModuleNameNode,
  ParameterNode,
  TypeAnnotationNode,
  TypeParameterNode,
} from '@zzzen/pyright-internal/dist/parser/parseNodes';

export enum TokenTypes {
  'UnKnownInvalid' = 0,
  'UnKnownEndOfStream' = 1,
  'UnKnownNewLine' = 2,
  'UnKnownIndent' = 3,
  'UnKnownDedent' = 4,
  'string' = 5,
  'number' = 6,
  'UnKnownIdentifier' = 7,
  'keyword' = 8,
  'operator' = 9,
  'colon' = 10,
  'semicolon' = 11,
  'comma' = 12,
  'parenthesis' = 13,
  'CloseParenthesis' = 14,
  'bracket' = 15,
  'CloseBracket' = 16,
  'curlyBrace' = 17,
  'CloseCurlyBrace' = 18,
  'ellipsis' = 19,
  'dot' = 20,
  'arrow' = 21,
  'backtick' = 22,

  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'case',
  'class',
  'continue',
  'debug',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'false',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'match',
  'none',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'true',
  'try',
  'type',
  'while',
  'with',
  'yield',

  'alias',
  'const',
  'module',
  'method',
  'function',
  'property',
  'variable',
  'decorator',
  'parameter',
  'typeParameter',
  'selfParameter',
  'clsParameter',
  'formatString',
  'magicFunction',
  'typeAnnotation',
}

export type SemanticItem = {
  type: TokenTypes;
  start: number;
  length: number;
};

export class SemanticTokensWalker extends ParseTreeWalker {
  public semanticItems: SemanticItem[] = [];

  private addSemanticItem(type: TokenTypes, text: TextRange) {
    const item: SemanticItem = { type, start: text.start, length: text.length };
    if (this.semanticItems.includes(item)) return;

    this.semanticItems.push(item);
  }

  visitFormatString(node: FormatStringNode): boolean {
    node.expressions.map((f) => this.addSemanticItem(TokenTypes.formatString, f));
    return super.visitFormatString(node);
  }

  visitTypeAnnotation(node: TypeAnnotationNode): boolean {
    if (node.typeAnnotation) {
      this.addSemanticItem(TokenTypes.typeAnnotation, node.typeAnnotation);
    }
    return super.visitTypeAnnotation(node);
  }

  visitCall(node: CallNode): boolean {
    // TODO: hard-code, treat first-letter UpperCase as class
    if (node.leftExpression.nodeType === 38) {
      const value = node.leftExpression.value;
      if (value[0] === value[0].toUpperCase()) {
        this.addSemanticItem(TokenTypes.class, node.leftExpression);
      }
    }
    return super.visitCall(node);
  }

  visitClass(node: ClassNode): boolean {
    this.addSemanticItem(TokenTypes.class, node.name);
    return super.visitClass(node);
  }

  visitMemberAccess(node: MemberAccessNode): boolean {
    this.addSemanticItem(TokenTypes.method, node.memberName);
    return super.visitMemberAccess(node);
  }

  visitConstant(node: ConstantNode): boolean {
    this.addSemanticItem(TokenTypes.const, node);
    return super.visitConstant(node);
  }

  visitDecorator(node: DecoratorNode): boolean {
    this.addSemanticItem(TokenTypes.decorator, node.expression);
    return super.visitDecorator(node);
  }

  visitModuleName(node: ModuleNameNode): boolean {
    node.nameParts.map((m) => this.addSemanticItem(TokenTypes.module, m));
    return super.visitModuleName(node);
  }

  visitImportAs(node: ImportAsNode): boolean {
    if (node.alias && node.alias.value.length) {
      this.addSemanticItem(TokenTypes.alias, node.alias);
    }
    return super.visitImportAs(node);
  }

  visitImportFromAs(node: ImportFromAsNode): boolean {
    if (node.alias && node.alias.value.length) {
      this.addSemanticItem(TokenTypes.alias, node.alias);
    }
    return super.visitImportFromAs(node);
  }

  visitParameter(node: ParameterNode): boolean {
    if (!node.name) return super.visitParameter(node);

    const type = node.name?.value === 'self' ? TokenTypes.selfParameter : TokenTypes.parameter;
    this.addSemanticItem(type, node.name);
    if (node.typeAnnotation) {
      this.addSemanticItem(TokenTypes.typeAnnotation, node.typeAnnotation);
    }
    return super.visitParameter(node);
  }

  visitTypeParameter(node: TypeParameterNode): boolean {
    this.addSemanticItem(TokenTypes.typeParameter, node.name);
    return super.visitTypeParameter(node);
  }

  visitFunction(node: FunctionNode): boolean {
    const type = node.parent?.parent?.nodeType === 10 ? TokenTypes.method : TokenTypes.function;
    this.addSemanticItem(type, node.name);

    for (const p of node.parameters) {
      if (!p.name) continue;

      const type = p.name?.value === 'self' ? TokenTypes.selfParameter : TokenTypes.parameter;
      this.addSemanticItem(type, p.name);
    }

    return super.visitFunction(node);
  }
}
