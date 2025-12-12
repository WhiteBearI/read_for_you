<template>
	<div class="online-library">
		<!-- 顶部导航栏 -->
		<TopNav />

		<!-- 主内容区 - 图书展示 -->
		<div class="main-content">
			<!-- 页面标题 -->
			<div class="page-header">
				<h1 class="page-title" tabindex="0">
					<span class="title-icon">📚</span>
					{{ t('onlineLibrary') }}
				</h1>
				<p class="page-description">{{ t('onlineLibraryDescription') }}</p>
			</div>

			<!-- 按分类展示图书 -->
			<div v-if="!loading" class="categories-container">
				<div v-for="category in categorizedBooks" :key="category.key" class="category-section">
					<!-- 分类标题 -->
					<h2 class="category-title" tabindex="0">
						<span class="category-icon">{{ category.icon }}</span>
						{{ category.name }}
						<span class="category-count">{{ category.books.length }}</span>
					</h2>
					<!-- 该分类下的图书网格 -->
					<div class="book-gallery">
						<div v-for="book in category.books" :key="book.imageUrl"
							class="book-card"
							:tabindex="0"
							:aria-label="`${t('bookPrefix')} ${getBookTitle(book)}`"
							@click="handleImageClick(book)"
							@keydown.enter="handleImageClick(book)"
							@keydown.space.prevent="handleImageClick(book)">

							<div class="book-cover">
								<img :src="book.imageUrl" :alt="getBookTitle(book)" class="cover-image" />
							</div>

							<div class="book-info">
								<h3 class="book-title">{{ getBookTitle(book) }}</h3>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- 加载状态 -->
			<div v-if="loading" class="loading-container">
				<div class="loading-spinner"></div>
				<p>{{ t('loadingBooks') }}</p>
			</div>
		</div>

		<!-- 加载书籍对话框 -->
		<div v-if="recognizing" class="dialog-mask">
			<div class="loading-dialog">
				<div class="loading-content">
					<div class="loading-spinner"></div>

					<div class="processing-file-name">
						📄 {{ processingFileName }}
					</div>

					<h3 class="loading-title">{{ loadingMessage }}</h3>
					<p class="loading-description">{{ t('loadingBookDescription') }}</p>

					<div class="loading-dots">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</div>
				</div>

				<button class="loading-cancel-btn" @click="cancelLoading">
					{{ t('cancel') }}
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
const backendUrl = import.meta.env.VITE_BACKEND_URL;
import indexedDBService from '../utils/IndexedDBService.js';
import { useTranslation } from '../utils/i18n.js';
import TopNav from './TopNav.vue';

const { t, language } = useTranslation();

// 响应式语言状态
const currentLanguage = ref(language);

const loading = ref(false);
const recognizing = ref(false);
const loadingMessage = ref('');
const processingFileName = ref('');
let bookLoadAbortController = null;

// 书籍数据列表
const bookInfo = ref([]);

// 默认分类图标映射
const categoryIcons = {
	'AI': '🤖',
	'Artificial Intelligence': '🤖',
	'Business': '💼',
	'Finance': '💼',
	'Development': '🌱',
	'Growth': '🌱',
	'Fiction': '📚',
	'Literature': '📚',
	'Novel': '📚',
	'Science': '🔬',
	'Education': '🔬',
	'Technology': '💻',
	'History': '📜',
	'Philosophy': '🤔',
	'Art': '🎨',
	'default': '📖'
};

// 根据分类名称获取图标
function getCategoryIcon(categoryEn) {
	for (const [key, icon] of Object.entries(categoryIcons)) {
		if (categoryEn.includes(key)) {
			return icon;
		}
	}
	return categoryIcons.default;
}

