// 全局状态
let globalFiles = []; // 存储 { fileObj, path, selected, content }
let finalOutput = "";

// ================= 配置区域 =================
const IGNORE_DIRS = [
    '.git', '.svn', '.hg', '.idea', '.vscode', '.settings',
    'node_modules', 'bower_components', 'build', 'dist', 'out', 'target',
    '__pycache__', '.venv', 'venv', 'env', '.pytest_cache',
    '.dart_tool', '.pub-cache', 'bin', 'obj', '.gradle', 'vendor',
    'tmp', 'temp', 'logs', 'coverage', '.next', '.nuxt',
    'ios', 'android' // 常见移动端构建目录也忽略
];

const IGNORE_EXTS = [
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.mp4', '.mp3', '.wav',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.tar', '.gz', '.7z', '.rar',
    '.exe', '.dll', '.so', '.dylib', '.class', '.jar', '.db', '.sqlite', '.sqlite3',
    '.lock', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store'
];
// ===========================================

// Tab 切换逻辑
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
    
    // 简单通过文本内容匹配按钮 (实际开发建议加 ID)
    const btns = document.querySelectorAll('.tab-btn');
    if(tab === 'pack') {
        btns[0].classList.add('active');
        document.getElementById('packSection').classList.add('active');
    } else {
        btns[1].classList.add('active');
        document.getElementById('unpackSection').classList.add('active');
    }
}

// ----------------------
// 逻辑 A: Packer (打包)
// ----------------------

document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    resetPackerUI();
    updateStatus(`正在分析 ${files.length} 个文件...`, 'processing');

    globalFiles = []; // 重置全局状态

    // 1. 预处理：读取并过滤
    let processedCount = 0;
    
    for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        
        // 过滤逻辑
        if (shouldIgnore(path)) continue;

        try {
            // 异步读取内容 (为了后面能快速重新生成，这里先读入内存)
            // 注意：如果项目巨大，这里应该优化为按需读取。但对于一般代码项目，几MB文本在浏览器内存没问题。
            const text = await readFileAsText(file);
            globalFiles.push({
                file: file,
                path: path,
                content: text,
                selected: true // 默认选中
            });
            processedCount++;
        } catch (err) {
            console.warn(`Skipped binary: ${path}`);
        }
    }

    if (globalFiles.length === 0) {
        updateStatus("未找到有效代码文件 (全部被过滤)", 'error');
        return;
    }

    // 2. 渲染文件列表
    renderFileList();

    // 3. 生成初始内容
    generateOutput();
});

function shouldIgnore(path) {
    const parts = path.split('/');
    // 目录过滤
    for (let part of parts) {
        if (IGNORE_DIRS.includes(part)) return true;
    }
    // 后缀过滤
    for (let ext of IGNORE_EXTS) {
        if (path.toLowerCase().endsWith(ext)) return true;
    }
    return false;
}

