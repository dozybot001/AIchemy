import { Store } from '../store.js';
import { TreeManager } from './tree.js';
import { ChatManager } from './chat.js';

export const UtilsManager = {
    dom: {},

    init() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM() {
        this.dom = {
            btnUtils: document.getElementById('btn-utils-top'),
            utilsMenu: document.getElementById('utils-menu'),
            itemCleanContext: document.getElementById('util-clean-context')
        };
    },

    bindEvents() {
        const { btnUtils, utilsMenu, itemCleanContext } = this.dom;

        if (btnUtils && utilsMenu) {
            btnUtils.addEventListener('click', (e) => {
                e.stopPropagation();
                utilsMenu.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!utilsMenu.classList.contains('hidden') && 
                    !utilsMenu.contains(e.target) && 
                    !btnUtils.contains(e.target)) {
                    utilsMenu.classList.add('hidden');
                }
            });
        }

        if (itemCleanContext) {
            itemCleanContext.addEventListener('click', () => {
                this.runCleanContext();
                if (utilsMenu) utilsMenu.classList.add('hidden');
            });
        }
    },

    runCleanContext() {
        if (!Store.state.contextContent) {
            alert("No context loaded to clean.");
            return;
        }

        const originalSize = Store.state.contextContent.length;
        let content = Store.state.contextContent;

        // 1. Remove HTML Comments content = content.replace(//g, '');

        // 2. Remove Block Comments /* ... */
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');

        // 3. Remove Line Comments // (Avoid http:// or strings)
        // Matches // preceded by start-of-line or non-colon char
        content = content.replace(/(^|[^:])\/\/.*$/gm, '$1');

        // 4. Compress Empty Lines (3 or more newlines -> 2 newlines)
        // Effectively turns "Line\n\n\nLine" into "Line\n\nLine" (Single empty line between)
        content = content.replace(/\n{3,}/g, '\n\n');

        // Update Store
        Store.state.contextContent = content;

        // Calculate saved size
        const newSize = content.length;
        const savedPercent = ((originalSize - newSize) / originalSize * 100).toFixed(1);
        // Add History (传入 content 以支持下载)
        TreeManager.addContextHistory(`${Store.state.projectName} (Cleaned)`, content);
        // Notify User
        const msg = document.createElement('div');
        msg.innerHTML = `
            <div style="background:var(--gray-l2); border:1px solid var(--gray-l3); padding:12px; border-radius:8px; display:flex; align-items:center; gap:10px;">
                <span class="material-symbols-outlined" style="color:var(--text-3)">cleaning_services</span>
                <div>
                    <div style="font-weight:500; color:var(--text-1)">Context Cleaned</div>
                    <div style="font-size:0.8rem; color:var(--text-3)">Reduced size by ${savedPercent}%</div>
                </div>
            </div>
        `;
        ChatManager.renderSystemMessage(msg);
    }
};