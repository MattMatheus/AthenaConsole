---
name: github-project-manager
description: Manage GitHub Project tasks. Use to list, create, move, or comment on project items (issues). Requires GitHub CLI (gh) authenticated with read:project and write:discussion scopes.
---

# GitHub Project Manager Skill

This skill allows you to interact with your GitHub Project board to manage tasks. It leverages the \`gh\` CLI for all operations.

## Setup

This skill requires the GitHub CLI (\`gh\`) to be installed and authenticated with \`read:project\` and \`write:discussion\` scopes.

## Usage

### 1. List Project Items

Use this to view items in your project board, optionally filtering by status.

\`\`\`bash
node scripts/list_project_items.cjs [optional-status-name]
\`\`\`

*   \`[optional-status-name]\`: (Optional) The name of the status column to filter by (e.g., "Backlog", "In progress", "Done"). If omitted, all items are listed.

**Example:**
\`node scripts/list_project_items.cjs "In progress"\`

### 2. Create a Project Item (Issue)

Use this to create a new GitHub Issue and automatically add it to your project with an initial status of "Backlog".

\`\`\`bash
node scripts/create_project_item.cjs "<title>" "[<body>]"
\`\`\`

*   \`<title>\`: The title of the new issue.
*   \`[<body>]\`: (Optional) The body content for the new issue.

**Example:**
\`node scripts/create_project_item.cjs "Implement feature X" "As a user, I want..."\`

### 3. Move a Project Item's Status

Use this to change the status (column) of an existing project item. You can identify the item by its Project Item ID or its GitHub Issue Number.

\`\`\`bash
node scripts/move_project_item.cjs <item-id-or-issue-number> "<target-status-name>"
\`\`\`

*   \`<item-id-or-issue-number>\`: The unique ID of the project item (e.g., \`PVTI_...\`) or the GitHub Issue Number (e.g., \`123\`).
*   \`<target-status-name>\`: The name of the status column to move the item to (e.g., "Ready", "In progress", "Done").

**Example:**
\`node scripts/move_project_item.cjs 123 "In progress"\`
\`node scripts/move_project_item.cjs PVTI_... "Done"\`

### 4. Add a Comment to an Issue

Use this to add a comment to an existing GitHub Issue.

\`\`\`bash
node scripts/add_comment_to_issue.cjs <issue-number> "<comment-body>"
\`\`\`

*   \`<issue-number>\`: The GitHub Issue Number (e.g., \`123\`).
*   \`<comment-body>\`: The content of the comment.

**Example:**
\`node scripts/add_comment_to_issue.cjs 123 "Blocking on backend API changes."\`

## Configuration

The skill uses \`references/config.md\` to store your GitHub Project's specific IDs and field options. This file was automatically generated based on your project. **Do not modify this file manually unless you understand the implications.**
