/* ==========================================================================
   Generic Utilities
   ========================================================================== */

const globToRegex = (pattern) => {
    let reStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') 
        .replace(/\*/g, '.*')                 
        .replace(/\?/g, '.');
    
    if (!pattern.includes('/')) {
        return new RegExp(`(^|/)${reStr}(/|$)`);
    }
    return new RegExp(`^${reStr}(/|$)`);
};

const getLangFromExt = (path) => {
    const ext = path.split('.').pop().toLowerCase();
    return LANG_MAP[ext] || ''; 
};

const Utils = {
    isBinary: (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        // 使用 config.js 中定义的 BINARY_EXTS
        if (BINARY_EXTS.has(ext)) return true;
        return false;
    },

    readFile: (file) => new Promise((resolve) => {
        if (Utils.isBinary(file)) {
            return resolve("<Binary File Omitted>");
        }
        if (file.size > 2 * 1024 * 1024) {
            console.warn(`File too large: ${file.name}`);
            return resolve("<File too large to process>");
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target.result;
            const snippet = result.slice(0, 512);
            if (snippet.includes('\u0000')) {
                resolve("<Binary File Omitted>");
            } else {
                resolve(result);
            }
        };
        reader.onerror = () => resolve("");
        reader.readAsText(file);
    }),

    estimateTokens: (text) => {
        const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const other = text.length - chinese;
        return Math.ceil(chinese * CONFIG.tokenWeights.chinese + other * CONFIG.tokenWeights.other);
    },
    
    shouldIgnore: (path) => {
        let ignored = false;
        for (const rule of STATE.ignoreRules) {
            if (!rule) continue;
            const isNegative = rule.startsWith('!');
            const cleanRule = isNegative ? rule.slice(1) : rule;
            const regex = globToRegex(cleanRule);
            if (regex.test(path)) {
                ignored = !isNegative;
            }
        }
        return ignored;
    },

    showToast: (msg, type = 'info') => {
        const container = document.getElementById('toast-overlay');
        const el = document.createElement('div');
        el.className = 'ui-btn'; 
        el.style.cssText = `margin-top:10px; background:${type === 'error' ? '#5c1e1e' : '#1e5c2e'}; border:1px solid rgba(255,255,255,0.2); pointer-events:none; animation: fadeIn 0.3s forwards;`;
        el.innerHTML = msg;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 2000);
    },

    copyToClipboard: async (text) => {
        if (!text) return Utils.showToast(UI_TEXT.toast.emptyContent, "error");
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast(UI_TEXT.toast.copySuccess);
        } catch (e) {
            Utils.showToast(UI_TEXT.toast.copyFail, "error");
        }
    },

    getTimestamp: () => {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        return `${date}_${time}`;
    },

    escapeHtml: (text) => {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};