// 计算属性：按分类组织书籍
const categorizedBooks = computed(() => {
	const lang = currentLanguage.value;
	const categoryMap = new Map();

	bookInfo.value.forEach(book => {
		const categoryEn = book.category_en || 'General';
		const categoryZh = book.category_zh || '其他';

		if (!categoryMap.has(categoryEn)) {
			categoryMap.set(categoryEn, {
				key: categoryEn,
				name: lang === 'zh' ? categoryZh : categoryEn,
				icon: getCategoryIcon(categoryEn),
				books: []
			});
		}

		categoryMap.get(categoryEn).books.push(book);
	});

	return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
});

// 获取书籍元数据
async function getBookInfo() {
	loading.value = true;
	try {
		const response = await fetch(`${backendUrl}/getBookMetadata`, {
			credentials: 'include'
		});
		
		if (!response.ok) {
			throw new Error('Failed to fetch book metadata');
		}
		
		const result = await response.json();
		
		if (!result.success) {
			throw new Error(result.message || 'Failed to get book metadata');
		}
		
		bookInfo.value = result.data || [];
		
		console.log(`Loaded ${bookInfo.value.length} books with metadata`);
	} catch (error) {
		console.error('Error fetching book data:', error);
		alert('Error loading books: ' + error.message);
	} finally {
		loading.value = false;
	}
}

// 处理图片点击事件
async function handleImageClick(book) {
	const prefix = book.book_prefix;
	
	if (!prefix) {
		console.error('Book prefix not found');
		alert('Book data is incomplete');
		return;
	}

	console.log('Book clicked, prefix:', prefix);

	loadingMessage.value = t('loading');
	processingFileName.value = getBookTitle(book);
	recognizing.value = true;
	bookLoadAbortController = new AbortController();

	try {
		const [pdfResponse, jsonResponse] = await Promise.all([
			fetch(`${backendUrl}/getStoragedData?prefix=${encodeURIComponent(prefix)}&type=pdf`, {
				signal: bookLoadAbortController.signal,
				credentials: 'include'
			}),
			fetch(`${backendUrl}/getStoragedData?prefix=${encodeURIComponent(prefix)}&type=json`, {
				signal: bookLoadAbortController.signal,
				credentials: 'include'
			})
		]);

		if (!recognizing.value) {
			console.log('Book loading cancelled by user, aborting navigation');
			return;
		}

		if (!pdfResponse.ok || !jsonResponse.ok) {
			throw new Error('Failed to fetch PDF or JSON data');
		}

		const pdfData = await pdfResponse.json();
		const pdfBlob = base64ToBlob(pdfData.data, 'application/pdf');
 
		const jsonData = await jsonResponse.json();
		const analysisResult = jsonData.data;

		if (!recognizing.value) {
			console.log('Book loading cancelled by user, aborting navigation');
			return;
		}

		await indexedDBService.setItems({
			analysisResult: analysisResult,
			PDFBlob: pdfBlob,
			bookTitle: getBookTitle(book),
			pdfFileName: book.pdf_file || 'Unknown'
		});

		console.log('Data stored successfully, navigating to reading page');
		window.location.hash = '#/reading';

	} catch (error) {
		if (error.name === 'AbortError') {
			console.log('Book loading aborted by user');
		} else {
			console.error('Error handling image click:', error);
			alert('Failed to load book data: ' + error.message);
		}
	} finally {
		recognizing.value = false;
	}
}

// 获取书名
function getBookTitle(book) {
	return book.title || 'Unknown Book';
}

// base64 转 Blob
function base64ToBlob(base64, contentType = '') {
	let base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
	base64Data = base64Data.replace(/\s/g, '');
	
	const byteCharacters = atob(base64Data);
	const byteNumbers = new Array(byteCharacters.length);
	
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	
	const byteArray = new Uint8Array(byteNumbers);
	return new Blob([byteArray], { type: contentType });
}

// 取消加载
function cancelLoading() {
	if (bookLoadAbortController) {
		bookLoadAbortController.abort();
	}
	recognizing.value = false;
	console.log('Book loading cancelled by user');
}

