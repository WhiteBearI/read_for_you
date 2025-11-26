<template>
	<div class="index-page">
		<!-- 顶部导航栏 -->
		<TopNav>
			<template #actions>
				<!-- 上传按钮 -->
				<button class="upload-btn" @click="showDialog = true">
					<svg class="upload-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span>{{ t('uploadPDF') }}</span>
				</button>

				<!-- 帮助按钮 -->
				<button class="help-btn" @click="openHelpDialog" :aria-label="t('viewHelp')">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
						<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						<circle cx="12" cy="17" r="1" fill="currentColor"/>
					</svg>
					<span>{{ t('viewHelp') }}</span>
				</button>
			</template>
		</TopNav>

		<!-- 主内容区 - 图书展示 -->
		<div class="main-content">
			<!-- 按分类展示图书 -->
			<div v-if="!loading" class="categories-container">
			<div v-for="category in categorizedBooks" :key="category.key" class="category-section">
				<!-- 分类标题 -->
				<h2 class="category-title" tabindex="0">
					<span class="category-icon">{{ category.icon }}</span>
					{{ category.name }}
					<span class="category-count">{{ category.books.length }}</span>
				</h2>					<!-- 该分类下的图书网格 -->
					<div class="book-gallery">
						<div v-for="book in category.books" :key="book.coverUrl"
							class="book-card"
							:tabindex="0"
							:aria-label="`Book: ${getBookTitle(book)}`"
							@click="handleImageClick(book)"
							@keydown.enter="handleImageClick(book)"
							@keydown.space.prevent="handleImageClick(book)">

							<div class="book-cover">
								<img :src="book.coverUrl" :alt="getBookTitle(book)" class="cover-image" />
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

		<div v-if="showDialog" class="dialog-mask" @click.self="showDialog = false">
			<div class="dialog-box">
				<div class="dialog-header">
					<h2 class="dialog-title" tabindex="0" ref="dialogTitleRef">
						<svg class="dialog-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						{{ t('selectFile') }}
					</h2>
					<button class="dialog-close" @click="showDialog = false" aria-label="Close">
						<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</button>
				</div>

				<div class="dialog-body">
					<div class="form-group">
						<label class="form-label">{{ t('chooseFile') }}</label>
						<div class="file-input-wrapper">
							<input type="file" accept=".pdf,application/pdf" @change="onFileChange" id="file-input" class="file-input" />
							<label for="file-input" class="file-input-label" role="button" tabindex="0" 
								@keydown.enter="triggerFileInput" 
								@keydown.space.prevent="triggerFileInput">
								<svg class="file-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
									<path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
								<span v-if="!file">{{ t('chooseFile') }}</span>
								<span v-else class="file-name">{{ file.name }}</span>
							</label>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label">{{ t('pageNumbers') }}</label>
						<div class="input-with-validation">
							<input
								type="text"
								v-model="pageNum"
								@input="validatePageFormat"
								class="form-input"
								:class="{ 'input-error': pageNumError, 'input-valid': pageNumValid }"
								:placeholder="t('pageNumbersPlaceholder')"
							/>
							<span v-if="pageNumValid && pageNum.trim() !== ''" class="validation-icon success">✓</span>
							<span v-if="pageNumError" class="validation-icon error">✗</span>
						</div>
						<p v-if="pageNumError" class="error-message">{{ pageNumError }}</p>
						<p v-else-if="pageNum.trim() === ''" class="form-hint">{{ t('pageNumbersHint') }}</p>
					</div>
				</div>

				<div class="dialog-footer">
					<button class="btn-secondary" @click="showDialog = false">{{ t('cancel') }}</button>
					<button class="btn-primary" @click="startRecognize" :disabled="!file || !pageNumValid">{{ t('startRecognition') }}</button>
				</div>
			</div>
		</div>

		<!-- 识别中 / 加载中对话框 -->
		<div v-if="recognizing" class="dialog-mask">
			<div class="loading-dialog">
				<div class="loading-content">
					<!-- 复用 loading books 的加载动画 -->
					<div class="loading-spinner"></div>

					<!-- 文件名/书籍名 -->
					<div class="processing-file-name">
						📄 {{ processingFileName }}
					</div>

					<!-- 加载文本 -->
					<h3 class="loading-title">{{ loadingMessage }}</h3>
					<p class="loading-description">{{ isLoadingBook ? t('loadingBookDescription') : t('loadingDescription') }}</p>

					<!-- 简化的进度指示 -->
					<div class="loading-dots">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</div>
				</div>

				<!-- 取消按钮 -->
				<button class="loading-cancel-btn" @click="cancelRecognize">
					{{ t('cancel') }}
				</button>
			</div>
		</div>

		<!-- 帮助文档对话框 -->
		<div v-if="showHelpDialog" class="dialog-mask" @keydown="handleHelpDialogKeydown">
			<div class="help-dialog-box">
				<div class="help-dialog-header">
					<h2 class="help-dialog-title" ref="helpTitleRef" tabindex="0">{{ t('helpDocumentation') }}</h2>
					<button class="help-close-btn" @click="closeHelpDialog" :aria-label="t('closeHelp')" tabindex="0">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</button>
				</div>
				<div class="help-dialog-content">
					<section class="help-section">
						<h3 tabindex="0">{{ t('helpIntroduction') }}</h3>
						<p tabindex="0">{{ t('helpIntroText') }}</p>
					</section>
					
					<section class="help-section">
						<h3 tabindex="0">{{ t('helpFeatures') }}</h3>
						<div class="help-text" tabindex="0" v-html="formatHelpText(t('helpFeaturesText'))"></div>
					</section>
					
					<section class="help-section">
						<h3 tabindex="0">{{ t('helpUsage') }}</h3>
						<div class="help-text" tabindex="0" v-html="formatHelpText(t('helpUsageText'))"></div>
					</section>
					
					<section class="help-section">
						<h3 tabindex="0">{{ t('helpKeyboardShortcuts') }}</h3>
						<div class="help-text shortcuts" tabindex="0" v-html="formatHelpText(t('helpShortcutsText'))"></div>
					</section>
					
					<section class="help-section">
						<h3 tabindex="0">{{ t('helpAccessibility') }}</h3>
						<div class="help-text" tabindex="0" v-html="formatHelpText(t('helpAccessibilityText'))"></div>
					</section>
				</div>
				<div class="help-dialog-actions">
					<button class="dialog-action-btn" tabindex="0" @click="closeHelpDialog">{{ t('closeHelp') }}</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { backendUrl, translateUrl } from '../constants.js'
