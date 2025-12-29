import { FileSystem } from '../lib/file-system.js';
import { Store } from '../store.js';
import { DB } from '../lib/db.js';

export const TreeManager = {
    dom: {},

    init() {
        this.dom = {
            sidebar: document.getElementById('sidebar'),
            btnMenu: document.getElementById('btn-menu'),
            uploadZoneSource: document.getElementById('upload-zone-source'),
            asciiContainer: document.getElementById('ascii-tree-view'),
            
            projectStatsBtn: document.getElementById('project-stats'),
            treePopover: document.getElementById('tree-popover'),
            statFilesEl: document.getElementById('stat-files'),
            statTokensEl: document.getElementById('stat-tokens'),
            btnMemoryView: document.getElementById('btn-memory-view'),
            ctxHistoryList: document.getElementById('context-history-list')
        };

        this.setupEventListeners();
        Store.subscribe('tree', (value) => {
            this.renderASCIITree(value);
            this.updateProjectStats(value);
        });

        Store.subscribe('isSidebarExpanded', (value) => {
            this.toggleSidebar(value);
        });

        this.renderASCIITree(Store.state.tree);
        this.toggleSidebar(Store.state.isSidebarExpanded);
    },

    setupEventListeners() {
        if (this.dom.btnMenu) {
            this.dom.btnMenu.addEventListener('click', () => {
                Store.state.isSidebarExpanded = !Store.state.isSidebarExpanded;
            });
        }

        if (this.dom.projectStatsBtn && this.dom.treePopover) {
            this.dom.projectStatsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dom.treePopover.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!this.dom.treePopover.classList.contains('hidden') && 
                    !this.dom.treePopover.contains(e.target) && 
                    !this.dom.projectStatsBtn.contains(e.target)) {
                    this.dom.treePopover.classList.add('hidden');
                }
            });
        }

        if (this.dom.asciiContainer) {
            this.dom.asciiContainer.addEventListener('click', (e) => this.handleTreeClick(e));
        }

        this.setupUploadZone(this.dom.uploadZoneSource, (files) => this.handleSourceFiles(files), true);
        this.setupUploadZone(this.dom.btnMemoryView, (files) => this.handleContextUpload(files), false, '.txt');
    },

    toggleSidebar(isExpanded) {
        if (!this.dom.sidebar) return;
        if (isExpanded) this.dom.sidebar.classList.remove('collapsed');
        else this.dom.sidebar.classList.add('collapsed');
    },

    updateProjectStats(tree) {
        if (!tree || tree.length === 0) {
            this.dom.statFilesEl.textContent = '0 Files';
            this.dom.statTokensEl.textContent = '0 Tokens';
            return;
        }
        const selectedFiles = tree.filter(n => n.type === 'file' && n.selected);
        const count = selectedFiles.length;
        
        const totalBytes = selectedFiles.reduce((acc, node) => {
            return acc + (node.file ? node.file.size : 0);
        }, 0);
        const estTokens = Math.ceil(totalBytes / 4);

        this.dom.statFilesEl.textContent = `${count} Files`;
        this.dom.statTokensEl.textContent = `~${estTokens.toLocaleString()} Tokens`;
    },

    renderASCIITree(tree) {
        const container = this.dom.asciiContainer;
        container.innerHTML = '';
        if (!tree || tree.length === 0) return; 
        const fragment = document.createDocumentFragment();
        tree.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = `tree-node ${item.type === 'dir' ? 'tree-node--folder' : 'tree-node--file'}`;
            div.dataset.index = index;

            if (!item.selected) {
                div.classList.add('is-excluded');
            }
            
            const labelClass = item.type === 'dir' ? 'node-label-folder' : 'node-label';
            
            const connectorSpan = document.createElement('span');
            connectorSpan.className = 'tree-connector';
            connectorSpan.textContent = `${item.prefix}${item.connector}`;

            const labelSpan = document.createElement('span');
            labelSpan.className = labelClass;
            labelSpan.textContent = item.name;

            div.appendChild(connectorSpan);
            div.appendChild(labelSpan);
            fragment.appendChild(div);
        });
        container.appendChild(fragment);
    },

    handleTreeClick(e) {
        e.stopPropagation();

        const target = e.target.closest('.tree-node');
        if (!target) return;

        const index = parseInt(target.dataset.index, 10);
        if (isNaN(index)) return;

        Store.toggleNodeSelection(index);
    },

    async handleSourceFiles(files) {
        if (!files.length) return;
        this.dom.asciiContainer.innerHTML = '<div style="padding:20px; color:var(--text-4);">Scanning files...</div>';

        try {
            const result = await FileSystem.buildFileTree(files);
            if (!result) return;
            const flatTree = FileSystem.flattenTree(result.root);
            Store.setProject(result.projectName, flatTree);

            if (!Store.state.isSidebarExpanded) {
                Store.state.isSidebarExpanded = true;
            }
        } catch (error) {
            console.error("File processing error:", error);
            this.dom.asciiContainer.innerHTML = '<div style="padding:20px; color:var(--accent-red);">Error processing files.</div>';
        }
    },

    async handleContextUpload(files) {
        if (!files.length) return;
        const file = files[0]; 
        
        try {
            const content = await FileSystem.readFileContent(file);
            Store.state.contextContent = content;

            // Extract project name for DB restoration
            const treeMatch = content.match(/^Project Tree:\n(.*?)\//m);
            const extractedName = treeMatch ? treeMatch[1].trim() : file.name.replace(/\.txt$/i, '');
            Store.state.projectName = extractedName;

            this.addContextHistory(file.name, content);
        } catch (e) {
            console.error("Failed to read context file", e);
            alert("Error reading context file");
            return;
        }

        if (!Store.state.isSidebarExpanded && this.dom.btnMenu) {
            this.dom.btnMenu.click();
        }
    },

    // 加载初始历史记录
    async initHistory() {
        if (!this.dom.ctxHistoryList) return;
        try {
            const history = await DB.get('context_history') || [];
            if (history.length > 0) {
                const emptyState = this.dom.ctxHistoryList.querySelector('.ctx-empty-state');
                if (emptyState) emptyState.remove();
                // 倒序渲染，因为 DOM prepend 是插到前面，但数组我们想保持时间顺序
                [...history].reverse().forEach(h => this.renderHistoryItem(h));
            }
        } catch (e) {
            console.warn("Failed to load history", e);
        }
    },

    async addContextHistory(name, contentPayload) {
        if (!this.dom.ctxHistoryList) return;
        if (!contentPayload) return; // 必须有内容才能保存

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const historyItem = {
            id: Date.now(),
            name: name,
            content: contentPayload,
            timeStr: timeStr
        };

        // 更新 DB (保持最近 7 条)
        try {
            let history = await DB.get('context_history') || [];
            history.unshift(historyItem);
            if (history.length > 7) history = history.slice(0, 7);
            await DB.set('context_history', history);
        } catch (e) {
            console.error("DB History Save Error", e);
        }

        // 更新 UI
        const emptyState = this.dom.ctxHistoryList.querySelector('.ctx-empty-state');
        if (emptyState) emptyState.remove();
        
        // 移除 UI 上超过 7 条的旧元素
        const currentItems = this.dom.ctxHistoryList.querySelectorAll('.ctx-history-item');
        if (currentItems.length >= 7) {
            currentItems[currentItems.length - 1].remove();
        }

        this.renderHistoryItem(historyItem);
    },

    renderHistoryItem(item) {
        const div = document.createElement('div');
        div.className = 'ctx-history-item';
        div.style.cursor = 'pointer';
        div.title = 'Click to Download TXT';
        
        div.onclick = () => {
            const blob = new Blob([item.content], { type: "text/plain;charset=utf-8" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${item.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`;
            link.click();
            URL.revokeObjectURL(link.href);
        };

        div.innerHTML = `
            <span class="ctx-filename">${item.name}</span>
            <span class="ctx-date">${item.timeStr}</span>
        `;
        this.dom.ctxHistoryList.prepend(div);
    },

    setupUploadZone(zoneElement, handler, isDirectory = false, accept = '') {
        if (!zoneElement) return;
        zoneElement.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            if (accept) fileInput.accept = accept;
            if (isDirectory) fileInput.webkitdirectory = true;
            fileInput.multiple = isDirectory; 
            fileInput.onchange = (e) => handler(e.target.files);
            fileInput.click();
        });
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            zoneElement.addEventListener(eventName, (e) => {
                e.preventDefault(); 
                e.stopPropagation();
            }, false);
        });
        zoneElement.addEventListener('dragover', () => zoneElement.classList.add('drag-active'));
        zoneElement.addEventListener('dragleave', () => zoneElement.classList.remove('drag-active'));
        zoneElement.addEventListener('drop', (e) => {
            zoneElement.classList.remove('drag-active');
            handler(e.dataTransfer.files);
        });
    }
};