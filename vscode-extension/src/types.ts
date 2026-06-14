export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EditorContext {
  code: string;
  language: string;
  filename: string;
  lineRange: string;
}

export interface KaradevSession {
  accessToken: string;
  refreshToken: string;
  email: string;
  userId: string;
  expiresAt: number;
}