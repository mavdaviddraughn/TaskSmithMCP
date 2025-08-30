# TaskSmith MCP Development Tasks

## Task File Guidelines

### Formatting Rules
- **Task ID**: `T###` - 3-digit zero-padded unique identifier
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

---

## Current Active Tasks (from TODO list)

### T001 [x] CORE: Initialize git repository
Set up git repo in the current workspace directory with initial commit

### T002 [x] CORE: Create GitHub repository  
Create a new GitHub repository using MCP tools and connect the local repo

### T003 [x] CORE: Scaffold TypeScript MCP server
Set up Node.js/TypeScript project structure with proper dependencies and build configuration

### T004 [ ] CORE: Implement core MCP tool router
Create the main server entry point with tool registration and JSON schema validation using Ajv

### T005 [ ] CORE: Add repository detection and path helpers
Implement git repository detection, path resolution, and directory structure creation for scripts/ and .tasksmith/

### T006 [ ] CORE: Implement registry management  
Create script registry read/write functionality with advisory locking and scripts.json persistence

### T007 [ ] CORE: Add git integration helpers
Implement git operations: repo detection, staging, committing, and tagging functionality

### T008 [ ] CORE: Implement script CRUD operations
Build task.save_script, task.get_script, task.delete_script with file operations and git commits

### T009 [ ] CORE: Build script execution engine
Implement task.run_script with precheck, CWD strategy, stdin support, logging, and run history

### T010 [ ] FEAT: Add TTL management and sweeper
Implement TTL expiry logic, background sweeper, and task.report_stale functionality

### T011 [ ] FEAT: Create CLI boilerplate for scripts
Add CLI wrapper functionality to scripts so they can be run independently while reporting back to MCP server

### T012 [ ] CORE: Add configuration management
Implement task.configure and config.json handling for server policies and settings

### T013 [ ] TEST: Write tests and documentation  
Create unit tests with Vitest, integration tests, and update README with usage instructions

### T014 [ ] INFRA: Setup VS Code MCP integration
Create .vscode/mcp.json configuration and test the server integration

---

## Extended Feature Tasks

### Registry Evolution & Versioning

### T015 [ ] CORE: Upgrade registry schema to v2
Evolve registry to support new fields and versioning system
  ### T016 [ ] CORE: Add version field to script metadata
  Track script versions with auto-increment on changes
  ### T017 [ ] CORE: Add changelog array to track version history  
  Store version history with commit SHAs and tag references
  ### T018 [ ] CORE: Add requireApproval field
  Support approval requirement for dangerous scripts
  ### T019 [ ] CORE: Implement registry migration system
  Handle schema upgrades from v1 to v2+ gracefully

### T020 [ ] FEAT: Implement tagging taxonomy system
Add structured tagging system for script categorization
  ### T021 [ ] FEAT: Add domain tags (build, db, deploy, test, etc)
  Categorize scripts by functional domain
  ### T022 [ ] FEAT: Add risk tags (standard, dangerous)
  Tag scripts by risk level for approval policies
  ### T023 [ ] FEAT: Add lifecycle tags (ttl, exempt, stale-candidate)
  Support lifecycle management through tags
  ### T024 [ ] FEAT: Add maintenance tags (updated, renamed)
  Track maintenance activities and changes

### Git Integration & Commit Policies

### T025 [ ] CORE: Implement one-script-per-commit policy
Enforce single script changes per commit with validation
  ### T026 [ ] CORE: Add commit message formatting  
  Use format: `mcp(script): add|update|remove <name> — <short>`
  ### T027 [ ] CORE: Add batch commit config option
  Allow multiple script changes when allowBatch=true
  ### T028 [ ] SEC: Add optional GPG signing support
  Support GPG signing of commits when configured

### T029 [ ] CORE: Implement per-script version tagging
Create annotated tags for each script version change
  ### T030 [ ] CORE: Add tag naming convention
  Use format: `mcp-scripts/<name>@<version>`
  ### T031 [ ] CORE: Add tag diff summaries
  Include short diff summary in annotated tag messages

### Typed Parameters & Validation

### T032 [ ] CORE: Add JSON Schema support for script arguments
Enable typed parameter validation using Ajv
  ### T033 [ ] CORE: Implement PowerShell argument materialization
  Convert JSON args to PowerShell parameters safely
  ### T034 [ ] CORE: Implement Bash argument materialization  
  Convert JSON args to Bash parameters safely
  ### T035 [ ] CORE: Add argument schema validation
  Validate runtime arguments against stored schemas

