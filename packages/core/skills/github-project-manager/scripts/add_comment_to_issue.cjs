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
    const PROJECT_OWNER = config.ProjectOwner;

    const issueNumber = process.argv[2];
    const commentBody = process.argv[3];

    if (!issueNumber || !commentBody) {
        console.error('Usage: node add_comment_to_issue.cjs <issue-number> "<comment-body>"');
        process.exit(1);
    }

    const addCommentCommand = `gh issue comment ${issueNumber} --owner ${PROJECT_OWNER} --body "${commentBody}"`;
    execSync(addCommentCommand, { encoding: 'utf8', stdio: 'pipe' });

    console.log(`Successfully added comment to issue #${issueNumber}.`);

} catch (error) {
    console.error(`Error adding comment to issue: ${error.message}`);
    process.exit(1);
}
