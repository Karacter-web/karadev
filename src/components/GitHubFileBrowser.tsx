import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Folder, FileText, ChevronRight, ChevronLeft, Loader2,
  FileCode, File, ArrowLeft, Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { githubHeaders } from "@/lib/github-token";

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  sha: string;
  download_url?: string;
}

interface Props {
  repoFullName: string;
  defaultBranch?: string;
  onClose: () => void;
}

const EXT_ICONS: Record<string, typeof FileText> = {
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
  py: FileCode, rs: FileCode, go: FileCode, rb: FileCode,
  css: FileCode, html: FileCode, json: FileCode, md: FileText,
};

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return EXT_ICONS[ext] || File;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GitHubFileBrowser({ repoFullName, defaultBranch = "main", onClose }: Props) {
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContents = async (path: string) => {
    setLoading(true);
    setError(null);
    setFileContent(null);
    setViewingFile(null);
    try {
      const url = `https://api.github.com/repos/${repoFullName}/contents/${path}?ref=${defaultBranch}`;
      const res = await fetch(url, { headers: githubHeaders() });
      if (!res.ok) throw new Error(res.status === 403 ? "GitHub API rate limit reached. Try again later." : `Failed to fetch: ${res.statusText}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const sorted = data.sort((a: GitHubFile, b: GitHubFile) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sorted);
        setCurrentPath(path);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFileContent = async (file: GitHubFile) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.github.com/repos/${repoFullName}/contents/${file.path}?ref=${defaultBranch}`;
      const res = await fetch(url, { headers: githubHeaders() });
      if (!res.ok) throw new Error("Failed to fetch file");
      const data = await res.json();
      if (data.encoding === "base64" && data.content) {
        setFileContent(atob(data.content));
        setViewingFile(file.path);
      } else if (data.download_url) {
        const textRes = await fetch(data.download_url);
        setFileContent(await textRes.text());
        setViewingFile(file.path);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContents("");
  }, [repoFullName]);

  const pathParts = currentPath ? currentPath.split("/") : [];

  const goUp = () => {
    if (viewingFile) {
      setViewingFile(null);
      setFileContent(null);
      return;
    }
    const parts = currentPath.split("/");
    parts.pop();
    fetchContents(parts.join("/"));
  };

  const handleClick = (file: GitHubFile) => {
    if (file.type === "dir") {
      fetchContents(file.path);
    } else {
      const sizeLimit = 500 * 1024; // 500KB
      if (file.size && file.size > sizeLimit) {
        setError("File too large to preview in browser");
        return;
      }
      fetchFileContent(file);
    }
  };

  return (
    <Card className="flex flex-col h-[70vh] max-h-[600px]">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode className="h-4 w-4 text-primary" />
            <span className="truncate">{repoFullName}</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap mt-1">
          <button onClick={() => { setViewingFile(null); setFileContent(null); fetchContents(""); }} className="hover:text-foreground transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" /> root
          </button>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => {
                  setViewingFile(null);
                  setFileContent(null);
                  fetchContents(pathParts.slice(0, i + 1).join("/"));
                }}
                className="hover:text-foreground transition-colors"
              >
                {part}
              </button>
            </span>
          ))}
          {viewingFile && (
            <span className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{viewingFile.split("/").pop()}</span>
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchContents(currentPath)}>Retry</Button>
          </div>
        )}

        {!loading && !error && viewingFile && fileContent !== null && (
          <div className="flex flex-col h-full">
            <div className="px-4 py-2 border-b flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={goUp} className="h-7 px-2">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
              <Badge variant="outline" className="text-xs">{viewingFile.split(".").pop()?.toUpperCase()}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <pre className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all text-foreground">
                {fileContent}
              </pre>
            </ScrollArea>
          </div>
        )}

        {!loading && !error && !viewingFile && (
          <ScrollArea className="h-full">
            {(currentPath || viewingFile) && (
              <button
                onClick={goUp}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-muted-foreground border-b"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>..</span>
              </button>
            )}
            {files.map((file) => {
              const Icon = file.type === "dir" ? Folder : getFileIcon(file.name);
              return (
                <button
                  key={file.sha}
                  onClick={() => handleClick(file)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left border-b border-border/30"
                >
                  <Icon className={cn(
                    "h-4 w-4 shrink-0",
                    file.type === "dir" ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="flex-1 truncate">{file.name}</span>
                  {file.type === "file" && file.size !== undefined && (
                    <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                  )}
                  {file.type === "dir" && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
              );
            })}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}