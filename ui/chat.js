import { PromptMode } from './modes/prompt-mode.js';
import { PatchMode } from './modes/patch-mode.js';

export const ChatManager = {
    dom: {},
    inputFiles: [],

    init() {
        this.cacheDOM();
        this.bindFileUpload();
        this.bindTags();
        this.bindSend();
        this.bindAutoResize();
        this.initMarkdown();
    },
    initMarkdown() {
        if (typeof marked === 'undefined' || typeof hljs === 'undefined') return;
        marked.setOptions({
            highlight: function(code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            },
            langPrefix: 'hljs language-',
            breaks: true,
            gfm: true
        });
    },

    cacheDOM() {
        this.dom = {
            inputWrapper: document.getElementById('input-wrapper'),
            outputArea: document.getElementById('output-area'),
            mainInput: document.getElementById('main-input'),
            tagContainer: document.getElementById('tag-container'),
            filePreviewArea: document.getElementById('input-files-area'),
            btnSend: document.getElementById('send-btn'),
            btnInputUpload: document.getElementById('btn-input-upload'),
            chipBtns: document.querySelectorAll('.chip')
        };
    },
    bindFileUpload() {
        if (!this.dom.btnInputUpload) return;
        const dummyInput = document.createElement('input');
        dummyInput.type = 'file'; 
        dummyInput.multiple = true;
        dummyInput.onchange = (e) => {
            Array.from(e.target.files).forEach(file => this.addFileCard(file));
            dummyInput.value = ''; 
            this.dom.mainInput.focus();
        };
        this.dom.btnInputUpload.addEventListener('click', () => dummyInput.click());
    },

    bindTags() {
        this.dom.chipBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                this.dom.tagContainer.innerHTML = '';
                const tag = document.createElement('div');
                tag.className = 'input-tag';
                tag.innerHTML = `<span>${type}</span><span class="material-symbols-outlined remove-tag">close</span>`;
                tag.addEventListener('click', () => tag.remove());
                this.dom.tagContainer.appendChild(tag);
                this.dom.mainInput.focus();
            });
        });
    },

    bindSend() {
        this.dom.btnSend.addEventListener('click', () => this.handleSend());
        this.dom.mainInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); 
                this.handleSend();
            }
        });
    },

    bindAutoResize() {
        this.dom.mainInput.addEventListener('input', (e) => {
            const el = e.target;
            el.style.height = 'auto'; 
            const newHeight = Math.min(el.scrollHeight, 250); 
            el.style.height = newHeight + 'px';
            el.style.overflowY = el.scrollHeight > 250 ? 'auto' : 'hidden';
        });
    },
    async handleSend() {
        const rawInputText = this.dom.mainInput.value.trim();
        const attachedFiles = [...this.inputFiles];
        let fullContextText = rawInputText;

        if (!rawInputText && attachedFiles.length === 0) return;
        if (attachedFiles.length > 0) {
            const fileContents = await Promise.all(attachedFiles.map(async (file) => {
                try {
                    const content = await file.text();
                    return `=== File: ${file.name} ===\n${content}`;
                } catch (e) { return `[Error reading ${file.name}]`; }
            }));
            const combinedContent = fileContents.join('\n\n');
            fullContextText = rawInputText ? `${rawInputText}\n\n${combinedContent}` : combinedContent;
        }
        const activeTags = Array.from(this.dom.tagContainer.children).map(t => t.firstChild.textContent);
        const isPatchMode = activeTags.includes('Patch') || this.detectPatchContent(fullContextText, attachedFiles);
        const isPromptMode = activeTags.includes('Prompt');
        if (this.dom.inputWrapper.classList.contains('centered')) {
            this.dom.inputWrapper.classList.remove('centered');
            this.dom.inputWrapper.classList.add('bottom');
            setTimeout(() => { this.dom.outputArea.classList.remove('hidden'); }, 300);
        }

        this.resetInputUI();
        this.renderUserMessage(rawInputText, attachedFiles, activeTags);
        if (isPatchMode) {
            await PatchMode.handle(fullContextText);
        } else if (isPromptMode) {
            await PromptMode.handle(rawInputText);
        } else {
            this.renderSystemMessage(`Echo: ${rawInputText || '(Files Uploaded)'}`);
        }
    },

    detectPatchContent(text, files) {
        const hasPatchMarker = text.includes('<<<<<<< SEARCH');
        const hasPatchFile = files.some(f => f.name.toLowerCase().includes('patch'));
        return hasPatchMarker || (hasPatchFile && text.includes('FILE:'));
    },
    addFileCard(file) {
        this.inputFiles.push(file);
        this.dom.filePreviewArea.classList.remove('hidden');
        const ext = file.name.split('.').pop() || 'FILE';
        const card = document.createElement('div');
        card.className = 'file-card';
        card.innerHTML = `<div class="file-name">${file.name}</div><div class="file-type">${ext}</div>`;
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            this.inputFiles = this.inputFiles.filter(f => f !== file);
            card.remove();
            if (this.dom.filePreviewArea.children.length === 0) this.dom.filePreviewArea.classList.add('hidden');
        });
        this.dom.filePreviewArea.appendChild(card);
    },

    resetInputUI() {
        this.dom.mainInput.value = '';
        this.dom.mainInput.style.height = '30px';
        this.dom.filePreviewArea.innerHTML = '';
        this.dom.filePreviewArea.classList.add('hidden');
        this.inputFiles = [];
        this.dom.tagContainer.innerHTML = '';
    },

    renderUserMessage(text, files, tags) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-row user';
        
        const renderedText = (text && typeof marked !== 'undefined')
            ? marked.parse(text)
            : (text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;") : '');

        let metaHtml = '';
        if (files.length > 0 || tags.length > 0) {
            const tagsHtml = tags.map(t => `<div class="history-tag"><span class="material-symbols-outlined">label</span><span>${t}</span></div>`).join('');
            const filesHtml = files.map(f => {
                const ext = f.name.split('.').pop() || 'FILE';
                return `<div class="file-card"><div class="file-name">${f.name}</div><div class="file-type">${ext}</div></div>`;
            }).join('');
            metaHtml = `<div class="user-meta-header">${tagsHtml}${filesHtml}</div>`;
        }

        wrapper.innerHTML = `
            <div class="user-stack">
                ${metaHtml}
                ${renderedText ? `<div class="chat-bubble user markdown-body">${renderedText}</div>` : ''}
            </div>
        `;
        this.dom.outputArea.appendChild(wrapper);
        this.scrollToBottom();
    },

    renderSystemMessage(contentOrHtml) {
        if (this.dom.inputWrapper.classList.contains('centered')) {
            this.dom.inputWrapper.classList.remove('centered');
            this.dom.inputWrapper.classList.add('bottom');
            setTimeout(() => { this.dom.outputArea.classList.remove('hidden'); }, 300);
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'chat-row ai';
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ai markdown-body';
        
        if (typeof contentOrHtml === 'string') {
            if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
                bubble.innerHTML = DOMPurify.sanitize(marked.parse(contentOrHtml));
            } else {
                bubble.innerHTML = contentOrHtml;
            }
        } else {
            bubble.appendChild(contentOrHtml);
        }
        
        wrapper.appendChild(bubble);
        this.dom.outputArea.appendChild(wrapper);
        this.scrollToBottom();
    },

    renderLoading(text) {
        const id = 'loading-' + Date.now();
        const wrapper = document.createElement('div');
        wrapper.id = id;
        wrapper.className = 'chat-row ai';
        wrapper.innerHTML = `
            <div class="chat-bubble ai">
                <div style="display:flex; align-items:center; gap:10px; color:var(--text-3);">
                    <span class="material-symbols-outlined spin">sync</span>
                    <span>${text}</span>
                </div>
            </div>`;
        this.dom.outputArea.appendChild(wrapper);
        this.scrollToBottom();
        return id;
    },

    removeLoading(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    scrollToBottom() {
        this.dom.outputArea.scrollTop = this.dom.outputArea.scrollHeight;
    }
};