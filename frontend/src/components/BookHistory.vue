<template>
<div class="book-history-page">
	<TopNav />
	
	<div class="main-content">
	<div class="page-header">
		<h1 class="page-title" tabindex="0">
		<span class="title-icon" aria-hidden="true">📖</span>
		{{ t('myBooks') }}
		</h1>
	</div>
	
	<div v-if="loading" class="loading-container" role="status" aria-live="polite">
		<div class="loading-spinner" aria-hidden="true"></div>
		<p tabindex="0">{{ t('loading') }}</p>
	</div>
	
	<div v-else-if="error" class="error-message" role="alert" tabindex="0">
		{{ error }}
	</div>
	
	<div v-else class="history-list" role="list" :aria-label="t('myBooks')">
		<div v-for="item in historyData" :key="item.id" class="history-item" role="listitem" tabindex="0"
			:aria-label="getItemAriaLabel(item)">
		<div class="item-info">
			<h3 class="book-title" tabindex="0">{{ item.bookName }}</h3>
			<div class="item-meta">
			<span class="meta-item" tabindex="0">
				<span class="meta-label">{{ t('pageRangeLabel') }}:</span>
				<span class="meta-value">{{ item.pageRange }}</span>
			</span>
			<span class="meta-item" tabindex="0">
				<span class="meta-label">{{ t('time') }}:</span>
				<span class="meta-value">{{ item.dateTime }}</span>
			</span>
			<span class="meta-item" tabindex="0">
				<span class="meta-label">{{ t('status') }}:</span>
				<span class="meta-value status-badge" :class="item.status">{{ getStatusText(item.status) }}</span>
			</span>
			</div>
		</div>
		<div class="item-actions">
			<button 
				v-if="item.status === 'Completed'" 
				@click="startReading(item)" 
				class="btn-primary"
				:aria-label="t('startReading') + ': ' + item.bookName">
			{{ t('startReading') }}
			</button>
			<button 
				v-else 
				class="btn-disabled" 
				disabled 
				tabindex="0"
				:aria-label="t('startReading') + ': ' + item.bookName + ' - ' + getStatusText(item.status)"
				:aria-disabled="true">
			{{ t('startReading') }}
			</button>
		</div>
		</div>
		<div v-if="historyData.length === 0" class="empty-state" tabindex="0" role="status">
		<p>{{ t('noHistoryFound') }}</p>
		</div>
	</div>
	</div>

	<!-- 加载书籍浮窗 -->
	<div v-if="loadingBook" class="dialog-mask">
		<div class="loading-dialog">
			<div class="loading-content">
				<div class="loading-spinner" aria-hidden="true"></div>
				<div class="processing-file-name" tabindex="0">
					📄 {{ processingFileName }}
				</div>
				<h3 class="loading-title" tabindex="0" ref="loadingTitleRef">{{ t('loading') }}</h3>
				<p class="loading-description" tabindex="0">{{ t('loadingBookDescription') }}</p>
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
import { ref, onMounted, nextTick } from 'vue';
import TopNav from './TopNav.vue';
import { useTranslation } from '../utils/i18n.js';
import indexedDBService from '../utils/IndexedDBService.js';

const { t } = useTranslation();
const historyData = ref([]);
const loading = ref(false);
const error = ref(null);
const backendUrl = import.meta.env.VITE_BACKEND_URL;

// 加载书籍相关状态
const loadingBook = ref(false);
const processingFileName = ref('');
const loadingTitleRef = ref(null);
let bookLoadAbortController = null;

async function getBookHistory() {
loading.value = true;
error.value = null;
try {
	const response = await fetch(`${backendUrl}/getBookHistory`, {
	credentials: 'include'
	});
	
	if (!response.ok) {
	throw new Error(`HTTP error! status: ${response.status}`);
	}

	const result = await response.json();
	if (result.status == 'success') {
	historyData.value = result.data;
	} else {
	error.value = result.error_msg || t('fetchError');
	}
} catch (e) {
	console.error("Error fetching book metadata:", e);
	error.value = e.message;
} finally {
	loading.value = false;
}
}

