import { PatchEngine } from '../../lib/patch-engine.js';
import { Store } from '../../store.js';
import { ChatManager } from '../chat.js';
import { TreeManager } from '../tree.js';

export const PatchMode = {
    currentMatches: [],
    async handle(inputText) {
        if (!Store.state.contextContent) {
            ChatManager.renderSystemMessage(`<div class="error-banner"><span class="material-symbols-outlined">error</span> No context loaded. Please upload files and click "Merge Project" first.</div>`);
            return;
        }
        const patches = PatchEngine.parseInput(inputText);
        
        if (patches.length === 0) {
            const errorMsg = document.createElement('div');
            errorMsg.innerHTML = `
                <div style="color:var(--text-4); padding: 12px; background: var(--gray-l2); border-radius: 8px; display:inline-flex; align-items:center; gap:8px;">
                    <span class="material-symbols-outlined">info</span>
                    No valid SEARCH/REPLACE blocks found. Use the standard format.
                </div>
            `;
            ChatManager.renderSystemMessage(errorMsg);
            return;
        }
        const matches = PatchEngine.findMatches(Store.state.contextContent, patches);
        this.currentMatches = matches; 
        const onApplySuccess = (count) => {
            const successMsg = document.createElement('div');
            successMsg.innerHTML = `
                <div style="background:var(--gray-l2); color:var(--state-success-text); padding:16px; border-radius:8px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px; border:1px solid var(--state-success-bg);">
                    <span class="material-symbols-outlined" style="font-size:32px;">check_circle</span>
                    <strong>${count} Patches Applied</strong>
                    <div style="font-size:0.85rem; opacity: 0.8;">Memory updated locally. Rebuild to download.</div>
                </div>
            `;
            ChatManager.renderSystemMessage(successMsg);
        };

        const container = this.renderDiffUI(matches, onApplySuccess);
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-row ai';
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ai bubble-wide';
        bubble.appendChild(container);
        wrapper.appendChild(bubble);
        ChatManager.dom.outputArea.appendChild(wrapper);
        ChatManager.scrollToBottom();
    },

    renderDiffUI(matches, onApplySuccess) {
        if (!document.getElementById('patch-interaction-styles')) {
            const style = document.createElement('style');
            style.id = 'patch-interaction-styles';
            style.textContent = `
                .diff-card.interactive { cursor: pointer; transition: opacity 0.2s, filter 0.2s; user-select: none; }
                .diff-card.patch-excluded { opacity: 0.4; filter: grayscale(1); }
                .diff-card.patch-excluded .diff-file-name { text-decoration: line-through; color: var(--text-4); }
                .diff-card.patch-excluded .diff-header { background: var(--gray-l2); }
            `;
            document.head.appendChild(style);
        }

        const container = document.createElement('div');
        container.className = 'diff-container';
        container.innerHTML = `
            <h3 style="color:var(--text-2); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                <span class="material-symbols-outlined">rate_review</span> 
                Diff Preview (${matches.filter(m=>m.isValid).length} valid)
            </h3>
        `;
        
        matches.forEach((match, idx) => {
            const card = document.createElement('div');
            card.className = 'diff-card';
            card.dataset.idx = idx;

            if (match.isValid) {
                card.classList.add('interactive');
                card.title = "Click to toggle (include/exclude)";
                card.addEventListener('click', () => card.classList.toggle('patch-excluded'));

                card.innerHTML = `
                    <div class="diff-header">
                        <div class="diff-file-name">
                            <span class="material-symbols-outlined">description</span>
                            ${match.file}
                        </div>
                         <div class="diff-status-icon">
                             <span class="material-symbols-outlined icon-include" style="color:var(--state-success-text)">check</span>
                        </div>
                    </div>
                    <div class="diff-content">
                        <div class="diff-half">
                            <div class="diff-pane-header">Original (Search)</div>
                            <div class="diff-block diff-old">${this.escapeHtml(match.original)}</div>
                        </div>
                         <div class="diff-half">
                            <div class="diff-pane-header">Modified (Replace)</div>
                             <div class="diff-block diff-new">${this.escapeHtml(match.replacement)}</div>
                        </div>
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <div class="diff-header" style="background:var(--state-error-bg);">
                        <div class="diff-file-name" style="color:var(--state-error-text);">
                            <span class="material-symbols-outlined">warning</span>
                            Match Failed
                        </div>
                    </div>
                    <div class="diff-block" style="color:var(--state-error-text); font-family:'JetBrains Mono'; font-size:0.8rem;">
                        <strong>Error:</strong> ${match.error}<br/>
                        <div style="opacity:0.7; margin-top:4px;">Target: ${match.file}</div>
                    </div>
                `;
            }
            container.appendChild(card);
        });

        const validCount = matches.filter(m => m.isValid).length;
        if (validCount > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'patch-confirm-area';
            actionsDiv.innerHTML = `
                <button class="btn-secondary" id="btn-cancel-patch">Dismiss</button>
                <button class="btn-primary" id="btn-apply-patch">
                    <span class="material-symbols-outlined">check</span>
                    Apply Changes
                </button>
            `;
            container.appendChild(actionsDiv);
            this.bindActionEvents(container, onApplySuccess);
        }

        return container;
    },

    bindActionEvents(container, onApplySuccess) {
        const btnApply = container.querySelector('#btn-apply-patch');
        const btnCancel = container.querySelector('#btn-cancel-patch');

        if (btnApply) {
            btnApply.addEventListener('click', () => {
                const activeCards = container.querySelectorAll('.diff-card.interactive:not(.patch-excluded)');
                const selectedIndices = Array.from(activeCards).map(card => parseInt(card.dataset.idx));
                const selectedMatches = this.currentMatches.filter((_, i) => selectedIndices.includes(i));

                if (selectedMatches.length === 0) {
                    alert("No patches selected.");
                    return;
                }
                const newContext = PatchEngine.applyPatches(Store.state.contextContent, selectedMatches);
                Store.state.contextContent = newContext; 

                // Update Context History
                TreeManager.addContextHistory(`${Store.state.projectName} (Patched)`);

                // Update UI Status (Preserve Diff)
                const actionArea = container.querySelector('.patch-confirm-area');
                if (actionArea) {
                    actionArea.innerHTML = ``;
                }

                // Disable interactions
                container.querySelectorAll('.diff-card').forEach(c => {
                    c.classList.remove('interactive');
                    c.style.pointerEvents = 'none';
                });

                onApplySuccess(selectedMatches.length);
            });
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                container.closest('.chat-row').remove();
            });
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
};