# TaskSmith MCP Future Features Catalog

This file contains an extended catalog of future feature tasks based on user requirements. These tasks expand upon the existing TASKS.md with advanced functionality for tags, lifecycle management, run output search, secrets management, and more.

## Task File Guidelines

### Formatting Rules
- **Task ID**: `T###` - 3-digit zero-padded unique identifier (continue from T108+)
- **Status**: `[ ]` not started, `[>]` in progress, `[x]` completed
- **Hierarchy**: Max 3 levels deep using indentation (2 spaces per level)
- **Dependencies**: Use `depends: T###` to specify blocking tasks
- **Completion**: Mark `[x]` when done, delete before committing completion changes

### Task Categories
- **CORE**: Core functionality and architecture
- **FEAT**: New features and enhancements  
- **SEC**: Security-related tasks
- **TEST**: Testing and validation
- **DOCS**: Documentation and guides
- **INFRA**: Infrastructure and tooling

### Commit Message Guidelines
- **Reference Task IDs**: Include relevant task IDs from TASKS.md or TASKS-OVERFLOW.md in commit messages
- **Format**: Use format like `feat(T001): implement script registry system` or `fix(T045): resolve output buffer memory leak`
- **Multiple Tasks**: For commits affecting multiple tasks, list them: `feat(T001,T002): add registry with validation`
- **Non-task commits**: Use standard conventional commit format without task IDs for maintenance, refactoring, or documentation-only changes

---

## Extended Feature Tasks (Starting T109+)

### Registry Schema v2 & Version Management

### T109 [ ] CORE: Implement registry schema v2 migration system
Upgrade registry to support new fields and versioning system (depends: T008)
  ### T110 [ ] CORE: Add version field to script metadata
  Track script versions with auto-increment on changes
  ### T111 [ ] CORE: Add changelog array to track version history  
  Store version history with commit SHAs and tag references
  ### T112 [ ] CORE: Add requireApproval field
  Support approval requirement for dangerous scripts
  ### T113 [ ] CORE: Implement graceful schema migration from v1 to v2+
  Handle registry upgrades without breaking existing scripts

### T114 [ ] FEAT: Implement structured tagging taxonomy system
Add comprehensive tagging system for script categorization (depends: T109)
  ### T115 [ ] FEAT: Add domain tags (build, db, deploy, test, etc)
  Categorize scripts by functional domain
  ### T116 [ ] FEAT: Add risk tags (standard, dangerous)
  Tag scripts by risk level for approval policies
  ### T117 [ ] FEAT: Add lifecycle tags (ttl, exempt, stale-candidate)
  Support lifecycle management through tags
  ### T118 [ ] FEAT: Add maintenance tags (updated, renamed)
  Track maintenance activities and changes

### Enhanced Git Integration & Commit Policies

### T119 [ ] CORE: Implement enhanced one-script-per-commit policy
Enforce single script changes per commit with strict validation (depends: T007)
  ### T120 [ ] CORE: Add structured commit message formatting  
  Use format: `mcp(script): add|update|remove <name> — <short>` with optional GPG signing
  ### T121 [ ] CORE: Add batch commit configuration option
  Allow multiple script changes when allowBatch=true in config
  ### T122 [ ] SEC: Add optional GPG signing support
  Support GPG signing of commits when configured

### T123 [ ] CORE: Implement per-script version tagging system
Create annotated tags for each script version change (depends: T119)
  ### T124 [ ] CORE: Add standardized tag naming convention
  Use format: `mcp-scripts/<name>@<version>`
  ### T125 [ ] CORE: Add tag diff summaries in annotations
  Include short diff summary in annotated tag messages

### Typed Parameters & JSON Schema Validation

