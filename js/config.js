/* ==========================================================================
   1. Global Configuration & Constants
   ========================================================================== */
const CONFIG = {
    ignoreDirs: [], 
    ignoreExts: [],
    tokenWeights: { chinese: 1.5, other: 0.25 }
};

// 将二进制文件列表从逻辑中抽离，方便后续维护
const BINARY_EXTS = new Set([
    'png','jpg','jpeg','gif','bmp','tiff','ico','svg','webp','avif',
    'mp4','mp3','wav','mov','avi','mkv','flv',
    'pdf','doc','docx','xls','xlsx','ppt','pptx',
    'zip','tar','gz','7z','rar','exe','dll','so','dylib','class','jar','db','sqlite','sqlite3',
    'ttf','otf','woff','woff2'
]);

// 语言映射表
const LANG_MAP = {
    'js': 'javascript', 'jsx': 'jsx', 'ts': 'typescript', 'tsx': 'tsx',
    'html': 'html', 'css': 'css', 'scss': 'scss', 'less': 'less', 'json': 'json',
    'py': 'python', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'h': 'cpp',
    'cs': 'csharp', 'go': 'go', 'rs': 'rust', 'php': 'php',
    'rb': 'ruby', 'sh': 'bash', 'yaml': 'yaml', 'yml': 'yaml',
    'md': 'markdown', 'sql': 'sql', 'xml': 'xml', 'vue': 'vue',
    'txt': 'text', 'ini': 'ini', 'toml': 'toml', 'dockerfile': 'dockerfile'
};

/* ==========================================================================
   2. Global State Container
   ========================================================================== */
const STATE = {
    files: [],            // { path, content, originalFile, excluded }
    projectName: "Project",
    ignoreRules: [],       // 存储合并后的忽略规则
    lang: 'zh' // 新增：默认语言
};

// DOM Elements Cache (Initialized empty, populated in app.js)
const UI = {
    inputs: {},
    areas: {},
    stats: {},
    btns: {}
};

/* ==========================================================================
   3. UI Text & Templates (Internationalization)
   ========================================================================== */

// 定义语言包资源
const I18N_RESOURCES = {
    zh: {
        labels: {
            appName: "AIchemy",
            github: "GitHub",
            blog: "博客",
            panelFiles: "项目文件",
            statFiles: "文件数",
            statTokens: "Token 数",
            panelPreview: "合并预览",
            panelPatch: "粘贴补丁",
            panelDiff: "变更预览",
            statBaseline: "基准文件",
            panelRestore: "手动还原",
            baselineName: "~",
            panelArchitect: "Prompt 架构师"
        },
        buttons: {
            import: "加载项目",
            copyTree: "复制树",
            append: "追加",
            selectAll: "全选",
            merge: "合并",
            clearWorkspace: "🗑️",
            copy: "复制",
            download: "下载",
            clear: "🗑️",
            previewPatch: "预览变更",
            uploadBaseline: "上传基准",
            applyPatch: "应用变更",
            packDownload: "打包下载",
            switchLang: "English" // 切换按钮显示的文字
        },
        placeholder: {
            tree: "等待导入项目文件…",
            merge: "合并后的文本…",
            patch: "在此粘贴补丁代码…",
            diff: "应用补丁后的差异对比…",
            restore: "在此粘贴文本…",
            architectInput: "输入你的简短想法，例如：我要做一个贪吃蛇游戏..."
        },
        toast: {
            emptyContent: "内容为空",
            copySuccess: "已复制到剪贴板",
            copyFail: "复制失败",
            noMergeFiles: "没有可供合并的文件",
            mergeSuccess: (count) => `已合并 ${count} 个文件`,
            restoreFail: "请先在下方粘贴内容",
            restoreNoTag: "未找到文件标记",
            restoreSuccess: (count) => `已解析并打包 ${count} 个文件`,
            patchEmpty: "补丁内容为空",
            patchInvalid: "未识别到有效的补丁块，请检查格式",
            diffNoChange: "没有有效的变更可预览",
            diffSuccess: (count) => `成功解析 ${count} 处变更，请确认后应用`,
            applyNoChange: "没有待应用的变更，请先预览",
            applySuccess: (count) => `✅ 已更新 ${count} 个文件`,
            projectLoaded: (total, ignored) => ignored > 0 
                ? `已加载 ${total} 个文件（已忽略 ${ignored} 个）` 
                : `已加载 ${total} 个文件`,
            projectCleared: "项目已清空",
            baselineLoaded: (name) => `已加载基准文件：${name}`,
            treeRestored: (count) => `已恢复全选状态（${count} 个文件）`,
            addedFiles: (count) => `追加了 ${count} 个文件`,
            gitIgnoreDetected: (count) => `检测并应用了 ${count} 个 .gitignore 规则`,
            beforeUnload: "确定要离开吗？当前项目内容将会丢失。",
            binaryOmitted: "（二进制文件已省略）",
            fileTooLarge: "（文件过大，仅部分处理）"
        },
        templates: {
            diffNotFound: (path) => `❌ 未找到文件：${path}`,
            diffAmbiguous: (path) => `⚠️ 匹配存在歧义：${path}`,
            diffAmbiguousDesc: (count, snippet) => `
                <strong>此代码段在文件中出现了 ${count} 次。</strong><br/>
                为避免误改，已停止对该文件的修改。<br/>
                <br/>
                <em style="opacity:0.6">建议：请在左侧粘贴补丁区域中扩展 Search Block 的上下文范围，使其唯一。</em>
                <hr style="border:0; border-top:1px dashed #555; margin:10px 0"/>
                目标代码段：<br/>
                <pre style="color: #ff9800; font-size:0.8em;">${snippet}</pre>`,
            diffMatchFail: (path) => `⚠️ 匹配失败：${path}`,
            diffMatchFailDesc: (snippet) => `
                <strong>无法在源文件中定位 Search Block。</strong><br/>
                目标代码段：<br/>
                <pre style="text-align:left; opacity:0.7; max-height:100px; overflow:auto;">${snippet}</pre>`,
            labelBaseline: "（基准文件）"
        },
        prompt: {
            header: `以下是项目的目录结构与文件内容。请基于此上下文回答我的问题：\n\n`
        },
        html: {
            diffEmptyState: `<div class="empty-hint">此处将显示应用补丁后的差异对比…</div>`,
            treeEmptyState: `<div class="empty-hint">此处将显示项目文件内容…</div>`,
            treeWaiting: `<div class="empty-hint">等待导入项目文件…</div>`
        }
    },
};

var UI_TEXT = I18N_RESOURCES.zh;

// Constants for Parsing
const MAGIC_TOKEN = "=== File:";
const ESCAPED_TOKEN = "\\=== File:";