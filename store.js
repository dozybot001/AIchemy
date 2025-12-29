const listeners = new Map();
const initialState = {
    isSidebarExpanded: localStorage.getItem('should_expand_sidebar') === 'true', 
    theme: localStorage.getItem('theme') || 'dark',
    currentModel: localStorage.getItem('current_model') || 'Gemini 1.5 Pro',
    projectName: 'Project',
    contextContent: null,
    tree: [],
    apiConfig: (() => {
        try {
            const stored = localStorage.getItem('api_config');
            return stored ? JSON.parse(stored) : {
                baseUrl: 'https://generativelanguage.googleapis.com',
                apiKey: '',
                modelName: 'gemini-pro'
            };
        } catch (e) {
            console.warn("Resetting invalid API config");
            return { baseUrl: '', apiKey: '', modelName: 'gemini-pro' };
        }
    })()
};
const reactiveState = new Proxy(initialState, {
    set(target, key, value) {
        const oldValue = target[key];
        const result = Reflect.set(target, key, value);
        if (oldValue !== value) {
            if (listeners.has(key)) {
                listeners.get(key).forEach(callback => callback(value, oldValue));
            }
        }
        return result;
    },
    get(target, key) {
        return Reflect.get(target, key);
    }
});

export const Store = {
    state: reactiveState,

    /**
     * 订阅特定状态变更
     * @param {string} key 状态的属性名
     * @param {Function} callback (newValue, oldValue) => void
     */
    subscribe(key, callback) {
        if (!listeners.has(key)) {
            listeners.set(key, new Set());
        }
        listeners.get(key).add(callback);
    },

    setProject(name, treeData) {
        this.state.projectName = name;
        this.state.tree = treeData;
    },

    toggleNodeSelection(index) {
        const tree = this.state.tree;
        const node = tree[index];

        if (node) {
            node.selected = !node.selected;

            if (node.type === 'dir') {
                const parentPath = node.id + '/';
                tree.forEach(child => {
                    if (child.id.startsWith(parentPath)) {
                        child.selected = node.selected;
                    }
                });
            }
            this.state.tree = [...tree]; 
            
            return node;
        }
        return null;
    }
};