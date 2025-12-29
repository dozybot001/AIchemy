import { SettingsManager } from './ui/settings.js';
import { ChatManager } from './ui/chat.js';
import { UtilsManager } from './ui/utils.js'; // Added
import { ToolbarManager } from './ui/toolbar.js';
import { TreeManager } from './ui/tree.js';
import { Store } from './store.js';
import { DB } from './lib/db.js';

document.addEventListener('DOMContentLoaded', async () => {
    TreeManager.init();
    // 初始化历史记录列表
    TreeManager.initHistory();
    
    SettingsManager.init();
    UtilsManager.init(); // Added
    ChatManager.init();
    ToolbarManager.init();
    try {
        const savedContext = await DB.get('contextContent');
        const savedProjectName = await DB.get('projectName');
        
        if (savedContext) {
            Store.state.contextContent = savedContext;
            Store.state.projectName = savedProjectName || 'Project';
            // 恢复时传入 content，以便可以下载，并正确保存到历史
            TreeManager.addContextHistory(savedProjectName + " (Restored)", savedContext);
            console.log("Restored context from IndexedDB");
        }
    } catch (e) {
        console.warn("Failed to restore state", e);
    }
    Store.subscribe('contextContent', (val) => {
        if (val) DB.set('contextContent', val);
    });
    Store.subscribe('projectName', (val) => {
        if (val) DB.set('projectName', val);
    });

    console.log("AIchemy App Initialized.");
});