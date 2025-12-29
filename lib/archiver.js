export const Archiver = {
    async rebuildProject(fullText) {
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip library not loaded.");
        }
        const zip = new JSZip();
        let count = 0;
        let projectName = 'RestoredProject';
        
        const treeMatch = fullText.match(/^Project Tree:\n(.*?)\//m);
        if (treeMatch && treeMatch[1]) {
            projectName = treeMatch[1].trim();
        }

        // 使用正则循环匹配，比手动索引更健壮
        const filePattern = /=== File: (.*?) ===\n```.*?\n([\s\S]*?)```/g;
        let match;

        while ((match = filePattern.exec(fullText)) !== null) {
            let relativePath = match[1].trim();
            let fileContent = match[2];

            // 清理末尾换行
            if (fileContent.endsWith('\n')) fileContent = fileContent.slice(0, -1);
            if (fileContent.endsWith('\r')) fileContent = fileContent.slice(0, -1);

            // 移除项目名前缀（如果存在）
            const prefix = `${projectName}/`;
            if (relativePath.startsWith(prefix)) {
                relativePath = relativePath.substring(prefix.length);
            }

            if (!relativePath) relativePath = `root_file_${count}.txt`;
            
            zip.file(relativePath, fileContent);
            count++;
        }

        if (count === 0) {
            throw new Error("No file patterns found in the context text.");
        }
        console.log(`Rebuilt ${count} files.`);
        
        return {
            blob: await zip.generateAsync({ type: "blob" }),
            fileName: `${projectName}_Rebuilt.zip`
        };
    }
};