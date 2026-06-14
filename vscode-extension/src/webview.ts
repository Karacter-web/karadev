import * as vscode from "vscode";

export function makeNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++)
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string,
): string {
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "chat.css"),
  );
  const csp = [
    "default-src 'none'",
    `style-src 'nonce-${nonce}' ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
    "connect-src https://*.supabase.co https://openrouter.ai",
    "img-src 'self' data: https:",
    `font-src ${webview.cspSource}`,
  ].join("; ");

  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<link rel="stylesheet" href="${cssUri}" nonce="${nonce}" />
<title>Karacter</title>
</head>
<body>
  <header class="kd-header">
    <div class="kd-title">🤖 Karacter</div>
    <div class="kd-email" id="kd-email"></div>
    <button class="kd-icon-btn" id="kd-clear" title="Clear conversation">🗑</button>
  </header>

  <div class="kd-error" id="kd-error" hidden>
    <span id="kd-error-text"></span>
    <button class="kd-icon-btn" id="kd-error-close" title="Dismiss">×</button>
  </div>

  <main class="kd-messages" id="kd-messages">
    <div class="kd-empty" id="kd-empty">Ask Karacter anything about your code…</div>
  </main>

  <div class="kd-toolbar">
    <label class="kd-checkbox">
      <input type="checkbox" id="kd-think" />
      <span>Deep thinking</span>
    </label>
    <span class="kd-count" id="kd-count" hidden>0</span>
  </div>

  <form class="kd-composer" id="kd-form">
    <textarea
      id="kd-input"
      rows="1"
      placeholder="Message Karacter… (Shift+Enter for newline)"
    ></textarea>
    <button type="submit" id="kd-send" class="kd-send">Send</button>
  </form>

<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  const messagesEl = document.getElementById("kd-messages");
  const emptyEl = document.getElementById("kd-empty");
  const emailEl = document.getElementById("kd-email");
  const errorEl = document.getElementById("kd-error");
  const errorText = document.getElementById("kd-error-text");
  const errorClose = document.getElementById("kd-error-close");
  const clearBtn = document.getElementById("kd-clear");
  const form = document.getElementById("kd-form");
  const input = document.getElementById("kd-input");
  const sendBtn = document.getElementById("kd-send");
  const thinkEl = document.getElementById("kd-think");
  const countEl = document.getElementById("kd-count");

  let currentAssistantEl = null;
  let currentAssistantBuffer = "";
  let typingEl = null;

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function renderMarkdown(src) {
    // Fenced code blocks first
    const parts = [];
    let last = 0;
    const re = /\`\`\`([\\w-]*)\\n([\\s\\S]*?)\`\`\`/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) parts.push({ type: "text", value: src.slice(last, m.index) });
      parts.push({ type: "code", lang: m[1] || "", value: m[2] });
      last = m.index + m[0].length;
    }
    if (last < src.length) parts.push({ type: "text", value: src.slice(last) });

    return parts.map((p) => {
      if (p.type === "code") {
        const lang = escapeHtml(p.lang || "text");
        const code = escapeHtml(p.value);
        return '<div class="kd-code"><div class="kd-code-bar"><span>' + lang +
          '</span><button class="kd-copy" data-copy="' + encodeURIComponent(p.value) +
          '">Copy</button></div><pre><code>' + code + '</code></pre></div>';
      }
      let t = escapeHtml(p.value);
      t = t.replace(/\`([^\`\\n]+)\`/g, '<code class="kd-inline">$1</code>');
      t = t.replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>");
      t = t.replace(/(^|[^*])\\*([^*\\n]+)\\*/g, "$1<em>$2</em>");
      t = t.replace(/\\n/g, "<br/>");
      return t;
    }).join("");
  }

  function bindCopy(scope) {
    scope.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const txt = decodeURIComponent(btn.getAttribute("data-copy") || "");
        navigator.clipboard.writeText(txt).then(() => {
          const old = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = old; }, 1200);
        });
      });
    });
  }

  function hideEmpty() { if (emptyEl) emptyEl.style.display = "none"; }

  function addUserMessage(text) {
    hideEmpty();
    const div = document.createElement("div");
    div.className = "kd-msg kd-user";
    div.innerHTML = renderMarkdown(text);
    messagesEl.appendChild(div);
    bindCopy(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function startAssistant() {
    hideEmpty();
    currentAssistantBuffer = "";
    currentAssistantEl = document.createElement("div");
    currentAssistantEl.className = "kd-msg kd-assistant";
    currentAssistantEl.innerHTML = "";
    messagesEl.appendChild(currentAssistantEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendToken(t) {
    if (!currentAssistantEl) startAssistant();
    currentAssistantBuffer += t;
    currentAssistantEl.innerHTML = renderMarkdown(currentAssistantBuffer);
    bindCopy(currentAssistantEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function finishAssistant() {
    currentAssistantEl = null;
    currentAssistantBuffer = "";
    removeTyping();
    sendBtn.disabled = false;
    input.disabled = false;
  }

  function showTyping(active) {
    removeTyping();
    if (!active) return;
    hideEmpty();
    typingEl = document.createElement("div");
    typingEl.className = "kd-msg kd-assistant kd-typing";
    typingEl.innerHTML = '<span class="kd-dot"></span><span class="kd-dot"></span><span class="kd-dot"></span>';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(120, input.scrollHeight) + "px";
    const len = input.value.length;
    if (len > 500) {
      countEl.hidden = false;
      countEl.textContent = len + " chars";
    } else {
      countEl.hidden = true;
    }
  }

  input.addEventListener("input", autoResize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    input.disabled = true;
    vscode.postMessage({ type: "send", text, think: thinkEl.checked });
    input.value = "";
    autoResize();
  });

  clearBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "clear" });
  });

  errorClose.addEventListener("click", () => { errorEl.hidden = true; });

  window.addEventListener("message", (e) => {
    const m = e.data;
    switch (m.type) {
      case "session":
        emailEl.textContent = m.email || "(signed out)";
        break;
      case "userMessage":
        addUserMessage(m.text);
        break;
      case "thinking":
        showTyping(!!m.active);
        break;
      case "assistantStart":
        removeTyping();
        startAssistant();
        break;
      case "token":
        appendToken(m.text);
        break;
      case "assistantDone":
        finishAssistant();
        break;
      case "error":
        finishAssistant();
        errorEl.hidden = false;
        errorText.textContent = m.text + (m.detail ? " — " + m.detail : "");
        break;
      case "cleared":
        messagesEl.innerHTML = "";
        messagesEl.appendChild(emptyEl);
        emptyEl.style.display = "";
        break;
      case "prefill":
        input.value = m.text;
        autoResize();
        input.focus();
        break;
      case "limitWarning":
        errorEl.hidden = false;
        errorText.textContent = "Approaching daily limit: " + m.used + " / " + m.limit;
        break;
    }
  });

  vscode.postMessage({ type: "ready" });
})();
</script>
</body>
</html>`;
}