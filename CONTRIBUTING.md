# Contributing to OpenCode Branch Memory Manager

Thank you for your interest in contributing! This document provides guidelines for contributing.

## 🚀 Getting Started

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Install dependencies: `cd .opencode && bun install`
4. Make your changes
5. Run tests: `bun test`
6. Submit a pull request

## 🧪 Running Tests

```bash
# Run all tests
bun test

# Run tests for a specific file
bun test tests/config.test.ts

# Run tests in watch mode
bun test --watch
```

## 📁 Project Structure

```
.opencode/
├── tool/              # User-facing tools
├── plugin/            # Plugin hooks
└── branch-memory/
    ├── index.ts     # Main exports
    ├── storage.ts   # Context persistence
    ├── git.ts       # Git operations
    ├── monitor.ts    # Branch monitoring
    ├── collector.ts  # Context collection
    ├── injector.ts   # Context injection
    ├── types.ts      # TypeScript types
    └── config.ts     # Configuration
```

## 🔧 Development Guidelines

### Code Style

- Use TypeScript for type safety
- Follow existing naming conventions
- Add JSDoc comments to public APIs
- Write tests for new functionality
- Keep functions focused and single-purpose

### Commit Messages

Follow conventional commits:
```
feat: add XYZ feature
fix: fix ABC bug
docs: update README
refactor: restructure XYZ
test: add tests for XYZ
chore: clean up temporary files
```

### Adding New Features

1. Update types in `.opencode/branch-memory/types.ts`
2. Implement the feature in the appropriate module
3. Add tests for the new functionality
4. Update README with new feature documentation
5. Update CHANGELOG.md with version and changes

### Error Handling

- Always handle errors gracefully
- Provide user-friendly error messages
- Log errors with helpful context
- Degrade gracefully when features fail

## 📝 Testing

Write tests for:
- All public methods
- Error conditions
- Edge cases (non-git repo, corrupted files, etc.)
- Cross-platform compatibility

Test coverage goal: 80%+

## 🐛 Bug Reports

When reporting bugs, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Environment (OS, Node.js version, git version)
5. Configuration used
6. Relevant logs

## 💡 Feature Requests

Before proposing a feature:
1. Check existing issues to avoid duplicates
2. Explain the use case clearly
3. Consider if it fits the project scope
4. Propose implementation approach
5. Discuss trade-offs

---

Thank you for contributing to OpenCode Branch Memory Manager! 🎉