### Run Output Management & Search

### T036 [ ] FEAT: Implement run output indexing system
Create efficient indexing for large log files
  ### T037 [ ] FEAT: Add line-based indexing with byte offsets
  Enable fast line-range reads without loading full files
  ### T038 [ ] FEAT: Add sidecar .idx.json files  
  Store indexing metadata for efficient access
  ### T039 [ ] FEAT: Implement memory-efficient line reading
  Support line ranges without loading entire files

### T040 [ ] FEAT: Build run output search family
Implement comprehensive run output search tools
  ### T041 [ ] FEAT: Add run.list_outputs tool
  Enumerate runs with human-readable IDs
  ### T042 [ ] FEAT: Add run.read_output tool
  Read output with line slicing like read_file
  ### T043 [ ] FEAT: Add run.read_output_window tool  
  Peek lines around specific line numbers
  ### T044 [ ] FEAT: Add run.search_output tool
  Search within single run output with regex support
  ### T045 [ ] FEAT: Add run.search_outputs tool
  Search across multiple run outputs with snippets
  ### T046 [ ] FEAT: Add run.summarize_output tool
  Summarize run output with line number citations

### T047 [ ] FEAT: Implement human-readable run IDs  
Generate user-friendly run identifiers
  ### T048 [ ] FEAT: Add per-script run counters
  Track run numbers per script for readable IDs
  ### T049 [ ] FEAT: Format as "<scriptName>-run-<NNNN>"
  Use zero-padded sequential numbering

### Environment & Attachments

### T050 [ ] FEAT: Add environment snapshot per run
Capture minimal environment info for reproducibility
  ### T051 [ ] FEAT: Capture OS and architecture info
  Record platform details in run metadata
  ### T052 [ ] FEAT: Capture tool versions map
  Record versions of key tools (node, git, etc)
  ### T053 [ ] FEAT: Capture repository hash
  Record current git commit for run context
  ### T054 [ ] FEAT: Capture PATH entries (first N)
  Record relevant PATH entries for debugging

### T055 [ ] FEAT: Implement run attachments system
Support file attachments for run artifacts
  ### T056 [ ] FEAT: Add run.add_attachment tool
  Copy/move artifacts to run-specific storage
  ### T057 [ ] FEAT: Add run.list_attachments tool
  List files attached to specific run
  ### T058 [ ] FEAT: Add run.open_attachment tool  
  Access attached files by path
  ### T059 [ ] FEAT: Add attachment storage in .tasksmith/artifacts/
  Organize attachments by runId

### Secrets Management

### T060 [ ] SEC: Implement secrets provider system
Add secure secret injection and redaction
  ### T061 [ ] SEC: Add secret.set/get/list/delete tools
  Manage secrets without exposing values
  ### T062 [ ] SEC: Add whitelist-based injection
  Only inject explicitly allowed secret names
  ### T063 [ ] SEC: Add exact value redaction
  Redact known secret values from logs
  ### T064 [ ] SEC: Add configurable regex redaction
  Support pattern-based secret redaction
  ### T065 [ ] SEC: Ensure secrets never echo to stdout
  Prevent accidental secret exposure

### Risk Management & Approvals

### T066 [ ] SEC: Implement dangerous operations approval
Require explicit approval for risky scripts
  ### T067 [ ] SEC: Add requireApproval flag support
  Honor script-level approval requirements  
  ### T068 [ ] SEC: Add risk tag approval mapping
  Map risk:dangerous tag to approval requirement
  ### T069 [ ] SEC: Add acknowledgeRisk parameter
  Require explicit risk acknowledgment in run calls
  ### T070 [ ] SEC: Add approval bypass for non-dangerous
  Skip approval for risk:standard scripts

### Prechecks & Validation

### T071 [ ] CORE: Enhance precheck system
Improve precheck execution and caching
  ### T072 [ ] CORE: Add precheck result caching
  Cache successful precheck results temporarily
  ### T073 [ ] CORE: Add standard return codes
  Use 0=ok, 10=precheck_failed, 11=allowlist_violation
  ### T074 [ ] CORE: Add precheck timeout handling
  Prevent hung precheck commands

### Ad-hoc Execution & Suggest-Save