### T126 [ ] CORE: Add JSON Schema support for script arguments
Enable typed parameter validation using Ajv (depends: T008)
  ### T127 [ ] CORE: Implement PowerShell argument materialization
  Convert JSON args to PowerShell parameters safely - generate param block from schema (string, int, bool, enum)
  ### T128 [ ] CORE: Implement Bash argument materialization  
  Convert JSON args to Bash parameters safely - build arg array; temp JSON file for complex objects
  ### T129 [ ] CORE: Add runtime argument schema validation
  Validate runtime arguments against stored schemas with Ajv

### Run Output Management & Advanced Search

### T130 [ ] FEAT: Implement run output indexing system
Create efficient indexing for large log files (depends: T008)
  ### T131 [ ] FEAT: Add line-based indexing with byte offsets
  Enable fast line-range reads without loading full files
  ### T132 [ ] FEAT: Add sidecar .idx.json files  
  Store indexing metadata for efficient access
  ### T133 [ ] FEAT: Implement memory-efficient line reading
  Support line ranges without loading entire files

### T134 [ ] FEAT: Build comprehensive run output search family
Implement run output search tools modeled after GHCP file tools (depends: T130)
  ### T135 [ ] FEAT: Add run.list_outputs tool
  Enumerate runs with human-readable IDs
  ### T136 [ ] FEAT: Add run.read_output tool
  Read output with line slicing like read_file
  ### T137 [ ] FEAT: Add run.read_output_window tool  
  Peek lines around specific line numbers
  ### T138 [ ] FEAT: Add run.search_output tool
  Search within single run output with regex support
  ### T139 [ ] FEAT: Add run.search_outputs tool
  Search across multiple run outputs with snippets
  ### T140 [ ] FEAT: Add run.summarize_output tool
  Summarize run output with line number citations using MCP prompts

### T141 [ ] FEAT: Implement human-readable run ID system  
Generate user-friendly run identifiers (depends: T134)
  ### T142 [ ] FEAT: Add per-script run counters
  Track run numbers per script for readable IDs
  ### T143 [ ] FEAT: Format as "<scriptName>-run-<NNNN>"
  Use zero-padded sequential numbering

### Environment Snapshots & Run Attachments

### T144 [ ] FEAT: Add environment snapshot per run
Capture minimal environment info for reproducibility (depends: T008)
  ### T145 [ ] FEAT: Capture OS and architecture info
  Record platform details in run metadata
  ### T146 [ ] FEAT: Capture tool versions map
  Record versions of key tools (node, git, etc)
  ### T147 [ ] FEAT: Capture repository hash
  Record current git commit for run context
  ### T148 [ ] FEAT: Capture PATH entries (first N only)
  Record relevant PATH entries for debugging - limit PATH snapshot to first N entries; never store full env

### T149 [ ] FEAT: Implement run attachments system
Support file attachments for run artifacts (depends: T144)
  ### T150 [ ] FEAT: Add run.add_attachment tool
  Copy/move artifacts to run-specific storage - task.add_attachment { runId, path|glob, role?, mime? }
  ### T151 [ ] FEAT: Add run.list_attachments tool
  List files attached to specific run - task.list_attachments { runId }
  ### T152 [ ] FEAT: Add run.open_attachment tool  
  Access attached files by path
  ### T153 [ ] FEAT: Add attachment storage in .tasksmith/artifacts/
  Organize attachments by runId with proper structure

### Secrets Management System

### T154 [ ] SEC: Implement provider-backed secrets system
Add secure secret injection and redaction (no heuristic discovery)
  ### T155 [ ] SEC: Add secret.set/get/list/delete tools
  Manage secrets without exposing values - secret.set/get/list/delete (values never echoed)
  ### T156 [ ] SEC: Add whitelist-based injection
  Only inject explicitly allowed secret names
  ### T157 [ ] SEC: Add exact value redaction
  Redact known secret values from logs - redact exact provider values + configured regexes
  ### T158 [ ] SEC: Add configurable regex redaction
  Support pattern-based secret redaction
  ### T159 [ ] SEC: Ensure secrets never echo to stdout
  Prevent accidental secret exposure - before persisting/streaming logs

### Risk Management & Approval Workflows

