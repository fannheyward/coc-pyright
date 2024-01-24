import { ParseTreeWalker } from '@zzzen/pyright-internal/dist/analyzer/parseTreeWalker';
import {
  CallNode,
  ClassNode,
  DecoratorNode,
  FormatStringNode,
  FunctionNode,
  ImportAsNode,
  ImportFromAsNode,
  ImportFromNode,
  ImportNode,
  MemberAccessNode,
  ParameterNode,
  ParseNode,
  ParseNodeBase,
  ParseNodeType,
  TypeParameterNode,
} from '@zzzen/pyright-internal/dist/parser/parseNodes';
import { SemanticTokenModifiers, SemanticTokenTypes } from 'coc.nvim';

type SemanticTokenItem = {
  type: string;
  start: number;
  length: number;
  modifiers: string[];
};

export class SemanticTokensWalker extends ParseTreeWalker {
  public semanticItems: SemanticTokenItem[] = [];

  private addItem(node: ParseNodeBase, type: string, modifiers: string[] = []) {
    const item: SemanticTokenItem = { type, start: node.start, length: node.length, modifiers };
    if (this.semanticItems.some((x) => x.type === item.type && x.start === item.start && x.length === item.length)) {
      return;
    }

    this.semanticItems.push(item);
  }

  visit(node: ParseNode): boolean {
    // ParseNodeType.Argument;
    // console.error(node);
    return super.visit(node);
  }

  visitFormatString(node: FormatStringNode): boolean {
    node.fieldExpressions.map((f) => this.addItem(f, SemanticTokenTypes.variable));
    return super.visitFormatString(node);
  }

  visitCall(node: CallNode): boolean {
    // TODO: hard-code, treat first-letter UpperCase as class
    if (node.leftExpression.nodeType === 38) {
      const value = node.leftExpression.value;
      if (value[0] === value[0].toUpperCase()) {
        this.addItem(node.leftExpression, SemanticTokenTypes.class);
      }
    }
    return super.visitCall(node);
  }

  visitClass(node: ClassNode): boolean {
    // @ts-ignore
    if (node.arguments.length === 1 && node.arguments[0].valueExpression.value === 'Enum') {
      this.addItem(node.name, SemanticTokenTypes.enum);

      for (const m of node.suite.statements) {
        // @ts-ignore
        this.addItem(m.statements[0].leftExpression, SemanticTokenTypes.enumMember);
      }
      return super.visitClass(node);
    }

    this.addItem(node.name, SemanticTokenTypes.class, [SemanticTokenModifiers.definition]);
    return super.visitClass(node);
  }

  visitMemberAccess(node: MemberAccessNode): boolean {
    if (node.parent?.nodeType === ParseNodeType.Call) {
      this.addItem(node.memberName, SemanticTokenTypes.function);
      return super.visitMemberAccess(node);
    }

    this.addItem(node.memberName, SemanticTokenTypes.property);
    return super.visitMemberAccess(node);
  }

  visitDecorator(node: DecoratorNode): boolean {
    this.addItem(node.expression, SemanticTokenTypes.decorator);
    return super.visitDecorator(node);
  }

  visitImport(node: ImportNode): boolean {
    node.list.map((x) => this.addItem(x, SemanticTokenTypes.namespace));
    return super.visitImport(node);
  }

  visitImportAs(node: ImportAsNode): boolean {
    if (node.alias && node.alias.value.length) {
      this.addItem(node.alias, SemanticTokenTypes.namespace);
    }
    node.module.nameParts.map((x) => this.addItem(x, SemanticTokenTypes.namespace));
    return super.visitImportAs(node);
  }

  visitImportFrom(node: ImportFromNode): boolean {
    node.module.nameParts.map((x) => this.addItem(x, SemanticTokenTypes.namespace));
    node.imports.map((x) => this.addItem(x, SemanticTokenTypes.namespace));

    return super.visitImportFrom(node);
  }

  visitImportFromAs(node: ImportFromAsNode): boolean {
    if (node.alias && node.alias.value.length) {
      this.addItem(node.alias, SemanticTokenTypes.namespace);
    }
    return super.visitImportFromAs(node);
  }

  visitParameter(node: ParameterNode): boolean {
    if (!node.name) return super.visitParameter(node);

    this.addItem(node.name, SemanticTokenTypes.parameter);
    if (node.typeAnnotation) {
      this.addItem(node.typeAnnotation, SemanticTokenTypes.typeParameter);
    }
    return super.visitParameter(node);
  }

  visitTypeParameter(node: TypeParameterNode): boolean {
    this.addItem(node.name, SemanticTokenTypes.typeParameter);
    return super.visitTypeParameter(node);
  }

  visitFunction(node: FunctionNode): boolean {
    const modifiers = [SemanticTokenModifiers.definition];
    if (node.isAsync) {
      modifiers.push(SemanticTokenModifiers.async);
    }
    const type = node.parent?.parent?.nodeType === 10 ? SemanticTokenTypes.method : SemanticTokenTypes.function;
    this.addItem(node.name, type, modifiers);

    for (const p of node.parameters) {
      if (!p.name) continue;

      this.addItem(p.name, SemanticTokenTypes.parameter);
      if (p.typeAnnotation) {
        this.addItem(p.typeAnnotation, SemanticTokenTypes.typeParameter);
      }
    }

    return super.visitFunction(node);
  }
}
