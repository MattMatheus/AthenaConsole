const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadProjectConfig() {
    const configPath = path.join(__dirname, '..', 'references', 'config.md');
    const content = fs.readFileSync(configPath, 'utf8');
    const config = {
        StatusField: {
            options: {}
        }
    };
    const lines = content.split('\n');

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('*   **Project ID:**')) {
            config.ProjectID = trimmedLine.split('**Project ID:**')[1].trim();
        } else if (trimmedLine.startsWith('*   **Project Owner:**')) {
            config.ProjectOwner = trimmedLine.split('**Project Owner:**')[1].trim();
        } else if (trimmedLine.startsWith('*   **Project Number:**')) {
            config.ProjectNumber = trimmedLine.split('**Project Number:**')[1].trim();
        } else if (trimmedLine.startsWith('*   **Project Title:**')) {
            config.ProjectTitle = trimmedLine.split('**Project Title:**')[1].trim();
        } else if (trimmedLine.startsWith('*   **Field ID:**')) {
            config.StatusField.FieldID = trimmedLine.split('**Field ID:**')[1].trim();
        } else if (trimmedLine.startsWith('*   **Field Name:**')) {
            config.StatusField.FieldName = trimmedLine.split('**Field Name:**')[1].trim();
        } else if (trimmedLine.startsWith('*') && trimmedLine.includes('(ID:')) {
             const lineWithoutStar = trimmedLine.substring(trimmedLine.indexOf('*') + 1).trim();
             const parts = lineWithoutStar.split('(ID:');
             if (parts.length === 2) {
                const name = parts[0].trim();
                const id = parts[1].replace(')', '').trim();
                config.StatusField.options[name] = id;
             }
        }
    });

    return config;
}

try {
    const config = loadProjectConfig();
    const PROJECT_ID = config.ProjectID;
    const PROJECT_OWNER = config.ProjectOwner;
    const PROJECT_NUMBER = config.ProjectNumber;
    const STATUS_FIELD_ID = config.StatusField.FieldID;
    const STATUS_OPTION_BACKLOG_ID = config.StatusField.options.Backlog;

    const title = process.argv[2];
    const bodyOrFile = process.argv[3] || '';

    if (!title) {
        console.error('Usage: node create_project_item.cjs "<title>" "[<body> | --body-file <file>]"');
        process.exit(1);
    }

    let createIssueCommand;
    if (bodyOrFile === '--body-file') {
        const bodyFile = process.argv[4];
        if (!bodyFile) {
            console.error('Error: --body-file flag requires a file path.');
            process.exit(1);
        }
        createIssueCommand = `gh issue create --title "${title}" --body-file "${bodyFile}"`;
    } else {
        const body = bodyOrFile;
        createIssueCommand = `gh issue create --title "${title}" --body "${body}"`;
    }

    // 1. Create a new issue
    const issueUrl = execSync(createIssueCommand, { encoding: 'utf8', stdio: 'pipe' }).trim();
    const issueNumber = issueUrl.split('/').pop();

    console.log(`Successfully created issue #${issueNumber}: ${title}`);
    console.log(`Issue URL: ${issueUrl}`);

    // 2. Add the issue to the project
    const addIssueToProjectCommand = `gh project item-add ${PROJECT_NUMBER} --owner ${PROJECT_OWNER} --url ${issueUrl} --format json`;
    const itemAddResult = execSync(addIssueToProjectCommand, { encoding: 'utf8', stdio: 'pipe' });
    const itemData = JSON.parse(itemAddResult);
    const itemId = itemData.id;

    console.log(`Successfully added issue #${issueNumber} to project "${config.ProjectTitle}" as item ID: ${itemId}`);

    // 3. Set the status to Backlog
    const setStatusCommand = `gh project item-edit --id ${itemId} --project-id ${PROJECT_ID} --field-id ${STATUS_FIELD_ID} --single-select-option-id ${STATUS_OPTION_BACKLOG_ID}`;
    execSync(setStatusCommand, { encoding: 'utf8', stdio: 'pipe' });

    console.log(`Successfully set status of item ${itemId} to "Backlog".`);

} catch (error) {
    console.error(`Error creating project item: ${error.message}`);
    process.exit(1);
}
