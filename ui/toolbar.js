import { FileSystem } from '../lib/file-system.js';
import { Archiver } from '../lib/archiver.js';
import { Store } from '../store.js';
import { DB } from '../lib/db.js';
import { TreeManager } from './tree.js';

export const ToolbarManager = {
    dom: {},

    init() {
        this.dom = {
            btnMergeContext: document.getElementById('btn-merge'),
            btnRebuild: document.getElementById('btn-rebuild'),
            btnReset: document.getElementById('btn-reset'),
        };
        this.bindEvents();
    },

    bindEvents() {
        if (this.dom.btnRebuild) {
            this.dom.btnRebuild.addEventListener('click', async () => {
                if (!Store.state.contextContent) {
                    alert("Please upload a Context TXT file first.");
                    return;
                }

                const originalHtml = this.dom.btnRebuild.innerHTML;
                this.dom.btnRebuild.innerHTML = `<span class="material-symbols-outlined spin">sync</span> <span class="nav-text">BUILDING...</span>`;

                try {
                    const { blob, fileName } = await Archiver.rebuildProject(Store.state.contextContent);
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = fileName;
                    link.click();
                    URL.revokeObjectURL(link.href);
                    this.dom.btnRebuild.innerHTML = `<span class="material-symbols-outlined">check</span> <span class="nav-text">DONE</span>`;
                } catch (error) {
                    alert("Rebuild failed: " + error.message);
                    this.dom.btnRebuild.innerHTML = `<span class="material-symbols-outlined">error</span> <span class="nav-text">ERROR</span>`;
                }
                setTimeout(() => { this.dom.btnRebuild.innerHTML = originalHtml; }, 2000);
            });
        }
        if (this.dom.btnMergeContext) {
            this.dom.btnMergeContext.addEventListener('click', async () => {
                const tree = Store.state.tree;
                const selectedFiles = tree.filter(node => node.type === 'file' && node.selected);
                
                if (selectedFiles.length === 0) {
                    alert("Please upload and select source files first.");
                    return;
                }

                const originalBtnContent = this.dom.btnMergeContext.innerHTML;
                this.dom.btnMergeContext.innerHTML = `<span class="material-symbols-outlined spin">sync</span> <span class="nav-text">PACKING...</span>`;
                
                try {
                    const projectName = Store.state.projectName;
                    const finalPrompt = await FileSystem.generateFullContext(selectedFiles, tree, projectName);
                    Store.state.contextContent = finalPrompt;
                    
                    const now = new Date();
                    const dateStr = now.toISOString().slice(0,10).replace(/-/g, '');
                    const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
                    const blob = new Blob([finalPrompt], { type: "text/plain;charset=utf-8" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = `${projectName}_${dateStr}_${timeStr}.txt`;
                    link.click();
                    URL.revokeObjectURL(link.href);
                    TreeManager.addContextHistory(`${Store.state.projectName} (Merged)`, finalPrompt);
                    
                    this.dom.btnMergeContext.innerHTML = `<span class="material-symbols-outlined">check</span> <span class="nav-text">DOWNLOADED</span>`;
                } catch (err) {
                    console.error(err);
                    this.dom.btnMergeContext.innerHTML = `<span class="material-symbols-outlined">error</span> <span class="nav-text">ERROR</span>`;
                }
                setTimeout(() => { this.dom.btnMergeContext.innerHTML = originalBtnContent; }, 2000);
            });
        }
        if (this.dom.btnReset) {
            this.dom.btnReset.addEventListener('click', async () => {
                if (confirm('Are you sure you want to reset the workspace?')) {
                    try {
                        await DB.clear();
                        console.log('Database cleared.');
                    } catch (e) {
                        console.error('Failed to clear DB:', e);
                    }
                    localStorage.setItem('should_expand_sidebar', 'true');
                    window.location.reload();
                }
            });
        }
    }
};