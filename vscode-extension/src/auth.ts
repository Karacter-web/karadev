import * as vscode from "vscode";
import type { KaradevSession } from "./types";

const SESSION_KEY = "karadev.session";
const ANON_KEY = "karadev.anonKey";

export class KaradevAuthManager {
  private session: KaradevSession | null = null;
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onSessionChange = this.emitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async init(): Promise<void> {
    const raw = await this.context.secrets.get(SESSION_KEY);
    if (raw) {
      try {
        this.session = JSON.parse(raw) as KaradevSession;
      } catch {
        this.session = null;
        await this.context.secrets.delete(SESSION_KEY);
      }
    }
    this.emitter.fire();
  }

  getSession(): KaradevSession | null {
    return this.session;
  }

  async getSupabaseUrl(prompt = true): Promise<string | undefined> {
    const cfg = vscode.workspace.getConfiguration("karadev");
    let url = (cfg.get<string>("supabaseUrl") ?? "").trim();
    if (!url && prompt) {
      const entered = await vscode.window.showInputBox({
        prompt: "Supabase project URL",
        placeHolder: "https://xxxx.supabase.co",
        ignoreFocusOut: true,
        validateInput: (v) =>
          /^https:\/\/[^/]+\.supabase\.co\/?$/.test(v.trim())
            ? null
            : "Expected https://xxxx.supabase.co",
      });
      if (!entered) return undefined;
      url = entered.trim().replace(/\/$/, "");
      await cfg.update("supabaseUrl", url, vscode.ConfigurationTarget.Global);
    }
    return url.replace(/\/$/, "");
  }

  async getAnonKey(prompt = true): Promise<string | undefined> {
    let key = await this.context.secrets.get(ANON_KEY);
    if (!key && prompt) {
      const entered = await vscode.window.showInputBox({
        prompt: "Supabase anon / public key (stored in encrypted secret storage)",
        password: true,
        ignoreFocusOut: true,
      });
      if (!entered) return undefined;
      key = entered.trim();
      await this.context.secrets.store(ANON_KEY, key);
    }
    return key ?? undefined;
  }

  async signIn(): Promise<void> {
    const supabaseUrl = await this.getSupabaseUrl();
    if (!supabaseUrl) return;
    const anonKey = await this.getAnonKey();
    if (!anonKey) return;

    const email = await vscode.window.showInputBox({
      prompt: "Karadev email",
      ignoreFocusOut: true,
    });
    if (!email) return;
    const password = await vscode.window.showInputBox({
      prompt: "Karadev password",
      password: true,
      ignoreFocusOut: true,
    });
    if (!password) return;

    try {
      const res = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({ email, password }),
        },
      );
      const body = (await res.json()) as any;
      if (!res.ok) {
        const msg =
          body?.error_description || body?.msg || body?.error || "Sign-in failed";
        vscode.window.showErrorMessage(`Karadev sign-in: ${msg}`);
        return;
      }
      const session: KaradevSession = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        email: body.user?.email ?? email,
        userId: body.user?.id ?? "",
        expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000,
      };
      this.session = session;
      await this.context.secrets.store(SESSION_KEY, JSON.stringify(session));
      this.emitter.fire();
      vscode.window.showInformationMessage(`Signed in as ${session.email}`);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Karadev sign-in failed: ${(err as Error).message}`,
      );
    }
  }

  async signOut(): Promise<void> {
    this.session = null;
    await this.context.secrets.delete(SESSION_KEY);
    this.emitter.fire();
    vscode.window.showInformationMessage("Signed out of Karadev");
  }

  async ensureFreshSession(): Promise<KaradevSession | null> {
    if (!this.session) return null;
    const fiveMin = 5 * 60 * 1000;
    if (this.session.expiresAt - Date.now() > fiveMin) return this.session;

    const supabaseUrl = await this.getSupabaseUrl(false);
    const anonKey = await this.getAnonKey(false);
    if (!supabaseUrl || !anonKey) return this.session;

    try {
      const res = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({ refresh_token: this.session.refreshToken }),
        },
      );
      if (!res.ok) {
        // refresh failed — drop session
        await this.signOut();
        return null;
      }
      const body = (await res.json()) as any;
      this.session = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? this.session.refreshToken,
        email: body.user?.email ?? this.session.email,
        userId: body.user?.id ?? this.session.userId,
        expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000,
      };
      await this.context.secrets.store(
        SESSION_KEY,
        JSON.stringify(this.session),
      );
      this.emitter.fire();
      return this.session;
    } catch {
      return this.session;
    }
  }
}