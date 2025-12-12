<template>
	<div class="index-page">
		<!-- 顶部导航栏 -->
		<TopNav />

		<!-- 主内容区 - 欢迎页面 -->
		<div class="main-content">
			<div class="welcome-section">
				<h1 class="welcome-title" tabindex="0">{{ t('welcomeTitle') }}</h1>
				
				<div class="action-buttons">
					<!-- 上传书籍按钮 -->
					<button class="action-btn" @click="showDialog = true" tabindex="0">
						<span class="btn-icon">📤</span>
						<span class="btn-text">{{ t('uploadPDF') }}</span>
					</button>
					
					<!-- 我的书籍按钮 -->
					<button class="action-btn" @click="goToMyBooks" tabindex="0">
						<span class="btn-icon">📖</span>
						<span class="btn-text">{{ t('myBooks') }}</span>
					</button>
					
					<!-- 在线书城按钮 -->
					<button class="action-btn" @click="goToLibrary" tabindex="0">
						<span class="btn-icon">📚</span>
						<span class="btn-text">{{ t('onlineLibrary') }}</span>
					</button>
					
					<!-- 查看帮助按钮 -->
					<button class="action-btn" @click="openHelpDialog" tabindex="0">
						<span class="btn-icon">❓</span>
						<span class="btn-text">{{ t('viewHelp') }}</span>
					</button>
				</div>
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
					<div class="processing-file-name" tabindex="0">
						📄 {{ processingFileName }}
					</div>

					<!-- 加载文本 -->
					<h3 class="loading-title" tabindex="0" ref="loadingTitleRef">{{ loadingMessage }}</h3>
					<p class="loading-description" tabindex="0">{{ isLoadingBook ? t('loadingBookDescription') : t('loadingDescription') }}</p>
					<p class="loading-hint" tabindex="0">{{ t('checkMyBooksHint') }}</p>

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
import { ref, watch, nextTick, onMounted } from 'vue';
const backendUrl = import.meta.env.VITE_BACKEND_URL
import { validatePageRange, getPDFPageCount } from '../utils/PDFService.js';
import indexedDBService from '../utils/IndexedDBService.js';
import { useTranslation, addLanguageParam } from '../utils/i18n.js';
import TopNav from './TopNav.vue';

const { t, language } = useTranslation();

const showDialog = ref(false);
const showHelpDialog = ref(false);
const pageNum = ref('');
const file = ref(null);
const dialogTitleRef = ref(null);
const helpTitleRef = ref(null);
const loadingTitleRef = ref(null);
const recognizing = ref(false);
const loadingMessage = ref('');
const processingFileName = ref('');
const isLoadingBook = ref(false);
let abortController = null;

// 页码格式验证状态
const pageNumError = ref('');
const pageNumValid = ref(false);

// 跳转到在线书城
function goToLibrary() {
	window.location.hash = '#/library';
}

// 跳转到我的书籍
function goToMyBooks() {
	window.location.hash = '#/mybooks';
}

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

// base64 转 Blob
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

	// 浮窗打开后将焦点移到提示语上
	nextTick(() => {
		if (loadingTitleRef.value) {
			loadingTitleRef.value.focus();
		}
	});

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
				analysisResult: result.result,            // JSON 对象：分析结果
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
	recognizing.value = false;
	console.log('Recognition cancelled by user');
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

// 组件挂载
onMounted(() => {
	// 可以在这里添加初始化逻辑
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

/* ========== 主内容区 ========== */
.main-content {
	width: 100%;
	max-width: 1600px;
	margin: 0 auto;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: calc(100vh - 48px); /* 减去页面padding */
}

/* ========== 欢迎页面 ========== */
.welcome-section {
	text-align: center;
	padding: 20px 20px;
	max-width: 900px;
	margin-top: -40px; /* 向上偏移使其更居中 */
}

.welcome-title {
	font-size: 2.5rem;
	font-weight: 700;
	color: #2c3e50;
	margin: 0 0 40px 0;
}

.welcome-description {
	font-size: 1.2rem;
	color: #5a6c7d;
	margin: 0 0 48px 0;
	line-height: 1.6;
}

/* ========== 四个操作按钮 ========== */
.action-buttons {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 20px;
	width: 100%;
}

.action-btn {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
	padding: 32px 40px;
	background: #fff;
	border: 2px solid transparent;
	border-radius: 20px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	min-width: 160px;
}

.action-btn:hover {
	transform: translateY(-4px);
	box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
	border-color: rgba(102, 126, 234, 0.3);
}

.action-btn:focus {
	outline: none;
	border-color: #667eea;
	box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
}

.action-btn:active {
	transform: translateY(-2px);
}

.btn-icon {
	font-size: 3rem;
}

.btn-text {
	font-size: 1.1rem;
	font-weight: 600;
	color: #2c3e50;
	white-space: nowrap;
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
	margin: 0 0 12px 0;
	text-align: center;
	line-height: 1.5;
}

.loading-hint {
	font-size: 0.85rem;
	color: #9ca3af;
	margin: 0 0 24px 0;
	text-align: center;
	line-height: 1.5;
	font-style: italic;
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
	.action-btn {
		padding: 20px 24px;
		min-width: 120px;
	}

	.btn-icon {
		font-size: 2rem;
	}

	.btn-text {
		font-size: 0.9rem;
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
	.main-content {
		margin-top: 80px;
	}

	.welcome-title {
		font-size: 2rem;
	}

	.welcome-description {
		font-size: 1rem;
		margin-bottom: 36px;
	}

	.action-buttons {
		gap: 16px;
	}

	.action-btn {
		padding: 18px 20px;
		min-width: 100px;
	}

	.btn-icon {
		font-size: 1.8rem;
	}

	.btn-text {
		font-size: 0.85rem;
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
	.main-content {
		margin-top: 100px;
		min-height: calc(100vh - 120px);
	}

	.welcome-icon {
		font-size: 4rem;
		margin-bottom: 16px;
	}

	.welcome-title {
		font-size: 1.6rem;
	}

	.welcome-description {
		font-size: 0.95rem;
		margin-bottom: 32px;
	}

	.action-buttons {
		gap: 12px;
	}

	.action-btn {
		padding: 16px 16px;
		min-width: 80px;
		border-radius: 12px;
	}

	.btn-icon {
		font-size: 1.5rem;
	}

	.btn-text {
		font-size: 0.75rem;
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

	.loading-hint {
		font-size: 0.8rem;
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
	.action-buttons {
		gap: 8px;
	}

	.action-btn {
		padding: 12px 10px;
		min-width: 70px;
	}

	.btn-icon {
		font-size: 1.3rem;
	}

	.btn-text {
		font-size: 0.7rem;
	}

	.dialog-box {
		margin: 8px;
		padding: 16px 12px;
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
