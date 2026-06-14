import * as vscode from "vscode";
import type { EditorContext } from "./types";

export function getEditorContext(): EditorContext | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;
  const doc = editor.document;
  const sel = editor.selection;
  const hasSel = !sel.isEmpty;
  const code = hasSel ? doc.getText(sel) : doc.getText();
  const startLine = hasSel ? sel.start.line + 1 : 1;
  const endLine = hasSel ? sel.end.line + 1 : doc.lineCount;
  return {
    code,
    language: doc.languageId,
    filename: doc.fileName.split(/[\\/]/).pop() ?? doc.fileName,
    lineRange: `L${startLine}-${endLine}`,
  };
}

export function buildRepoContext(): string {
  const cfg = vscode.workspace.getConfiguration("karadev");
  if (!cfg.get<boolean>("includeFileContext", true)) return "";
  const ctx = getEditorContext();
  const ws =
    vscode.workspace.workspaceFolders?.[0]?.name ?? "(no workspace)";
  if (!ctx) return `Workspace: ${ws}`;
  return `File: ${ctx.filename} (${ctx.language}) ${ctx.lineRange} | Workspace: ${ws}`;
}