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
    ignoreRules: []       // 存储合并后的忽略规则
};

// DOM Elements Cache (Initialized empty, populated in app.js)
const UI = {
    inputs: {},
    areas: {},
    stats: {},
    btns: {}
};

/* ==========================================================================
   3. UI Text & Templates
   ========================================================================== */
const UI_TEXT = {
    placeholder: {
        tree: "在此处等待上传项目文件...",
        merge: "此处显示合并后的文本...",
        patch: "在此粘贴 AI 生成的补丁代码...",
        diff: "此处显示应用补丁后的差异对比...",
        restore: "此处为最终可下载的文件结构..."
    },
    toast: {
        emptyContent: "内容为空",
        copySuccess: "已复制到剪贴板",
        copyFail: "复制失败",
        noMergeFiles: "没有可合并的有效文件",
        mergeSuccess: (count) => `合并完成 (包含了 ${count} 个文件)`,
        restoreFail: "请先在下方区域粘贴内容",
        restoreNoTag: "未找到文件标记",
        restoreSuccess: (count) => `已解析并打包 ${count} 个文件`,
        patchEmpty: "补丁内容为空",
        patchInvalid: "未识别到有效的补丁块，请检查格式",
        diffNoChange: "没有产生有效的变更预览",
        diffSuccess: (count) => `成功解析 ${count} 个变更，请确认后应用`,
        applyNoChange: "没有待应用的变更，请先预览",
        applySuccess: (count) => `✅ 已更新 ${count} 个文件`,
        projectLoaded: (total, ignored) => ignored > 0 
            ? `加载 ${total} 个文件 (已忽略 ${ignored} 个)` 
            : `加载了 ${total} 个文件`,
        projectCleared: "项目已清空"
    },
    prompt: {
        header: "下面是项目的目录结构和文件内容。请根据这些上下文回答我的问题。\n\n"
    },
    html: {
        diffEmptyState: `<div class="empty-hint">此处显示应用补丁后的差异对比...</div>`,
        treeEmptyState: `<div class="empty-hint">此处显示上传的项目文件内容...</div>`,
        treeWaiting: `<div class="empty-hint">等待上传项目文件...</div>`
    }
};

// Constants for Parsing
const MAGIC_TOKEN = "=== File:";
const ESCAPED_TOKEN = "\\=== File:";