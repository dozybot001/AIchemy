function _sortChildren(childrenMap) {
    return Array.from(childrenMap.values()).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

function generateTreeString(flatStructure, projectName) {
    const selectedNodes = flatStructure.filter(n => n.selected);
    if (selectedNodes.length === 0) return 'Project Tree:\n(No files selected)\n';
    
    const tempRoot = { name: projectName, children: new Map() };
    selectedNodes.forEach(node => {
        if (node.id === projectName) return;
        const parts = node.id.split('/');
        const relativeParts = parts.slice(1);
        let current = tempRoot;
        
        relativeParts.forEach((part, index) => {
            if (!current.children.has(part)) {
                current.children.set(part, { name: part, type: 'dir', children: new Map() });
            }
            current = current.children.get(part);
            if (index === relativeParts.length - 1) current.type = node.type;
        });
    });

    const lines = ["Project Tree:", `${tempRoot.name}/`];
    const buildLines = (node, prefix = '') => {
        const children = _sortChildren(node.children);
        children.forEach((child, index) => {
            const isLast = index === children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            lines.push(`${prefix}${connector}${child.name}${child.type === 'dir' ? '/' : ''}`);
            if (child.children.size > 0) {
                buildLines(child, prefix + (isLast ? '    ' : '│   '));
            }
        });
    };
    buildLines(tempRoot);
    return lines.join('\n') + '\n';
}
async function readFileContent(file) {
    try {
        const isBinaryExt = /\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|zip|rar|pdf|exe|dll|bin)$/i.test(file.name);
        if (isBinaryExt) return `[Binary File: ${file.name} Omitted]`;

        const MAX_SIZE = 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return `[File too large: ${file.name} (${(file.size / 1024).toFixed(2)} KB) Omitted for performance]`;
        }
        const HEADER_SIZE = 512;
        const headerBlob = file.slice(0, HEADER_SIZE);
        const buffer = await headerBlob.arrayBuffer();
        const arr = new Uint8Array(buffer);
        const isBinary = arr.some(byte => byte === 0);

        if (isBinary) {
            return `[Binary Content Detected: ${file.name} Omitted]`;
        }
        return await file.text();
    } catch (e) {
        return `[Error reading ${file.name}: ${e.message}]`;
    }
}

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'GENERATE_CONTEXT') {
        const { selectedFiles, flatStructure, projectName } = payload;
        
        try {
            const treePart = generateTreeString(flatStructure, projectName);
            const separator = "=".repeat(48);
            
            const fileContents = [];
            const BATCH_SIZE = 20;
            
            for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
                const batch = selectedFiles.slice(i, i + BATCH_SIZE);
                const batchResults = await Promise.all(batch.map(async (node) => {
                    const content = await readFileContent(node.file);
                    const ext = node.name.split('.').pop() || '';
                    return `=== File: ${node.id} ===\n\`\`\`${ext}\n${content}\n\`\`\``;
                }));
                fileContents.push(...batchResults);
            }

            const finalOutput = `# Project Context\n\n${treePart}\n${separator}\n\n${fileContents.join('\n\n')}`;
            
            self.postMessage({ type: 'COMPLETE', data: finalOutput });

        } catch (error) {
            self.postMessage({ type: 'ERROR', error: error.message });
        }
    }
};