### T160 [ ] SEC: Implement dangerous operations approval system
Require explicit approval for risky scripts (depends: T114)
  ### T161 [ ] SEC: Add requireApproval flag support
  Honor script-level approval requirements  
  ### T162 [ ] SEC: Add risk tag approval mapping
  Map risk:dangerous tag to approval requirement
  ### T163 [ ] SEC: Add acknowledgeRisk parameter
  Require explicit risk acknowledgment in run calls
  ### T164 [ ] SEC: Add approval bypass for non-dangerous
  Skip approval for risk:standard scripts

### Enhanced Precheck System

### T165 [ ] CORE: Enhance precheck execution system
Improve precheck execution and caching (depends: T008)
  ### T166 [ ] CORE: Add precheck result caching
  Cache successful precheck results temporarily
  ### T167 [ ] CORE: Add standard return codes
  Use 0=ok, 10=precheck_failed, 11=allowlist_violation
  ### T168 [ ] CORE: Add precheck timeout handling
  Prevent hung precheck commands

### Script Execution Engine

### T169 [ ] CORE: Build comprehensive script execution engine
Implement task.run_script with advanced features (depends: T126, T154, T160)
  ### T170 [ ] CORE: Add CWD strategy support
  Implement repoRoot|scriptDir working directory strategies
  ### T171 [ ] CORE: Add stdin support for scripts
  Enable piping data to script execution
  ### T172 [ ] CORE: Add comprehensive logging system
  Structured logging with run history persistence
  ### T173 [ ] CORE: Add run history management
  Track and manage script execution history

### Guarded Ad-hoc Execution & Suggest-Save

### T174 [ ] FEAT: Implement controlled ad-hoc execution
Add controlled ad-hoc execution with safeguards (depends: T165)
  ### T175 [ ] FEAT: Add task.exec_adhoc tool (hidden by default)
  Enable ad-hoc execution when explicitly enabled - off by default; after ≥2 failures or ≥3 similar uses, auto-draft registry entry
  ### T176 [ ] FEAT: Add failure threshold tracking
  Count failures to trigger save suggestions
  ### T177 [ ] FEAT: Add similarity detection using Levenshtein distance
  Use Levenshtein distance to detect similar commands
  ### T178 [ ] FEAT: Add automatic draft script creation
  Generate script drafts from repeated ad-hoc usage
  ### T179 [ ] FEAT: Add structured suggest-save payload
  Return structured suggestion for script creation

### TTL Management & Lifecycle

### T180 [ ] FEAT: Add comprehensive TTL management system
Implement TTL expiry logic and background sweeper (depends: T114)
  ### T181 [ ] FEAT: Add TTL sweeper background process
  Automatic cleanup of expired scripts
  ### T182 [ ] FEAT: Add task.report_stale functionality
  Report stale scripts for manual review
  ### T183 [ ] FEAT: Add TTL configuration per script
  Support custom TTL values and exemptions

### CLI Boilerplate Generation

### T184 [ ] FEAT: Create CLI wrapper functionality
Add CLI boilerplate for scripts (depends: T173)
  ### T185 [ ] FEAT: Generate standalone CLI wrappers
  Create scripts that can run independently
  ### T186 [ ] FEAT: Add MCP server reporting integration
  Enable CLI scripts to report back to MCP server
  ### T187 [ ] FEAT: Add parameter passing from CLI to MCP
  Support argument forwarding from CLI to server

### Configuration Management

### T188 [ ] CORE: Add comprehensive configuration management
Implement task.configure and config.json handling
  ### T189 [ ] CORE: Add server policy configuration
  Configure server behaviors and restrictions
  ### T190 [ ] CORE: Add tool approval settings
  Configure which tools require approval
  ### T191 [ ] CORE: Add security policy settings
  Configure security-related behaviors

### HTTP Transport (Optional)

