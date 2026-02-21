# GitHub Project Configuration

This file stores the specific IDs and names needed to interact with the GitHub Project via the `gh` CLI.

## Project Details
*   **Project ID:** PVT_kwHOAIjUss4BPY0V
*   **Project Owner:** MattMatheus
*   **Project Number:** 2
*   **Project Title:** Project Athena Work Tracker

## Fields
### Status Field
*   **Field ID:** PVTSSF_lAHOAIjUss4BPY0Vzg9z4ik
*   **Field Name:** Status
*   **Options:**
    *   Backlog (ID: f75ad846)
    *   Ready (ID: 61e4505c)
    *   In progress (ID: 47fc9ee4)
    *   In review (ID: df73e18b)
    *   Done (ID: 98236657)

## Instructions for Use

When writing scripts that interact with the GitHub Project, they should load these values to ensure they are always up-to-date with the configured project.

Example (Node.js CJS):

```javascript
const fs = require('fs');
const path = require('path');

function loadProjectConfig() {
    const configPath = path.join(__dirname, '..', 'references', 'config.md');
    const content = fs.readFileSync(configPath, 'utf8');

    const config = {};
    const lines = content.split('
');

    let currentSection = '';
    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('*')) {
            const [key, value] = line.substring(1).split(':', 2).map(s => s.trim());
            if (key && value) {
                config[key.replace(/\s+/g, '')] = value;
            }
        } else if (line.startsWith('###')) {
            currentSection = line.substring(3).trim().replace(/\s+/g, '');
            config[currentSection] = {};
        } else if (line.startsWith('-') && currentSection === 'StatusFieldOptions') {
            const [name, id] = line.substring(1).split('(ID:', 2).map(s => s.trim());
            if (name && id) {
                if (!config.StatusFieldOptions.options) {
                    config.StatusFieldOptions.options = {};
                }
                config.StatusFieldOptions.options[name] = id.replace(')', '');
            }
        }
    });
    return config;
}

// In a script:
// const config = loadProjectConfig();
// const PROJECT_ID = config.ProjectID;
// const STATUS_FIELD_ID = config.StatusField.FieldID;
// const STATUS_OPTION_ID_BACKLOG = config.StatusFieldOptions.options.Backlog;
```
