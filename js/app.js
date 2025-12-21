/* ==========================================================================
   Application Entry Point & Event Binding
   ========================================================================== */

const App = {
    init: async () => {
        App.cacheDOM(); // 填充 config.js 中的 UI 对象
        App.renderStaticText();
        App.initPlaceholders(); 
        App.mountInteractiveTree();
        App.attachUploadHandlers();
        App.attachDragAndDropHandlers();
        App.attachToolbarHandlers();
        await App.fetchDefaultIgnoreRules();
        
        window.addEventListener('beforeunload', (e) => {
            if (STATE.files.length > 0) e.returnValue = UI_TEXT.toast.beforeUnload;
        });
    },

    cacheDOM: () => {
        UI.btns.switchLang = document.getElementById('action-switch-lang');
        UI.inputs.dir = document.getElementById('input-upload-directory');
        UI.inputs.file = document.getElementById('input-upload-files');
        UI.inputs.baseline = document.getElementById('input-upload-baseline');

        UI.modals = {};
        UI.modals.settings = document.getElementById('modal-settings');
        UI.btns.openSettings = document.getElementById('action-settings');
        UI.btns.closeSettings = document.getElementById('action-close-settings');
        UI.btns.saveSettings = document.getElementById('action-save-settings');
        UI.inputs.settingUrl = document.getElementById('setting-base-url');
        UI.inputs.settingKey = document.getElementById('setting-api-key');
        UI.inputs.settingModel = document.getElementById('setting-model');
        
        // 在 App.cacheDOM 中更新 Prompt Architect 相关的引用
        UI.inputs.reqCommand = document.getElementById('input-req-command');
        UI.btns.analyzeReq = document.getElementById('action-analyze-req');
        UI.btns.genPrompt = document.getElementById('action-gen-prompt');
        UI.btns.copyPrompt = document.getElementById('action-copy-prompt'); // 新增引用
        UI.btns.resetArchitect = document.getElementById('action-reset-architect');

        UI.areas.treeViewer = document.getElementById('viewer-file-tree');
        UI.areas.preview = document.getElementById('editor-merge-result');
        UI.areas.patch = document.getElementById('input-patch-source');
        UI.areas.diff = document.getElementById('viewer-diff-result');
        UI.areas.restore = document.getElementById('input-restore-source');
        
        UI.stats.fileCount = document.getElementById('display-file-count');
        UI.stats.tokenCount = document.getElementById('display-token-estimator');
        UI.stats.baselineName = document.getElementById('display-baseline-name');

        UI.btns.upload = document.getElementById('action-import-dir');
        UI.btns.add = document.getElementById('action-append-files');
        UI.btns.copyTree = document.getElementById('action-copy-structure');
        UI.btns.selectAll = document.getElementById('action-select-all');
        UI.btns.mergeTrigger = document.getElementById('action-merge-content');
        UI.btns.clearProject = document.getElementById('action-reset-workspace');
        UI.btns.copyPreview = document.getElementById('action-copy-result');
        UI.btns.downloadPreview = document.getElementById('action-download-text');
        UI.btns.clearPreview = document.getElementById('action-clear-result');
        UI.btns.clearPatch = document.getElementById('action-clear-patch'); 
        UI.btns.uploadBaseline = document.getElementById('action-upload-baseline');
        UI.btns.previewPatch = document.getElementById('action-preview-patch');
        UI.btns.applyDownload = document.getElementById('action-apply-download'); // 新增
        UI.btns.applyCopy = document.getElementById('action-apply-copy');         // 新增
        UI.btns.clearDiff = document.getElementById('action-clear-diff');
        UI.btns.downloadZip = document.getElementById('action-export-zip');
        UI.btns.clearRestore = document.getElementById('btnClearRestore');
    },
    switchLanguage: () => {
        // 1. 切换状态
        STATE.lang = STATE.lang === 'zh' ? 'en' : 'zh';

        // 2. 更新全局文本对象
        UI_TEXT = I18N_RESOURCES[STATE.lang];

        // 3. 重新渲染静态文本 (data-i18n)
        App.renderStaticText();

        // 4. 重新初始化占位符 (placeholder)
        App.initPlaceholders();

        // 5. 特殊处理：如果有空状态的 innerHTML，需要手动刷新
        if (!STATE.files.length) {
            if (UI.areas.treeContainer) UI.areas.treeContainer.innerHTML = UI_TEXT.html.treeWaiting;
        }
        if (!UI.areas.diff.textContent.trim()) { // 简单判断是否为空状态
            UI.areas.diff.innerHTML = UI_TEXT.html.diffEmptyState;
        }

        // 6. 提示用户
        Utils.showToast(`Language switched to ${STATE.lang === 'zh' ? '中文' : 'English'}`);
    },

    renderStaticText: () => {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const keyPath = el.getAttribute('data-i18n');
            // 通过 'buttons.import' 这种字符串路径去 UI_TEXT 对象里取值
            const text = keyPath.split('.').reduce((obj, key) => obj && obj[key], UI_TEXT);
            if (text) {
                el.textContent = text;
            } else {
                console.warn(`Missing translation for key: ${keyPath}`);
            }
        });
    },

    initPlaceholders: () => {
        UI.areas.treeViewer.placeholder = UI_TEXT.placeholder.tree;
        UI.areas.preview.placeholder = UI_TEXT.placeholder.merge;
        UI.areas.patch.placeholder = UI_TEXT.placeholder.patch;
        UI.areas.restore.placeholder = UI_TEXT.placeholder.restore;
        UI.areas.diff.innerHTML = UI_TEXT.html.diffEmptyState;
    },

    fetchDefaultIgnoreRules: async () => {
        try {
            const response = await fetch('ignore.txt');
            if (!response.ok) return console.warn("未找到 ignore 文件");
            
            const text = await response.text();
            const rules = text.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            STATE.ignoreRules.push(...rules);
            console.log(`[AIchemy] 已加载 ${rules.length} 条默认过滤规则`);
        } catch (error) {
            console.error("无法加载 ignore 文件:", error);
        }
    },

    mountInteractiveTree: () => {
        const oldArea = UI.areas.treeViewer;
        const newDiv = document.createElement('div');
        newDiv.id = 'guiProjectTree';
        newDiv.className = 'file-tree-widget';
        newDiv.innerHTML = UI_TEXT.html.treeWaiting;
        
        oldArea.parentNode.insertBefore(newDiv, oldArea.nextSibling);
        oldArea.classList.add('hidden');
        UI.areas.treeContainer = newDiv;
    },

    attachUploadHandlers: () => {
        UI.btns.upload.onclick = () => UI.inputs.dir.click();
        
        UI.inputs.dir.onchange = async (e) => {
            const fileList = Array.from(e.target.files);
            if (!fileList.length) return;

            STATE.files = [];
            STATE.projectName = fileList[0].webkitRelativePath.split('/')[0] || "Project";
            STATE.ignoreRules = []; 
            
            await App.fetchDefaultIgnoreRules();
            
            const gitIgnoreFiles = fileList.filter(f => f.name === '.gitignore');
            if (gitIgnoreFiles.length > 0) {
                for (const gitIgnore of gitIgnoreFiles) {
                    const text = await Utils.readFile(gitIgnore);
                    const customRules = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
                    STATE.ignoreRules.push(...customRules);
                }
                Utils.showToast(UI_TEXT.toast.gitIgnoreDetected(gitIgnoreFiles.length));
            }

            let loaded = 0;
            let ignoredCount = 0;
            for (const f of fileList) {
                const path = f.webkitRelativePath || f.name;
                if (Utils.shouldIgnore(path)) {
                    ignoredCount++;
                    continue;
                }
                STATE.files.push({ path, content: await Utils.readFile(f), originalFile: f });
                loaded++;
            }
            STATE.needsTreeRebuild = true; // 强制下一次渲染重建 DOM
            Logic.renderProjectState();
            Utils.showToast(UI_TEXT.toast.projectLoaded(loaded, ignoredCount));
            e.target.value = '';
        };

        UI.btns.add.onclick = () => UI.inputs.file.click();
        
        UI.inputs.file.onchange = async (e) => {
            const fileList = Array.from(e.target.files);
            for (const f of fileList) {
                const path = "Extra/" + f.name;
                if (Utils.shouldIgnore(path)) continue;

                const content = await Utils.readFile(f);
                const existIdx = STATE.files.findIndex(x => x.path === path);
                if (existIdx > -1) STATE.files[existIdx].content = content;
                else STATE.files.push({ path, content, originalFile: f });
            }
            STATE.needsTreeRebuild = true; // 强制下一次渲染重建 DOM
            Logic.renderProjectState();
            Utils.showToast(UI_TEXT.toast.addedFiles(fileList.length));
            e.target.value = '';
        };
    },

    attachToolbarHandlers: () => {
        UI.btns.switchLang.onclick = App.switchLanguage;

        UI.btns.openSettings.onclick = () => {
            //以此回填 LocalStorage 中的数据
            const config = RequirementLogic.getLLMConfig();
            UI.inputs.settingUrl.value = config.baseUrl;
            UI.inputs.settingKey.value = config.apiKey || '';
            UI.inputs.settingModel.value = config.model;
            UI.modals.settings.classList.remove('hidden');
        };

        UI.btns.closeSettings.onclick = () => UI.modals.settings.classList.add('hidden');

        UI.btns.saveSettings.onclick = () => {
            const config = {
                baseUrl: UI.inputs.settingUrl.value.trim(),
                apiKey: UI.inputs.settingKey.value.trim(),
                model: UI.inputs.settingModel.value.trim()
            };
            RequirementLogic.saveLLMConfig(config);
            UI.modals.settings.classList.add('hidden');
            Utils.showToast("配置已保存", "success"); // 假设你有个success类型的toast样式
        };
        
        UI.btns.analyzeReq.onclick = async () => {
            const val = UI.inputs.reqCommand.value.trim();
            if(!val) return Utils.showToast("请输入需求指令", "error");

            const originalText = UI.btns.analyzeReq.textContent;
            UI.btns.analyzeReq.textContent = "⏳...";
            try {
                const schema = await RequirementLogic.fetchMockOptions(val);
                RequirementLogic.renderOptions(schema);
            } catch(e) {
                console.error(e);
            } finally {
                UI.btns.analyzeReq.textContent = originalText;
            }
        };
        UI.btns.genPrompt.onclick = RequirementLogic.generateFinalPrompt;
        UI.btns.copyPrompt.onclick = () => {
            const content = document.getElementById('output-architect-prompt').value;
            Utils.copyToClipboard(content);
        };
        UI.btns.resetArchitect.onclick = () => {
            UI.inputs.reqCommand.value = "";
            document.getElementById('container-req-options').innerHTML = "";
            document.getElementById('container-req-options').classList.add('hidden');

            const output = document.getElementById('output-architect-prompt');
            output.value = "";
            output.style.height = "auto";
            document.getElementById('container-final-prompt').classList.add('hidden');
        };
        UI.btns.copyTree.onclick = () => Utils.copyToClipboard(Logic.generateTreeText());
        UI.btns.clearProject.onclick = () => {
            STATE.files = [];
            STATE.projectName = "Project";
            STATE.ignoreRules = [];
            App.fetchDefaultIgnoreRules();
            Logic.renderProjectState();
            UI.areas.treeContainer.innerHTML = UI_TEXT.html.treeEmptyState;
            UI.areas.preview.value = "";
            UI.stats.baselineName.innerText = UI_TEXT.labels.baselineName;
            Utils.showToast(UI_TEXT.toast.projectCleared);
        };
        UI.btns.selectAll.onclick = () => {
            STATE.files.forEach(f => f.excluded = false);
            Logic.renderProjectState();
            // ✅ 修正：
            Utils.showToast(UI_TEXT.toast.treeRestored(STATE.files.length)); 
        };
        UI.btns.mergeTrigger.onclick = Logic.mergeProjectFiles;
        UI.btns.copyPreview.onclick = () => Utils.copyToClipboard(UI.areas.preview.value);
        UI.btns.clearPreview.onclick = () => UI.areas.preview.value = "";
        
        UI.btns.downloadPreview.onclick = () => {
            const blob = new Blob([UI.areas.preview.value], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, `${STATE.projectName}_${Utils.getTimestamp()}.txt`);
        };

        UI.btns.uploadBaseline.onclick = () => UI.inputs.baseline.click();

        UI.inputs.baseline.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const content = await Utils.readFile(file);
            // 调用 Core 中的逻辑注册基准文件
            PatchLogic.registerBaseline(file.name, content);
            UI.stats.baselineName.innerText = file.name;

            Utils.showToast(`已加载基准文件: ${file.name}`);
            e.target.value = ''; // 重置 input 以允许重复上传同名文件
        };

        UI.btns.previewPatch.onclick = PatchLogic.previewPatch;
        UI.btns.clearPatch.onclick = () => UI.areas.patch.value = "";
        UI.btns.clearDiff.onclick = () => {
            UI.areas.diff.innerHTML = UI_TEXT.html.diffEmptyState;
        };
        UI.btns.applyDownload.onclick = PatchLogic.applyAndDownload; // 绑定下载逻辑
        UI.btns.applyCopy.onclick = PatchLogic.applyAndCopy;         // 绑定复制逻辑
        UI.btns.downloadZip.onclick = Logic.generateRestorePackage;
        UI.btns.clearRestore.onclick = () => UI.areas.restore.value = "";
    },

    // === 在 App 对象中添加以下新方法 ===

    attachDragAndDropHandlers: () => {
        const dropZone = UI.areas.treeContainer; // 使用生成的 div 容器 

        // 1. 阻止默认行为并添加视觉反馈
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // 2. 视觉交互样式 toggle
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('is-dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('is-dragover'), false);
        });

        // 3. 核心 Drop 处理逻辑
        dropZone.addEventListener('drop', async (e) => {
            // [关键] 必须在这里立即获取 items，不能等 await
            const items = e.dataTransfer.items;
            if (!items || items.length === 0) return;

            // [关键步骤 1] 在进入任何异步操作前，同步提取所有 Entry
            // 此时 items 还是有效的，一旦经过 await 就会变空
            const entries = [];
            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry();
                if (entry) entries.push(entry);
            }

            Utils.showToast("正在解析文件结构...", "info");

            try {
                // [关键步骤 2] 现在可以放心地进行异步初始化了
                STATE.files = [];
                STATE.ignoreRules = [];
                await App.fetchDefaultIgnoreRules();

                let processedCount = 0;
                let ignoredCount = 0;

                // [关键步骤 3] 使用之前保存好的 entries 数组进行遍历
                for (const entry of entries) {
                    // 如果是拖入的整个文件夹，将其名称设为项目名
                    if (entry.isDirectory && STATE.files.length === 0) {
                        STATE.projectName = entry.name;
                    }
                    
                    // 开始递归扫描
                    await App.scanEntry(entry, "", (file, path) => {
                        if (Utils.shouldIgnore(path)) {
                            ignoredCount++;
                            return;
                        }
                        STATE.files.push({ path, content: file, originalFile: null });
                        processedCount++;
                    });
                }

                STATE.needsTreeRebuild = true;
                Logic.renderProjectState();
                Utils.showToast(UI_TEXT.toast.projectLoaded(processedCount, ignoredCount));

            } catch (error) {
                console.error("[AIchemy] 拖拽处理错误:", error);
                Utils.showToast("文件解析发生错误", "error");
            }
        });
    },

    /**
     * 递归扫描 FileSystemEntry
     * @param {FileSystemEntry} entry - 当前入口
     * @param {String} pathPrefix - 路径前缀
     * @param {Function} callback - 处理文件内容的回调
     */
    /**
     * [Fix] 健壮的递归扫描，增加错误捕获，防止单个文件读取失败导致整个流程卡死
     */
    scanEntry: async (entry, pathPrefix, callback) => {
        // 1. 如果是文件
        if (entry.isFile) {
            return new Promise((resolve) => {
                entry.file(
                    // 成功回调
                    async (file) => {
                        const relativePath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
                        try {
                            const content = await Utils.readFile(file);
                            callback(content, relativePath);
                        } catch (err) {
                            console.warn(`[AIchemy] 读取文件内容失败: ${relativePath}`, err);
                        }
                        resolve(); // 无论读写成功与否，必须 resolve 以继续流程
                    },
                    // [关键修复] 失败回调：防止 Promise 永远 pending
                    (err) => {
                        console.warn(`[AIchemy] 无法访问文件 Entry: ${entry.name}`, err);
                        resolve(); // 出错也 resolve，跳过坏文件
                    }
                );
            });
        } 
        // 2. 如果是文件夹
        else if (entry.isDirectory) {
            const newPrefix = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
            const dirReader = entry.createReader();
            
            // 封装读取器为 Promise
            const readBatch = () => new Promise((resolve, reject) => {
                dirReader.readEntries(resolve, reject);
            });

            let allEntries = [];
            let keepReading = true;

            try {
                while (keepReading) {
                    const batch = await readBatch();
                    if (batch.length > 0) {
                        allEntries = allEntries.concat(batch);
                    } else {
                        keepReading = false;
                    }
                }
            } catch (err) {
                console.warn(`[AIchemy] 读取目录结构失败: ${newPrefix}`, err);
                return; // 目录读取失败则跳过该目录
            }

            // 递归处理子项
            for (const child of allEntries) {
                await App.scanEntry(child, newPrefix, callback);
            }
        }
    },
};

document.addEventListener('DOMContentLoaded', App.init);