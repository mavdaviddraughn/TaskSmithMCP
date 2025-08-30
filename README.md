# TaskSmith MCP

A production-grade MCP server that enables repeatable command execution, script persistence, audit trails, and lifecycle management across Windows (PowerShell/CMD) and Linux/macOS (Bash/Zsh).

## Features

- **Save & reuse scripts** with sensible filenames in-repo
- **Auto-commit** any script add/update/delete and create annotated tags
- **TTL (time-to-live)** per script with automatic expiry
- **Run history & outputs** with browsing and search capabilities
- **CWD-independent execution** with proper repo root resolution
- **Security hardening** with allowlists, prechecks, dry-run mode
- **CLI wrapper support** for scripts to run independently

## Project Structure

```
scripts/                    # Source of truth for scripts
├── pwsh/*.ps1              # Windows-friendly PowerShell scripts  
├── bash/*.sh               # Linux/macOS bash scripts
└── meta/scripts.json       # Registry metadata

.tasksmith/                 # Internal data
├── runs/YYYY/MM/DD/        # Run history by date
│   ├── <runId>.json        # Run metadata
│   └── <runId>.log         # Full combined logs
└── config.json             # Server settings per repo
```

## Installation

```bash
npm install -g tasksmith-mcp
```

## Configuration

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "tasksmith": {
      "command": "node",
      "args": ["./node_modules/tasksmith-mcp/dist/index.js"],
      "env": {
        "TASKSMITH_DEFAULT_TTL": "604800",
        "TASKSMITH_DOCKER_SANDBOX": "false"
      }
    }
  }
}
```

## Development

This project is currently under development. See the implementation roadmap in the project proposal.