### T192 [ ] INFRA: Implement optional HTTP transport
Add optional HTTP server for web-based access
  ### T193 [ ] INFRA: Add transport configuration
  Support stdio|http transport selection - config transport:"stdio"|"http" (default stdio)
  ### T194 [ ] INFRA: Add HTTP API endpoints
  Implement POST /mcp/tools/list and /mcp/tools/call
  ### T195 [ ] INFRA: Add Server-Sent Events for streaming
  Implement GET /mcp/stream/:runId for live logs - SSE
  ### T196 [ ] SEC: Add CORS configuration
  Support CORS allowlist for web access
  ### T197 [ ] SEC: Add bearer token authentication
  Optional TASKSMITH_HTTP_TOKEN for security

### Built-in Prompts & Documentation

### T198 [ ] DOCS: Ship built-in prompts with server
Include standard prompts for common workflows
  ### T199 [ ] DOCS: Add TaskSmith Rules v1 prompt
  Best practices for using TaskSmith effectively - prefer task.run_script over ad-hoc; use typed args when schema exists; weekly task.report_stale
  ### T200 [ ] DOCS: Add Script Authoring Guide prompt
  Guidelines for writing maintainable scripts - CWD independence; idempotency; strict modes; prechecks before work; no secrets in stdout
  ### T201 [ ] DOCS: Add Summarize Run Output v1 prompt
  Standard prompt for run output summarization with line number citations

### T202 [ ] DOCS: Enhance tool descriptions for better LLM usage
Improve tool descriptions for better LLM selection
  ### T203 [ ] DOCS: Add when-to-use guidance
  Clear guidance on appropriate tool usage
  ### T204 [ ] DOCS: Add actionable descriptions
  Make tool descriptions more actionable

### Comprehensive Testing Suite

### T205 [ ] TEST: Add comprehensive test coverage
Ensure all features work correctly
  ### T206 [ ] TEST: Test one-script-per-commit enforcement
  Validate commit policy compliance
  ### T207 [ ] TEST: Test version bumps and tagging
  Ensure proper versioning behavior
  ### T208 [ ] TEST: Test run output indexing
  Validate efficient line-range operations
  ### T209 [ ] TEST: Test secrets redaction
  Ensure secrets never appear in logs
  ### T210 [ ] TEST: Test approval workflows
  Validate dangerous operation approvals
  ### T211 [ ] TEST: Test TTL sweeper behavior
  Ensure proper cleanup of expired scripts
  ### T212 [ ] TEST: Test ad-hoc suggest-save flow
  Validate automatic script draft generation

### Infrastructure & VS Code Integration

### T213 [ ] INFRA: Update VS Code integration
Enhance .vscode/mcp.json with new features (depends: T188)
  ### T214 [ ] INFRA: Add policy configuration sample
  Include server preferences and tool approvals
  ### T215 [ ] INFRA: Add security policy examples
  Demonstrate secure configuration patterns

### T216 [ ] DOCS: Update README with complete feature set
Document all implemented features comprehensively
  ### T217 [ ] DOCS: Add installation instructions
  Clear setup and installation guidance
  ### T218 [ ] DOCS: Add usage examples
  Practical examples of common workflows
  ### T219 [ ] DOCS: Add configuration reference
  Complete reference for all config options

---

## Task Dependencies

