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

    // 替换原有的 readFile 方法
    readFile: (file) => new Promise((resolve) => {
        // 1. 扩展名预检 (保持不变)
        if (Utils.isBinary(file)) return resolve(UI_TEXT.toast.binaryOmitted);

        // 2. 只有小文件才通过 text 读取，大文件先通过 slice 检查头
        const CHUNK_SIZE = 1024;
        const blob = file.slice(0, CHUNK_SIZE);
        const reader = new FileReader();

        reader.onload = (e) => {
            const arr = new Uint8Array(e.target.result);
            // 检查是否存在 NULL 字节 (二进制特征)
            let isBinaryContent = false;
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] === 0) {
                    isBinaryContent = true;
                    break;
                }
            }

            if (isBinaryContent) {
                resolve(UI_TEXT.toast.binaryOmitted);
            } else {
                // 安全：确认为文本后，再读取全文
                if (file.size > 2 * 1024 * 1024) { 
                    // 这里甚至可以做截断，只读前 2MB
                    resolve(UI_TEXT.toast.fileTooLarge);
                } else {
                    const fullReader = new FileReader();
                    fullReader.onload = (ev) => resolve(ev.target.result);
                    fullReader.readAsText(file);
                }
            }
        };
        reader.readAsArrayBuffer(blob); // 关键：先读为 ArrayBuffer 避免解码卡死
    }),

    estimateTokens: (text) => {
        if (!text) return 0;

        // 1. 提取并计算 CJK (中日韩) 字符
        // 匹配范围：基本汉字 + 扩展 A 区 + 标点
        const cjkRegex = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g;
        const cjkMatches = text.match(cjkRegex) || [];
        const cjkCount = cjkMatches.length;

        // 2. 将 CJK 替换为空格，以便处理剩余的拉丁字符/代码
        const nonCjkText = text.replace(cjkRegex, ' ');

        // 3. 拆分剩余内容
        // 匹配逻辑：
        // [\w]+ : 匹配连续的字母、数字、下划线（单词/变量名）
        // [^\s\w] : 匹配非空白且非单词的字符（各类代码符号、运算符）
        const tokens = nonCjkText.match(/[\w]+|[^\s\w]/g) || [];

        let latinTokenCount = 0;
        
        for (const t of tokens) {
            if (/^[\w]+$/.test(t)) {
                // 对于单词/变量名：
                // GPT 分词器通常将常见单词视为 1 token (如 "const", "return")
                // 长单词或生僻组合会被拆分。
                // 经验公式：Math.max(1, length / 4)
                latinTokenCount += Math.max(1, Math.ceil(t.length / 4));
            } else {
                // 对于符号 (如 "{", ";", "+")，通常各占 1 token
                latinTokenCount += 1;
            }
        }

        // 汇总 (CJK 权重设为 1，偏保守，防止 Context Window 溢出)
        return cjkCount + latinTokenCount;
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