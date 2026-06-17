const fs = require('fs');
const path = require('path');

// Target Directories
const ROOT_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT_DIR, 'skills');
const COMMANDS_DIR = path.join(ROOT_DIR, 'commands');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ANTIGRAVITY_DIR = path.join(DIST_DIR, 'antigravity');
const ANTIGRAVITY_SUBAGENTS_DIR = path.join(ANTIGRAVITY_DIR, 'subagents');
const CURSOR_RULES_DIR = path.join(DIST_DIR, 'cursor-rules');
const CURSOR_EXT_DIR = path.join(DIST_DIR, 'cursor-extension');

// Ensure output directories exist
[
    DIST_DIR,
    ANTIGRAVITY_DIR,
    ANTIGRAVITY_SUBAGENTS_DIR,
    CURSOR_RULES_DIR,
    CURSOR_EXT_DIR,
    path.join(CURSOR_EXT_DIR, 'src')
].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Helper to parse YAML-like frontmatter
function parseFrontmatter(fileContent) {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = fileContent.match(frontmatterRegex);
    
    if (!match) {
        return { metadata: {}, body: fileContent };
    }

    const rawYaml = match[1];
    const body = fileContent.replace(frontmatterRegex, '').trim();
    const metadata = {};

    const lines = rawYaml.split('\n');
    let currentKey = null;
    let currentValue = '';
    let isMultiLine = false;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Check for new key
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1 && !isMultiLine) {
            // Save previous key if any
            if (currentKey) {
                metadata[currentKey] = currentValue.trim();
            }

            const key = line.substring(0, colonIndex).trim();
            let val = line.substring(colonIndex + 1).trim();

            if (val === '>' || val === '|') {
                currentKey = key;
                currentValue = '';
                isMultiLine = true;
            } else {
                // Strip quotes if present
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.substring(1, val.length - 1);
                }
                metadata[key] = val;
                currentKey = null;
                isMultiLine = false;
            }
        } else if (isMultiLine) {
            // Append to multiline value
            currentValue += ' ' + trimmed;
        }
    });

    if (currentKey) {
        metadata[currentKey] = currentValue.trim();
    }

    return { metadata, body };
}

// Compile references for a skill
function compileReferences(skillPath, baseBody) {
    let compiledBody = baseBody;
    const refDir = path.join(skillPath, 'references');
    
    if (fs.existsSync(refDir)) {
        const refFiles = fs.readdirSync(refDir).filter(f => f.endsWith('.md'));
        if (refFiles.length > 0) {
            compiledBody += '\n\n---\n## References & Operational Protocols\n\n';
            compiledBody += 'The following sub-documents define the detailed invariants and steps for this skill:\n\n';
            
            refFiles.forEach(refFile => {
                const refFilePath = path.join(refDir, refFile);
                const refContent = fs.readFileSync(refFilePath, 'utf8');
                const refName = path.basename(refFile, '.md');
                
                compiledBody += `### Protocol: ${refName}\n\n`;
                compiledBody += `<!-- START REFERENCE: ${refFile} -->\n`;
                compiledBody += refContent.trim() + '\n';
                compiledBody += `<!-- END REFERENCE: ${refFile} -->\n\n`;
            });
        }
    }
    return compiledBody;
}

// Map skill name to appropriate Cursor rules globs
function getGlobsForSkill(skillName) {
    switch (skillName) {
        case 'ba-pitch-analyzer':
            return 'docs/shapeup-sdlc/**/*.md';
        case 'shapeup':
            return 'docs/shapeup-sdlc/**/*.md';
        case 'task-executor':
            return 'TASK-*.md';
        case 'spec-evaluator':
            return '**/*';
        default:
            return '**/*';
    }
}

// 1. Process Skills
console.log('Processing Claude Code Skills...');
const skills = fs.readdirSync(SKILLS_DIR).filter(item => {
    return fs.statSync(path.join(SKILLS_DIR, item)).isDirectory();
});

const subagentsList = [];

skills.forEach(skill => {
    const skillPath = path.join(SKILLS_DIR, skill);
    const skillFile = path.join(skillPath, 'SKILL.md');
    
    if (!fs.existsSync(skillFile)) return;
    
    console.log(`- Compiling skill: ${skill}`);
    const rawContent = fs.readFileSync(skillFile, 'utf8');
    const { metadata, body } = parseFrontmatter(rawContent);
    const compiledBody = compileReferences(skillPath, body);
    
    const skillName = metadata.name || skill;
    const skillDesc = metadata.description || 'ShapeUp SDLC skill';
    
    // Create Antigravity Subagent schema
    const subagentDef = {
        name: `shapeup-${skillName}`,
        description: skillDesc.replace(/\s+/g, ' ').substring(0, 150) + '...',
        system_prompt: compiledBody,
        enable_write_tools: ['task-executor', 'tech-lead', 'shapeup', 'ba-pitch-analyzer'].includes(skillName),
        enable_mcp_tools: true,
        enable_subagent_tools: skillName === 'tech-lead'
    };
    
    // Save Antigravity formats
    fs.writeFileSync(
        path.join(ANTIGRAVITY_SUBAGENTS_DIR, `shapeup-${skillName}.json`),
        JSON.stringify(subagentDef, null, 2)
    );
    fs.writeFileSync(
        path.join(ANTIGRAVITY_SUBAGENTS_DIR, `shapeup-${skillName}.md`),
        `# Subagent: shapeup-${skillName}\n\n${compiledBody}`
    );
    
    subagentsList.push(subagentDef);
    
    // Generate Cursor Rule (.mdc)
    const mdcContent = `---
description: ${skillDesc.replace(/\n/g, ' ')}
globs: ${getGlobsForSkill(skillName)}
alwaysApply: false
---
${compiledBody}
`;
    fs.writeFileSync(
        path.join(CURSOR_RULES_DIR, `shapeup-${skillName}.mdc`),
        mdcContent
    );
});

