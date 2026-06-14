import * as vscode from "vscode";
import type { KaradevAuthManager } from "./auth";
import type { ChatMessage } from "./types";
import { getWebviewHtml, makeNonce } from "./webview";
import { buildRepoContext } from "./context";

type WebviewLike = vscode.Webview;

export interface ChatHost {
  webview: WebviewLike;
  reveal?: () => void;
}

export async function runChatExchange(
  host: ChatHost,
  auth: KaradevAuthManager,
  messages: ChatMessage[],
  text: string,
  think: boolean,
): Promise<void> {
  const session = await auth.ensureFreshSession();
  if (!session) {
    host.webview.postMessage({
      type: "error",
      text: "Not signed in. Run “Karadev: Sign In”.",
    });
    return;
  }
  const supabaseUrl = await auth.getSupabaseUrl(false);
  if (!supabaseUrl) {
    host.webview.postMessage({
      type: "error",
      text: "Set karadev.supabaseUrl in settings first.",
    });
    return;
  }

  messages.push({ role: "user", content: text });
  host.webview.postMessage({ type: "userMessage", text });
  host.webview.postMessage({ type: "thinking", active: true });

  const repoContext = buildRepoContext();

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages, think, repoContext }),
    });
  } catch (err) {
    host.webview.postMessage({
      type: "error",
      text: "Network error",
      detail: (err as Error).message,
    });
    return;
  }

  if (!res.ok || !res.body) {
    let detail: string | undefined;
    let errText = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as any;
      errText = body?.error ?? errText;
      detail = body?.detail;
      if (res.status === 402) {
        errText =
          body?.error ?? "Payment required — upgrade your Karadev plan.";
      }
    } catch {
      /* ignore */
    }
    host.webview.postMessage({ type: "error", text: errText, detail });
    return;
  }

  host.webview.postMessage({ type: "thinking", active: false });
  host.webview.postMessage({ type: "assistantStart" });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const token: string | undefined =
            json?.choices?.[0]?.delta?.content ??
            json?.choices?.[0]?.message?.content;
          if (token) {
            assistantText += token;
            host.webview.postMessage({ type: "token", text: token });
          }
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  } catch (err) {
    host.webview.postMessage({
      type: "error",
      text: "Stream interrupted",
      detail: (err as Error).message,
    });
    return;
  }

  if (assistantText) messages.push({ role: "assistant", content: assistantText });
  host.webview.postMessage({ type: "assistantDone" });
}

export class KaradevChatPanel {
  static current: KaradevChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly messages: ChatMessage[] = [];
  private readonly disposables: vscode.Disposable[] = [];
  private pendingPrefill: string | null = null;

  static createOrShow(
    context: vscode.ExtensionContext,
    auth: KaradevAuthManager,
    prefill?: string,
  ): KaradevChatPanel {
    if (KaradevChatPanel.current) {
      KaradevChatPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      if (prefill) KaradevChatPanel.current.sendPrefill(prefill);
      return KaradevChatPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      "karadev.chat",
      "Karacter",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
      },
    );
    KaradevChatPanel.current = new KaradevChatPanel(panel, context, auth);
    if (prefill) KaradevChatPanel.current.sendPrefill(prefill);
    return KaradevChatPanel.current;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly auth: KaradevAuthManager,
  ) {
    this.panel = panel;
    const nonce = makeNonce();
    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      context.extensionUri,
      nonce,
    );
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables,
    );

    this.disposables.push(
      auth.onSessionChange(() => this.postSession()),
    );
  }

  sendPrefill(text: string) {
    if (!this.panel.webview) {
      this.pendingPrefill = text;
      return;
    }
    this.panel.webview.postMessage({ type: "prefill", text });
  }

  clear() {
    this.messages.length = 0;
    this.panel.webview.postMessage({ type: "cleared" });
  }

  private postSession() {
    const s = this.auth.getSession();
    this.panel.webview.postMessage({
      type: "session",
      email: s?.email ?? null,
    });
  }

  private async handleMessage(msg: any) {
    switch (msg?.type) {
      case "ready":
        this.postSession();
        if (this.pendingPrefill) {
          this.panel.webview.postMessage({
            type: "prefill",
            text: this.pendingPrefill,
          });
          this.pendingPrefill = null;
        }
        break;
      case "send":
        await runChatExchange(
          { webview: this.panel.webview },
          this.auth,
          this.messages,
          String(msg.text ?? ""),
          !!msg.think,
        );
        break;
      case "clear":
        this.clear();
        break;
    }
  }

  dispose() {
    KaradevChatPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}