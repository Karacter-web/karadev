# Collaboration Guide

Thank you for your interest in contributing to Karadev! This document covers how to get involved, open issues, submit pull requests, and communicate effectively with the team.

## Getting Started

1. **Fork the repository** and clone it locally.
2. **Install dependencies**: `bun install`
3. **Create a branch** for your work: `git checkout -b feature/your-feature-name`
4. **Run the dev server**: `bun run dev`

## Development Workflow

### Branches

- `main` — production-ready code
- `feature/*` — new features
- `fix/*` — bug fixes
- `chore/*` — tooling, docs, cleanup

### Commit Messages

Use clear, descriptive commit messages:

```text
feat: add real-time chat subscription
fix: resolve race condition in auth state
chore: update Tailwind to v3.4
```

### Pull Request Process

1. Ensure your branch is up to date with `main`.
2. Open a PR with a clear title and description.
3. Link related issues (e.g., `Closes #123`).
4. Request review from a maintainer.
5. Address feedback promptly.
6. Once approved, a maintainer will merge.

## Reporting Issues

Before opening a new issue:

1. Search existing issues to avoid duplicates.
2. Use the issue templates if available.
3. Provide:
   - A clear description
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots or logs if relevant

## Communication

- **Discussions**: Use GitHub Discussions for questions and ideas.
- **Issues**: Use GitHub Issues for bugs and feature requests.
- **Direct contact**: For security issues, see [SECURITY.md](./SECURITY.md).

## Areas That Need Help

- Improving VS Code extension stability
- Adding more AI model providers
- Better prompt template discoverability
- Documentation and tutorials
- Test coverage

## Code Style

- **TypeScript**: Strict mode enabled; avoid `any`.
- **React**: Functional components + hooks; no class components.
- **Tailwind**: Use utility classes; avoid arbitrary values where possible.
- **Formatting**: Follow the existing ESLint config.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
