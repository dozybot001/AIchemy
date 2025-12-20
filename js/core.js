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
        // [优化] 如果树结构已经存在且项目未变更，不再重建 DOM
        if (UI.areas.treeContainer && UI.areas.treeContainer.hasChildNodes() && !STATE.needsTreeRebuild) {
             Logic.syncTreeVisuals();
             return;
        }

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
                
                // [优化] 添加 data-path 属性，方便后续快速定位 DOM
                if (isFile) {
                    row.dataset.path = currentFullPath;
                    row.classList.add('tree-node--file');
                    
                    // 绑定事件
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
        
        // 渲染完 DOM 后，同步一次状态
        STATE.needsTreeRebuild = false;
        Logic.syncTreeVisuals();
    },

    // [新增] 轻量级状态同步，避免重绘 DOM
    syncTreeVisuals: () => {
        // 遍历所有文件节点
        const fileNodes = UI.areas.treeContainer.querySelectorAll('.tree-node--file');
        fileNodes.forEach(node => {
            const path = node.dataset.path;
            const fileObj = STATE.files.find(f => f.path === path);
            
            if (fileObj) {
                if (fileObj.excluded) {
                    node.classList.add('is-disabled');
                } else {
                    node.classList.remove('is-disabled');
                }
            }
        });
        Logic.updateStats(); // 顺便更新统计
    },

    toggleFile: (path) => {
        const file = STATE.files.find(f => f.path === path);
        if (file) {
            file.excluded = !file.excluded;
            
            // [优化] 只更新文本预览的内容 + 树的视觉样式，不重建树
            UI.areas.treeViewer.value = Logic.generateTreeText();
            Logic.syncTreeVisuals();
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
        
        // 优化：合并完成后平滑滚动到预览区顶部
        UI.areas.preview.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        Utils.showToast(UI_TEXT.toast.mergeSuccess(includedFiles.length));
    },

    generateRestorePackage: async () => {
        const content = UI.areas.restore.value || "";
        if (!content.trim()) return Utils.showToast(UI_TEXT.toast.restoreFail, "error");

        const zip = new JSZip();
        const headerRegex = /(?:^|\n)(?:\\+)?\\=== File:\s*(.*?)\s*===/g;
        
        let match;
        let count = 0;
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
    baselines: new Map(),
    dmp: new diff_match_patch(),

    registerBaseline: (filename, content) => {
        PatchLogic.baselines.set(filename, content);
    },

    parsePatchText: (text) => {
        const fileRegex = /(?:^|\n)(?:\\+)?\\=== File:\s*(.*?)\s*===\s*[\r\n]+<<<< SEARCH\s*([\s\S]*?)==== REPLACE\s*([\s\S]*?)>>>>/g;
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

    // 辅助：生成双栏 HTML 结构
    generateSplitHtml: (diffs) => {
        let oldHtml = "";
        let newHtml = "";

        diffs.forEach(([op, text]) => {
            // op: 0 = Equal, -1 = Delete, 1 = Insert
            const safeText = Utils.escapeHtml(text);
            
            if (op === 0) {
                oldHtml += safeText;
                newHtml += safeText;
            } else if (op === -1) {
                // 删除：左侧显示删除线
                oldHtml += `<del>${safeText}</del>`;
            } else if (op === 1) {
                // 新增：右侧显示高亮
                newHtml += `<ins>${safeText}</ins>`;
            }
        });

        return { oldHtml, newHtml };
    },

    previewPatch: () => {
        const input = UI.areas.patch.value;
        if (!input.trim()) return Utils.showToast(UI_TEXT.toast.patchEmpty, "error");

        const patches = PatchLogic.parsePatchText(input);
        if (patches.length === 0) return Utils.showToast(UI_TEXT.toast.patchInvalid, "error");

        PatchLogic.pendingChanges.clear();
        let finalOutputHtml = `<div class="diff-container">`; 
        let successCount = 0;

        // 辅助工具
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const normalizePath = (p) => p.trim().replace(/^\.\//, '');

        patches.forEach(p => {
            const targetPath = normalizePath(p.path);
            const targetFileName = targetPath.split('/').pop(); 

            let originalContent = null;
            let sourceLabel = "";

            // 1. 优先检查基准文件
            if (PatchLogic.baselines.has(targetFileName)) {
                originalContent = PatchLogic.baselines.get(targetFileName);
                sourceLabel = UI_TEXT.templates.labelBaseline;
            } 
            // 2. 其次检查项目文件
            else {
                const fileObj = STATE.files.find(f => normalizePath(f.path) === targetPath);
                if (fileObj) {
                    originalContent = fileObj.content;
                }
            }

            if (originalContent === null) {
                finalOutputHtml += `
                    <div class="diff-file-block">
                        <div class="diff-file-header" style="color:#ff6b6b">
                            ${UI_TEXT.templates.diffNotFound(p.path)}
                        </div>
                    </div>`;
            }

            let newContent = originalContent;
            let matchIndex = -1;
            let matchLength = 0;

            const searchBlock = p.search.replace(/\s+$/, '');
            
            // [新增] 安全检查：计算匹配项出现的次数
            // 使用 split 分割来统计出现次数 (次数 = 数组长度 - 1)
            const occurrenceCount = originalContent.split(searchBlock).length - 1;

            // 如果匹配超过 1 次，这是危险操作！
            if (occurrenceCount > 1) {
                 finalOutputHtml += `
                    <div class="diff-file-block" style="border-color: #ff9800;">
                        <div class="diff-file-header" style="background: rgba(255, 152, 0, 0.1); color: #ff9800;">
                                ${UI_TEXT.templates.diffAmbiguous(p.path)}
                        </div>
                        <div class="diff-message" style="text-align:left; color:#e3e3e3;">
                                ${UI_TEXT.templates.diffAmbiguousDesc(occurrenceCount, Utils.escapeHtml(searchBlock))}
                        </div>
                    </div>`;
                return; // 跳过此文件的处理
            }

            // === 策略 A: 精确匹配 (优先) ===
            const exactIdx = originalContent.indexOf(searchBlock);
            if (exactIdx !== -1) {
                matchIndex = exactIdx;
                matchLength = searchBlock.length;
            } 
            // === 策略 B: 宽松正则匹配 (降级) ===
            // 注意：如果上面精确匹配失败，才进这里。正则匹配较难统计次数，暂维持原样或仅做首个匹配
            else {
                 // ... (保持原本的正则逻辑 [cite: 132-135]) ...
                 const escapedSearch = escapeRegExp(searchBlock);
                 const flexiblePattern = escapedSearch.replace(/\s+/g, '\\s+');
                 // 使用全局匹配 g 来检查次数
                 const regexGlobal = new RegExp(flexiblePattern, 'g');
                 const matches = [...originalContent.matchAll(regexGlobal)];
                 
                 if (matches.length > 1) {
                    finalOutputHtml += `
                        <div class="diff-file-block" style="border-color: #ff9800;">
                            <div class="diff-file-header" style="background: rgba(255, 152, 0, 0.1); color: #ff9800;">
                                    ${UI_TEXT.templates.diffAmbiguous(p.path)}
                            </div>
                            <div class="diff-message" style="text-align:left; color:#e3e3e3;">
                                    ${UI_TEXT.templates.diffAmbiguousDesc(occurrenceCount, Utils.escapeHtml(searchBlock))}
                            </div>
                        </div>`;
                     return;
                 }
                 
                 if (matches.length === 1) {
                    matchIndex = matches[0].index;
                    matchLength = matches[0][0].length;
                    console.log(`[AIchemy] Fuzzy match fix for ${p.path}`);
                 }
            }

            // === 执行替换 ===
            // (保持原逻辑 [cite: 136])
            if (matchIndex !== -1) {
                const before = originalContent.slice(0, matchIndex);
                const after = originalContent.slice(matchIndex + matchLength);
                newContent = before + p.replace + after;
            } else {
                finalOutputHtml += `
                    <div class="diff-file-block">
                        <div class="diff-file-header">
                            ${UI_TEXT.templates.diffMatchFail(p.path)}
                        </div>
                        <div class="diff-message">
                            ${UI_TEXT.templates.diffMatchFailDesc(Utils.escapeHtml(searchBlock))}
                        </div>
                    </div>`;
                return; 
            }

            // === 生成 Diff 预览 (双栏) ===
            const diffs = PatchLogic.dmp.diff_main(originalContent, newContent);
            PatchLogic.dmp.diff_cleanupSemantic(diffs);
            
            const { oldHtml, newHtml } = PatchLogic.generateSplitHtml(diffs);

            finalOutputHtml += `
                <div class="diff-file-block">
                    <div class="diff-file-header">File: ${p.path}${sourceLabel}</div>
                    <div class="diff-split-view">
                        <div class="diff-pane pane-old">${oldHtml}</div>
                        <div class="diff-pane pane-new">${newHtml}</div>
                    </div>
                </div>`;
            
            PatchLogic.pendingChanges.set(p.path, newContent);
            successCount++;
        });

        finalOutputHtml += `</div>`;
        UI.areas.diff.innerHTML = finalOutputHtml;

        if (successCount > 0) {
            Utils.showToast(UI_TEXT.toast.diffSuccess(successCount));
            // 优化：预览生成后平滑滚动到变更区域顶部
            UI.areas.diff.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            Utils.showToast(UI_TEXT.toast.diffNoChange, "error");
        }
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