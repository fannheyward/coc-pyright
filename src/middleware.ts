import {
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  ConfigurationParams,
  Diagnostic,
  HandleDiagnosticsSignature,
  InsertTextFormat,
  LinesTextDocument,
  Position,
  ProvideCompletionItemsSignature,
  ProvideHoverSignature,
  ResolveCompletionItemSignature,
  workspace,
} from 'coc.nvim';
import { PythonSettings } from './configSettings';

function toJSONObject(obj: any): any {
  if (obj) {
    if (Array.isArray(obj)) {
      return obj.map(toJSONObject);
    } else if (typeof obj === 'object') {
      const res = Object.create(null);
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          res[key] = toJSONObject(obj[key]);
        }
      }
      return res;
    }
  }
  return obj;
}

export function configuration(params: ConfigurationParams, token: CancellationToken, next: any) {
  const pythonItem = params.items.find((x) => x.section === 'python');
  if (pythonItem) {
    const custom = () => {
      const config = toJSONObject(workspace.getConfiguration(pythonItem.section, pythonItem.scopeUri));
      config['pythonPath'] = PythonSettings.getInstance().pythonPath;

      // expand relative path
      const analysis = config['analysis'];
      analysis['stubPath'] = workspace.expand(analysis['stubPath'] as string);
      const extraPaths = analysis['extraPaths'] as string[];
      if (extraPaths?.length) {
        analysis['extraPaths'] = extraPaths.map((p) => workspace.expand(p));
      }
      const typeshedPaths = analysis['typeshedPaths'] as string[];
      if (typeshedPaths?.length) {
        analysis['typeshedPaths'] = typeshedPaths.map((p) => workspace.expand(p));
      }
      config['analysis'] = analysis;
      return [config];
    };
    return custom();
  }
  const analysisItem = params.items.find((x) => x.section === 'python.analysis');
  if (analysisItem) {
    const custom = () => {
      const analysis = toJSONObject(workspace.getConfiguration(analysisItem.section, analysisItem.scopeUri));
      analysis['stubPath'] = workspace.expand(analysis['stubPath'] as string);
      const extraPaths = analysis['extraPaths'] as string[];
      if (extraPaths?.length) {
        analysis['extraPaths'] = extraPaths.map((p) => workspace.expand(p));
      }
      const typeshedPaths = analysis['typeshedPaths'] as string[];
      if (typeshedPaths?.length) {
        analysis['typeshedPaths'] = typeshedPaths.map((p) => workspace.expand(p));
      }
      return [analysis];
    };

    return custom();
  }

  return next(params, token);
}

export async function provideCompletionItem(
  document: LinesTextDocument,
  position: Position,
  context: CompletionContext,
  token: CancellationToken,
  next: ProvideCompletionItemsSignature
) {
  const result = await next(document, position, context, token);
  if (!result) return;

  const items = Array.isArray(result) ? result : result.items;
  items.map((x) => (x.sortText ? (x.sortText = x.sortText.toLowerCase()) : (x.sortText = x.label.toLowerCase())));

  const snippetSupport = workspace.getConfiguration('pyright').get<boolean>('completion.snippetSupport');
  if (snippetSupport) {
    for (const item of items) {
      if (item.data?.funcParensDisabled) continue;
      if (item.kind === CompletionItemKind.Method || item.kind === CompletionItemKind.Function) {
        item.insertText = `${item.label}($1)$0`;
        item.insertTextFormat = InsertTextFormat.Snippet;
      }
    }
  }

  return Array.isArray(result) ? items : { items, isIncomplete: result.isIncomplete };
}

export async function resolveCompletionItem(item: CompletionItem, token: CancellationToken, next: ResolveCompletionItemSignature) {
  const result = await next(item, token);
  if (result && typeof result.documentation === 'object' && 'kind' in result.documentation && result.documentation.kind === 'markdown') {
    result.documentation.value = result.documentation.value.replace(/&nbsp;/g, ' ');
  }
  return result;
}

export async function provideHover(document: LinesTextDocument, position: Position, token: CancellationToken, next: ProvideHoverSignature) {
  const hover = await next(document, position, token);
  if (hover && typeof hover.contents === 'object' && 'kind' in hover.contents && hover.contents.kind === 'markdown') {
    hover.contents.value = hover.contents.value.replace(/&nbsp;/g, ' ');
  }
  return hover;
}

export async function handleDiagnostics(uri: string, diagnostics: Diagnostic[], next: HandleDiagnosticsSignature) {
  next(
    uri,
    diagnostics.filter((d) => d.message !== '"__" is not accessed')
  );
}
