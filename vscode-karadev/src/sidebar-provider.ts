import * as vscode from "vscode";
import type { KaradevAuthManager } from "./auth";
import type { ChatMessage } from "./types";
import { getWebviewHtml, makeNonce } from "./webview";
import { runChatExchange } from "./chat-panel";

export class KaradevSidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "karadev.chatView";
  private view: vscode.WebviewView | undefined;
  private readonly messages: ChatMessage[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly auth: KaradevAuthManager,
  ) {
    this.auth.onSessionChange(() => this.postSession());
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };
    const nonce = makeNonce();
    view.webview.html = getWebviewHtml(
      view.webview,
      this.context.extensionUri,
      nonce,
    );
    view.webview.onDidReceiveMessage(async (msg: any) => {
      switch (msg?.type) {
        case "ready":
          this.postSession();
          break;
        case "send":
          await runChatExchange(
            { webview: view.webview },
            this.auth,
            this.messages,
            String(msg.text ?? ""),
            !!msg.think,
          );
          break;
        case "clear":
          this.messages.length = 0;
          view.webview.postMessage({ type: "cleared" });
          break;
      }
    });
  }

  private postSession() {
    if (!this.view) return;
    const s = this.auth.getSession();
    this.view.webview.postMessage({
      type: "session",
      email: s?.email ?? null,
    });
  }
}