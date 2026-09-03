declare global {
  interface Navigator {
    readonly modelContext?: WebMCP.ModelContext;
  }
}

export type ModelContextEntryPoint = "document" | "navigator";

export interface ModelContextHost {
  document?: { readonly modelContext?: WebMCP.ModelContext } | undefined;
  navigator?: { readonly modelContext?: WebMCP.ModelContext } | undefined;
}

export interface ResolvedModelContext {
  modelContext: WebMCP.ModelContext;
  entryPoint: ModelContextEntryPoint;
}

function usable(candidate: unknown): candidate is WebMCP.ModelContext {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof (candidate as { registerTool?: unknown }).registerTool === "function"
  );
}

function hostFromGlobal(): ModelContextHost {
  return {
    document: typeof document === "undefined" ? undefined : document,
    navigator: typeof navigator === "undefined" ? undefined : navigator,
  };
}

export function resolveModelContext(
  host: ModelContextHost = hostFromGlobal(),
): ResolvedModelContext | undefined {
  const documentContext = host.document?.modelContext;
  if (usable(documentContext)) return { modelContext: documentContext, entryPoint: "document" };
  const navigatorContext = host.navigator?.modelContext;
  if (usable(navigatorContext)) return { modelContext: navigatorContext, entryPoint: "navigator" };
  return undefined;
}
