import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { Send, Bot, User, Loader2, Sparkles, Brain, Plus, MessageSquare, Trash2, Search, Download, X, GitBranch, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchRepoSnapshot, hasGitHubToken } from "@/lib/github-token";
import { branding, buildDevIdeUrl } from "@/config/branding";
import { MessageSquareCode, Code2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  workspace_id: string;
};

export default function Chat() {
  const { user, session } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspace");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [deepThink, setDeepThink] = useState(true);
  const [defaultWsId, setDefaultWsId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [repoContext, setRepoContext] = useState<string | null>(null);
  const [connectedRepos, setConnectedRepos] = useState<{ full_name: string; branch: string }[]>([]);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [syncingRepo, setSyncingRepo] = useState(false);
  const [mode, setMode] = useState<"chat" | "dev">(() => {
    if (typeof window === "undefined") return "chat";
    return (localStorage.getItem("karadev:mode") as "chat" | "dev") || "chat";
  });
  const [devSessionId] = useState<string>(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    let id = localStorage.getItem("karadev:dev-session");
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("karadev:dev-session", id);
    }
    return id;
  });
  useEffect(() => {
    try { localStorage.setItem("karadev:mode", mode); } catch { /* noop */ }
  }, [mode]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const effectiveWsId = workspaceId || defaultWsId;

  // Fetch default workspace if none specified
  useEffect(() => {
    if (workspaceId || !user) return;
    supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setDefaultWsId(data.workspace_id);
      });
  }, [workspaceId, user]);

  // Fetch connected repos for the workspace
  useEffect(() => {
    if (!effectiveWsId) return;
    (async () => {
      const { data: repos } = await supabase
        .from("repositories")
        .select("github_repo_full_name, default_branch")
        .eq("workspace_id", effectiveWsId);
      if (!repos?.length) {
        setConnectedRepos([]);
        setActiveRepo(null);
        setRepoContext(null);
        return;
      }
      const mapped = repos.map((r) => ({
        full_name: r.github_repo_full_name,
        branch: r.default_branch || "main",
      }));
      setConnectedRepos(mapped);
      // Default to first repo if none selected yet
      setActiveRepo((prev) => prev ?? mapped[0].full_name);
    })();
  }, [effectiveWsId]);

  // Sync (fetch tree + manifests + README) for the currently selected repo
  const syncRepoContext = useCallback(async () => {
    if (!activeRepo) return;
    const repo = connectedRepos.find((r) => r.full_name === activeRepo);
    if (!repo) return;
    if (!hasGitHubToken()) {
      setRepoContext(
        `Connected repos: ${connectedRepos
          .map((r) => r.full_name)
          .join(", ")} (no GitHub token configured — add a PAT in Repos to enable deep sync)`
      );
      return;
    }
    setSyncingRepo(true);
    const snap = await fetchRepoSnapshot(repo.full_name, repo.branch);
    setRepoContext(
      snap ?? `Connected repo: ${repo.full_name} (sync failed — check token/permissions)`
    );
    setSyncingRepo(false);
  }, [activeRepo, connectedRepos]);

  // Auto-sync whenever the active repo changes
  useEffect(() => {
    syncRepoContext();
  }, [syncRepoContext]);

  // Fetch conversations for workspace
  const fetchConversations = useCallback(async () => {
    if (!effectiveWsId) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, title, created_at, workspace_id")
      .eq("workspace_id", effectiveWsId)
      .order("updated_at", { ascending: false });
    setConversations(data || []);
  }, [effectiveWsId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", activeConvId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    })();
  }, [activeConvId]);

  // Realtime: append messages inserted by other users (or other tabs) live
  useEffect(() => {
    if (!activeConvId || !user) return;
    const channel = supabase
      .channel(`messages:${activeConvId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConvId}`,
        },
        (payload) => {
          const row = payload.new as { role: string; content: string; user_id: string | null };
          // Skip messages this user just sent — they're already optimistic in state
          if (row.user_id === user.id) return;
          setMessages((prev) => {
            // Avoid duplicates if same content/role is already the last entry
            const last = prev[prev.length - 1];
            if (last && last.role === row.role && last.content === row.content) return prev;
            return [...prev, { role: row.role as "user" | "assistant", content: row.content }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConvId, user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const saveMessage = async (convId: string, role: string, content: string) => {
    await supabase.from("messages").insert({
      conversation_id: convId,
      role,
      content,
      user_id: role === "user" ? user?.id : null,
    });
  };

  const createConversation = async (firstMessage: string): Promise<string | null> => {
    if (!effectiveWsId || !user) return null;
    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "");
    const { data, error } = await supabase
      .from("conversations")
      .insert({ workspace_id: effectiveWsId, user_id: user.id, title })
      .select("id")
      .single();
    if (error) {
      console.error("Failed to create conversation:", error);
      return null;
    }
    return data.id;
  };

  const newChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    if (activeConvId === id) newChat();
    fetchConversations();
  };

  // Search conversations
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Export conversation as markdown
  const exportConversation = () => {
    if (!messages.length) return;
    const activeConv = conversations.find((c) => c.id === activeConvId);
    const title = activeConv?.title || "conversation";
    const md = messages
      .map((m) => `## ${m.role === "user" ? "You" : "DevAgent"}\n\n${m.content}`)
      .join("\n\n---\n\n");
    const header = `# ${title}\n\nExported on ${new Date().toLocaleString()}\n\n---\n\n`;
    const blob = new Blob([header + md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported!", description: "Conversation downloaded as markdown." });
  };

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setIsThinking(deepThink);

    let convId = activeConvId;
    if (!convId) {
      convId = await createConversation(userMsg.content);
      if (!convId) {
        toast({ title: "Error", description: "Could not create conversation", variant: "destructive" });
        setIsLoading(false);
        setIsThinking(false);
        return;
      }
      setActiveConvId(convId);
      fetchConversations();
    }

    await saveMessage(convId, "user", userMsg.content);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, think: deepThink, repoContext }),
      });

      if (resp.status === 429) {
        const body = await resp.json().catch(() => ({}));
        toast({ title: "Rate limited", description: body.detail || body.error || "Too many requests. Please wait a moment.", variant: "destructive" });
        setIsLoading(false);
        setIsThinking(false);
        return;
      }
      if (resp.status === 402) {
        const body = await resp.json().catch(() => ({}));
        toast({ title: "Credits needed", description: body.detail || body.error || "Please add credits to continue.", variant: "destructive" });
        setIsLoading(false);
        setIsThinking(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Failed to start stream");

      setIsThinking(false);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantSoFar) {
        await saveMessage(convId, "assistant", assistantSoFar);
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar — conversation history */}
      <div className="hidden md:flex flex-col w-64 border-r bg-muted/30">
        <div className="p-3 border-b space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={newChat}>
            <Plus className="h-4 w-4" /> New Chat
          </Button>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
              className="pl-8 h-8 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                activeConvId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              )}
              onClick={() => setActiveConvId(c.id)}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {filteredConversations.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              {searchQuery ? "No matching conversations" : "No conversations yet"}
            </p>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-sm sm:text-base truncate">DevAgent</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {connectedRepos.length > 0
                  ? <span className="flex items-center gap-1"><GitBranch className="h-3 w-3 text-primary inline" /> {syncingRepo ? "Syncing…" : `Synced with ${activeRepo}`}</span>
                  : "Context-aware AI development assistant"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connectedRepos.length > 0 && (
              <>
                <Select value={activeRepo ?? undefined} onValueChange={setActiveRepo}>
                  <SelectTrigger className="h-8 w-[160px] sm:w-[220px] text-xs">
                    <SelectValue placeholder="Select repo" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedRepos.map((r) => (
                      <SelectItem key={r.full_name} value={r.full_name} className="text-xs">
                        {r.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={syncRepoContext}
                  disabled={syncingRepo}
                  title="Re-sync repo context"
                >
                  <RefreshCw className={cn("h-4 w-4", syncingRepo && "animate-spin")} />
                </Button>
              </>
            )}
            {/* Export button */}
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={exportConversation} title="Export as Markdown">
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" className="md:hidden" onClick={newChat}>
              <Plus className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setDeepThink(!deepThink)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0",
                deepThink ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              title="Toggle deep analysis mode"
            >
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Deep Think</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground px-4">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div>
                <p className="font-display font-semibold text-foreground text-base sm:text-lg">DevAgent Ready</p>
                <p className="text-xs sm:text-sm mt-1 max-w-sm">Ask about your codebase, generate code, debug issues, or get architecture advice.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md mt-2">
                {[
                  "Explain the database schema",
                  "Write a React component for...",
                  "How do I add auth to a page?",
                  "Review this code for issues",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2 sm:gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
                </div>
              )}
              <div className={cn(
                "rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md max-w-[85%] sm:max-w-[75%]"
                  : "bg-muted rounded-bl-md max-w-[90%] sm:max-w-[80%]"
              )}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all [&_pre]:text-xs">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                  <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-2 sm:gap-3">
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Brain className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Analyzing request...</span>
                </div>
              </div>
            </div>
          )}

          {isLoading && !isThinking && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2 sm:gap-3">
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 sm:p-4 border-t">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 max-w-4xl mx-auto items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Ask DevAgent anything..."
              className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] max-h-[120px]"
              disabled={isLoading}
              rows={1}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon" className="shrink-0 h-10 w-10">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            {deepThink ? "Deep Think ON — AI analyzes before responding" : "Shift+Enter for new line"}
          </p>
        </div>
      </div>
    </div>
  );
}
