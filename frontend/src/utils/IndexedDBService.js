/**
 * IndexedDB 服务类
 * 用于存储大型数据（如 PDF 数组和分析结果）
 */

const DB_NAME = 'ReadForYouDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';

class IndexedDBService {
	constructor() {
		this.db = null;
	}

	/**
	 * 初始化数据库
	 */
	async init() {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				console.error('Failed to open IndexedDB:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.db = request.result;
				console.log('IndexedDB initialized successfully');
				resolve(this.db);
			};

			request.onupgradeneeded = (event) => {
				const db = event.target.result;
				
				// 创建对象存储空间
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME);
					console.log('Object store created:', STORE_NAME);
				}
			};
		});
	}

	/**
	 * 确保数据库已初始化
	 */
	async ensureDB() {
		if (!this.db) {
			await this.init();
		}
		return this.db;
	}

	/**
	 * 保存数据
	 * @param {string} key - 键名
	 * @param {any} value - 值（可以是任何可序列化的数据）
	 */
	async setItem(key, value) {
		await this.ensureDB();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.put(value, key);

			request.onsuccess = () => {
				console.log(`Data saved to IndexedDB: ${key}`);
				resolve();
			};

			request.onerror = () => {
				console.error(`Failed to save data: ${key}`, request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * 获取数据
	 * @param {string} key - 键名
	 * @returns {Promise<any>} - 返回存储的值
	 */
	async getItem(key) {
		await this.ensureDB();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(key);

			request.onsuccess = () => {
				resolve(request.result);
			};

			request.onerror = () => {
				console.error(`Failed to get data: ${key}`, request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * 删除数据
	 * @param {string} key - 键名
	 */
	async removeItem(key) {
		await this.ensureDB();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(key);

			request.onsuccess = () => {
				console.log(`Data removed from IndexedDB: ${key}`);
				resolve();
			};

			request.onerror = () => {
				console.error(`Failed to remove data: ${key}`, request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * 清空所有数据
	 */
	async clear() {
		await this.ensureDB();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.clear();

			request.onsuccess = () => {
				console.log('IndexedDB cleared');
				resolve();
			};

			request.onerror = () => {
				console.error('Failed to clear IndexedDB', request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * 批量保存数据
	 * @param {Object} data - 键值对对象
	 */
	async setItems(data) {
		await this.ensureDB();
		
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			
			const promises = Object.entries(data).map(([key, value]) => {
				return new Promise((res, rej) => {
					const request = store.put(value, key);
					request.onsuccess = () => res();
					request.onerror = () => rej(request.error);
				});
			});

			Promise.all(promises)
				.then(() => {
					console.log('Batch data saved to IndexedDB');
					resolve();
				})
				.catch(reject);
		});
	}
}

// 导出单例
export default new IndexedDBService();
