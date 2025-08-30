# Docker Testing Environment

This project includes a Docker-based testing environment that provides clean, isolated test runs with fresh git repositories. This is especially important for testing git operations and CRUD functionality.

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- PowerShell (Windows) or Bash (Linux/macOS)

### Running Tests

**Windows (PowerShell):**
```powershell
# Run all tests in clean environment
.\scripts\test.ps1 all

# Run just CRUD tests
.\scripts\test.ps1 crud

# Run git integration tests
.\scripts\test.ps1 git

# Start test watcher
.\scripts\test.ps1 watch

# Debug with interactive shell
.\scripts\test.ps1 shell
```

**Linux/macOS (Bash):**
```bash
# Make script executable
chmod +x scripts/test.sh

# Run all tests in clean environment
./scripts/test.sh all

# Run just CRUD tests  
./scripts/test.sh crud

# Run git integration tests
./scripts/test.sh git

# Start test watcher
./scripts/test.sh watch

# Debug with interactive shell
./scripts/test.sh shell
```

### Direct Docker Commands

You can also use Docker Compose directly:

```bash
# Build test environment
docker-compose -f docker-compose.test.yml build

# Run all tests
docker-compose -f docker-compose.test.yml run --rm test-runner

# Run specific test file
docker-compose -f docker-compose.test.yml run --rm test-runner npx vitest run test/script-crud.test.ts

# Interactive debugging shell
docker-compose -f docker-compose.test.yml run --rm test-shell
```

### NPM Scripts

The following NPM scripts are available for Docker testing:

```bash
# Run all tests in Docker
npm run test:docker

# Run CRUD tests specifically  
npm run test:docker:crud

# Start test watcher
npm run test:docker:watch

# Open debug shell
npm run test:docker:shell

# Build Docker images
npm run test:docker:build
```

## Why Docker for Testing?

### Benefits

1. **Clean Git Environment**: Each test run starts with a fresh git repository
2. **Consistent Environment**: Same Node.js version, git configuration, and dependencies
3. **Isolation**: Tests don't interfere with your local git repository
4. **Reproducible**: Tests run the same way in CI/CD and locally
5. **Easy Cleanup**: No leftover test files or git commits in your workspace

### Test Environment Features

- **Fresh Git Repo**: Each container starts with a clean git repository initialized with the current code
- **Configured Git User**: Pre-configured git user for commit operations
- **Volume Mounting**: Source code changes are reflected immediately during development
- **Multiple Services**: Separate services for different testing scenarios

## Troubleshooting

### Common Issues

**Docker not found:**
- Install Docker Desktop and ensure it's running
- On Windows, make sure you're using PowerShell, not Command Prompt

**Permission denied on scripts:**
- Linux/macOS: Run `chmod +x scripts/test.sh`
- Windows: Make sure PowerShell execution policy allows scripts

**Tests failing in Docker but not locally:**
- Check that all dependencies are in package.json (not just devDependencies)
- Ensure test doesn't rely on local file system paths
- Verify git operations work in isolated environment

### Debug Shell

Use the debug shell to investigate test failures:

```bash
# Open interactive shell in test environment
npm run test:docker:shell

# Inside the container, you can:
git status                    # Check git state
ls -la scripts/              # Inspect file structure  
npm test                     # Run tests manually
npx vitest run test/script-crud.test.ts --reporter=verbose
```

## Development Workflow

1. **Write Tests**: Develop tests locally using regular `npm test`
2. **Validate in Docker**: Run `npm run test:docker:crud` to ensure clean environment compatibility
3. **Debug Issues**: Use `npm run test:docker:shell` for investigation
4. **CI/CD Ready**: Docker tests can be used in CI pipelines for consistent results