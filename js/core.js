/* ==========================================================================
   Core Logic: Tree & Smelting
   ========================================================================== */
const Logic = {
    getActiveFiles: () => STATE.files.filter(f => !f.excluded),

    generateTreeText: () => {
        const tree = {};
        Logic.getActiveFiles().forEach(f => {
            f.path.split('/').reduce((r, k) => r[k] = r[k] || {}, tree);
        });
        const print = (node, prefix = "") => {
            const keys = Object.keys(node).sort();
            return keys.map((key, i) => {
                const last = i === keys.length - 1;
                const str = prefix + (last ? "└── " : "├── ") + key + "\n";
                const children = Object.keys(node[key]).length 
                    ? print(node[key], prefix + (last ? "    " : "│   ")) 
                    : "";
                return str + children;
            }).join('');
        };
        return `Project: ${STATE.projectName}\nRoot/\n${print(tree)}`;
    },

    renderInteractiveTree: () => {
        if (!UI.areas.treeContainer) return;
        UI.areas.treeContainer.innerHTML = ''; 

        const tree = {};
        STATE.files.forEach(f => {
            let current = tree;
            f.path.split('/').forEach((part, index, arr) => {
                if (!current[part]) current[part] = index === arr.length - 1 ? "__FILE__" : {};
                current = current[part];
            });
        });

        const buildDom = (node, container, prefix = "", fullPathPrefix = "") => {
            const keys = Object.keys(node).sort();
            keys.forEach((key, i) => {
                const isFile = node[key] === "__FILE__";
                const last = i === keys.length - 1;
                const currentFullPath = fullPathPrefix ? `${fullPathPrefix}/${key}` : key;
                const row = document.createElement('div');
                row.className = 'tree-node';
                
                if (isFile) {
                    const fileObj = STATE.files.find(f => f.path === currentFullPath);
                    row.classList.add('tree-node--file');
                    if (fileObj && fileObj.excluded) row.classList.add('is-disabled');
                    row.onclick = (e) => {
                        e.stopPropagation();
                        Logic.toggleFile(currentFullPath);
                    };
                }

                const prefixSpan = document.createElement('span');
                prefixSpan.textContent = prefix + (last ? "└── " : "├── ");
                prefixSpan.style.opacity = "0.5";
                
                const nameSpan = document.createElement('span');
                nameSpan.className = `node-label ${isFile ? '' : 'tree-node--folder'}`;
                nameSpan.textContent = key;

                row.appendChild(prefixSpan);
                row.appendChild(nameSpan);
                container.appendChild(row);

                if (!isFile) {
                    buildDom(node[key], container, prefix + (last ? "    " : "│   "), currentFullPath);
                }
            });
        };

        const header = document.createElement('div');
        header.className = 'tree-node';
        header.innerHTML = `<span class="tree-node--folder">Project: ${STATE.projectName}</span>`;
        UI.areas.treeContainer.appendChild(header);
        buildDom(tree, UI.areas.treeContainer);
    },

    toggleFile: (path) => {
        const file = STATE.files.find(f => f.path === path);
        if (file) {
            file.excluded = !file.excluded;
            Logic.renderProjectState();
        }
    },

    updateStats: () => {
        const includedFiles = Logic.getActiveFiles();
        UI.stats.fileCount.innerText = includedFiles.length;
        const totalContent = includedFiles.map(f => f.content).join("");
        UI.stats.tokenCount.innerText = `~${Utils.estimateTokens(totalContent).toLocaleString()}`;
    },

    renderProjectState: () => {
        UI.areas.treeViewer.value = Logic.generateTreeText();
        Logic.renderInteractiveTree();
        Logic.updateStats();
    },

    mergeProjectFiles: () => {
        const includedFiles = Logic.getActiveFiles();
        if (includedFiles.length === 0) return Utils.showToast(UI_TEXT.toast.noMergeFiles, "error");
        
        const treeStr = Logic.generateTreeText();
        const contentStr = includedFiles.map(f => {
            const safeContent = f.content.replaceAll(MAGIC_TOKEN, ESCAPED_TOKEN);
            const lang = getLangFromExt(f.path);
            return `${MAGIC_TOKEN} ${f.path} ===\n\`\`\`${lang}\n${safeContent}\n\`\`\`\n`;
        }).join("\n");

        const finalOutput = `${UI_TEXT.prompt.header}${treeStr}\n================================================\n\n${contentStr}`;
        UI.areas.preview.value = finalOutput;
        UI.areas.preview.parentElement.scrollIntoView({ behavior: 'smooth' });
        Utils.showToast(UI_TEXT.toast.mergeSuccess(includedFiles.length));
    },

    generateRestorePackage: async () => {
        const content = UI.areas.restore.value || ""; // [cite: 85-86]
        if (!content.trim()) return Utils.showToast(UI_TEXT.toast.restoreFail, "error");

        const zip = new JSZip();
        const headerRegex = /(?:^|\n)(?:\\+)?=== File:\s*(.*?)\s*===/g;
        
        let match;
        let count = 0; // [cite: 87]
        const files = [];

        while ((match = headerRegex.exec(content)) !== null) {
            files.push({
                path: match[1].trim(),
                startIndex: match.index + match[0].length,
                fullMatchIndex: match.index
            });
        }

        if (files.length === 0) return Utils.showToast(UI_TEXT.toast.restoreNoTag, "error");

        for (let i = 0; i < files.length; i++) {
            const current = files[i];
            const next = files[i + 1];
            let rawChunk = next 
                ? content.substring(current.startIndex, next.fullMatchIndex) 
                : content.substring(current.startIndex);
            let cleanContent = "";
            let processedChunk = rawChunk.trim();
            const hasOpeningFence = /^\s*```/.test(processedChunk);
            const hasClosingFence = /```\s*$/.test(processedChunk);

            if (hasOpeningFence && hasClosingFence) {
                const firstNewLineIndex = processedChunk.indexOf('\n');
                const lastFenceIndex = processedChunk.lastIndexOf('```');

                if (firstNewLineIndex !== -1 && lastFenceIndex > firstNewLineIndex) {
                    cleanContent = processedChunk.substring(firstNewLineIndex + 1, lastFenceIndex);
                } else {
                    cleanContent = ""; 
                }
            } else {
                console.warn(`File ${current.path} fallback to raw text mode.`);
                cleanContent = rawChunk.trim();
            }

            cleanContent = cleanContent.replaceAll(ESCAPED_TOKEN, MAGIC_TOKEN);
            if (cleanContent) {
                zip.file(current.path, cleanContent);
                count++;
            }
        }

        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, `${STATE.projectName}_restore_${Utils.getTimestamp()}.zip`);
        Utils.showToast(UI_TEXT.toast.restoreSuccess(count));
    }
};

