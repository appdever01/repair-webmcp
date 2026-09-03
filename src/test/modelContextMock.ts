export class ModelContextMock extends EventTarget implements WebMCP.ModelContext {
  readonly tools = new Map<string, WebMCP.ModelContextTool>();
  ontoolchange: ((this: WebMCP.ModelContext, ev: Event) => unknown) | null = null;

  readonly registrationLog: string[] = [];

  async registerTool(
    tool: WebMCP.ModelContextTool,
    options?: WebMCP.ModelContextRegisterToolOptions,
  ) {
    if (this.tools.has(tool.name)) {
      throw new DOMException(
        `A tool named ${tool.name} is already registered.`,
        "InvalidStateError",
      );
    }
    this.registrationLog.push(tool.name);
    this.tools.set(tool.name, tool);
    options?.signal?.addEventListener(
      "abort",
      () => {
        if (this.tools.get(tool.name) === tool) this.tools.delete(tool.name);
        this.dispatchEvent(new Event("toolchange"));
      },
      { once: true },
    );
    this.dispatchEvent(new Event("toolchange"));
  }

  async getTools(): Promise<WebMCP.RegisteredTool[]> {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      title: tool.title ?? tool.name,
      description: tool.description,
      ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
      window,
      origin: window.location.origin,
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
    }));
  }

  execute(name: string, input: Record<string, unknown>, signal = new AbortController().signal) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not registered: ${name}`);
    return tool.execute(input, { signal });
  }

  executeWithoutOptions(name: string, input: Record<string, unknown>) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not registered: ${name}`);
    const execute = tool.execute as (inputObject: Record<string, unknown>) => unknown;
    return execute(input);
  }
}