import { validatePageRange, getPDFPageCount } from '../utils/PDFService.js';
import indexedDBService from '../utils/IndexedDBService.js';
import { useTranslation, addLanguageParam } from '../utils/i18n.js';
import TopNav from './TopNav.vue';

const { t, language } = useTranslation();

// 响应式语言状态（用于触发UI更新，直接使用 i18n 提供的 language）
const currentLanguage = ref(language);

const showDialog = ref(false);
const showHelpDialog = ref(false);
const pageNum = ref('');
const file = ref(null);
const dialogTitleRef = ref(null);
const helpTitleRef = ref(null);
const recognizing = ref(false);
const loading = ref(false);
const loadingMessage = ref('');
const processingFileName = ref(''); // 当前处理的文件名或书籍名
const isLoadingBook = ref(false); // 区分是加载书籍还是处理用户文档
let abortController = null;
let bookLoadAbortController = null; // 用于取消书籍加载

// 页码格式验证状态
const pageNumError = ref('');
const pageNumValid = ref(false);

// 书籍数据列表（包含封面URL和元数据）
const bookImages = ref([]);

// 默认分类图标映射（可根据关键词匹配）
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
	const language = currentLanguage.value;
	const categoryMap = new Map();

	// 将书籍按分类分组
	bookImages.value.forEach(book => {
		const categoryEn = book.metadata?.category_en || 'General';
		const categoryZh = book.metadata?.category_zh || '其他';

		if (!categoryMap.has(categoryEn)) {
			categoryMap.set(categoryEn, {
				key: categoryEn,
				name: language === 'zh' ? categoryZh : categoryEn,
				icon: getCategoryIcon(categoryEn),
				books: []
			});
		}

		categoryMap.get(categoryEn).books.push(book);
	});

	// 转换为数组并按分类名称排序
	return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
});

// 格式化帮助文本（将换行符转换为HTML）
function formatHelpText(text) {
	return text.replace(/\\n/g, '<br>');
}

