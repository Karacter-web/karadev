import * as vscode from "vscode";
import type { KaradevAuthManager } from "./auth";
import { KaradevChatPanel } from "./chat-panel";
import { getEditorContext } from "./context";

function buildPrefill(prefix: string): string | null {
  const ctx = getEditorContext();
  if (!ctx || !ctx.code.trim()) {
    vscode.window.showWarningMessage("Select some code first");
    return null;
  }
  return `${prefix}\n\n\`\`\`${ctx.language}\n// ${ctx.filename}\n${ctx.code}\n\`\`\``;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  auth: KaradevAuthManager,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("karadev.openChat", () => {
      KaradevChatPanel.createOrShow(context, auth);
    }),
    vscode.commands.registerCommand("karadev.signIn", () => auth.signIn()),
    vscode.commands.registerCommand("karadev.signOut", () => auth.signOut()),
    vscode.commands.registerCommand("karadev.clearChat", () => {
      KaradevChatPanel.current?.clear();
    }),
    vscode.commands.registerCommand("karadev.askWithSelection", () => {
      const text = buildPrefill("Ask about the selected code:");
      if (text) KaradevChatPanel.createOrShow(context, auth, text);
    }),
    vscode.commands.registerCommand("karadev.explainSelection", () => {
      const text = buildPrefill("Explain this code in plain English:");
      if (text) KaradevChatPanel.createOrShow(context, auth, text);
    }),
    vscode.commands.registerCommand("karadev.fixSelection", () => {
      const text = buildPrefill(
        "Find and fix any bugs or issues in this code:",
      );
      if (text) KaradevChatPanel.createOrShow(context, auth, text);
    }),
  );
}