// 组件挂载
onMounted(() => {
	getBookInfo();

	const handleLanguageChange = (event) => {
		console.log('Language changed, updating book titles and categories');
		currentLanguage.value = event.detail.newLanguage;
	};

	window.addEventListener('languageChanged', handleLanguageChange);

	onUnmounted(() => {
		window.removeEventListener('languageChanged', handleLanguageChange);
	});
});
</script>

<style scoped>
* {
	box-sizing: border-box;
}

.online-library {
	width: 100%;
	min-height: 100vh;
	background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
	padding: 24px;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	display: flex;
	flex-direction: column;
	position: relative;
}

/* 主内容区 */
.main-content {
	width: 100%;
	max-width: 1600px;
	margin: 90px auto 0 auto;
	display: flex;
	flex-direction: column;
}

/* 页面标题 */
.page-header {
	text-align: center;
	margin-bottom: 48px;
}

.page-title {
	font-size: 2.5rem;
	font-weight: 700;
	color: #2c3e50;
	margin: 0 0 12px 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16px;
}

.title-icon {
	font-size: 3rem;
}

.page-description {
	font-size: 1.1rem;
	color: #5a6c7d;
	margin: 0;
}

/* 分类容器 */
.categories-container {
	display: flex;
	flex-direction: column;
	gap: 48px;
	padding: 0 8px;
}