function startReading(item) {
console.log('Start reading', item);
loadBook(item);
}

// 加载书籍数据
async function loadBook(item) {
processingFileName.value = item.bookName;
loadingBook.value = true;
bookLoadAbortController = new AbortController();

// 浮窗打开后将焦点移到提示语上
nextTick(() => {
	if (loadingTitleRef.value) {
		loadingTitleRef.value.focus();
	}
});

try {
	const response = await fetch(`${backendUrl}/getResultOfUser`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ request_id: item.requestId }),
		signal: bookLoadAbortController.signal,
		credentials: 'include'
	});

	if (!loadingBook.value) {
		console.log('Book loading cancelled by user, aborting navigation');
		return;
	}

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const result = await response.json();

	if (!loadingBook.value) {
		console.log('Book loading cancelled by user, aborting navigation');
		return;
	}

	if (result.status !== 'success') {
		throw new Error(result.error_msg || 'Failed to load book data');
	}

	// 解析返回的数据（与上传按钮返回格式统一：result, pdf）
	const pdfBlob = base64ToBlob(result.pdf, 'application/pdf');
	const analysisResult = result.result;

	// 存储到 IndexedDB
	await indexedDBService.setItems({
		analysisResult: analysisResult,
		PDFBlob: pdfBlob,
		bookTitle: item.bookName,
		pdfFileName: item.bookName || 'Unknown'
	});

	console.log('Data stored successfully, navigating to reading page');
	window.location.hash = '#/reading';

} catch (error) {
	if (error.name === 'AbortError') {
		console.log('Book loading aborted by user');
	} else {
		console.error('Error loading book:', error);
		alert('Failed to load book data: ' + error.message);
	}
} finally {
	loadingBook.value = false;
}
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
loadingBook.value = false;
console.log('Book loading cancelled by user');
}

function viewDetails(item) {
console.log('View details', item);
// TODO: Implement view details logic
}

// 获取状态的国际化文本
function getStatusText(status) {
if (!status) return '';
const key = 'status_' + status.toLowerCase();
const translated = t(key);
// 如果翻译结果等于 key 本身，说明没有找到翻译，返回原状态值
return translated === key ? status : translated;
}

// 获取记录项的 aria-label
function getItemAriaLabel(item) {
const statusText = getStatusText(item.status);
return `${item.bookName}, ${t('pageRangeLabel')}: ${item.pageRange}, ${t('time')}: ${item.dateTime}, ${t('status')}: ${statusText}`;
}

onMounted(() => {
getBookHistory();
});
</script>

<style scoped>
.book-history-page {
width: 100%;
min-height: 100vh;
background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
padding: 24px;
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
display: flex;
flex-direction: column;
}

.main-content {
width: 100%;
max-width: 1000px;
margin: 90px auto 0 auto;
display: flex;
flex-direction: column;
}

.page-header {
text-align: center;
margin-bottom: 32px;
}

.page-title {
font-size: 2rem;
font-weight: 700;
color: #2c3e50;
display: flex;
align-items: center;
justify-content: center;
gap: 12px;
}

.title-icon {
font-size: 2.5rem;
}

.history-list {
display: flex;
flex-direction: column;
gap: 16px;
}

.history-item {
background: #fff;
border-radius: 12px;
padding: 20px;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
display: flex;
justify-content: space-between;
align-items: center;
transition: transform 0.2s, box-shadow 0.2s;
}

