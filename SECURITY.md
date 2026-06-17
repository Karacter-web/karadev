# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Karadev, please report it responsibly.

**Do not open a public issue.**

Instead, email **security@karacterhub.xyz** with:

- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and provide a resolution timeline within 5 business days.

## Security Practices

- **Row-Level Security (RLS)** is enforced on all Supabase tables.
- **API keys are hashed** with SHA-256 before storage; only prefixes are visible in the UI.
- **No secrets are committed** to the repository.
- **CSP headers** are configured via `vercel.json` to mitigate XSS.
- **JWT tokens** are handled by Supabase Auth; we never store raw passwords.
- **GitHub tokens** are stored in Supabase auth metadata, not localStorage.

## Scope

This policy covers:
- The Karadev web application (`dev.karacterhub.xyz`, `karadev-delta.vercel.app`)
- The Supabase backend (edge functions, database)
- The VS Code extension (`vscode-extension/`)

## Acknowledgments

We will publicly acknowledge reporters who responsibly disclose vulnerabilities (with their permission).
