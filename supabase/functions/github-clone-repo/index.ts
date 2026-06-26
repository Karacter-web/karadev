// Mirror-clone a repo: enumerate source tree via GitHub API, create destination repo under the app installation,
// then push all files as a single initial commit using the Git Data API.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { getInstallationToken, getInstallationOwner, ghHeaders, requireAdmin } from '../_shared/github-app.ts';

function parseRepoUrl(u: string): { owner: string; repo: string } {
  const m = u.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/);
  if (!m) throw new Error('invalid GitHub URL');
  return { owner: m[1], repo: m[2] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    await requireAdmin(req);
    const { repoUrl, newName } = await req.json();
    if (!repoUrl) return j({ error: 'repoUrl required' }, 400);
    const src = parseRepoUrl(repoUrl);

    const token = await getInstallationToken();
    const headers = ghHeaders(token);

    // Fetch source repo metadata (uses installation token; falls back to unauth for public).
    const metaRes = await fetch(`https://api.github.com/repos/${src.owner}/${src.repo}`, { headers });
    if (!metaRes.ok) return j({ error: `Source lookup: ${metaRes.status} ${await metaRes.text()}` }, metaRes.status);
    const meta = await metaRes.json();
    const branch = meta.default_branch || 'main';

    // Source tree (recursive)
    const treeRes = await fetch(`https://api.github.com/repos/${src.owner}/${src.repo}/git/trees/${branch}?recursive=1`, { headers });
    if (!treeRes.ok) return j({ error: `Tree: ${treeRes.status} ${await treeRes.text()}` }, treeRes.status);
    const tree = await treeRes.json();
    const blobs = (tree.tree as any[]).filter((n) => n.type === 'blob').slice(0, 500); // cap

    // Read blob contents
    const files: { path: string; content: string; encoding: string }[] = [];
    for (const b of blobs) {
      const r = await fetch(`https://api.github.com/repos/${src.owner}/${src.repo}/git/blobs/${b.sha}`, { headers });
      if (!r.ok) continue;
      const bj = await r.json();
      files.push({ path: b.path, content: bj.content, encoding: bj.encoding });
    }

    // Create destination repo
    const owner = await getInstallationOwner();
    const destName = (newName || `${src.repo}-clone-${Date.now().toString(36)}`).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
    const createUrl = owner.type === 'Organization' ? `https://api.github.com/orgs/${owner.login}/repos` : `https://api.github.com/user/repos`;
    const createRes = await fetch(createUrl, {
      method: 'POST', headers,
      body: JSON.stringify({ name: destName, description: `Clone of ${src.owner}/${src.repo}`, private: meta.private, auto_init: true }),
    });
    if (!createRes.ok) return j({ error: `Create: ${createRes.status} ${await createRes.text()}` }, createRes.status);
    const newRepo = await createRes.json();
    const destBranch = newRepo.default_branch || 'main';

    // Push files
    const refRes = await fetch(`https://api.github.com/repos/${owner.login}/${destName}/git/ref/heads/${destBranch}`, { headers });
    const ref = await refRes.json();
    const baseSha = ref.object.sha;
    const baseCommit = await (await fetch(`https://api.github.com/repos/${owner.login}/${destName}/git/commits/${baseSha}`, { headers })).json();

    const created: { path: string; sha: string }[] = [];
    for (const f of files) {
      const b = await fetch(`https://api.github.com/repos/${owner.login}/${destName}/git/blobs`, {
        method: 'POST', headers,
        body: JSON.stringify({ content: f.content.replace(/\n/g, ''), encoding: 'base64' }),
      });
      if (!b.ok) continue;
      created.push({ path: f.path, sha: (await b.json()).sha });
    }

    const newTree = await (await fetch(`https://api.github.com/repos/${owner.login}/${destName}/git/trees`, {
      method: 'POST', headers,
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: created.map((c) => ({ path: c.path, mode: '100644', type: 'blob', sha: c.sha })) }),
    })).json();

    const commit = await (await fetch(`https://api.github.com/repos/${owner.login}/${destName}/git/commits`, {
      method: 'POST', headers,
      body: JSON.stringify({ message: `chore: clone from ${src.owner}/${src.repo}`, tree: newTree.sha, parents: [baseSha] }),
    })).json();

    await fetch(`https://api.github.com/repos/${owner.login}/${destName}/git/refs/heads/${destBranch}`, {
      method: 'PATCH', headers, body: JSON.stringify({ sha: commit.sha }),
    });

    return j({ clonedRepoUrl: newRepo.html_url, clonedRepoName: `${owner.login}/${destName}`, files_count: created.length });
  } catch (e: any) {
    return j({ error: e?.message ?? String(e) }, e?.status ?? 500);
  }
});