.history-item:hover {
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.item-info {
flex: 1;
}

.book-title {
font-size: 1.2rem;
font-weight: 600;
color: #2c3e50;
margin: 0 0 8px 0;
}

.item-meta {
display: flex;
gap: 24px;
font-size: 0.9rem;
color: #6b7280;
flex-wrap: wrap;
}

.meta-item {
display: flex;
align-items: center;
gap: 6px;
}

.meta-label {
font-weight: 500;
}

.status-badge {
padding: 2px 8px;
border-radius: 4px;
font-size: 0.8rem;
font-weight: 600;
text-transform: capitalize;
}

.status-badge.Completed,
.status-badge.success {
background-color: #d1fae5;
color: #059669;
}

.status-badge.Failed,
.status-badge.fail {
background-color: #fee2e2;
color: #dc2626;
}

.status-badge.Running,
.status-badge.Queued,
.status-badge.processing {
background-color: #fef3c7;
color: #d97706;
}

.item-actions {
margin-left: 24px;
}

.btn-primary {
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
color: #fff;
border: none;
border-radius: 8px;
padding: 8px 16px;
font-size: 0.9rem;
font-weight: 600;
cursor: pointer;
transition: all 0.3s ease;
}

.btn-primary:hover {
transform: translateY(-1px);
box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
background: #f3f4f6;
color: #4b5563;
border: none;
border-radius: 8px;
padding: 8px 16px;
font-size: 0.9rem;
font-weight: 600;
cursor: pointer;
transition: all 0.3s ease;
}

.btn-secondary:hover {
background: #e5e7eb;
}

.btn-disabled {
background: #d1d5db;
color: #9ca3af;
border: none;
border-radius: 8px;
padding: 8px 16px;
font-size: 0.9rem;
font-weight: 600;
cursor: not-allowed;
opacity: 0.7;
}

.btn-disabled:focus {
outline: 2px solid #667eea;
outline-offset: 2px;
}

.loading-container {
display: flex;
flex-direction: column;
align-items: center;
padding: 40px;
color: #6b7280;
}

.loading-spinner {
width: 32px;
height: 32px;
border: 3px solid rgba(102, 126, 234, 0.1);
border-top: 3px solid #667eea;
border-radius: 50%;
animation: spin 0.8s linear infinite;
margin-bottom: 12px;
}

@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}

.error-message {
color: #dc2626;
text-align: center;
padding: 20px;
background: #fee2e2;
border-radius: 8px;
}

/* 加载书籍浮窗样式 */
.dialog-mask {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.5);
display: flex;
justify-content: center;
align-items: center;
z-index: 2000;
backdrop-filter: blur(4px);
}

.loading-dialog {
background: #fff;
border-radius: 16px;
padding: 40px 32px;
max-width: 400px;
width: 90%;
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
display: flex;
flex-direction: column;
align-items: center;
}

.loading-content {
display: flex;
flex-direction: column;
align-items: center;
text-align: center;
}

.processing-file-name {
font-size: 1rem;
color: #4b5563;
background: #f3f4f6;
padding: 12px 20px;
border-radius: 8px;
margin-bottom: 20px;
max-width: 100%;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
}

.loading-title {
font-size: 1.3rem;
font-weight: 700;
color: #2c3e50;
margin: 0 0 8px 0;
}

.loading-description {
font-size: 0.9rem;
color: #6b7280;
margin: 0 0 24px 0;
line-height: 1.5;
}

.loading-dots {
display: flex;
gap: 8px;
margin-bottom: 24px;
}

.dot {
width: 8px;
height: 8px;
border-radius: 50%;
background: #667eea;
animation: bounce 1.2s ease-in-out infinite;
}

.dot:nth-child(1) { animation-delay: 0s; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
0%, 60%, 100% { transform: translateY(0); }
30% { transform: translateY(-8px); }
}

.loading-cancel-btn {
background: #f3f4f6;
color: #4b5563;
border: none;
border-radius: 8px;
padding: 10px 24px;
font-size: 0.9rem;
font-weight: 600;
cursor: pointer;
transition: all 0.3s ease;
}

.loading-cancel-btn:hover {
background: #e5e7eb;
}

@media (max-width: 768px) {
.history-item {
	flex-direction: column;
	align-items: flex-start;
	gap: 16px;
}

.item-actions {
	margin-left: 0;
	width: 100%;
	display: flex;
	justify-content: flex-end;
}

.item-meta {
	flex-direction: column;
	gap: 8px;
}
}
</style>