// 打开帮助对话框并管理焦点
async function openHelpDialog() {
	showHelpDialog.value = true;
	// 等待DOM更新后将焦点移动到帮助标题
	await nextTick();
	if (helpTitleRef.value) {
		helpTitleRef.value.focus();
	}
}

// 关闭帮助对话框
function closeHelpDialog() {
	showHelpDialog.value = false;
}

// 处理帮助对话框的键盘事件
function handleHelpDialogKeydown(event) {
	if (event.key === 'Escape') {
		closeHelpDialog();
	}
}

// 获取封面图片和书籍元数据
async function getCoverImages() {
	loading.value = true;
	try {
		// 并行请求封面URL和元数据
		const [coversResponse, metadataResponse] = await Promise.all([
			fetch(`${backendUrl}/getCoverImages`, { credentials: 'include' }),
			fetch(`${backendUrl}/getBookMetadata`, { credentials: 'include' })
		]);

		const coversData = await coversResponse.json();
		const metadataData = await metadataResponse.json();

		if (!coversData.success) {
			console.error('Failed to get cover images:', coversData);
			alert('Failed to load book covers');
			return;
		}

		if (!metadataData.success) {
			console.warn('Failed to get book metadata, using covers only');
			// 降级方案：只有封面，没有元数据
			bookImages.value = coversData.images.map((coverUrl, index) => ({
				coverUrl,
				metadata: null,
				index
			}));
			return;
		}

		// 提取 prefix 的辅助函数
		const extractPrefix = (coverUrl) => {
			let prefix = coverUrl.replace(/\/[^\/]+\.(jpg|jpeg|png|gif).*$/i, '');
			const containerIndex = prefix.indexOf('.net/bookblobcontainer/');
			if (containerIndex !== -1) {
				prefix = prefix.substring(containerIndex + 23);
			}
			return prefix;
		};

		// 匹配封面和元数据
		const coverUrls = coversData.images;
		const metadataList = metadataData.data;

		bookImages.value = coverUrls.map((coverUrl, index) => {
			const prefix = extractPrefix(coverUrl);
			// 通过 book_prefix 匹配元数据
			const matchedMetadata = metadataList.find(item =>
				prefix.includes(item.book_prefix) || item.book_prefix.includes(prefix)
			);

			return {
				coverUrl,
				metadata: matchedMetadata || null,
				index
			};
		});

		console.log(`Loaded ${bookImages.value.length} books with metadata`);
	} catch (error) {
		console.error('Error fetching book data:', error);
		alert('Error loading books: ' + error.message);
	} finally {
		loading.value = false;
	}
}

