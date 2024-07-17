import { ParseTreeWalker } from '@zzzen/pyright-internal/dist/analyzer/parseTreeWalker';
import {
  type CallNode,
  type ClassNode,
  type DecoratorNode,
  type ForNode,
  type FormatStringNode,
  type FunctionNode,
  type ImportAsNode,
  type ImportFromAsNode,
  type ImportFromNode,
  type ImportNode,
  type MemberAccessNode,
  type NameNode,
  type ParameterNode,
  type ParseNode,
  type ParseNodeBase,
  ParseNodeType,
  type TypeAnnotationNode,
  type TypeParameterNode,
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

  private addItem(node: ParseNodeBase<ParseNodeType>, type: string, modifiers: string[] = []) {
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

  visitFor(node: ForNode): boolean {
    if (node.nodeType === ParseNodeType.For) {
      this.addItem(node.d.targetExpr, SemanticTokenTypes.variable);
    }
    return super.visitFor(node);
  }

  visitFormatString(node: FormatStringNode): boolean {
    node.d.fieldExprs.map((f) => this.addItem(f, SemanticTokenTypes.variable));
    return super.visitFormatString(node);
  }

  visitCall(node: CallNode): boolean {
    // TODO: hard-code, treat first-letter UpperCase as class
    if (node.d.leftExpr.nodeType === 38) {
      const value = node.d.leftExpr.d.value;
      if (value[0] === value[0].toUpperCase()) {
        this.addItem(node.d.leftExpr, SemanticTokenTypes.class);
      } else {
        this.addItem(node.d.leftExpr, SemanticTokenTypes.function);
      }
    }
    return super.visitCall(node);
  }

  visitClass(node: ClassNode): boolean {
    // @ts-ignore
    if (node.arguments.length === 1 && node.arguments[0].valueExpression.value === 'Enum') {
      this.addItem(node.d.name, SemanticTokenTypes.enum);

      for (const m of node.d.suite.d.statements) {
        // @ts-ignore
        this.addItem(m.statements[0].leftExpression, SemanticTokenTypes.enumMember);
      }
      return super.visitClass(node);
    }

    this.addItem(node.d.name, SemanticTokenTypes.class, [SemanticTokenModifiers.definition]);
    return super.visitClass(node);
  }

  visitMemberAccess(node: MemberAccessNode): boolean {
    if (node.parent?.nodeType === ParseNodeType.Call) {
      this.addItem(node.d.member, SemanticTokenTypes.function);
      return super.visitMemberAccess(node);
    }

    this.addItem(node.d.member, SemanticTokenTypes.property);
    return super.visitMemberAccess(node);
  }

  visitDecorator(node: DecoratorNode): boolean {
    this.addItem(node.d.expr, SemanticTokenTypes.decorator);
    let nameNode: NameNode | undefined;
    switch (node.d.expr.nodeType) {
      case ParseNodeType.Call:
        if (node.d.expr.d.leftExpr.nodeType === ParseNodeType.MemberAccess) {
          nameNode = node.d.expr.d.leftExpr.d.member;
        } else if (node.d.expr.d.leftExpr.nodeType === ParseNodeType.Name) {
          nameNode = node.d.expr.d.leftExpr;
        }
        break;
      case ParseNodeType.MemberAccess:
        nameNode = node.d.expr.d.member;
        break;
      case ParseNodeType.Name:
        nameNode = node.d.expr;
        break;
    }
    if (nameNode) {
      this.addItem(nameNode, SemanticTokenTypes.decorator);
    }
    return super.visitDecorator(node);
  }

  visitImport(node: ImportNode): boolean {
    for (const x of node.d.list) {
      if (x.d.alias) {
        this.addItem(x.d.alias, SemanticTokenTypes.namespace);
      }
    }
    return super.visitImport(node);
  }

  visitImportAs(node: ImportAsNode): boolean {
    if (node.d.alias?.d.value.length) {
      this.addItem(node.d.alias, SemanticTokenTypes.namespace);
    }
    node.d.module.d.nameParts.map((x) => this.addItem(x, SemanticTokenTypes.namespace));
    return super.visitImportAs(node);
  }

  visitImportFrom(node: ImportFromNode): boolean {
    node.d.module.d.nameParts.map((x) => this.addItem(x, SemanticTokenTypes.namespace));
    for (const x of node.d.imports) {
      if (x.d.alias) {
        this.addItem(x.d.alias, SemanticTokenTypes.namespace);
      }
    }

    return super.visitImportFrom(node);
  }

  visitImportFromAs(node: ImportFromAsNode): boolean {
    if (node.d.alias?.d.value.length) {
      this.addItem(node.d.alias, SemanticTokenTypes.namespace);
    }
    return super.visitImportFromAs(node);
  }

  visitParameter(node: ParameterNode): boolean {
    if (!node.d.name) return super.visitParameter(node);

    this.addItem(node.d.name, SemanticTokenTypes.parameter);
    if (node.d.annotation) {
      this.addItem(node.d.annotation, SemanticTokenTypes.typeParameter);
    }
    return super.visitParameter(node);
  }

  visitTypeParameter(node: TypeParameterNode): boolean {
    this.addItem(node.d.name, SemanticTokenTypes.typeParameter);
    return super.visitTypeParameter(node);
  }

  visitTypeAnnotation(node: TypeAnnotationNode): boolean {
    if (node.d.annotation) {
      this.addItem(node.d.annotation, SemanticTokenTypes.typeParameter);
    }
    return super.visitTypeAnnotation(node);
  }

  visitFunction(node: FunctionNode): boolean {
    const modifiers = [SemanticTokenModifiers.definition];
    if (node.d.isAsync) {
      modifiers.push(SemanticTokenModifiers.async);
    }
    const type = node.parent?.parent?.nodeType === 10 ? SemanticTokenTypes.method : SemanticTokenTypes.function;
    this.addItem(node.d.name, type, modifiers);

    for (const p of node.d.params) {
      if (!p.d.name) continue;

      this.addItem(p.d.name, SemanticTokenTypes.parameter);
      if (p.d.annotation) {
        this.addItem(p.d.annotation, SemanticTokenTypes.typeParameter);
      }
    }

    return super.visitFunction(node);
  }
}
