/* ==========================================================================
   Application Entry Point & Event Binding
   ========================================================================== */

const App = {
    init: async () => {
        App.cacheDOM(); // 填充 config.js 中的 UI 对象
        App.initPlaceholders(); 
        App.mountInteractiveTree();
        App.attachUploadHandlers();
        App.attachToolbarHandlers();
        await App.fetchDefaultIgnoreRules();
        
        window.addEventListener('beforeunload', (e) => {
            if (STATE.files.length > 0) e.returnValue = "Sure?";
        });
    },

    cacheDOM: () => {
        UI.inputs.dir = document.getElementById('input-upload-directory');
        UI.inputs.file = document.getElementById('input-upload-files');
        
        UI.areas.treeViewer = document.getElementById('viewer-file-tree');
        UI.areas.preview = document.getElementById('editor-merge-result');
        UI.areas.patch = document.getElementById('input-patch-source');
        UI.areas.diff = document.getElementById('viewer-diff-result');
        UI.areas.restore = document.getElementById('input-restore-source');
        
        UI.stats.fileCount = document.getElementById('display-file-count');
        UI.stats.tokenCount = document.getElementById('display-token-estimator');
        
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
        UI.btns.previewPatch = document.getElementById('action-preview-patch');
        UI.btns.applyDiff = document.getElementById('action-apply-patch');
        UI.btns.clearDiff = document.getElementById('action-clear-diff');
        UI.btns.downloadZip = document.getElementById('action-export-zip');
        UI.btns.clearRestore = document.getElementById('btnClearRestore');
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
            const response = await fetch('ignore');
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
                Utils.showToast(`检测并应用了 ${gitIgnoreFiles.length} 个 .gitignore 文件`);
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
            Logic.renderProjectState();
            Utils.showToast(`追加了 ${fileList.length} 个文件`);
            e.target.value = '';
        };
    },

    attachToolbarHandlers: () => {
        UI.btns.copyTree.onclick = () => Utils.copyToClipboard(Logic.generateTreeText());
        
        UI.btns.clearProject.onclick = () => {
            STATE.files = [];
            STATE.projectName = "Project";
            STATE.ignoreRules = [];
            App.fetchDefaultIgnoreRules();
            Logic.renderProjectState();
            UI.areas.treeContainer.innerHTML = UI_TEXT.html.treeEmptyState;
            UI.areas.preview.value = "";
            Utils.showToast(UI_TEXT.toast.projectCleared);
        };

        UI.btns.selectAll.onclick = () => {
            STATE.files.forEach(f => f.excluded = false);
            Logic.renderProjectState();
            Utils.showToast(`已恢复全选 (${STATE.files.length} 个文件)`); 
        };

        UI.btns.mergeTrigger.onclick = Logic.mergeProjectFiles;
        UI.btns.copyPreview.onclick = () => Utils.copyToClipboard(UI.areas.preview.value);
        UI.btns.clearPreview.onclick = () => UI.areas.preview.value = "";
        
        UI.btns.downloadPreview.onclick = () => {
            const blob = new Blob([UI.areas.preview.value], { type: 'text/plain;charset=utf-8' });
            saveAs(blob, `${STATE.projectName}_${Utils.getTimestamp()}.txt`);
        };

        UI.btns.previewPatch.onclick = PatchLogic.previewPatch;
        UI.btns.clearPatch.onclick = () => UI.areas.patch.value = "";
        UI.btns.clearDiff.onclick = () => {
            UI.areas.diff.innerHTML = UI_TEXT.html.diffEmptyState;
        };
        UI.btns.applyDiff.onclick = PatchLogic.applyChanges;
        UI.btns.downloadZip.onclick = Logic.generateRestorePackage;
        UI.btns.clearRestore.onclick = () => UI.areas.restore.value = "";
    }
};

document.addEventListener('DOMContentLoaded', App.init);