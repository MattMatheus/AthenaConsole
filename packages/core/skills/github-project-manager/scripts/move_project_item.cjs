const { execSync } = require('child_process');
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
            if (currentSection.includes("StatusField")) {
                config["StatusField"] = config["StatusField"] || {};
            } else {
                config[currentSection] = config[currentSection] || {};
            }
        } else if (line.startsWith('-') && (currentSection === 'StatusField' || currentSection === 'StatusFieldOptions')) {
            if (line.includes("(ID:")) {
                 const [name, id] = line.substring(1).split('(ID:', 2).map(s => s.trim());
                 if (name && id) {
                    if (!config["StatusField"].options) {
                        config["StatusField"].options = {};
                    }
                    config["StatusField"].options[name] = id.replace(')', '');
                 }
            } else {
                const [key, value] = line.substring(1).split(':', 2).map(s => s.trim());
                 if (key && value) {
                    config["StatusField"][key.replace(/\s+/g, '')] = value;
                 }
            }
        }
    });

    return config;
}

try {
    const config = loadProjectConfig();
    const PROJECT_ID = config.ProjectID;
    const STATUS_FIELD_ID = config.StatusField.FieldID;
    const STATUS_OPTIONS = config.StatusField.options;

    const identifier = process.argv[2]; // Item ID or Issue Number
    const targetStatusName = process.argv[3];

    if (!identifier || !targetStatusName) {
        console.error('Usage: node move_project_item.cjs <item-id-or-issue-number> "<target-status-name>"');
        console.error(`Available statuses: ${Object.keys(STATUS_OPTIONS).join(', ')}`);
        process.exit(1);
    }

    const targetStatusOptionId = STATUS_OPTIONS[targetStatusName];
    if (!targetStatusOptionId) {
        console.error(`Error: Invalid status name "${targetStatusName}". Available statuses: ${Object.keys(STATUS_OPTIONS).join(', ')}`);
        process.exit(1);
    }

    let itemId;
    // Determine if identifier is an issue number or an item ID
    // If it's a number, we need to find the project item ID first.
    if (!isNaN(identifier) && Number(identifier) > 0) { // Assume it's an issue number
        const issueNumber = identifier;
        const findItemCommand = `gh project item-list ${config.ProjectNumber} --owner ${config.ProjectOwner} --format json`;
        const itemListResult = execSync(findItemCommand, { encoding: 'utf8', stdio: 'pipe' });
        const items = JSON.parse(itemListResult).items.nodes;

        const projectItem = items.find(item => item.content && item.content.number === parseInt(issueNumber, 10));

        if (!projectItem) {
            console.error(`Error: Could not find project item for issue number #${issueNumber}.`);
            process.exit(1);
        }
        itemId = projectItem.id;
        console.log(`Found project item ID ${itemId} for issue #${issueNumber}.`);

    } else { // Assume it's an item ID
        itemId = identifier;
    }


    const setStatusCommand = `gh project item-edit ${itemId} --project-id ${PROJECT_ID} --field-id ${STATUS_FIELD_ID} --single-select-option-id ${targetStatusOptionId}`;
    execSync(setStatusCommand, { encoding: 'utf8', stdio: 'pipe' });

    console.log(`Successfully moved item ${itemId} to status "${targetStatusName}".`);

} catch (error) {
    console.error(`Error moving project item: ${error.message}`);
    process.exit(1);
}
