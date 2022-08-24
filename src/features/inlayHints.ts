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
  workspace,
} from 'coc.nvim';

import * as typeInlayHintsParser from '../parsers/typeInlayHints';

export class TypeInlayHintsProvider implements InlayHintsProvider {
  private readonly _onDidChangeInlayHints = new Emitter<void>();
  public readonly onDidChangeInlayHints: Event<void> = this._onDidChangeInlayHints.event;

  constructor(private client: LanguageClient) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async provideInlayHints(document: LinesTextDocument, _range: Range, _token: CancellationToken) {
    const inlayHints: InlayHint[] = [];

    const code = document.getText();
    const parsed = typeInlayHintsParser.parse(code);
    if (!parsed) return [];

    const walker = new typeInlayHintsParser.TypeInlayHintsWalker();
    walker.walk(parsed.parseTree);

    for (const item of walker.featureItems) {
      if (this.isDisableVariableTypes(item.inlayHintType)) continue;
      if (this.isDisableFunctionReturnTypes(item.inlayHintType)) continue;

      const startPosition = document.positionAt(item.startOffset);
      const endPosition = document.positionAt(item.endOffset);
      const hoverResponse = await this.getHoverAtOffset(document, startPosition);

      if (hoverResponse) {
        let inlayHintLabelValue: string | undefined = undefined;
        let inlayHintPosition: Position | undefined = undefined;

        if (item.inlayHintType === 'variable') {
          inlayHintLabelValue = this.getVariableHintAtHover(hoverResponse);
        }

        if (item.inlayHintType === 'functionReturn') {
          inlayHintLabelValue = this.getFunctionReturnHintAtHover(hoverResponse);
        }

        if (inlayHintLabelValue) {
          const inlayHintLabelPart: InlayHintLabelPart[] = [
            {
              value: inlayHintLabelValue,
            },
          ];

          switch (item.inlayHintType) {
            case 'variable':
              inlayHintPosition = Position.create(startPosition.line, endPosition.character + 1);
              break;
            case 'functionReturn':
              inlayHintPosition = endPosition;
              break;
            default:
              break;
          }

          if (inlayHintPosition) {
            const inlayHint: InlayHint = {
              label: inlayHintLabelPart,
              position: inlayHintPosition,
              paddingLeft: item.inlayHintType === 'functionReturn' ?? true,
              paddingRight: item.inlayHintType === 'variable' ?? true,
            };

            inlayHints.push(inlayHint);
          }
        }
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

  private getVariableHintAtHover(hover: Hover): string | undefined {
    const contents = hover.contents as MarkupContent;
    if (contents) {
      if (contents.value.includes('(variable)')) {
        const text = contents.value.split(': ')[1].split('\n')[0].trim();
        const hintText = ': ' + text;
        return hintText;
      }
    }
  }

  private getFunctionReturnHintAtHover(hover: Hover): string | undefined {
    const contents = hover.contents as MarkupContent;
    if (contents) {
      if (contents.value.includes('(function)') || contents.value.includes('(method)')) {
        const text = contents.value.split('->')[1].split('\n')[0].trim();
        const hintText = '-> ' + text;
        return hintText;
      }
    }
  }

  private isDisableVariableTypes(inlayHintType: string) {
    if (!workspace.getConfiguration('pyright').get('inlayHints.variableTypes') && inlayHintType === 'variable') {
      return true;
    }
    return false;
  }

  private isDisableFunctionReturnTypes(inlayHintType: string) {
    if (!workspace.getConfiguration('pyright').get('inlayHints.functionReturnTypes') && inlayHintType === 'functionReturn') {
      return true;
    }
    return false;
  }
}