// 处理图片点击事件
async function handleImageClick(book) {
	// 如果有元数据，直接使用 book_prefix；否则从 URL 提取
	let prefix;
	if (book.metadata && book.metadata.book_prefix) {
		prefix = book.metadata.book_prefix;
	} else {
		// 降级方案：从封面 URL 提取 prefix
		const imageUrl = book.coverUrl;
		prefix = imageUrl.replace(/\/[^\/]+\.(jpg|jpeg|png|gif).*$/i, '');
		const containerIndex = prefix.indexOf('.net/bookblobcontainer/');
		if (containerIndex !== -1) {
			prefix = prefix.substring(containerIndex + 23);
		}
	}

	console.log('Book clicked, prefix:', prefix);

	loadingMessage.value = t('loading');
	processingFileName.value = getBookTitle(book); // 设置书籍名
	isLoadingBook.value = true; // 加载书籍
	recognizing.value = true;
	bookLoadAbortController = new AbortController();

	try {
		// 并行获取 PDF 和 JSON 文件
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

		// 检查是否已经取消（用户点击了取消按钮）
		if (!recognizing.value) {
			console.log('Book loading cancelled by user, aborting navigation');
			return;
		}

		if (!pdfResponse.ok || !jsonResponse.ok) {
			throw new Error('Failed to fetch PDF or JSON data');
		}

		// 获取文件数据
		// PDF 返回: { type: 'pdf', data: 'data:application/pdf;base64,...' }
		const pdfData = await pdfResponse.json();
		const pdfBlob = base64ToBlob(pdfData.data, 'application/pdf');
 
		// JSON 返回: { type: 'json', data: {...} }
		const jsonData = await jsonResponse.json();
		const analysisResult = jsonData.data;

		// 再次检查是否已经取消
		if (!recognizing.value) {
			console.log('Book loading cancelled by user, aborting navigation');
			return;
		}

		// 使用 IndexedDB 存储数据
		await indexedDBService.setItems({
			analysisResult: analysisResult,        // 原始数据
			PDFBlob: pdfBlob,                      // PDF Blob 对象
			bookTitle: getBookTitle(book),         // 书籍名称
			pdfFileName: book.metadata?.pdf_file || 'Unknown'  // PDF文件名
		});

		console.log('Data stored successfully, navigating to reading page');
		window.location.hash = '#/reading';

	} catch (error) {
		// 如果是取消操作，不显示错误
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

// 获取书名（从元数据中获取统一的 title 字段）
function getBookTitle(book) {
	// 如果有元数据，使用元数据中的 title
	if (book.metadata) {
		return book.metadata.title || `Book ${book.index + 1}`;
	}

	// 降级方案：使用占位符
	const placeholderTitles = [
		'The Great Adventure',
		'Mystery of the Ocean',
		'Journey Through Time',
		'Ancient Wisdom',
		'Modern Technology',
		'Art and Culture',
		'Science Frontiers',
		'Historical Tales'
	];
	return placeholderTitles[book.index % placeholderTitles.length] || `Book ${book.index + 1}`;
}

/**
 * 将 base64 字符串转换为 Blob
 * @param {string} base64 - base64 编码的字符串（可以带或不带 data URI 前缀）
 * @param {string} contentType - MIME 类型
 * @returns {Blob} - 转换后的 Blob 对象
 */
function base64ToBlob(base64, contentType = '') {
	// 移除 data URI 前缀（如果存在）
	let base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
	
	// 移除所有空白字符（换行符、空格等）
	base64Data = base64Data.replace(/\s/g, '');
	
	// 解码 base64
	const byteCharacters = atob(base64Data);
	const byteNumbers = new Array(byteCharacters.length);
	
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	
	const byteArray = new Uint8Array(byteNumbers);
	return new Blob([byteArray], { type: contentType });
}

function onFileChange(e) {
	file.value = e.target.files[0] || null;
}

// 触发文件输入（用于键盘无障碍访问）
function triggerFileInput() {
	const fileInput = document.getElementById('file-input');
	if (fileInput) {
		fileInput.click();
	}
}

// 页码格式验证函数
function validatePageFormat() {
	const trimmed = pageNum.value.trim();

	// 空值是有效的（处理所有页面）
	if (trimmed === '') {
		pageNumError.value = '';
		pageNumValid.value = true;
		return true;
	}

	// 检查是否是纯数字（单页）
	if (/^\d+$/.test(trimmed)) {
		const page = parseInt(trimmed, 10);
		if (page > 0) {
			pageNumError.value = '';
			pageNumValid.value = true;
			return true;
		}
	}

	// 检查是否是范围格式（数字-数字）
	if (/^\d+-\d+$/.test(trimmed)) {
		const parts = trimmed.split('-');
		const startPage = parseInt(parts[0], 10);
		const endPage = parseInt(parts[1], 10);

		if (startPage > 0 && endPage > 0 && endPage >= startPage) {
			pageNumError.value = '';
			pageNumValid.value = true;
			return true;
		}

		if (endPage < startPage) {
			pageNumError.value = t('pageRangeInvalid');
			pageNumValid.value = false;
			return false;
		}
	}

	// 格式无效
	pageNumError.value = t('pageFormatInvalid');
	pageNumValid.value = false;
	return false;
}

async function startRecognize() {
	if (!file.value) {
		alert('Please select a file first');
		return;
	}

	// 保存文件名（防止后续 file.value 被清空）
	const fileName = file.value.name;
	const bookTitleValue = fileName.replace(/\.pdf$/i, '');

	// 验证页码格式
	if (pageNum.value && pageNum.value.trim() !== '') {
		if (!validatePageFormat()) {
			// 格式无效，不继续
			return;
		}
		const totalPages = await getPDFPageCount(file.value);

		const validation = validatePageRange(pageNum.value, totalPages);
		if (!validation.valid) {
			alert(validation.error);
			return;
		}
	}

	const formData = new FormData();
	formData.append('file', file.value);
	formData.append('pageNum', pageNum.value);
	showDialog.value = false;
	loadingMessage.value = t('recognizing');
	processingFileName.value = fileName; // 设置文件名
	isLoadingBook.value = false; // 用户上传的文档
	recognizing.value = true;
	abortController = new AbortController();

	try {
		const recognitionUrl = addLanguageParam(backendUrl + '/recognition');
		const res = await fetch(recognitionUrl, {
			method: 'POST',
			body: formData,
			signal: abortController.signal,
			credentials: 'include'
		});
		const result = await res.json();

		// 检查是否已经取消（用户点击了取消按钮）
		if (!recognizing.value) {
			console.log('Recognition cancelled by user, aborting navigation');
			return;
		}

		if (result.status !== 'success') {
			recognizing.value = false;
			alert('Recognition failed');
			return;
		}

		recognizing.value = false;

		try {
			// 将 PDF base64 转换为 Blob
			const pdfBase64 = result.pdf;
			const pdfBlob = base64ToBlob(pdfBase64, 'application/pdf');

			// IndexedDB 存储
			await indexedDBService.setItems({
				analysisResult: JSON.parse(result.result),            // JSON 对象：分析结果
				PDFBlob: pdfBlob,                         // Blob：PDF 文件
				bookTitle: bookTitleValue,                // 字符串：书籍名称
				pdfFileName: fileName                     // 字符串：PDF 文件名
			});
			window.location.hash = '#/reading';
		} catch (dbError) {
			console.error('Failed to save to IndexedDB:', dbError);
			alert('Failed to save data: ' + dbError.message);
		}
	} catch (e) {
		if (e.name !== 'AbortError') {
			alert('Upload failed: ' + e.message);
		}
		recognizing.value = false;
	}
}

function cancelRecognize() {
	// 取消手动上传PDF的请求
	if (abortController) {
		abortController.abort();
	}
	// 取消Book Center加载的请求
	if (bookLoadAbortController) {
		bookLoadAbortController.abort();
	}
	recognizing.value = false;
	console.log('Recognition/loading cancelled by user');
}

watch(showDialog, (val) => {
	if (val) {
		// 对话框打开时，立即验证当前输入
		validatePageFormat();
		nextTick(() => {
			dialogTitleRef.value && dialogTitleRef.value.focus();
		});
	} else {
		// 对话框关闭时，重置所有状态
		pageNum.value = '';
		file.value = null;
		pageNumError.value = '';
		pageNumValid.value = false;
	}
});

// 组件挂载时获取封面图片
onMounted(() => {
	getCoverImages();

	// 监听语言切换事件
	const handleLanguageChange = (event) => {
		console.log('Language changed, updating book titles and categories');
		currentLanguage.value = event.detail.newLanguage;
	};

	window.addEventListener('languageChanged', handleLanguageChange);

	// 清理监听器
	onUnmounted(() => {
		window.removeEventListener('languageChanged', handleLanguageChange);
	});
});
</script>

<style scoped>
* {
	box-sizing: border-box;
}

.index-page {
	width: 100%;
	min-height: 100vh;
	background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
	padding: 24px;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	display: flex;
	flex-direction: column;
	position: relative;
}

/* ========== 上传 PDF 按钮 ========== */
.upload-btn {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: #fff;
	border: none;
	border-radius: 10px;
	padding: 10px 20px;
	font-size: 14px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
	display: flex;
	align-items: center;
	gap: 8px;
	box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3);
	white-space: nowrap;
}

.upload-btn:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.upload-btn:active {
	transform: translateY(0);
	box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3);
}