### T075 [ ] FEAT: Implement guarded ad-hoc execution
Add controlled ad-hoc execution with safeguards
  ### T076 [ ] FEAT: Add task.exec_adhoc tool (hidden)
  Enable ad-hoc execution when explicitly enabled
  ### T077 [ ] FEAT: Add failure threshold tracking
  Count failures to trigger save suggestions
  ### T078 [ ] FEAT: Add similarity detection  
  Use Levenshtein distance to detect similar commands
  ### T079 [ ] FEAT: Add auto-draft script creation
  Generate script drafts from repeated ad-hoc usage
  ### T080 [ ] FEAT: Add suggest-save payload
  Return structured suggestion for script creation

### HTTP Transport (Optional)

### T081 [ ] INFRA: Implement HTTP transport option
Add optional HTTP server for web-based access
  ### T082 [ ] INFRA: Add transport configuration
  Support stdio|http transport selection
  ### T083 [ ] INFRA: Add HTTP endpoints
  Implement POST /mcp/tools/list and /mcp/tools/call
  ### T084 [ ] INFRA: Add Server-Sent Events for streaming
  Implement GET /mcp/stream/:runId for live logs
  ### T085 [ ] SEC: Add CORS configuration
  Support CORS allowlist for web access
  ### T086 [ ] SEC: Add bearer token authentication
  Optional TASKSMITH_HTTP_TOKEN for security

### Prompts & Documentation

### T087 [ ] DOCS: Ship built-in prompts with server
Include standard prompts for common workflows
  ### T088 [ ] DOCS: Add TaskSmith Rules v1 prompt
  Best practices for using TaskSmith effectively
  ### T089 [ ] DOCS: Add Script Authoring Guide
  Guidelines for writing maintainable scripts
  ### T090 [ ] DOCS: Add Summarize Run Output prompt
  Standard prompt for run output summarization

### T091 [ ] DOCS: Enhance tool descriptions
Improve tool descriptions for better LLM selection
  ### T092 [ ] DOCS: Add when-to-use guidance
  Clear guidance on appropriate tool usage
  ### T093 [ ] DOCS: Add actionable descriptions
  Make tool descriptions more actionable

### Testing & Validation

### T094 [ ] TEST: Add comprehensive test suite
Ensure all features work correctly
  ### T095 [ ] TEST: Test one-script-per-commit enforcement
  Validate commit policy compliance
  ### T096 [ ] TEST: Test version bumps and tagging
  Ensure proper versioning behavior
  ### T097 [ ] TEST: Test run output indexing
  Validate efficient line-range operations
  ### T098 [ ] TEST: Test secrets redaction
  Ensure secrets never appear in logs
  ### T099 [ ] TEST: Test approval workflows
  Validate dangerous operation approvals
  ### T100 [ ] TEST: Test TTL sweeper behavior
  Ensure proper cleanup of expired scripts
  ### T101 [ ] TEST: Test ad-hoc suggest-save flow
  Validate automatic script draft generation

### Infrastructure & Configuration

### T102 [ ] INFRA: Update VS Code integration
Enhance .vscode/mcp.json with new features
  ### T103 [ ] INFRA: Add policy configuration sample
  Include server preferences and tool approvals
  ### T104 [ ] INFRA: Add security policy examples
  Demonstrate secure configuration patterns

### T105 [ ] DOCS: Update README with full feature set
Document all implemented features comprehensively
  ### T106 [ ] DOCS: Add installation instructions
  Clear setup and installation guidance
  ### T107 [ ] DOCS: Add usage examples
  Practical examples of common workflows
  ### T108 [ ] DOCS: Add configuration reference
  Complete reference for all config options

---

## Task Dependencies

```
T004 -> T005 -> T006 -> T007 -> T008 -> T009
T015 -> T016, T017, T018, T019
T020 -> T021, T022, T023, T024  
T025 -> T026, T027, T028
T029 -> T030, T031
T032 -> T033, T034, T035
T036 -> T037, T038, T039
T040 -> T041, T042, T043, T044, T045, T046
T047 -> T048, T049
T050 -> T051, T052, T053, T054
T055 -> T056, T057, T058, T059
T060 -> T061, T062, T063, T064, T065
T066 -> T067, T068, T069, T070
T071 -> T072, T073, T074
T075 -> T076, T077, T078, T079, T080
T081 -> T082, T083, T084, T085, T086
T087 -> T088, T089, T090
T091 -> T092, T093
T094 -> T095, T096, T097, T098, T099, T100, T101
T102 -> T103, T104
T105 -> T106, T107, T108
```

---

## Completion Notes

- Mark tasks `[x]` immediately when functionality is complete
- Delete completed tasks from this file just before committing the completion changes  
- Child tasks can be completed independently but parent remains until all children done
- Update dependencies list when task relationships change
- Commit task file changes separately from implementation commits