.category-section {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.category-title {
	font-size: 1.75rem;
	font-weight: 700;
	color: #2c3e50;
	margin: 0;
	padding: 0 0 12px 0;
	border-bottom: 3px solid rgba(102, 126, 234, 0.2);
	display: flex;
	align-items: center;
	gap: 12px;
}

.category-icon {
	font-size: 2rem;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.category-count {
	font-size: 1rem;
	font-weight: 600;
	color: #667eea;
	background: rgba(102, 126, 234, 0.1);
	padding: 4px 12px;
	border-radius: 20px;
	margin-left: auto;
}

/* 图书网格 */
.book-gallery {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	gap: 24px;
	padding: 0 8px;
}

.book-card {
	background: #fff;
	border-radius: 12px;
	overflow: hidden;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	cursor: pointer;
	display: flex;
	flex-direction: column;
}

.book-card:hover {
	transform: translateY(-4px);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.book-card:active {
	transform: translateY(-2px);
}

.book-card:focus {
	outline: 3px solid #667eea;
	outline-offset: 2px;
}

.book-cover {
	width: 100%;
	aspect-ratio: 2 / 3;
	overflow: hidden;
	background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
	position: relative;
}

.cover-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
	transition: transform 0.3s ease;
}

.book-card:hover .cover-image {
	transform: scale(1.05);
}

.book-info {
	padding: 14px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	background: #fff;
	flex-grow: 1;
}

.book-title {
	font-size: 0.95rem;
	font-weight: 600;
	color: #2c3e50;
	margin: 0;
	line-height: 1.35;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	text-overflow: ellipsis;
	min-height: 2.7em;
}

/* 加载状态 */
.loading-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 24px;
	padding: 80px 20px;
	color: #5a6c7d;
	font-size: 1.1rem;
}

.loading-spinner {
	width: 48px;
	height: 48px;
	border: 4px solid rgba(102, 126, 234, 0.1);
	border-top: 4px solid #667eea;
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}

/* 弹窗样式 */
.dialog-mask {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	background: rgba(0, 0, 0, 0.4);
	backdrop-filter: blur(4px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2000;
	animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}

.loading-dialog {
	background: #fff;
	border-radius: 20px;
	box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	padding: 48px 40px;
	width: 90%;
	max-width: 420px;
	display: flex;
	flex-direction: column;
	align-items: center;
	animation: slideUp 0.3s ease;
}

@keyframes slideUp {
	from { transform: translateY(20px); opacity: 0; }
	to { transform: translateY(0); opacity: 1; }
}

.loading-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.loading-dialog .loading-spinner {
	margin-bottom: 32px;
}

.processing-file-name {
	font-size: 1rem;
	font-weight: 600;
	color: #667eea;
	background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
	padding: 12px 20px;
	border-radius: 10px;
	margin-bottom: 20px;
	text-align: center;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	border: 2px solid rgba(102, 126, 234, 0.2);
}

.loading-title {
	font-size: 1.3rem;
	font-weight: 700;
	color: #2c3e50;
	margin: 0 0 8px 0;
	text-align: center;
}

.loading-description {
	font-size: 0.9rem;
	color: #6b7280;
	margin: 0 0 24px 0;
	text-align: center;
	line-height: 1.5;
}

.loading-dots {
	display: flex;
	gap: 8px;
	margin-bottom: 32px;
}

.dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: #667eea;
	animation: bounce 1.2s ease-in-out infinite;
	transform: translateZ(0);
	will-change: transform, opacity;
}

.dot:nth-child(1) { animation-delay: 0s; }
.dot:nth-child(2) { animation-delay: 0.3s; }
.dot:nth-child(3) { animation-delay: 0.6s; }

@keyframes bounce {
	0%, 80%, 100% { transform: translateY(0) scale(0.8); opacity: 0.5; }
	40% { transform: translateY(-4px) scale(1); opacity: 1; }
}

.loading-cancel-btn {
	background: #f3f4f6;
	color: #4b5563;
	border: none;
	border-radius: 10px;
	padding: 12px 32px;
	font-size: 15px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
	width: 100%;
	max-width: 200px;
}

.loading-cancel-btn:hover {
	background: #e5e7eb;
	transform: translateY(-2px);
}

.loading-cancel-btn:active {
	transform: translateY(0);
}

/* 响应式布局 */
@media (max-width: 1024px) {
	.categories-container { gap: 40px; }
	.category-title { font-size: 1.5rem; }
	.category-icon { font-size: 1.75rem; }
	.book-gallery {
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 20px;
	}
	.page-title { font-size: 2rem; }
	.title-icon { font-size: 2.5rem; }
}

@media (max-width: 768px) {
	.back-btn { padding: 8px 16px; font-size: 13px; }
	.main-content { margin-top: 80px; }
	.page-header { margin-bottom: 32px; }
	.page-title { font-size: 1.75rem; }
	.title-icon { font-size: 2rem; }
	.page-description { font-size: 1rem; }
	.categories-container { gap: 32px; }
	.category-title { font-size: 1.3rem; gap: 8px; }
	.category-icon { font-size: 1.5rem; }
	.category-count { font-size: 0.85rem; padding: 3px 10px; }
	.book-gallery {
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 16px;
	}
	.book-info { padding: 12px; }
	.book-title { font-size: 0.9rem; min-height: 2.5em; }
}

@media (max-width: 480px) {
	.back-btn { width: 100%; justify-content: center; padding: 11px 20px; font-size: 14px; }
	.main-content { margin-top: 140px; }
	.page-header { margin-bottom: 24px; }
	.page-title { font-size: 1.5rem; flex-direction: column; gap: 8px; }
	.title-icon { font-size: 2.5rem; }
	.page-description { font-size: 0.9rem; }
	.categories-container { gap: 28px; }
	.category-title { font-size: 1.15rem; gap: 6px; padding-bottom: 8px; border-bottom-width: 2px; }
	.category-icon { font-size: 1.3rem; }
	.category-count { font-size: 0.75rem; padding: 2px 8px; }
	.book-gallery { grid-template-columns: repeat(2, 1fr); gap: 12px; }
	.book-card { border-radius: 10px; }
	.book-info { padding: 10px; gap: 5px; }
	.book-title { font-size: 0.85rem; -webkit-line-clamp: 2; line-clamp: 2; min-height: 2.4em; }
	.loading-dialog { padding: 36px 28px; max-width: 340px; }
	.processing-file-name { font-size: 0.9rem; padding: 10px 16px; }
	.loading-title { font-size: 1.1rem; }
	.loading-description { font-size: 0.85rem; }
}

@media (max-width: 360px) {
	.book-gallery { gap: 8px; }
}
</style>
