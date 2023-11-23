import {
  CancellationToken,
  Emitter,
  Event,
  Hover,
  InlayHint,
  InlayHintLabelPart,
  InlayHintsProvider,
  LanguageClient,
  LinesTextDocument,
  MarkupContent,
  Position,
  Range,
  SignatureHelp,
  workspace,
} from 'coc.nvim';

import * as parser from '../parsers';
import { positionInRange } from '../utils';

export class TypeInlayHintsProvider implements InlayHintsProvider {
  private readonly _onDidChangeInlayHints = new Emitter<void>();
  public readonly onDidChangeInlayHints: Event<void> = this._onDidChangeInlayHints.event;

  constructor(private client: LanguageClient) {
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('pyright.inlayHints')) {
        this._onDidChangeInlayHints.fire();
      }
    });
    workspace.onDidChangeTextDocument((e) => {
      const doc = workspace.getDocument(e.bufnr);
      if (doc.languageId === 'python') {
        this._onDidChangeInlayHints.fire();
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async provideInlayHints(document: LinesTextDocument, range: Range, _token: CancellationToken) {
    const inlayHints: InlayHint[] = [];

    const code = document.getText();
    const parsed = parser.parse(code);
    if (!parsed) return [];

    const walker = new parser.TypeInlayHintsWalker(parsed);
    walker.walk(parsed.parseTree);

    const featureItems = walker.featureItems
      .filter((item) => this.enableForType(item.inlayHintType))
      .filter((item) => {
        const startPosition = document.positionAt(item.startOffset);
        const endPosition = document.positionAt(item.endOffset);
        return positionInRange(startPosition, range) === 0 || positionInRange(endPosition, range) === 0;
      });
    if (featureItems.length === 0) return [];

    for (const item of featureItems) {
      const startPosition = document.positionAt(item.startOffset);
      const endPosition = document.positionAt(item.endOffset);
      const hover = item.inlayHintType === 'parameter' ? null : await this.getHoverAtOffset(document, startPosition);
      const signatureInfo = item.inlayHintType === 'parameter' ? await this.getSignatureHelpAtOffset(document, startPosition) : null;

      let inlayHintLabelValue: string | undefined = undefined;
      switch (item.inlayHintType) {
        case 'variable':
          inlayHintLabelValue = this.getVariableHintFromHover(hover);
          break;
        case 'functionReturn':
          inlayHintLabelValue = this.getFunctionReturnHintFromHover(hover);
          break;
        case 'parameter':
          inlayHintLabelValue = this.getParameterHintFromSignature(signatureInfo);
          break;
        default:
          break;
      }
      if (!inlayHintLabelValue) {
        continue;
      }

      const inlayHintLabelPart: InlayHintLabelPart[] = [
        {
          value: inlayHintLabelValue,
        },
      ];

      let inlayHintPosition: Position | undefined = undefined;
      switch (item.inlayHintType) {
        case 'variable':
          inlayHintPosition = Position.create(startPosition.line, endPosition.character + 1);
          break;
        case 'functionReturn':
          inlayHintPosition = endPosition;
          break;
        case 'parameter':
          inlayHintPosition = startPosition;
          break;
        default:
          break;
      }

      if (inlayHintPosition) {
        inlayHints.push({
          label: inlayHintLabelPart,
          position: inlayHintPosition,
          kind: item.inlayHintType === 'parameter' ? 2 : 1,
          paddingLeft: item.inlayHintType === 'functionReturn',
        });
      }
    }

    return inlayHints;
  }

  private async getHoverAtOffset(document: LinesTextDocument, position: Position) {
    const params = {
      textDocument: { uri: document.uri },
      position,
    };

    return await this.client.sendRequest<Hover>('textDocument/hover', params);
  }

  private getVariableHintFromHover(hover: Hover | null): string | undefined {
    if (!hover) return;
    const contents = hover.contents as MarkupContent;
    if (contents && contents.value.includes('(variable)')) {
      if (contents.value.includes('(variable) def')) {
        return;
      }
      const firstIdx = contents.value.indexOf(': ');
      if (firstIdx > -1) {
        const text = contents.value
          .substring(firstIdx + 2)
          .split('\n')[0]
          .trim();
        if (text === 'Any' || text.startsWith('Literal[')) {
          return;
        }
        return ': ' + text;
      }
    }
  }

  private getFunctionReturnHintFromHover(hover: Hover | null): string | undefined {
    if (!hover) return;
    const contents = hover.contents as MarkupContent;
    if (contents && (contents.value.includes('(function)') || contents.value.includes('(method)'))) {
      const retvalIdx = contents.value.indexOf('->') + 2;
      const text = contents.value.substring(retvalIdx).split('\n')[0].trim();
      return '-> ' + text;
    }
  }

  private async getSignatureHelpAtOffset(document: LinesTextDocument, position: Position) {
    const params = {
      textDocument: { uri: document.uri },
      position,
    };

    return await this.client.sendRequest<SignatureHelp>('textDocument/signatureHelp', params);
  }

  private getParameterHintFromSignature(signatureInfo: SignatureHelp | null): string | undefined {
    if (!signatureInfo) return;
    const sig = signatureInfo.signatures[0];
    if (typeof sig.activeParameter !== 'number') {
      return;
    }
    if (!sig.parameters || sig.parameters.length < sig.activeParameter) {
      return;
    }
    const param = sig.parameters[sig.activeParameter];
    if (typeof param.label === 'string') {
      return param.label;
    }
    const label = sig.label.substring(param.label[0], param.label[1]).split(':')[0];
    if (label.startsWith('__')) {
      return;
    }
    return label + ': ';
  }

  private enableForType(inlayHintType: string) {
    return workspace.getConfiguration('pyright').get(`inlayHints.${inlayHintType}Types`, true);
  }
}
