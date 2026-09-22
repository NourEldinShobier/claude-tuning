/**
 * stash: an MCP server (stdio, newline-delimited JSON-RPC 2.0) that keeps big command outputs, files and
 * web pages out of the agent's context. Stdout carries protocol messages only; logs go to stderr.
 */
import { Store, bytes } from './store';
import { tools } from './tools';

type Id = string | number | null;
interface Message { jsonrpc?: string; id?: Id; method?: string; params?: Record<string, unknown> }

const INSTRUCTIONS =
  'stash keeps large outputs out of your context. Use stash_run instead of Bash for commands that may print a lot, ' +
  'stash_index for files or web pages you only need parts of, stash_search to pull the passages you need, and ' +
  'stash_get to read any stored chunk or source in full. stash_code runs a snippet and returns only what it prints.';

const send = (msg: unknown) => process.stdout.write(JSON.stringify(msg) + '\n');

export async function handle(store: Store, msg: Message): Promise<unknown | null> {
  const { id, method, params = {} } = msg;
  if (id === undefined) return null; // notification, including notifications/initialized
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const list = tools(store);
  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'stash', version: '0.1.0' },
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: list.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = list.find((t) => t.name === params.name);
      let text: string;
      let isError = false;
      try {
        if (!tool) throw new Error(`unknown tool ${String(params.name)}`);
        text = await tool.handler((params.arguments ?? {}) as Record<string, unknown>);
      } catch (e) {
        text = `stash error: ${(e as Error).message}`;
        isError = true;
      }
      store.count('returned', bytes(text));
      return ok({ content: [{ type: 'text', text }], isError });
    }
    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

if (import.meta.main) {
  const store = new Store();
  if (Math.random() < 0.02) process.stderr.write(`stash: pruned ${store.prune()} old sources\n`);
  const dispatch = async (line: string) => {
    let msg: Message;
    try {
      msg = JSON.parse(line) as Message;
    } catch {
      return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    try {
      const reply = await handle(store, msg);
      if (reply) send(reply);
    } catch (e) {
      process.stderr.write(`stash: ${(e as Error).stack}\n`);
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: (e as Error).message } });
    }
  };
  const decoder = new TextDecoder();
  let buf = '';
  // Requests are handled concurrently so a long stash_run doesn't block ping or other calls.
  for await (const piece of Bun.stdin.stream()) {
    buf += decoder.decode(piece, { stream: true });
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) void dispatch(line);
    }
  }
  if (buf.trim()) void dispatch(buf.trim());
}