.upload-icon {
	width: 18px;
	height: 18px;
	flex-shrink: 0;
}

/* 帮助按钮 */
.help-btn {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 20px;
	font-size: 14px;
	font-weight: 600;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
	border: none;
	border-radius: 10px;
	cursor: pointer;
	box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3);
	transition: all 0.3s ease;
	white-space: nowrap;
}

.help-btn:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.help-btn:active {
	transform: translateY(0);
}

.help-btn:focus {
	outline: 2px solid #667eea;
	outline-offset: 2px;
}

.help-btn svg {
	flex-shrink: 0;
}

/* ========== 主内容区 ========== */
.main-content {
	width: 100%;
	max-width: 1600px;
	margin: 90px auto 0 auto; /* 为固定导航栏留出空间 */
	display: flex;
	flex-direction: column;
}

/* ========== 分类容器 ========== */
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

/* 分类标题 */
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

/* ========== 图书网格 ========== */
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
	aspect-ratio: 2 / 3; /* 更紧凑的比例 */
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

.book-category {
	font-size: 0.8rem;
	color: #667eea;
	font-weight: 500;
	padding: 3px 10px;
	background: rgba(102, 126, 234, 0.08);
	border-radius: 4px;
	display: inline-block;
	align-self: flex-start;
}

/* ========== 加载状态 ========== */
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
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

