const DB_NAME = 'caret-db';
const STORE_NAME = 'project-store';
const DB_VERSION = 1;

export const DB = {
    async getDB() {
        if (!window.idb) {
            console.error("IDB library not loaded");
            return null;
        }
        return idb.openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    },

    async set(key, value) {
        try {
            const db = await this.getDB();
            if(db) await db.put(STORE_NAME, value, key);
        } catch (e) {
            console.error("DB Save Error:", e);
        }
    },

    async get(key) {
        try {
            const db = await this.getDB();
            return db ? await db.get(STORE_NAME, key) : null;
        } catch (e) {
            console.error("DB Read Error:", e);
            return null;
        }
    },

    async clear() {
        const db = await this.getDB();
        if(db) await db.clear(STORE_NAME);
    }
};