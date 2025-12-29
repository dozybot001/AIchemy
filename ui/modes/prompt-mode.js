import { LLMEngine } from '../../lib/llm-engine.js';
import { ChatManager } from '../chat.js';

export const PromptMode = {
    async handle(userGoal) {
        const loadingId = ChatManager.renderLoading("Analyzing requirements...");
        
        try {
            const analysisData = await LLMEngine.analyzeRequirements(userGoal);
            ChatManager.removeLoading(loadingId);
            this.renderAnalysisForm(userGoal, analysisData);
        } catch (error) {
            ChatManager.removeLoading(loadingId);
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `<div class="error-banner">Analysis Failed: ${error.message}</div>`;
            ChatManager.renderSystemMessage(errorDiv);
        }
    },

    renderAnalysisForm(userGoal, data) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-row ai';
        
        const formBubble = document.createElement('div');
        formBubble.className = 'chat-bubble ai form-bubble';
        const header = `
            <div class="form-header">
                <span class="material-symbols-outlined" style="color:var(--text-1)">tune</span>
                <h3>Customize Requirements</h3>
            </div>
        `;
        let formBody = `<form id="req-form" class="form-body">`;
        
        data.dimensions.forEach((dim, index) => {
            formBody += `
                <div class="form-group-item">
                    <label class="form-label">${dim.name}</label>
                    <div class="form-options">`;
            
            dim.options.forEach(opt => {
                const inputType = dim.multi ? 'checkbox' : 'radio';
                const nameAttr = dim.key || `dim_${index}`;
                const checked = (!dim.multi && opt === dim.options[0]) ? 'checked' : '';
                
                formBody += `
                    <label class="option-chip">
                        <input type="${inputType}" name="${nameAttr}" value="${opt}" ${checked}>
                        <span>${opt}</span>
                    </label>
                `;
            });
            formBody += `</div></div>`;
        });
        formBody += `</form>`;
        const actionsHtml = `
            <div class="patch-confirm-area" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--gray-l2);">
                <button class="btn-secondary" id="btn-regenerate">
                    <span class="material-symbols-outlined">refresh</span>
                    Regenerate
                </button>
                <button class="btn-primary" id="btn-apply-prompt">
                    <span class="material-symbols-outlined">auto_awesome</span>
                    Apply these details
                </button>
            </div>
        `;
        const resultContainer = document.createElement('div');
        resultContainer.className = 'prompt-result-section hidden';
        formBubble.innerHTML = header + formBody + actionsHtml;
        formBubble.appendChild(resultContainer);
        
        wrapper.appendChild(formBubble);
        ChatManager.dom.outputArea.appendChild(wrapper);
        ChatManager.scrollToBottom();
        this.bindActionEvents(wrapper, formBubble, userGoal, resultContainer);
    },

    bindActionEvents(wrapper, formBubble, userGoal, resultContainer) {
        const btnRegen = formBubble.querySelector('#btn-regenerate');
        const btnApply = formBubble.querySelector('#btn-apply-prompt');
        const form = formBubble.querySelector('#req-form');
        if (btnRegen) {
            btnRegen.addEventListener('click', () => {
                wrapper.remove();
                this.handle(userGoal);
            });
        }
        if (btnApply) {
            btnApply.addEventListener('click', () => {
                if (btnApply.classList.contains('processing')) return;
                const formData = new FormData(form);
                const selections = {};
                for (let [key, value] of formData.entries()) {
                    if (selections[key]) {
                        if (!Array.isArray(selections[key])) selections[key] = [selections[key]];
                        selections[key].push(value);
                    } else {
                        selections[key] = value;
                    }
                }
                btnApply.classList.add('processing');
                const originalText = btnApply.innerHTML;
                btnApply.innerHTML = `<span class="material-symbols-outlined spin">sync</span> <span>Writing...</span>`;
                this.executeFinalGeneration(userGoal, selections, resultContainer, btnApply, originalText);
            });
        }
    },

    async executeFinalGeneration(userGoal, selections, container, btn, originalBtnHtml) {
        try {
            const finalPrompt = await LLMEngine.generateFinalPrompt(userGoal, selections);
            btn.classList.remove('processing');
            btn.innerHTML = originalBtnHtml;
            container.classList.remove('hidden');
            container.innerHTML = `
                <div style="margin: 20px 0 8px 0; border-top: 1px dashed var(--gray-l3); width: 100%;"></div>
                <div style="margin-bottom:8px; font-weight:600; color:var(--text-1); display:flex; justify-content:space-between; align-items:center;">
                    <span>✨ Final Prompt</span>
                </div>
                <div class="code-block-wrapper">
                    <pre style="white-space:pre-wrap; font-family:'JetBrains Mono'; font-size:0.85rem; max-height: 400px; overflow-y:auto; background:var(--gray-l1); padding:12px; border-radius:8px; border:1px solid var(--gray-l3);">${finalPrompt.replace(/</g, "&lt;")}</pre>
                </div>
                <button class="btn-secondary" style="margin-top:12px; width:100%; justify-content:center;" onclick="navigator.clipboard.writeText(this.previousElementSibling.innerText); this.innerText='Copied to Clipboard'">
                    <span class="material-symbols-outlined">content_copy</span> Copy Prompt
                </button>
            `;
            ChatManager.scrollToBottom();

        } catch (error) {
            btn.classList.remove('processing');
            btn.innerHTML = `<span class="material-symbols-outlined">error</span> <span>Error</span>`;
            alert("Generation failed: " + error.message);
        }
    }
};