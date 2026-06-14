import * as vscode from "vscode";
import { KaradevAuthManager } from "./auth";
import { registerCommands } from "./commands";
import { KaradevSidebarProvider } from "./sidebar-provider";

let statusItem: vscode.StatusBarItem | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const auth = new KaradevAuthManager(context);
  await auth.init();

  registerCommands(context, auth);

  const sidebar = new KaradevSidebarProvider(context, auth);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      KaradevSidebarProvider.viewType,
      sidebar,
    ),
  );

  statusItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(statusItem);
  updateStatus(auth);
  context.subscriptions.push(auth.onSessionChange(() => updateStatus(auth)));
}

function updateStatus(auth: KaradevAuthManager) {
  if (!statusItem) return;
  const s = auth.getSession();
  if (s) {
    statusItem.text = "$(robot) Karacter";
    statusItem.tooltip = `Signed in as ${s.email}`;
    statusItem.command = "karadev.openChat";
    statusItem.backgroundColor = undefined;
  } else {
    statusItem.text = "$(robot) Sign in to Karadev";
    statusItem.tooltip = "Sign in to Karadev";
    statusItem.command = "karadev.signIn";
    statusItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  }
  statusItem.show();
}

export function deactivate() {
  statusItem?.dispose();
}