/* ========== 弹窗样式 ========== */
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
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}

.dialog-box {
	background: #fff;
	border-radius: 16px;
	box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	width: 90%;
	max-width: 480px;
	display: flex;
	flex-direction: column;
	animation: slideUp 0.3s ease;
}

@keyframes slideUp {
	from {
		transform: translateY(20px);
		opacity: 0;
	}
	to {
		transform: translateY(0);
		opacity: 1;
	}
}

/* 弹窗头部 */
.dialog-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 24px 28px 16px 28px;
	border-bottom: 1px solid #f0f0f0;
}

.dialog-title {
	font-size: 1.4rem;
	font-weight: 700;
	color: #2c3e50;
	margin: 0;
	display: flex;
	align-items: center;
	gap: 12px;
}

.dialog-icon {
	width: 24px;
	height: 24px;
	stroke: #667eea;
}

.dialog-close {
	width: 32px;
	height: 32px;
	border: none;
	background: transparent;
	cursor: pointer;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.2s ease;
	padding: 0;
}

.dialog-close svg {
	width: 20px;
	height: 20px;
	stroke: #666;
}

.dialog-close:hover {
	background: rgba(102, 126, 234, 0.1);
}

.dialog-close:hover svg {
	stroke: #667eea;
}

/* 弹窗主体 */
.dialog-body {
	padding: 24px 28px;
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.form-label {
	font-size: 0.9rem;
	font-weight: 600;
	color: #2c3e50;
}

/* 文件上传输入 */
.file-input-wrapper {
	position: relative;
}

.file-input {
	display: none;
}

.file-input-label {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px 18px;
	border: 2px dashed rgba(102, 126, 234, 0.3);
	border-radius: 10px;
	background: rgba(102, 126, 234, 0.03);
	cursor: pointer;
	transition: all 0.3s ease;
	color: #667eea;
	font-weight: 500;
}

.file-input-label:hover {
	border-color: #667eea;
	background: rgba(102, 126, 234, 0.08);
	transform: translateY(-1px);
}

.file-icon {
	width: 24px;
	height: 24px;
	stroke: #667eea;
	flex-shrink: 0;
}

.file-name {
	color: #2c3e50;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* 文本输入 */
.form-input {
	padding: 12px 16px;
	border: 2px solid #e5e7eb;
	border-radius: 10px;
	font-size: 0.95rem;
	color: #2c3e50;
	transition: all 0.3s ease;
	outline: none;
	width: 100%;
}

.form-input:focus {
	border-color: #667eea;
	box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input.input-error {
	border-color: #ef4444;
	background-color: #fef2f2;
}

.form-input.input-error:focus {
	border-color: #dc2626;
	box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.form-input.input-valid {
	border-color: #10b981;
	background-color: #f0fdf4;
}

.form-input.input-valid:focus {
	border-color: #059669;
	box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-input::placeholder {
	color: #9ca3af;
}

/* 带验证图标的输入框容器 */
.input-with-validation {
	position: relative;
	display: flex;
	align-items: center;
}

.validation-icon {
	position: absolute;
	right: 12px;
	font-size: 1.2rem;
	font-weight: bold;
	pointer-events: none;
}

.validation-icon.success {
	color: #10b981;
}

.validation-icon.error {
	color: #ef4444;
}

.form-hint {
	font-size: 0.8rem;
	color: #6b7280;
	margin: 4px 0 0 0;
}

.error-message {
	font-size: 0.8rem;
	color: #ef4444;
	margin: 4px 0 0 0;
	font-weight: 500;
}

/* 弹窗底部 */
.dialog-footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	padding: 16px 28px 24px 28px;
	border-top: 1px solid #f0f0f0;
}

.btn-primary {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: #fff;
	border: none;
	border-radius: 10px;
	padding: 12px 28px;
	font-size: 15px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 2px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:active:not(:disabled) {
	transform: translateY(0);
}

.btn-primary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-secondary {
	background: #f3f4f6;
	color: #4b5563;
	border: none;
	border-radius: 10px;
	padding: 12px 24px;
	font-size: 15px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
}

.btn-secondary:hover {
	background: #e5e7eb;
	transform: translateY(-2px);
}

.btn-secondary:active {
	transform: translateY(0);
}

/* ========== 加载对话框样式 ========== */
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

.loading-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

/* 为加载对话框中的 spinner 添加底部间距 */
.loading-dialog .loading-spinner {
	margin-bottom: 32px;
}

/* 文件名/书籍名显示 */
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

/* 加载文本 */
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

/* 进度指示点 */
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
	/* 启用硬件加速 */
	transform: translateZ(0);
	will-change: transform, opacity;
}

.dot:nth-child(1) {
	animation-delay: 0s;
}

.dot:nth-child(2) {
	animation-delay: 0.3s;
}

.dot:nth-child(3) {
	animation-delay: 0.6s;
}

@keyframes bounce {
	0%, 80%, 100% {
		transform: translateY(0) scale(0.8);
		opacity: 0.5;
	}
	40% {
		transform: translateY(-4px) scale(1);
		opacity: 1;
	}
}

/* 取消按钮 */
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

/* ========== 响应式布局 ========== */
@media (max-width: 1024px) {
	.upload-btn {
		padding: 9px 18px;
		font-size: 13px;
	}

	.upload-icon {
		width: 16px;
		height: 16px;
	}

	.categories-container {
		gap: 40px;
	}

	.category-title {
		font-size: 1.5rem;
	}

	.category-icon {
		font-size: 1.75rem;
	}

	.book-gallery {
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 20px;
	}
}

/* ============= 帮助文档对话框样式 ============= */
.help-dialog-box {
	background: white;
	border-radius: 12px;
	box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
	max-width: 700px;
	width: 90%;
	max-height: 80vh;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.help-dialog-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 20px 24px;
	border-bottom: 1px solid #e2e8f0;
	background: #f8fafc;
}

.help-dialog-title {
	margin: 0;
	font-size: 1.5rem;
	font-weight: 600;
	color: #2d3748;
}

.help-close-btn {
	background: none;
	border: none;
	cursor: pointer;
	padding: 8px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #64748b;
	transition: all 0.2s ease;
}

.help-close-btn:hover {
	background: #e2e8f0;
	color: #2d3748;
}

.help-close-btn:focus {
	outline: 2px solid #667eea;
	outline-offset: 2px;
}

.help-dialog-content {
	flex: 1;
	padding: 24px;
	overflow-y: auto;
}

.help-section {
	margin-bottom: 24px;
}

.help-section:last-child {
	margin-bottom: 0;
}

.help-section h3 {
	margin: 0 0 12px 0;
	font-size: 1.2rem;
	font-weight: 600;
	color: #2d3748;
	border-left: 4px solid #667eea;
	padding-left: 12px;
}

.help-section p {
	margin: 0 0 16px 0;
	line-height: 1.6;
	color: #4a5568;
}

.help-text {
	line-height: 1.6;
	color: #4a5568;
}

.help-text.shortcuts {
	font-family: 'Courier New', monospace;
	background: #f7fafc;
	padding: 16px;
	border-radius: 8px;
	border-left: 4px solid #48bb78;
}

.help-dialog-actions {
	padding: 16px 24px;
	border-top: 1px solid #e2e8f0;
	background: #f8fafc;
	display: flex;
	justify-content: flex-end;
}

/* 帮助对话框焦点样式 */
.help-dialog-title:focus,
.help-section h3:focus,
.help-section p:focus,
.help-text:focus {
	outline: 2px solid #667eea;
	outline-offset: 2px;
	border-radius: 4px;
}

.help-dialog-title:focus {
	background: rgba(102, 126, 234, 0.1);
}

/* 响应式布局 */
@media (max-width: 768px) {
	.upload-btn,
	.help-btn {
		padding: 8px 16px;
		font-size: 13px;
	}

	.main-content {
		margin-top: 80px;
	}

	.categories-container {
		gap: 32px;
	}

	.category-title {
		font-size: 1.3rem;
		gap: 8px;
	}

	.category-icon {
		font-size: 1.5rem;
	}

	.category-count {
		font-size: 0.85rem;
		padding: 3px 10px;
	}

	.book-gallery {
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 16px;
	}

	.book-info {
		padding: 12px;
	}

	.book-title {
		font-size: 0.9rem;
		min-height: 2.5em;
	}

	.book-category {
		font-size: 0.75rem;
		padding: 2px 8px;
	}

	/* 移动端帮助对话框 */
	.help-dialog-box {
		width: 95%;
		max-height: 85vh;
		margin: 12px;
	}

	.help-dialog-header {
		padding: 16px 20px;
	}

	.help-dialog-title {
		font-size: 1.3rem;
	}

	.help-dialog-content {
		padding: 20px;
	}

	.help-section h3 {
		font-size: 1.1rem;
	}

	.help-text.shortcuts {
		padding: 12px;
		font-size: 14px;
	}

	.help-dialog-actions {
		padding: 12px 20px;
	}
}

@media (max-width: 480px) {
	.upload-btn,
	.help-btn {
		width: 100%;
		justify-content: center;
		padding: 11px 20px;
		font-size: 14px;
	}

	.upload-icon {
		width: 18px;
		height: 18px;
	}

	.main-content {
		margin-top: 140px;
	}

	.categories-container {
		gap: 28px;
	}

	.category-title {
		font-size: 1.15rem;
		gap: 6px;
		padding-bottom: 8px;
		border-bottom-width: 2px;
	}

	.category-icon {
		font-size: 1.3rem;
	}

	.category-count {
		font-size: 0.75rem;
		padding: 2px 8px;
	}

	.book-gallery {
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	.book-card {
		border-radius: 10px;
	}

	.book-info {
		padding: 10px;
		gap: 5px;
	}

	.book-title {
		font-size: 0.85rem;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		min-height: 2.4em;
	}

	.book-category {
		font-size: 0.7rem;
		padding: 2px 7px;
	}

	/* 加载对话框响应式 */
	.loading-dialog {
		padding: 36px 28px;
		max-width: 340px;
	}

	.processing-file-name {
		font-size: 0.9rem;
		padding: 10px 16px;
	}

	.loading-title {
		font-size: 1.1rem;
	}

	.loading-description {
		font-size: 0.85rem;
	}

	/* 移动端对话框优化 */
	.dialog-box {
		padding: 20px 16px;
		margin: 16px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.dialog-title {
		font-size: 1.2rem;
		margin-bottom: 16px;
	}

	.help-btn {
		font-size: 13px;
		padding: 9px 16px;
		gap: 6px;
	}

	.help-btn svg {
		width: 16px;
		height: 16px;
	}

	/* 移动端帮助对话框 */
	.help-dialog-box {
		width: 98%;
		margin: 8px;
	}

	.help-dialog-header {
		padding: 12px 16px;
	}

	.help-dialog-content {
		padding: 16px;
	}
}

/* 超小屏幕优化 */
@media (max-width: 360px) {
	.book-gallery {
		gap: 8px;
	}

	.dialog-box {
		margin: 8px;
		padding: 16px 12px;
	}

	.help-btn {
		font-size: 12px;
		padding: 6px 8px;
	}

	.help-dialog-box {
		width: 98%;
		margin: 8px;
	}

	.help-dialog-header {
		padding: 12px 16px;
	}

	.help-dialog-content {
		padding: 16px;
	}
}
</style>

<!-- 全局样式：防止滚动条导致布局偏移 + 美化滚动条 -->
<style>
/* 强制始终显示滚动条，避免内容左移 */
html {
	overflow-y: scroll;
	scrollbar-gutter: stable; /* 现代浏览器：为滚动条预留空间 */
}

/* 美化滚动条样式 (Webkit 浏览器：Chrome, Safari, Edge) */
::-webkit-scrollbar {
	width: 12px;
	height: 12px;
}

::-webkit-scrollbar-track {
	background: #f1f1f1;
	border-radius: 10px;
}

::-webkit-scrollbar-thumb {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	border-radius: 10px;
	border: 2px solid #f1f1f1;
	transition: background 0.3s ease;
}

::-webkit-scrollbar-thumb:hover {
	background: linear-gradient(135deg, #5568d3 0%, #653a8b 100%);
}

::-webkit-scrollbar-thumb:active {
	background: linear-gradient(135deg, #4450b8 0%, #542f72 100%);
}

/* Firefox 滚动条美化 */
* {
	scrollbar-width: thin;
	scrollbar-color: #667eea #f1f1f1;
}
</style>