```
# Core Dependencies
T109 -> T110, T111, T112, T113
T114 -> T115, T116, T117, T118 (depends: T109)
T119 -> T120, T121, T122 (depends: T007)
T123 -> T124, T125 (depends: T119)
T126 -> T127, T128, T129 (depends: T008)
T130 -> T131, T132, T133 (depends: T008)
T134 -> T135, T136, T137, T138, T139, T140 (depends: T130)
T141 -> T142, T143 (depends: T134)
T144 -> T145, T146, T147, T148 (depends: T008)
T149 -> T150, T151, T152, T153 (depends: T144)
T154 -> T155, T156, T157, T158, T159
T160 -> T161, T162, T163, T164 (depends: T114)
T165 -> T166, T167, T168 (depends: T008)
T169 -> T170, T171, T172, T173 (depends: T126, T154, T160)
T174 -> T175, T176, T177, T178, T179 (depends: T165)
T180 -> T181, T182, T183 (depends: T114)
T184 -> T185, T186, T187 (depends: T173)
T188 -> T189, T190, T191
T192 -> T193, T194, T195, T196, T197
T198 -> T199, T200, T201
T202 -> T203, T204
T205 -> T206, T207, T208, T209, T210, T211, T212
T213 -> T214, T215 (depends: T188)
T216 -> T217, T218, T219

# Sequential Implementation Order
Phase 1: T109-T118 (Registry v2 & Tagging)
Phase 2: T119-T129 (Git & Typed Params)  
Phase 3: T130-T143 (Run Output Search)
Phase 4: T144-T153 (Environment & Attachments)
Phase 5: T154-T173 (Secrets & Execution Engine)
Phase 6: T174-T191 (Ad-hoc & Config)
Phase 7: T192-T219 (HTTP & Documentation)
```

---

## Implementation Strategy

### Run-Output Storage & Indexing (T130-T143)
- Persist full combined log at `.tasksmith/runs/YYYY/MM/DD/<runId>.log` with normalized line endings
- Store sidecar index `.idx.json` with `{ totalLines, byteOffsets[] }` for fast line-range reads
- Search APIs return snippets with `before/after` context and `[Lx-Ly]` ranges
- Human-readable IDs: `"<scriptName>-run-<NNNN>"` (zero-padded per script)

### Registry Schema v2 Structure (T109-T113)
```json
{
  "name": "build:app",
  "version": 3,
  "shell": "pwsh|bash|cmd",
  "path": "scripts/pwsh/build-app.ps1", 
  "description": "Build app",
  "tags": ["domain:build","risk:standard","lifecycle:exempt"],
  "ttlSeconds": null,
  "requireApproval": false,
  "cwdStrategy": "repoRoot|scriptDir",
  "precheck": "pwsh -c Get-Command dotnet -EA Stop | Out-Null",
  "argsSchema": {"type":"object","properties":{}},
  "createdAt": "ISO",
  "updatedAt": "ISO", 
  "lastUsedAt": "ISO|null",
  "changelog": [{"version":2,"commit":"<sha>","tag":"mcp-scripts/build:app@2"}]
}
```

### Tag Taxonomy System (T114-T118)
- `domain:*` (build, db, deploy, test, tooling, analytics, infra, release)
- `risk:{standard|dangerous}` (maps to approval policy)
- `lifecycle:ttl:{Nd|Nh}` (explicit TTL), `lifecycle:exempt` (no TTL), `lifecycle:stale-candidate`
- `maintenance:updated`, `maintenance:renamed:<oldName>`

### VS Code Policy Configuration Sample (T213-T215)
```json
{
  "servers": { "tasksmith": { "command": "node", "args": ["./node_modules/tasksmith-mcp/dist/index.js"] } },
  "policy": { "preferServers": ["tasksmith"], "denyServers": ["*shell*","*exec*"], "toolApprovals": {"task.run_script": true} }
}
```

---

## Completion Guidelines

- Mark tasks `[x]` immediately when functionality is complete and tested
- Delete completed tasks from this file just before committing the completion changes  
- Child tasks can be completed independently but parent remains until all children done
- Update dependencies list when task relationships change
- Commit task file changes separately from implementation commits
- Use separate commits for each major feature area to maintain clean history

---

## Notes

This catalog represents a comprehensive roadmap for evolving TaskSmith MCP from its current CRUD foundation into a full-featured script execution and management platform. The tasks are organized by functional area and include proper dependency tracking to ensure implementation order respects architectural requirements.

Key architectural principles maintained:
- Single-repo scope with git integration
- Default-deny ad-hoc execution 
- Provider-backed secrets (no heuristics)
- Stdio-first with optional HTTP transport
- Comprehensive testing and documentation