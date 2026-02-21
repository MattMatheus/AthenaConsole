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
    const STATUS_FIELD_NAME = config.StatusField.FieldName;
    const STATUS_OPTIONS = config.StatusField.options;

    const statusFilter = process.argv[2]; // Optional: filter by status name
    let statusOptionId = '';

    if (statusFilter) {
        statusOptionId = STATUS_OPTIONS[statusFilter];
        if (!statusOptionId) {
            console.error(`Error: Invalid status filter "${statusFilter}". Available statuses: ${Object.keys(STATUS_OPTIONS).join(', ')}`);
            process.exit(1);
        }
    }

    let query = `
        query($projectId: ID!) {
            node(id: $projectId) {
                ... on ProjectV2 {
                    items(first: 100) {
                        nodes {
                            id
                            fieldValues(first: 20) {
                                nodes {
                                    ... on ProjectV2ItemFieldTextValue {
                                        field { ... on ProjectV2Field { name } }
                                        text
                                    }
                                    ... on ProjectV2ItemFieldSingleSelectValue {
                                        field { ... on ProjectV2Field { name } }
                                        name
                                    }
                                }
                            }
                            content {
                                ... on DraftIssue { title body }
                                ... on Issue { title body number url }
                                ... on PullRequest { title body number url }
                            }
                        }
                    }
                }
            }
        }
    `;

    let ghCommand = `gh api graphql -F projectId=${PROJECT_ID} -f query='\${query}'`;
    const result = execSync(ghCommand, { encoding: 'utf8', stdio: 'pipe' });
    const projectData = JSON.parse(result);

    const items = projectData.data.node.items.nodes;
    const filteredItems = items.filter(item => {
        if (!statusFilter) return true; // No filter, include all

        const statusValue = item.fieldValues.nodes.find(fv =>
            fv.field && fv.field.name === STATUS_FIELD_NAME
        );
        return statusValue && statusValue.name === statusFilter;
    });

    if (filteredItems.length === 0 && statusFilter) {
        console.log(`No items found in status "${statusFilter}".`);
    } else if (filteredItems.length === 0) {
        console.log("No items found in the project.");
    } else {
        console.log(`Found ${filteredItems.length} items (filtered by Status: ${statusFilter || 'None'}):`);
        filteredItems.forEach(item => {
            const title = item.content ? (item.content.title || item.content.body.split('
')[0]) : 'Untitled';
            const status = item.fieldValues.nodes.find(fv => fv.field && fv.field.name === STATUS_FIELD_NAME)?.name || 'N/A';
            const url = item.content?.url || 'N/A';
            const number = item.content?.number ? `#\${item.content.number}` : '';

            console.log(`- ${title} ${number} (Status: ${status}) - ${url}`);
        });
    }

} catch (error) {
    console.error(`Error listing project items: \${error.message}`);
    process.exit(1);
}