/* ==========================================================================
   Patch & Diff Engine
   ========================================================================== */
const PatchLogic = {
    pendingChanges: new Map(),
    dmp: new diff_match_patch(),

    parsePatchText: (text) => {
        const fileRegex = /(?:^|\n)(?:\\+)?=== File:\s*(.*?)\s*===\s*[\r\n]+<<<< SEARCH\s*([\s\S]*?)==== REPLACE\s*([\s\S]*?)>>>>/g;
        const patches = [];
        let match;
        while ((match = fileRegex.exec(text)) !== null) {
            patches.push({
                path: match[1].trim(),
                search: match[2], 
                replace: match[3]
            });
        }
        return patches;
    },

    previewPatch: () => {
        const input = UI.areas.patch.value;
        if (!input.trim()) return Utils.showToast(UI_TEXT.toast.patchEmpty, "error");

        const patches = PatchLogic.parsePatchText(input);
        if (patches.length === 0) return Utils.showToast(UI_TEXT.toast.patchInvalid, "error");

        PatchLogic.pendingChanges.clear();
        let diffHtmlAccumulator = "";
        let successCount = 0;

        patches.forEach(p => {
            const fileObj = STATE.files.find(f => f.path === p.path);
            if (!fileObj) {
                diffHtmlAccumulator += `<div class="diff-separator">❌ 未找到文件: ${p.path}</div>`;
                return;
            }

            const originalContent = fileObj.content;
            let newContent = originalContent;
            
            const searchBlock = p.search.replace(/\r?\n$/, ''); 
            const replaceBlock = p.replace.replace(/\r?\n$/, '');

            if (originalContent.includes(searchBlock)) {
                newContent = originalContent.replace(searchBlock, replaceBlock);
            } else if (originalContent.includes(p.search)) {
                newContent = originalContent.replace(p.search, p.replace);
            } else {
                diffHtmlAccumulator += `<div class="diff-separator">⚠️ 匹配失败: ${p.path}</div>`;
                diffHtmlAccumulator += `<pre style="color:red; opacity:0.7">${Utils.escapeHtml(searchBlock.slice(0, 100))}...</pre>`;
                return;
            }

            const diffs = PatchLogic.dmp.diff_main(originalContent, newContent);
            PatchLogic.dmp.diff_cleanupSemantic(diffs);
            const html = PatchLogic.dmp.diff_prettyHtml(diffs);

            diffHtmlAccumulator += `<div class="diff-separator">File: ${p.path}</div>`;
            diffHtmlAccumulator += `<div class="diff-content">${html}</div>`;
            PatchLogic.pendingChanges.set(p.path, newContent);
            successCount++;
        });

        UI.areas.diff.innerHTML = diffHtmlAccumulator;
        if (successCount > 0) Utils.showToast(UI_TEXT.toast.diffSuccess(successCount));
        else Utils.showToast(UI_TEXT.toast.diffNoChange, "error");
    },

    applyChanges: () => {
        if (PatchLogic.pendingChanges.size === 0) {
            return Utils.showToast(UI_TEXT.toast.applyNoChange, "error");
        }
        let count = 0;
        PatchLogic.pendingChanges.forEach((newContent, path) => {
            const fileObj = STATE.files.find(f => f.path === path);
            if (fileObj) {
                fileObj.content = newContent;
                count++;
            }
        });
        Logic.renderProjectState();
        PatchLogic.pendingChanges.clear();
        UI.areas.patch.value = "";
        UI.areas.diff.innerHTML = "";
        Utils.showToast(UI_TEXT.toast.applySuccess(count));
    }
};