// Save Antigravity index list
fs.writeFileSync(
    path.join(ANTIGRAVITY_DIR, 'subagents.json'),
    JSON.stringify(subagentsList.map(s => ({
        name: s.name,
        description: s.description,
        enable_write_tools: s.enable_write_tools,
        enable_mcp_tools: s.enable_mcp_tools,
        enable_subagent_tools: s.enable_subagent_tools
    })), null, 2)
);

// 2. Process Commands (Generate Cursor Rules & Extension commands)
console.log('Processing Commands...');
let extensionCommands = [];
let extActivationCode = '';

if (fs.existsSync(COMMANDS_DIR)) {
    const commandFiles = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
    commandFiles.forEach(cmdFile => {
        const filePath = path.join(COMMANDS_DIR, cmdFile);
        const rawContent = fs.readFileSync(filePath, 'utf8');
        const { metadata, body } = parseFrontmatter(rawContent);
        
        const cmdName = path.basename(cmdFile, '.md');
        const cmdDesc = metadata.description || `ShapeUp command ${cmdName}`;
        
        console.log(`- Compiling command: /${cmdName}`);
        
        // Save as general Cursor rules tool instruction
        const mdcCmd = `---
description: Command to ${cmdDesc}. Triggers on "/${cmdName}"
globs: **/*
alwaysApply: false
---
${body}
`;
        fs.writeFileSync(
            path.join(CURSOR_RULES_DIR, `command-${cmdName}.mdc`),
            mdcCmd
        );
        
        extensionCommands.push({
            command: `shapeup-sdlc.${cmdName}`,
            title: `ShapeUp: /${cmdName} (${cmdDesc})`
        });
        
        extActivationCode += `
    let ${cmdName}Cmd = vscode.commands.registerCommand('shapeup-sdlc.${cmdName}', function () {
        const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('ShapeUp CLI');
        terminal.show();
        vscode.window.showInputBox({
            prompt: 'Arguments for /${cmdName}',
            placeHolder: 'e.g. pitch.md'
        }).then(args => {
            if (args !== undefined) {
                terminal.sendText(\`claude -p "run /${cmdName} \${args}"\`);
            }
        });
    });
    context.subscriptions.push(${cmdName}Cmd);
`;
    });
}

// 3. Output VS Code / Cursor Extension
console.log('Generating VS Code / Cursor Extension...');

// package.json for extension
const extPackageJson = {
    name: "shapeup-sdlc-integration",
    displayName: "ShapeUp SDLC Integration",
    description: "Brings ShapeUp SDLC Claude Code workspace skills and rules directly to Cursor / VS Code.",
    version: "0.1.0",
    publisher: "liberty-nguyen",
    engines: {
        "vscode": "^1.80.0"
    },
    categories: [
        "Programming Languages",
        "Extension Packs",
        "Other"
    ],
    activationEvents: [],
    main: "./extension.js",
    contributes: {
        "commands": extensionCommands
    },
    scripts: {},
    dependencies: {}
};

fs.writeFileSync(
    path.join(CURSOR_EXT_DIR, 'package.json'),
    JSON.stringify(extPackageJson, null, 2)
);

// extension.js code
const extCode = `const vscode = require('vscode');

function activate(context) {
    console.log('ShapeUp SDLC Integration Extension is now active!');
${extActivationCode}
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
`;

fs.writeFileSync(
    path.join(CURSOR_EXT_DIR, 'extension.js'),
    extCode
);

// Quickstart & Readme
const extReadme = `# ShapeUp SDLC Integration Extension

This extension integrates your **ShapeUp SDLC** workspace commands directly inside VS Code / Cursor.

## Commands Available

${extensionCommands.map(c => `*   **${c.title}** (Command ID: \`${c.command}\`)`).join('\n')}

## How to Package and Run Locally

1.  Make sure you have \`vsce\` (VS Code Extension Manager) installed:
    \`\`\`bash
    npm install -g @vscode/vsce
    \`\`\`
2.  Package the extension into a \`.vsix\` bundle:
    \`\`\`bash
    vsce package
    \`\`\`
3.  Install the generated \`.vsix\` file in Cursor or VS Code:
    *   Command Palette (\`Cmd+Shift+P\` or \`Ctrl+Shift+P\`) -> **Developer: Install Extension from VSIX...**
    *   Select the \`shapeup-sdlc-integration-0.1.0.vsix\` file.
`;

fs.writeFileSync(
    path.join(CURSOR_EXT_DIR, 'README.md'),
    extReadme
);

// Summary file
const summaryMd = `# Compile and Distribution Summary

The single-source-of-truth Claude Code config files have been successfully compiled into platform configurations.

## Antigravity (Option A)
*   Compiled JSON configurations for **${subagentsList.length} subagents** placed in \`dist/antigravity/subagents/\`.
*   A consolidated \`subagents.json\` index of the agents is at \`dist/antigravity/subagents.json\`.

## Cursor (Option C / Rules)
*   Packaged **${skills.length + extensionCommands.length} .mdc rules** under \`dist/cursor-rules/\` to drop into target project workspaces.
*   Generated a clean VS Code/Cursor extension with registered slash commands ready for packing under \`dist/cursor-extension/\`.

Run \`npm run distribute\` to recompile after changing any skill in \`skills/\` or command in \`commands/\`.
`;

fs.writeFileSync(
    path.join(DIST_DIR, 'summary.md'),
    summaryMd
);

console.log('Distribute compilation completed successfully!');