function renderFileList() {
    const container = document.getElementById('fileList');
    const wrapper = document.getElementById('fileListContainer');
    wrapper.style.display = 'block';
    container.innerHTML = '';

    globalFiles.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <input type="checkbox" id="f_${index}" ${item.selected ? 'checked' : ''}>
            <label for="f_${index}" style="cursor:pointer; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${item.path}
            </label>
        `;
        
        // 绑定事件
        const checkbox = div.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            globalFiles[index].selected = e.target.checked;
            // 样式更新
            if(!e.target.checked) div.classList.add('ignored');
            else div.classList.remove('ignored');
            // 重新生成
            generateOutput();
        });

        container.appendChild(div);
    });
}

function toggleAllFiles() {
    // 简单的全选/反选逻辑：如果有一个没选，就全选；否则全不选
    const hasUnchecked = globalFiles.some(f => !f.selected);
    globalFiles.forEach(f => f.selected = hasUnchecked);
    renderFileList();
    generateOutput();
}

function generateOutput() {
    const activeFiles = globalFiles.filter(f => f.selected);
    
    // 1. 生成树
    let treeString = "Project Structure:\n";
    const paths = activeFiles.map(f => f.path);
    treeString += generateTree(paths);
    treeString += "\n\n================================================\n\n";

    // 2. 拼接内容
    let contentString = "";
    activeFiles.forEach(f => {
        contentString += `=== File: ${f.path} ===\n`;
        contentString += f.content;
        contentString += `\n\n`;
    });

    finalOutput = treeString + contentString;

    // UI 更新
    document.getElementById('actionBar').style.display = 'flex';
    document.getElementById('previewContainer').style.display = 'block';
    
    const previewText = finalOutput.length > 3000 
        ? finalOutput.substring(0, 3000) + "\n... (内容过长，请下载查看完整版)" 
        : finalOutput;
    document.getElementById('previewArea').innerText = previewText;

    const tokenCount = Math.ceil(finalOutput.length / 4);
    document.getElementById('tokenEstimate').innerText = `Token 估算: ~${tokenCount.toLocaleString()}`;
    
    updateStatus(`✅ 已打包 ${activeFiles.length} 个文件，大小 ${(finalOutput.length/1024).toFixed(1)} KB`, 'success');
}

// ----------------------
// 逻辑 B: Unpacker (解包)
// ----------------------

// 处理 .txt 文件上传
document.getElementById('txtInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await readFileAsText(file);
    document.getElementById('pasteArea').value = text;
});

// 复制提示词
function copyPromptHint() {
    const text = "请修改代码，并以 Code Packer 格式（包含 Project Structure 和 === File: path === 标记）输出完整的修改后文件内容，不要省略。";
    navigator.clipboard.writeText(text);
    alert("提示词已复制！粘贴给 AI 即可。");
}

async function unpackToZip() {
    const content = document.getElementById('pasteArea').value;
    if (!content.trim()) {
        alert("请先上传文件或粘贴内容！");
        return;
    }

    const zip = new JSZip();
    let fileCount = 0;

    // 解析逻辑：根据 === File: path === 分割
    // 正则解释：匹配 === File: (路径) ===，然后捕获直到下一个标记前的所有内容
    // 使用 split 更安全
    const parts = content.split(/=== File: (.*?) ===/);
    
    // split 后数组结构：[前导文案, 路径1, 内容1, 路径2, 内容2, ...]
    // 所以从索引 1 开始遍历，每次跳2格
    for (let i = 1; i < parts.length; i += 2) {
        const filepath = parts[i].trim();
        let fileContent = parts[i+1];
        
        // 清理内容首尾的换行（保留原本的代码缩进，只去首尾多余的空行）
        // 通常 Packer 生成时会在末尾加 \n\n，这里稍微清理一下
        fileContent = fileContent.replace(/^\n+/, '').replace(/\n+$/, '');

        if (filepath && filepath.length > 0) {
            zip.file(filepath, fileContent);
            fileCount++;
        }
    }

    if (fileCount === 0) {
        alert("未识别到有效的文件标记！请确认文本包含 '=== File: path/to/file ===' 格式。");
        return;
    }

    // 生成并下载
    const blob = await zip.generateAsync({type:"blob"});
    saveAs(blob, "project_unpacked.zip");
}

// ----------------------
// 工具函数
// ----------------------
function resetPackerUI() {
    document.getElementById('actionBar').style.display = 'none';
    document.getElementById('previewContainer').style.display = 'none';
    document.getElementById('fileListContainer').style.display = 'none';
    finalOutput = "";
}

function updateStatus(msg, type) {
    const el = document.getElementById('status');
    el.innerText = msg;
    el.style.color = type === 'error' ? '#ff5546' : (type === 'success' ? '#81c995' : '#a8abb1');
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

function downloadFile() {
    const blob = new Blob([finalOutput], { type: 'text/plain' });
    saveAs(blob, "project_context.txt"); // 使用 FileSaver.js
}

async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(finalOutput);
        const btn = document.querySelector('.btn-secondary'); // 注意：如果有多个btn-secondary，这里要改具体点
        const originalText = btn.innerHTML;
        btn.innerHTML = "✅ 已复制";
        setTimeout(() => btn.innerHTML = originalText, 2000);
    } catch (err) {
        alert('复制失败，文本太长，请使用下载功能。');
    }
}

// 树结构生成算法 (保持原样，稍作封装)
function generateTree(paths) {
    let tree = {};
    paths.forEach(path => {
        let parts = path.split('/');
        let current = tree;
        parts.forEach(part => {
            current[part] = current[part] || {};
            current = current[part];
        });
    });

    function printTree(node, prefix = "") {
        let output = "";
        let keys = Object.keys(node);
        keys.forEach((key, index) => {
            let isLast = index === keys.length - 1;
            let connector = isLast ? "└── " : "├── ";
            if (Object.keys(node[key]).length === 0) {
                output += prefix + connector + key + "\n";
            } else {
                output += prefix + connector + key + "/\n";
                output += printTree(node[key], prefix + (isLast ? "    " : "│   "));
            }
        });
        return output;
    }
    let rootKey = Object.keys(tree)[0];
    // 如果是多文件夹上传或根目录，可能没有统一rootKey，简单处理
    if(!rootKey) return "";
    return (paths.length > 1 ? "Root/\n" : "") + printTree(tree);
}
