const CONFIG={
    ignoreDirs:[],
    ignoreExts:[],
    tokenWeights:{chinese:1.5,other:0.25}
};
const BINARY_EXTS = new Set([
    'png','jpg','jpeg','gif','bmp','tiff','ico','svg','webp','avif','mp4','mp3','wav','mov','avi','mkv','flv','pdf','doc','docx','xls','xlsx','ppt','pptx','zip','tar','gz','7z','rar','exe','dll','so','dylib','class','jar','db','sqlite','sqlite3','ttf','otf','woff','woff2'
]);
const LANG_MAP = {
    js:'javascript',jsx:'jsx',ts:'typescript',tsx:'tsx',html:'html',css:'css',scss:'scss',less:'less',json:'json',py:'python',java:'java',c:'c',cpp:'cpp',h:'cpp',cs:'csharp',go:'go',rs:'rust',php:'php',rb:'ruby',sh:'bash',yaml:'yaml',yml:'yaml',md:'markdown',sql:'sql',xml:'xml',vue:'vue',txt:'text',ini:'ini',toml:'toml',dockerfile:'dockerfile'
};
const STATE={files:[],projectName:"Project",ignoreRules:[]};
const UI={inputs:{},areas:{},stats:{},btns:{},modals:{}};

const UI_TEXT = {
    status: {
        hunkApplied: "✅ 已应用",
        hunkIgnored: "❌ 已忽略"
    },
    toast: {
        saved: "配置已保存",
        inputRequired: "请输入需求内容",
        promptReady: "Prompt 已生成",
        copySuccess: "已复制到剪贴板",
        copyFail: "复制失败",
        noMergeFiles: "没有可供合并的文件",
        mergeSuccess: c => `已合并 ${c} 个文件`,
        projectCleared: "项目已清空",
        projectLoaded: (t, i) => i > 0 ? `已加载 ${t} 个文件（已忽略 ${i} 个）` : `已加载 ${t} 个文件`,
        addedFiles: c => `追加了 ${c} 个文件`,
        gitIgnoreDetected: c => `检测并应用了 ${c} 个 .gitignore 规则`,
        baselineLoaded: n => `已加载基准文件：${n}`,
        patchEmpty: "补丁内容为空",
        patchInvalid: "未识别到有效的补丁块",
        diffSuccess: c => `成功解析 ${c} 处变更，请确认后应用`,
        diffNoChange: "没有有效的变更可预览",
        applyNoChange: "没有待应用的变更",
        applySuccess: c => `✅ 已更新 ${c} 个文件`,
        applyCopyInfo: "多个文件变更，仅复制了第一个文件内容",
        restoreFail: "请先在下方粘贴内容",
        restoreNoTag: "未找到文件标记",
        restoreSuccess: c => `已解析并打包 ${c} 个文件`,
        binaryOmitted: "（二进制文件已省略）",
        fileTooLarge: "（文件过大，仅部分处理）",
        parsing: "正在解析...",
        analyzing: "正在分析...",
        packaging: "正在打包...",
        beforeUnload: "确定要离开吗？当前项目内容将会丢失。"
    },
    prompt: {
        header: "以下是项目的目录结构与文件内容。请基于此上下文回答我的问题：\n\n"
    },
    templates: {
        labelBaseline: "（基准文件）"
    }
};

const MAGIC_TOKEN="\=== File:", ESCAPED_TOKEN="\\\=== File:";