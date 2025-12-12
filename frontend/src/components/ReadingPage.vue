<template>
	<div class="reading-page">
		<!-- 顶部导航栏 -->
		<TopNav :show-language-switcher="false">
			<template #center>
				<!-- 面包屑导航 -->
				<nav class="breadcrumb" aria-label="Breadcrumb navigation" v-if="AnalysisResult">
					<span class="breadcrumb-book-info" v-if="bookTitle" :title="pdfFileName">
						{{ bookTitle }}
					</span>
					<span class="breadcrumb-separator" v-if="bookTitle">·</span>
					<span class="breadcrumb-text">{{ t('pageTitle', { currentPage }) }}</span>
				</nav>
			</template>
			<template #actions>
				<!-- TTS 控制按钮 -->
				<div class="read-aloud-container" v-if="AnalysisResult">
					<button class="read-aloud-btn read-from-start-btn" @click="readFromStart"
						:disabled="(isLoadingAudio && !bufferStatus.ready) || isReading"
						:class="{ 'loading': isLoadingAudio && !bufferStatus.ready }"
						:aria-label="isLoadingAudio ? bufferStatus.message : t('readFromStart')"
						:title="isLoadingAudio ? bufferStatus.message : t('readFromStart')">
						<span v-if="isLoadingAudio && !bufferStatus.ready">
							{{ bufferStatus.message || t('preparing') }}
						</span>
						<span v-else>{{ t('readFromStart') }}</span>
					</button>

					<button v-if="isReading" class="read-aloud-btn stop-reading-btn" @click="stopReading"
						:aria-label="t('stopReading')" :title="t('stopReading')">
						<span>{{ t('stopReading') }}</span>
					</button>
				</div>
			</template>
		</TopNav>

		<div v-if="AnalysisResult" class="page-container">

			<!-- 中部内容区域 - 左右分栏 -->
			<div v-if="currentPageData" class="content-area">
				<!-- 左侧：原 PDF 页面 - 屏幕朗读器忽略 -->
			<div class="pdf-viewer" aria-hidden="true">
				<div class="pdf-container">
					<!-- 使用 Canvas 渲染 PDF -->
					<canvas 
						v-if="hasPdfDocument"
						ref="pdfCanvasRef"
						class="pdf-canvas"
						:aria-label="`PDF page ${currentPage}`">
					</canvas>
					
					<div v-if="pdfLoadingError" class="pdf-error">
						<p>❌ PDF 加载失败</p>
						<p class="error-detail">{{ pdfLoadingError }}</p>
					</div>

					<div v-if="!hasPdfDocument && !pdfLoadingError" class="no-pdf">
						<p>{{ t('noPdfAvailable') }}</p>
						<p class="hint">{{ t('pleaseUploadPdf') }}</p>
					</div>
				</div>
			</div>
				<!-- 右侧：识别结果 -->
				<div class="analysis-result" ref="analysisResultContainer" role="main" aria-label="Document content">
					<div class="result-content">
						<template v-if="readingBlocks.length">
							<template v-for="(block, blockIdx) in readingBlocks" :key="blockIdx">
								<div class="reading-block">
									<template v-for="(el, elIdx) in block" :key="el.sequence">
										<template v-if="el.type === 'paragraph'">
											<p class="paragraph"
												:class="{ 'currently-reading': currentReadingIndex === el.sequence }"
												@keydown.enter="onElementEnterKey" @click="onElementClick" tabindex="0">
												{{ el.properties?.content }}</p>
										</template>
										<template v-else-if="el.type === 'figure'">
											<div class="figure-with-description" :class="[
												getImageLayoutClass(el.properties.imageSize),
												{ 'currently-reading': currentReadingIndex === el.sequence }
											]" @keydown="onFigureKeydown($event, el.properties.imageUrl, el.properties.detailDescription || el.properties.description)"
												@click="onElementClick" tabindex="0" role="group"
												:aria-label="`Figure: ${el.properties.detailDescription || el.properties.description || 'Image'}`">
												<figure class="figure">
													<div v-if="!hasFigureImageSrc(el.properties.imageUrl)" class="image-placeholder" aria-live="polite">
														<div class="image-spinner" aria-hidden="true"></div>
														<span class="image-placeholder-text">{{ t('imageLoading') }}</span>
													</div>
													<img v-else :src="getFigureImageSrc(el.properties.imageUrl)"
														:alt="el.properties.detailDescription || el.properties.description || el.properties.content || 'Image'"
														:width="el.properties.imageSize?.width"
														:height="el.properties.imageSize?.height" class="figure-img" />
												</figure>
												<!-- AI生成的详细图片描述 -->
												<div v-if="el.properties.detailDescription" class="ai-description"
													title="AI-generated detailed description">
													<span class="ai-badge">🤖 AI</span>
													<span class="description-text">{{ el.properties.detailDescription
													}}</span>
												</div>
											</div>
										</template>
										<template v-else-if="el.type === 'table'">
											<div class="table-with-description"
												:class="{ 'currently-reading': currentReadingIndex === el.sequence }"
												@keydown.enter="onElementEnterKey" @click="onElementClick" tabindex="0"
												role="group"
												:aria-label="`Table: ${el.properties.detailDescription || 'Data table'}`">
												<div class="table-content">
													<table class="result-table" role="table">
														<caption class="sr-only">
															{{ el.properties.detailDescription ||
																el.properties.description || '数据表格' }}
														</caption>
														<tbody>
															<tr v-for="row in el.properties.rows + 1" :key="row"
																role="row">
																<template v-for="col in el.properties.columns + 1">
																	<td v-for="cell in el.properties.cells.filter(c => c.rowIndex === row - 1 && c.columnIndex === col - 1)"
																		:key="cell.rowIndex + '-' + cell.columnIndex"
																		:rowspan="cell.rowSpan"
																		:colspan="cell.columnSpan" role="gridcell"
																		tabindex="0" :title="(cell.rowSpan > 1 || cell.columnSpan > 1)
																			? t('mergedCell', { startRow: cell.rowIndex + 1, startCol: cell.columnIndex + 1, endRow: cell.rowIndex + cell.rowSpan, endCol: cell.columnIndex + cell.columnSpan })
																			: t('cellPosition', { row: cell.rowIndex + 1, col: cell.columnIndex + 1 })">{{ cell.content }}</td>
																</template>
															</tr>
														</tbody>
													</table>
												</div>
												<!-- AI生成的表格描述 - 右侧 -->
												<div v-if="el.properties.description" class="ai-description"
													title="AI-generated description">
													<span class="ai-badge">🤖 AI</span>
													<span class="description-text">{{ el.properties.detailDescription
													}}</span>
												</div>
											</div>
										</template>
										<template v-else-if="el.type === 'formula'">
											<div class="formula-with-description"
												:class="{ 'currently-reading': currentReadingIndex === el.sequence }"
												@keydown.enter="onElementEnterKey" @click="onElementClick" tabindex="0"
												role="group"
												:aria-label="`Mathematical formula: ${el.properties.latexContent}`">
												<div class="math" role="math"
													v-html="renderLatex(el.properties.latexContent, true)"></div>
												<!-- AI生成的LaTeX源码 - 右侧 -->
												<div v-if="el.properties.latexContent" class="ai-description"
													title="AI-generated LaTeX code">
													<span class="ai-badge">🤖 LaTeX</span>
													<code class="latex-code">{{ el.properties.latexContent }}</code>
												</div>
											</div>
										</template>
									</template>
								</div>
							</template>
						</template>
					</div>
				</div>
			</div>
			<div v-else class="no-data">No data for this page</div>

			<!-- 底部页面控制器 -->
			<div class="page-controls">
				<button @click="prevPage" :disabled="currentPage <= 1">Previous</button>
				<span tabindex="0">Page {{ currentPage }} / {{ totalPages }}</span>
				<button @click="nextPage" :disabled="currentPage >= totalPages">Next</button>
				<input v-model.number="jumpPage" type="number" min="1" :max="totalPages" class="jump-input"
					@keyup.enter="goToPage" placeholder="Go to page" />
				<button @click="goToPage">Go</button>
			</div>
		</div>
		<div v-else class="no-result">No recognition result</div>

		<!-- 键盘快捷键帮助按钮 -->
		<button class="keyboard-help-toggle" @click="showKeyboardHelp = !showKeyboardHelp"
			:aria-label="showKeyboardHelp ? 'Hide keyboard shortcuts' : 'Show keyboard shortcuts'"
			:title="showKeyboardHelp ? 'Hide keyboard shortcuts' : 'Show keyboard shortcuts'">
			<span class="help-icon">⌨️</span>
		</button>

		<!-- 键盘快捷键帮助面板 -->
		<transition name="slide-fade">
			<div v-show="showKeyboardHelp" class="keyboard-help-panel">
				<div class="help-header">
					<h3>Keyboard Shortcuts</h3>
					<button class="close-btn" @click="showKeyboardHelp = false" aria-label="Close">✕</button>
				</div>
				<div class="shortcuts-list">
					<div class="shortcut-item">
						<kbd>R</kbd>
						<span class="shortcut-desc">Read from start</span>
					</div>
					<div class="shortcut-item">
						<kbd>Space</kbd>
						<span class="shortcut-desc">Play / Stop reading</span>
					</div>
					<div class="shortcut-item">
						<kbd>Enter</kbd>
						<span class="shortcut-desc">Play from selected block</span>
					</div>
					<div class="shortcut-item">
						<kbd>Esc</kbd>
						<span class="shortcut-desc">Stop reading</span>
					</div>
					<div class="shortcut-item">
						<kbd>Tab</kbd>
						<span class="shortcut-desc">Navigate between blocks</span>
					</div>
					<div class="shortcut-item">
						<kbd class="arrow-key">↑</kbd>
						<span class="shortcut-desc">Previous block</span>
					</div>
					<div class="shortcut-item">
						<kbd class="arrow-key">↓</kbd>
						<span class="shortcut-desc">Next block</span>
					</div>
					<div class="shortcut-item">
						<kbd class="arrow-key">←</kbd>
						<span class="shortcut-desc">Previous page</span>
					</div>
					<div class="shortcut-item">
						<kbd class="arrow-key">→</kbd>
						<span class="shortcut-desc">Next page</span>
					</div>
					<div class="shortcut-item">
						<div class="shortcut-keys">
							<kbd>Ctrl</kbd><span class="key-plus">+</span><kbd>Shift</kbd><span
								class="key-plus">+</span><kbd>I</kbd>
						</div>
						<span class="shortcut-desc">Open image in AI Chat</span>
					</div>
				</div>
			</div>
		</transition>
	</div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { TTSManager } from '../utils/TTSManager.js';
import indexedDBService from '../utils/IndexedDBService.js';
import { useTranslation } from '../utils/i18n.js';
import TopNav from './TopNav.vue';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
const backendUrl = import.meta.env.VITE_BACKEND_URL;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const { t, language } = useTranslation();

const AnalysisResult = ref(null); // 存储文档分析结果数据
const analysisResultContainer = ref(null); // DOM 元素引用
const currentPage = ref(1);
const jumpPage = ref(1);
const showKeyboardHelp = ref(false); // 控制键盘快捷键帮助面板的显示
const pdfBlobUrl = ref(null); // 存储 PDF Blob 的 URL
const currentLanguage = ref(language.value); // 当前语言，使用 i18n 的语言状态

// PDF.js 相关
const pdfCanvasRef = ref(null); // Canvas 元素引用
const pdfLoadingError = ref(null); // PDF 加载错误
let currentRenderTask = null; // 当前正在进行的渲染任务
let renderTaskId = 0; // 渲染任务 ID，用于识别最新的渲染
let pdfDocument = null; // 缓存加载的 PDF 文档对象
const hasPdfDocument = ref(false); // Template 控制 PDF 区域显示

// 书籍信息
const bookTitle = ref('');
const pdfFileName = ref('');

// 图片缓存：key=imageUrl, value=data URI
const imageCache = reactive({});
const imageFetchTasks = new Map();

// ============= TTS Manager =============
// 创建 TTSManager 实例 - 负责音频缓存和预加载
const ttsManager = new TTSManager();

// 创建一个响应式触发器，用于强制更新 computed 属性
const audioMapUpdateTrigger = ref(0);

// 设置 audioMap 更新回调，每次 audioMap 变化时触发 Vue 响应式更新
ttsManager.onAudioMapUpdate = () => {
	audioMapUpdateTrigger.value++;
};

// Read Aloud 相关状态
const isReading = ref(false);
// audioMap 现在由 TTSManager 管理，通过 ttsManager.audioMap 访问

// audioData 结构：{ status: 'loading' | 'loaded' | 'failed', audioBlob: Blob | null }

/**
 * 是否正在加载音频（computed，基于 audioMap 状态判断）
 * 判断逻辑：
 * 1. map 中不存在 -> 还没开始加载，不能认为该 audio 已完成
 * 2. 存在但 status='loading' -> 不能认为该 audio 已完成
 * 3. 存在且 status='loaded' -> 认为该 audio 完成
 * 4. 存在且 status='failed' -> 也认为 audio 完成（否则将阻塞播放流程）
 *
 * 返回 true：当前页有音频正在加载中（部分元素未完成）
 */
const isLoadingAudio = computed(() => {
	// 依赖 audioMapUpdateTrigger 来触发重新计算
	audioMapUpdateTrigger.value; // 访问以建立依赖关系

	const total = totalElementsCount.value;
	if (total === 0) return false;

	let completedCount = 0; // 已完成的音频数量（loaded 或 failed）

	for (let i = 0; i < total; i++) {
		const key = `${currentPage.value}-${i}`;
		const audioData = ttsManager.audioMap.get(key);

		if (!audioData) {
			// 情况1: map 中不存在，未完成
			continue;
		}

		if (audioData.status === 'loaded' || audioData.status === 'failed') {
			// 情况3和4: loaded 或 failed 都算完成
			completedCount++;
		}
		// 情况2: status === 'loading'，不算完成
	}

	// 如果已完成数 < 总数，说明有音频正在加载或未开始加载
	// 只要不是全部完成，就认为是"正在加载中"
	return completedCount < total;
});


const totalElementsCount = ref(0); // 当前页总元素数量
const currentReadingIndex = ref(-1); // 当前正在朗读的元素索引（用于滚动定位，-1表示未播放）

// 当前PDF的总页数
const totalPages = computed(() => {
	return AnalysisResult.value && AnalysisResult.value.pages
		? AnalysisResult.value.pages.length
		: 0;
});

const currentPageData = computed(() => {
	return AnalysisResult.value && AnalysisResult.value.pages
		? AnalysisResult.value.pages.find(p => p.pageNumber === currentPage.value)
		: null;
});

/**
 * 使用 PDF.js 渲染 PDF 到 Canvas
 */
async function renderPDFToCanvas() {
	if (!pdfDocument || !pdfCanvasRef.value) {
		console.log('[renderPDFToCanvas] 跳过渲染: 没有 PDF 文档或 Canvas 引用');
		return;
	}

	// 生成新的渲染任务 ID
	const myTaskId = ++renderTaskId;
	console.log(`[renderPDFToCanvas] 开始渲染任务 #${myTaskId}, page:`, currentPage.value);

	// 取消之前的渲染任务
	if (currentRenderTask) {
		console.log(`[renderPDFToCanvas] 取消旧任务，启动任务 #${myTaskId}`);
		try {
			currentRenderTask.cancel();
		} catch (e) {
			// 忽略取消错误
		}
		currentRenderTask = null;
	}

	try {
		pdfLoadingError.value = null;

		// 检查是否还是最新任务
		if (myTaskId !== renderTaskId) {
			console.log(`[renderPDFToCanvas] 任务 #${myTaskId} 已过期，跳过`);
			return;
		}

		// 获取指定页面
			const page = await pdfDocument.getPage(currentPage.value);

		// 再次检查是否还是最新任务
		if (myTaskId !== renderTaskId) {
			console.log(`[renderPDFToCanvas] 任务 #${myTaskId} 在获取页面后已过期`);
			return;
		}

		// 获取 Canvas 上下文
		const canvas = pdfCanvasRef.value;
		if (!canvas) {
			console.log(`[renderPDFToCanvas] 任务 #${myTaskId} Canvas 已不存在`);
			return;
		}
		
		const context = canvas.getContext('2d');

		// 计算缩放比例以适应容器（减去 padding）
		const container = canvas.parentElement;
		const containerWidth = container.clientWidth - 20;
		const containerHeight = container.clientHeight - 20;

		// 获取页面原始尺寸
		const viewport = page.getViewport({ scale: 1.0 });
		
		// 计算缩放比例（适应容器，使用 min 确保不超出）
		const scaleX = containerWidth / viewport.width;
		const scaleY = containerHeight / viewport.height;
		const scale = Math.min(scaleX, scaleY);

		// 高 DPI 支持：使用设备像素比来提高渲染清晰度
		const outputScale = window.devicePixelRatio || 1;

		// 应用缩放（包含设备像素比以获得高清渲染）
		const scaledViewport = page.getViewport({ scale: scale * outputScale });

		// 设置 Canvas 内部渲染尺寸（使用高分辨率）
		canvas.width = scaledViewport.width;
		canvas.height = scaledViewport.height;

		// 设置 Canvas CSS 显示尺寸（实际显示大小）
		canvas.style.width = Math.floor(scaledViewport.width / outputScale) + 'px';
		canvas.style.height = Math.floor(scaledViewport.height / outputScale) + 'px';

		// 最后一次检查是否还是最新任务
		if (myTaskId !== renderTaskId) {
			console.log(`[renderPDFToCanvas] 任务 #${myTaskId} 在渲染前已过期`);
			return;
		}

		// 渲染 PDF 页面到 Canvas
		const renderContext = {
			canvasContext: context,
			viewport: scaledViewport
		};

		currentRenderTask = page.render(renderContext);
		await currentRenderTask.promise;
		
		// 检查渲染完成后是否还是最新任务
		if (myTaskId !== renderTaskId) {
			console.log(`[renderPDFToCanvas] 任务 #${myTaskId} 渲染完成但已过期`);
			return;
		}
		
		currentRenderTask = null;
		console.log(`[renderPDFToCanvas] ✅ 任务 #${myTaskId} 渲染成功`);

	} catch (error) {
		// 忽略取消错误
		if (error.name === 'RenderingCancelledException') {
			console.log(`[renderPDFToCanvas] 任务 #${myTaskId} 被取消`);
			return;
		}
		
		// 只有最新任务的错误才显示给用户
		if (myTaskId === renderTaskId) {
			console.error(`[renderPDFToCanvas] ❌ 任务 #${myTaskId} 渲染失败:`, error);
			pdfLoadingError.value = error.message || 'Unknown error';
		}
	}
}

/**
 * 处理窗口 resize 事件，重新渲染 PDF
 */
let resizeTimeout = null;
function handleResize() {
	// 使用防抖避免频繁渲染
	if (resizeTimeout) clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(async () => {
		console.log('[handleResize] 窗口大小改变，重新渲染 PDF');
		await renderPDFToCanvas();
	}, 300);
}

// Group elements by continueFromPrevious: each new false (or first) starts a new block
// 每个阅读块，在右边对应一个方格。是Call TTS的最小单位。
const readingBlocks = computed(() => {
	if (!currentPageData.value || !Array.isArray(currentPageData.value.elements)) return [];
	const blocks = [];
	let currentBlock = [];
	currentPageData.value.elements.forEach((el, idx) => {
		if (!el.continueFromPrevious || idx === 0) {
			if (currentBlock.length) blocks.push(currentBlock);
			currentBlock = [el];
		} else {
			currentBlock.push(el);
		}
	});
	if (currentBlock.length) blocks.push(currentBlock);
	return blocks;
});

/**
 * 请求后端将图片转换为 base64（带 data 前缀）并缓存
 * @param {string} imageUrl - 原始图片 URL
 * @returns {Promise<string>} data URI
 */
async function getImageFromBlob(imageUrl) {
	if (!imageUrl) return '';
	const cached = imageCache[imageUrl];
	if (cached) return cached;
	if (imageFetchTasks.has(imageUrl)) {
		return imageFetchTasks.get(imageUrl);
	}

	const fetchTask = (async () => {
		try {
			const response = await fetch(`${backendUrl}/getImageFromAB2`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ imageUrl: imageUrl }),
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Image fetch failed with status ${response.status}`);
			}

			const contentType = response.headers.get('content-type') || '';
			let base64Data;
			if (contentType.includes('application/json')) {
				const data = await response.json();
				if (data?.status === 'success') {
					base64Data = data?.data || '';
				} else {
					throw new Error(data?.error_msg || 'Image request failed');
				}
			} else {
				base64Data = await response.text();
			}

			if (!base64Data) {
				throw new Error('Empty image data received');
			}

			if (!base64Data.startsWith('data:')) {
				base64Data = `data:image/png;base64,${base64Data}`;
			}

			imageCache[imageUrl] = base64Data;
			return base64Data;
		} catch (error) {
			console.error('Failed to load image from backend:', error);
			throw error;
		} finally {
			imageFetchTasks.delete(imageUrl);
		}
	})();

	imageFetchTasks.set(imageUrl, fetchTask);
	return fetchTask;
}

/**
 * 为模板提供图片 src，如果没有缓存则触发异步加载
 * @param {string} imageUrl
 * @returns {string}
 */
function getFigureImageSrc(imageUrl) {
	if (!imageUrl) return '';
	const cached = imageCache[imageUrl];
	if (cached) return cached;
	if (!imageFetchTasks.has(imageUrl)) {
		getImageFromBlob(imageUrl).catch(() => {
			// 错误已在 getImageFromBlob 中记录
		});
	}
	return '';
}

function hasFigureImageSrc(imageUrl) {
	return !!(imageUrl && imageCache[imageUrl]);
}

// 当页面内容发生变化时预取所有 figure 图片
watch(readingBlocks, (blocks) => {
	if (!blocks || !blocks.length) return;
	blocks.forEach(block => {
		block.forEach(el => {
			if (el?.type === 'figure' && el.properties?.imageUrl) {
				getImageFromBlob(el.properties.imageUrl).catch(() => {
					// 错误已在函数内部记录
				});
			}
		});
	});
}, { immediate: true, deep: true });

// 获取当前页已加载/处理的音频统计
// 返回值：{ loadedCount: 成功加载数, processedCount: 已处理数（含失败） }
function getAudioLoadStats() {
	const currentPageNum = currentPage.value;
	let loadedCount = 0; // 成功加载的有效音频
	let processedCount = 0; // 已处理的元素（包括成功和失败）

	for (let i = 0; i < totalElementsCount.value; i++) {
		const cacheKey = `${currentPageNum}-${i}`;
		const audioItem = ttsManager.audioMap.get(cacheKey);

		if (audioItem) {
			// 统计真正加载完成且有有效 audioBlob 的元素
			if (audioItem.status === 'loaded' && audioItem.audioBlob instanceof Blob && audioItem.audioBlob.size > 0) {
				loadedCount++;
				processedCount++;
			} else if (audioItem.status === 'failed') {
				// failed 元素（语言不匹配等）也算作已处理
				processedCount++;
			}
		}
	}

	return { loadedCount, processedCount };
}

// 计算当前缓冲状态
// 返回值说明：
// - ready: boolean - 是否所有音频都已处理完成（可以开始播放）
// - progress: number - 加载进度百分比 (0-100)
// - message: string - 用户友好的状态提示文本（如 "Ready to play" 或 "Generating speech..."）
// - loadedCount: number - 成功加载的有效音频数量（不包括失败的元素）
const bufferStatus = computed(() => {
	// 依赖 audioMapUpdateTrigger 来触发重新计算（当 audioMap 更新时）
	audioMapUpdateTrigger.value;

	if (totalElementsCount.value === 0) {
		return { ready: false, progress: 0, message: '', loadedCount: 0 };
	}

	const { loadedCount, processedCount } = getAudioLoadStats();
	const progress = Math.round((processedCount / totalElementsCount.value) * 100);
	const ready = processedCount === totalElementsCount.value;

	let message = '';
	if (ready) {
		const failedCount = processedCount - loadedCount;
		message = failedCount > 0
			? `Ready to play (${loadedCount} valid, ${failedCount} skipped)`
			: 'Ready to play';
	} else if (isLoadingAudio.value) {
		message = `Generating speech... ${processedCount}/${totalElementsCount.value} (${progress}%)`;
	}

	return { ready, progress, message, loadedCount };
});

/**
 * 重置屏幕阅读器焦点到内容区域开头
 */
function resetFocusToContentStart() {
	nextTick(() => {
		if (analysisResultContainer.value) {
			// 将焦点设置到内容区域本身
			analysisResultContainer.value.focus();
			// 滚动到顶部
			analysisResultContainer.value.scrollTo({
				top: 0,
				behavior: 'smooth'
			});
			console.log('📍 Focus reset to content area start');
		}
	});
}

function prevPage() {
	if (currentPage.value > 1) {
		currentPage.value--;
		resetFocusToContentStart();
	}
}

function nextPage() {
	if (currentPage.value < totalPages.value) {
		currentPage.value++;
		resetFocusToContentStart();
	}
}

function goToPage() {
	if (jumpPage.value >= 1 && jumpPage.value <= totalPages.value) {
		currentPage.value = jumpPage.value;
		resetFocusToContentStart();
	}
}

/**
 * 返回首页
 */
function goToHome() {
	// 停止当前播放（如果正在播放）
	if (isReading.value) {
		stopReading();
	}

	// 跳转到首页
	window.location.hash = '#/';
}

function renderLatex(latex, isBlock = true) {
	if (!latex) return '';
	return isBlock ? `$$${latex}$$` : `$${latex}$`;
}

/**
 * 获取当前焦点元素的全局索引
 * @returns {number} 元素的全局索引，如果未找到则返回 -1
 */
function getFocusedElementIndex() {
	const focusedElement = document.activeElement;
	if (!focusedElement || !analysisResultContainer.value) return -1;

	// 检查焦点元素是否在内容区域内
	if (!analysisResultContainer.value.contains(focusedElement)) return -1;

	// 查找所有可朗读的元素
	const readableElements = analysisResultContainer.value.querySelectorAll('.paragraph, .figure-with-description, .table-with-description, .formula-with-description');

	// 找到焦点元素的索引
	for (let i = 0; i < readableElements.length; i++) {
		if (readableElements[i] === focusedElement || readableElements[i].contains(focusedElement)) {
			return i;
		}
	}

	return -1;
}

/**
 * 聚焦到第一个可读元素
 */
function focusFirstReadableElement() {
	if (!analysisResultContainer.value) {
		console.log('⚠️  Cannot focus: analysisResultContainer not available');
		return;
	}

	// 等待下一帧，确保 DOM 完全更新
	nextTick(() => {
		// 查找所有可朗读的元素
		const readableElements = analysisResultContainer.value.querySelectorAll('.paragraph, .figure-with-description, .table-with-description, .formula-with-description');

		if (readableElements.length > 0) {
			const firstElement = readableElements[0];
			firstElement.focus();
			console.log('✓ Focused first readable element on page', currentPage.value);
		} else {
			console.log('⚠️  No readable elements found on page', currentPage.value);
		}
	});
}

/**
 * 聚焦到最后一个可读元素
 */
function focusLastReadableElement() {
	if (!analysisResultContainer.value) {
		console.log('⚠️  Cannot focus: analysisResultContainer not available');
		return;
	}

	// 查找所有可朗读的元素
	const readableElements = analysisResultContainer.value.querySelectorAll('.paragraph, .figure-with-description, .table-with-description, .formula-with-description');

	if (readableElements.length > 0) {
		const lastElement = readableElements[readableElements.length - 1];
		lastElement.focus();
		console.log('✓ Focused last readable element');
	} else {
		console.log('⚠️  No readable elements found');
	}
}

/**
 * 导航到上一个块
 */
function navigateToPreviousBlock() {
	if (!analysisResultContainer.value) {
		return;
	}

	const readableElements = analysisResultContainer.value.querySelectorAll('.paragraph, .figure-with-description, .table-with-description, .formula-with-description');

	if (readableElements.length === 0) {
		return;
	}

	// 获取当前焦点元素的索引
	const currentIndex = getFocusedElementIndex();

	if (currentIndex === -1) {
		// 没有焦点元素，导航到第一个块
		focusFirstReadableElement();
		return;
	}

	if (currentIndex === 0) {
		// 已经在第一个块，保持在第一个块
		console.log('⚠️  Already at first block');
		return;
	}

	// 导航到上一个块
	const previousElement = readableElements[currentIndex - 1];
	previousElement.focus();
	console.log(`✓ Navigated to block ${currentIndex - 1}`);
}

/**
 * 导航到下一个块
 */
function navigateToNextBlock() {
	if (!analysisResultContainer.value) {
		return;
	}

	const readableElements = analysisResultContainer.value.querySelectorAll('.paragraph, .figure-with-description, .table-with-description, .formula-with-description');

	if (readableElements.length === 0) {
		return;
	}

	// 获取当前焦点元素的索引
	const currentIndex = getFocusedElementIndex();

	if (currentIndex === -1) {
		// 没有焦点元素，导航到最后一个块
		focusLastReadableElement();
		return;
	}

	if (currentIndex === readableElements.length - 1) {
		// 已经在最后一个块，保持在最后一个块
		console.log('⚠️  Already at last block');
		return;
	}

	// 导航到下一个块
	const nextElement = readableElements[currentIndex + 1];
	nextElement.focus();
	console.log(`✓ Navigated to block ${currentIndex + 1}`);
}

/**
 * 处理元素点击事件 - 直接从点击的元素开始播放
 * 如果正在播放，会先停止当前播放，然后从点击位置开始新的播放
 * @param {MouseEvent} event - 鼠标事件
 */
async function onElementClick(event) {
	// ====== 1. 阻止默认行为和事件冒泡 ======
	event.preventDefault();
	event.stopPropagation();

	const clickedElement = event.currentTarget;

	// ====== 2. 处理播放中切换：如果正在播放，先停止当前播放 ======
	// 这样用户可以随时点击任意位置切换播放进度，类似视频播放器的进度条跳转
	if (isReading.value) {
		stopReading();
	}

	// ====== 3. 设置焦点到点击的元素 ======
	// 确保键盘导航状态与点击行为同步
	clickedElement.focus();

	// ====== 4. 添加点击视觉反馈 ======
	// 短暂的高亮效果（300ms），让用户知道点击被响应
	clickedElement.classList.add('click-feedback');
	setTimeout(() => {
		clickedElement.classList.remove('click-feedback');
	}, 300);

	// ====== 5. 查找点击元素在可朗读元素列表中的索引 ======
	// 5.1 获取内容区域引用
	if (!analysisResultContainer.value) {
		return;
	}

	// 5.2 获取所有可朗读的元素（段落、图片、表格、公式）
	const readableElements = analysisResultContainer.value.querySelectorAll('.paragraph, .figure-with-description, .table-with-description, .formula-with-description');

	// 5.3 遍历查找点击元素的索引
	let clickedIndex = -1;
	for (let i = 0; i < readableElements.length; i++) {
		// 检查是否为当前元素或其子元素（支持点击容器内的任何位置）
		if (readableElements[i] === clickedElement || readableElements[i].contains(clickedElement)) {
			clickedIndex = i;
			break;
		}
	}

	// ====== 6. 从点击的元素开始播放 ======
	if (clickedIndex >= 0) {
		await startReading(clickedIndex);
	} else {
		console.error('Unable to determine clicked element index for TTS playback');
	}
}

/**
 * 处理元素上的回车键事件 - 从当前元素开始播放
 * @param {KeyboardEvent} event - 键盘事件
 */
async function onElementEnterKey(event) {
	// 检查是否按下了回车键
	if (event.key === 'Enter' && !isReading.value) {
		event.preventDefault();
		event.stopPropagation();

		// 获取当前焦点元素的索引
		const focusedIndex = getFocusedElementIndex();

		if (focusedIndex >= 0) {
			await startReading(focusedIndex);
		}
	}
}

/**
 * 根据图片宽高比判断使用哪种布局
 * @param {Object} imageSize - 图片尺寸对象 {width, height}
 * @returns {string} 布局类名
 */
function getImageLayoutClass(imageSize) {
	if (!imageSize || !imageSize.width || !imageSize.height) {
		return 'layout-vertical'; // 默认上下布局
	}

	const aspectRatio = imageSize.width / imageSize.height;

	// 宽高比 > 1.4: 扁图 (宽度明显大于高度) → 上下布局
	// 宽高比 ≤ 1.4: 方图或高图 → 左右布局
	if (aspectRatio > 1.4) {
		return 'layout-vertical'; // 上下布局
	} else {
		return 'layout-horizontal'; // 左右布局
	}
}

// 滚动到正在朗读的元素，并设置焦点
function scrollToReadingElement(elementIndex) {
	if (!analysisResultContainer.value || elementIndex < 0) {
		return;
	}

	// 查找所有可朗读的元素
	const readableElements = analysisResultContainer.value.querySelectorAll('.paragraph, .figure-with-description, .table-with-description, .formula-with-description');

	if (elementIndex >= readableElements.length) {
		return;
	}

	const targetElement = readableElements[elementIndex];

	if (targetElement) {

		// 设置焦点到目标元素
		targetElement.focus({ preventScroll: true }); // preventScroll: true 因为我们自己控制滚动

		// 计算元素相对于容器的位置
		const containerRect = analysisResultContainer.value.getBoundingClientRect();
		const elementRect = targetElement.getBoundingClientRect();
		const relativeTop = elementRect.top - containerRect.top + analysisResultContainer.value.scrollTop;

		// 滚动到元素位置，并使其位于容器中间
		analysisResultContainer.value.scrollTo({
			top: relativeTop - (analysisResultContainer.value.clientHeight / 2) + (elementRect.height / 2),
			behavior: 'smooth'
		});

	}
}

// ============= Read Aloud 功能 =============

/**
 * 检查指定页面的缓存状态
 * @param {number} pageNum - 页码
 * @param {Array} elements - 该页的可朗读元素数组
 * @returns {Object} 缓存状态统计 { cached, missing, failed, loading, total }
 */
function checkPageCacheStatus(pageNum, elements) {
	// 使用 TTSManager 的方法
	return ttsManager.checkPageCacheStatus(pageNum, elements);
}

/**
 * 获取指定页面的可朗读元素数组
 * @param {number} pageNum - 页码（如果不提供则使用当前页）
 * @returns {Array} 包含文本内容和元素索引的数组
 */
function getReadableElementsForPage(pageNum = null) {
	const targetPage = pageNum ?? currentPage.value;
	const pageData = AnalysisResult.value?.pages?.find(p => p.pageNumber === targetPage);
	if (!pageData || !Array.isArray(pageData.elements)) {
		return [];
	}

	const readableElements = [];

	// 遍历指定页面的所有元素
	pageData.elements.forEach((element, index) => {
		if (!element.type || !element.properties) return;

		let text = '';

		switch (element.type) {
			case 'paragraph':
				// 追加段落内容
				if (element.properties.content) {
					text = element.properties.content;
				}
				break;

			case 'table':
				// 追加表格描述
				if (element.properties.description) {
					text = t('thisIsATable') + element.properties.detailDescription + t('tableDescriptionEnd');
				}
				break;

			case 'figure':
				// 追加图片描述
				if (element.properties.detailDescription) {
					text = t('thisIsAnImage') + element.properties.detailDescription + t('imageDescriptionEnd');
				}
				break;

			case 'formula':
				// 追加公式的 LaTeX 内容
				if (element.properties.latexContent) {
					text = element.properties.latexContent;
				}
				break;
		}

		if (text.trim()) {
			readableElements.push({
				text: text.trim(),
				elementIndex: index,
				type: element.type
			});
		}
	});

	return readableElements;
}

/**
 * 预加载当前页面的TTS音频（智能缓存检查）
 * 允许并发请求，但避免重复请求同一个元素
 */
async function preloadCurrentPageTTS() {
	const elements = getReadableElementsForPage();
	const pageNum = currentPage.value;

	if (elements.length === 0) {
		return;
	}

	// 设置总元素数量（用于UI显示）
	totalElementsCount.value = elements.length;

	// 使用 TTSManager 预加载当前页，传入 getElementsForPage 函数以便自动预加载后续页面
	const result = await ttsManager.preloadPage(pageNum, elements, {
		background: false,
		getElementsForPage: getReadableElementsForPage
	});

	if (!result.success) {
		console.error(`TTS preload failed for page ${pageNum}: ${result.message}`);
	}
}

/**
 * 从页面开头开始朗读
 */
async function readFromStart() {
	// 如果已经在播放，忽略点击
	if (isReading.value) {
		return;
	}

	// 从索引 0 开始朗读
	await startReading(0);
}

/**
 * 开始朗读（使用 TTSManager 和 TTSPlayer）
 * @param {number} startIndex - 起始元素索引
 */
async function startReading(startIndex = 0) {
	try {
		isReading.value = true;

		// 记录开始时的页码，用于后续校验（防止用户在加载过程中切换页面）
		const pageNumAtStart = currentPage.value;
		const elements = getReadableElementsForPage();

		if (elements.length === 0) {
			console.error('TTS playback aborted: no readable content on current page');
			isReading.value = false;
			return;
		}

		const pageNum = currentPage.value;

		// 设置当前页状态
		totalElementsCount.value = elements.length;

		// 使用 TTSManager 开始播放（它会处理所有加载和播放逻辑）
		await ttsManager.startPlayback(
			pageNum,
			elements,
			startIndex,
			() => currentPage.value !== pageNumAtStart // 页码改变检测
		);


	} catch (error) {
		console.error('❌ Failed to start reading:', error);
		alert('Failed to read aloud: ' + error.message);
		isReading.value = false;
		currentReadingIndex.value = -1;
	}
}

/**
 * 停止朗读（使用 TTSManager）
 */
function stopReading() {
	// 使用 TTSManager 停止播放（TTSPlayer 会处理所有清理工作）
	ttsManager.stopPlayback();

	// 更新UI状态
	isReading.value = false;
	currentReadingIndex.value = -1;
}

// ============= 焦点管理功能 =============

// 保存当前焦点上下文（在跳转到 AIChat 前调用）
async function saveFocusContext() {
	const focusedElement = document.activeElement;
	console.log('[saveFocusContext] Current focused element:', focusedElement);
	console.log('[saveFocusContext] Element classes:', focusedElement?.className);

	// 查找所有可聚焦的元素（图片、段落、表格等）
	const focusableElements = document.querySelectorAll(
		'.figure-img, .paragraph, .result-table, .page-controls span, .page-controls button, .jump-input'
	);
	console.log('[saveFocusContext] Total focusable elements:', focusableElements.length);

	const focusIndex = Array.from(focusableElements).indexOf(focusedElement);
	console.log('[saveFocusContext] Focus index:', focusIndex);

	if (focusIndex !== -1) {
		// 保存焦点信息到 IndexedDB
		try {
			await indexedDBService.setItems({
				readingpage_focus_index: focusIndex,
				readingpage_scroll_y: window.scrollY,
				readingpage_current_page: currentPage.value,
				readingpage_focus_timestamp: Date.now()
			});
			console.log('[saveFocusContext] ✓ Saved successfully');
		} catch (err) {
			console.warn('Failed to save focus context:', err);
		}
	} else {
		console.log('[saveFocusContext] ⚠ Focused element not in focusable list, saving anyway with closest match');
		// 即使找不到精确匹配，也尝试保存当前滚动位置和页码
		// 查找最近的可聚焦祖先元素
		let closestFocusable = focusedElement?.closest('.figure-img, .paragraph, .result-table');
		if (closestFocusable) {
			const closestIndex = Array.from(focusableElements).indexOf(closestFocusable);
			console.log('[saveFocusContext] Found closest focusable:', closestFocusable, 'index:', closestIndex);
			if (closestIndex !== -1) {
				try {
					await indexedDBService.setItems({
						readingpage_focus_index: closestIndex,
						readingpage_scroll_y: window.scrollY,
						readingpage_current_page: currentPage.value,
						readingpage_focus_timestamp: Date.now()
					});
					console.log('[saveFocusContext] ✓ Saved with closest match');
				} catch (err) {
					console.warn('Failed to save focus context:', err);
				}
			}
		}
	}
}

// 恢复焦点上下文（从 AIChat 返回后调用）
async function restoreFocusContext() {
	try {
		const [focusIndex, scrollY, savedPage, timestamp] = await Promise.all([
			indexedDBService.getItem('readingpage_focus_index'),
			indexedDBService.getItem('readingpage_scroll_y'),
			indexedDBService.getItem('readingpage_current_page'),
			indexedDBService.getItem('readingpage_focus_timestamp')
		]);

		console.log('[restoreFocusContext] Saved data:', { focusIndex, scrollY, savedPage, timestamp });

		// 检查是否有保存的焦点信息
		if (focusIndex === undefined || focusIndex === null) {
			console.log('[restoreFocusContext] No saved focus index, skipping');
			return;
		}

		// 检查时间戳，防止恢复过期数据（5分钟内有效）

		const currentTime = Date.now();
		const timeDiff = currentTime - (timestamp || 0);
		if (timeDiff > 300000) { // 5分钟 = 300000毫秒
			console.log('[restoreFocusContext] Data expired, clearing');
			await clearFocusContext();
			return;
		}

		// 如果保存的页码与当前页码不同，先跳转到保存的页码
		if (savedPage && savedPage !== currentPage.value) {
			console.log('[restoreFocusContext] Changing page from', currentPage.value, 'to', savedPage);
			currentPage.value = savedPage;
		}

		// 等待 DOM 更新后恢复焦点（增加延迟确保 PDF 内容渲染完成）
		nextTick(() => {
			setTimeout(() => {
				const focusableElements = document.querySelectorAll(
					'.figure-img, .paragraph, .result-table, .page-controls span, .page-controls button, .jump-input'
				);

				console.log('[restoreFocusContext] Found', focusableElements.length, 'focusable elements, target index:', focusIndex);

				if (focusIndex >= 0 && focusIndex < focusableElements.length) {
					const targetElement = focusableElements[focusIndex];

					if (targetElement) {
						console.log('[restoreFocusContext] Focusing element:', targetElement);
						targetElement.focus();

						// 恢复滚动位置（平滑滚动）
						if (scrollY && scrollY > 0) {
							window.scrollTo({
								top: scrollY,
								behavior: 'smooth'
							});
						}

						// 添加视觉高亮效果（可选）
						targetElement.classList.add('focus-restored');
						setTimeout(() => {
							targetElement.classList.remove('focus-restored');
						}, 2000);
					}
				} else {
					console.log('[restoreFocusContext] Target index out of range');
				}

				// 清除保存的焦点信息
				clearFocusContext();
			}, 500); // 增加延迟确保 DOM 完全渲染（包括分析结果内容）
		});
	} catch (err) {
		console.warn('Failed to restore focus context:', err);
	}
}

// 清除保存的焦点信息
async function clearFocusContext() {
	try {
		await Promise.all([
			indexedDBService.removeItem('readingpage_focus_index'),
			indexedDBService.removeItem('readingpage_scroll_y'),
			indexedDBService.removeItem('readingpage_current_page'),
			indexedDBService.removeItem('readingpage_focus_timestamp')
		]);
	} catch (err) {
		console.warn('Failed to clear focus context:', err);
	}
}

// 监听键盘事件，保存焦点信息
function handleGlobalKeydown(event) {
	// 检测上箭头键 - 上一个块（或第一个块）
	if (event.key === 'ArrowUp') {
		// 只在没有输入框聚焦时才处理
		if (document.activeElement.tagName !== 'INPUT') {
			event.preventDefault();
			console.log('⬆️ Up arrow pressed - navigate to previous block');
			navigateToPreviousBlock();
		}
		return;
	}

	// 检测下箭头键 - 下一个块（或最后一个块）
	if (event.key === 'ArrowDown') {
		// 只在没有输入框聚焦时才处理
		if (document.activeElement.tagName !== 'INPUT') {
			event.preventDefault();
			console.log('⬇️ Down arrow pressed - navigate to next block');
			navigateToNextBlock();
		}
		return;
	}

	// 检测左箭头键 - 上一页
	if (event.key === 'ArrowLeft') {
		// 只在没有输入框聚焦时才翻页
		if (document.activeElement.tagName !== 'INPUT') {
			event.preventDefault();
			console.log('◀️ Left arrow pressed - previous page');
			prevPage();
		}
		return;
	}

	// 检测右箭头键 - 下一页
	if (event.key === 'ArrowRight') {
		// 只在没有输入框聚焦时才翻页
		if (document.activeElement.tagName !== 'INPUT') {
			event.preventDefault();
			console.log('▶️ Right arrow pressed - next page');
			nextPage();
		}
		return;
	}

	// 检测 R 键 - 从头开始播放
	if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.shiftKey && !event.altKey) {
		// 只在没有输入框聚焦时才处理
		if (document.activeElement.tagName !== 'INPUT' && !isReading.value) {
			event.preventDefault();
			event.stopPropagation();
			readFromStart();
		}
		return;
	}

	// 检测空格键 - 播放/停止切换
	if (event.key === ' ' || event.code === 'Space') {
		// 阻止默认滚动行为
		event.preventDefault();
		event.stopPropagation();

		if (isReading.value) {
			// 正在播放 → 停止
			stopReading();
		} else {
			// 未播放 → 开始播放
			// 优先从焦点元素开始，否则从头开始
			const focusedIndex = getFocusedElementIndex();
			if (focusedIndex >= 0) {
				startReading(focusedIndex);
			} else {
				readFromStart();
			}
		}
		return;
	}

	// 检测 Esc 键 - 停止朗读
	if (event.key === 'Escape' && isReading.value) {
		event.preventDefault();
		event.stopPropagation();
		stopReading();
		return;
	}

	// 检测翻页快捷键 Ctrl+Shift+左右箭头
	if (event.ctrlKey && event.shiftKey) {
		if (event.key === 'ArrowLeft') {
			// Ctrl+Shift+左箭头 - 上一页
			event.preventDefault();
			event.stopPropagation();
			if (currentPage.value > 1) {
				console.log('⬅️ Ctrl+Shift+Left - Previous page');
				prevPage();
			}
			return;
		} else if (event.key === 'ArrowRight') {
			// Ctrl+Shift+右箭头 - 下一页
			event.preventDefault();
			event.stopPropagation();
			if (currentPage.value < totalPages.value) {
				console.log('➡️ Ctrl+Shift+Right - Next page');
				nextPage();
			}
			return;
		}
	}

	// 检测 Ctrl+Shift+I 快捷键
	if (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'i')) {
		// 这里不阻止事件，让 onImgKeydown 继续处理
		// 我们在下一帧保存焦点信息
		requestAnimationFrame(() => {
			saveFocusContext();
		});
	}
}

// ============= 语言切换功能 =============

/**
 * 监听 localStorage 的语言变化（用于跨标签页/组件同步）
 */
function handleStorageChange(event) {
	if (event.key === 'language' && event.newValue !== event.oldValue) {
		const newLang = event.newValue || 'en';
		console.log(`📡 Storage event detected: language changed to ${newLang}`);
		currentLanguage.value = newLang;
	}
}

/**
 * 监听同页面的语言变化（来自 TopNav 的自定义事件）
 */
function handleLanguageChangedEvent(event) {
	const { newLanguage } = event.detail;
	console.log(`📡 Custom event detected: language changed to ${newLanguage}`);
	currentLanguage.value = newLanguage;
}


// ============= 生命周期钩子 =============
onMounted(async () => {
	// 从 IndexedDB 加载数据
	const [analysisResult, pdfBlob, savedBookTitle, savedPdfFileName] = await Promise.all([
		indexedDBService.getItem('analysisResult'),
		indexedDBService.getItem('PDFBlob'),
		indexedDBService.getItem('bookTitle'),
		indexedDBService.getItem('pdfFileName')
	]);

	// 设置响应式数据
	AnalysisResult.value = analysisResult;
	bookTitle.value = savedBookTitle || '';
	pdfFileName.value = savedPdfFileName || '';

	// 加载 PDF 文档
	if (pdfBlob) {
		try {
			// 创建 Blob URL
			pdfBlobUrl.value = URL.createObjectURL(pdfBlob);
			
			// 使用 PDF.js 加载整个 PDF 文档
			const loadingTask = pdfjsLib.getDocument(pdfBlobUrl.value);
			pdfDocument = await loadingTask.promise;
			hasPdfDocument.value = true;
			console.log(`✅ PDF 文档加载成功，共 ${pdfDocument.numPages} 页`);

			// 等待 DOM 更新，确保 Canvas 元素已渲染
			await nextTick();
			await nextTick(); // 双重等待确保 DOM 完全更新
			
			// 触发首次 PDF 渲染
			await renderPDFToCanvas();
		} catch (error) {
			console.error('❌ PDF 文档加载失败:', error);
			pdfLoadingError.value = error.message || 'Failed to load PDF';
		}
	}

	// 如果AnalysisResult已加载，立即开始预加载TTS
	if (AnalysisResult.value) {
		preloadCurrentPageTTS().catch(err => {
			console.error('TTS preload failed:', err);
		});
	}

	// ============= 设置 TTSPlayer 回调 =============
	// 当元素开始播放时：更新UI高亮并滚动到当前元素
	ttsManager.player.onElementStart = (index, audioItem) => {
		currentReadingIndex.value = index;
		scrollToReadingElement(index);
	};

	// 当页面播放完成时：自动翻页或停止
	ttsManager.player.onPageComplete = async (pageNum) => {
		if (currentPage.value < totalPages.value) {
			currentPage.value++;

			await nextTick();

			// 获取新页面的元素
			const newElements = getReadableElementsForPage();
			if (newElements.length > 0) {
				// 重新初始化并开始播放新页面
				await ttsManager.startPlayback(
					currentPage.value,
					newElements,
					0,
					() => false // 新页面不需要检查页码变化
				);
				return true; // 告诉播放器继续
			} else {
				stopReading();
				return false;
			}
		}

		// 到达最后一页，停止播放
		stopReading();
		return false;
	};

	// 当播放完成时（所有页面播放完毕）
	ttsManager.player.onPlaybackComplete = () => {
		isReading.value = false;
		currentReadingIndex.value = -1;
	};

	// 当播放出错时
	ttsManager.player.onError = (error) => {
		console.error('❌ Playback error:', error);
		alert('Playback error: ' + error.message);
		stopReading();
	};

	// ============= MathJax 初始化 =============
	if (window.MathJax && window.MathJax.typesetPromise) {
		window.MathJax.typesetPromise();
	}

	// 添加全局键盘事件监听
	document.addEventListener('keydown', handleGlobalKeydown);

	// 监听 localStorage 的语言变化（用于跨标签页同步）
	window.addEventListener('storage', handleStorageChange);

	// 监听同页面的语言变化（来自 TopNav 的自定义事件）
	window.addEventListener('languageChanged', handleLanguageChangedEvent);

	// 添加窗口 resize 监听，容器大小变化时重新渲染 PDF
	window.addEventListener('resize', handleResize);

	// 尝试恢复焦点上下文
	restoreFocusContext();
});

onUnmounted(() => {
	console.log('[ReadingPage] Component unmounting');
	// 取消正在进行的 PDF 渲染
	if (currentRenderTask) {
		currentRenderTask.cancel();
		currentRenderTask = null;
	}
	// 清理 PDF 文档
	if (pdfDocument) {
		pdfDocument.destroy();
		pdfDocument = null;
		hasPdfDocument.value = false;
	}
	// 释放 Blob URL
	if (pdfBlobUrl.value) {
		URL.revokeObjectURL(pdfBlobUrl.value);
		pdfBlobUrl.value = null;
	}
	// 停止朗读并清理音频资源
	stopReading();
	// 清除全局事件监听
	document.removeEventListener('keydown', handleGlobalKeydown);
	// 清除 storage 事件监听
	window.removeEventListener('storage', handleStorageChange);
	// 清除自定义语言变化事件监听
	window.removeEventListener('languageChanged', handleLanguageChangedEvent);
	// 清除窗口 resize 监听
	window.removeEventListener('resize', handleResize);
});

watch(currentPageData, async () => {
	await nextTick();
	if (window.MathJax && window.MathJax.typesetPromise) {
		window.MathJax.typesetPromise();
	}
});

// 监听页面切换，如果用户使用过TTS，自动预加载新页面
watch(currentPage, async (newPage, oldPage) => {
	// 页面切换时重置当前页状态（但不清空全局音频缓存！）
	if (newPage !== oldPage) {
		console.log(`📄 Page changed from ${oldPage} to ${newPage}`);

		// 如果正在播放，停止当前音频（手动翻页时）
		if (isReading.value) {
			stopReading(); // 使用 stopReading() 来正确停止 TTSManager/TTSPlayer
		}

		// 只重置当前页的UI状态，不清空 audioMap（全局缓存）
		totalElementsCount.value = 0;

		// 等待 DOM 更新
		await nextTick();

		// 重新渲染 PDF
		await renderPDFToCanvas();

		// 重置焦点到内容区域开头
		resetFocusToContentStart();

		// 自动聚焦到第一个可读块
		focusFirstReadableElement();

		// 自动检查并预加载新页面（不管用户是否使用过TTS）
		if (!isReading.value) {
			// 延迟300ms，等待页面切换动画完成
			setTimeout(() => {
				preloadCurrentPageTTS(); // 会智能检查缓存，避免重复加载
			}, 300);
		}
	}
});

// 监听语言切换，重新加载对应的 AnalysisResult
watch(currentLanguage, async (newLang, oldLang) => {
	if (newLang !== oldLang) {
		console.log(`🌍 Language changed from ${oldLang} to ${newLang}`);

		// 如果正在播放，停止当前朗读
		if (isReading.value) {
			stopReading();
		}

		// 保存当前页码
		const savedPage = currentPage.value;

		// 加载新语言的 AnalysisResult
		const success = await loadAnalysisResultForLanguage(newLang);

		if (success) {
			console.log(`✅ Successfully switched to ${newLang} version`);

			// 清空 TTS 缓存（因为语言变了，缓存的音频不再适用）
			ttsManager.clearAllCache();
			totalElementsCount.value = 0;

			// 等待 DOM 更新
			await nextTick();

			// 恢复到之前的页码（如果新数据中有该页）
			if (savedPage <= totalPages.value) {
				currentPage.value = savedPage;
			} else {
				currentPage.value = 1;
			}

			// 滚动到页面顶部
			scrollResultToTop();

			// 自动聚焦到第一个可读块
			focusFirstReadableElement();

			// 预加载新语言的 TTS
			setTimeout(() => {
				preloadCurrentPageTTS();
			}, 300);
		} else {
			console.error(`❌ Failed to load ${newLang} version`);
		}
	}
});

/**
 * 处理 figure 元素的键盘事件
 * @param {KeyboardEvent} e - 键盘事件
 * @param {string} imageUrl - 图片URL
 * @param {string} aiDescription - AI描述
 */
async function onFigureKeydown(e, imageUrl, aiDescription) {
	// 处理回车键 - 从当前元素开始播放
	if (e.key === 'Enter' && !isReading.value) {
		e.preventDefault();
		e.stopPropagation();

		// 获取当前焦点元素的索引
		const focusedIndex = getFocusedElementIndex();

		if (focusedIndex >= 0) {
			await startReading(focusedIndex);
		}
		return;
	}

	// 处理 Ctrl+Shift+I - 跳转到 AIChat
	if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
		e.preventDefault();
		e.stopPropagation();

		// 先保存焦点上下文
		await saveFocusContext();

		// 先下载图片并转为 base64
		let imageBase64 = '';
		try {
			imageBase64 = await getImageFromBlob(imageUrl);
			console.log('📷 Image downloaded and converted to base64');
		} catch (err) {
			console.warn('[ReadingPage] Failed to download image:', err);
		}

		// 保存图片 base64 和 AI 描述到 IndexedDB
		try {
			const dataToSave = { selectedImageBase64: imageBase64 };
			if (aiDescription) {
				dataToSave.selectedImageDescription = aiDescription;
				console.log('📝 Saved AI description:', aiDescription);
			}
			await indexedDBService.setItems(dataToSave);
			
			// 如果没有描述，确保移除旧的描述
			if (!aiDescription) {
				await indexedDBService.removeItem('selectedImageDescription');
			}
			// 移除旧的 URL 字段（如果存在）
			await indexedDBService.removeItem('selectedImageUrl');
		} catch (err) {
			console.warn('[ReadingPage] Failed to persist image data to IndexedDB:', err);
		}

		// 跳转到 AIChat
		window.location.hash = '#/AIChat';
	}
}

async function onImgKeydown(e, imageUrl, aiDescription) {
	if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
		e.preventDefault();
		e.stopPropagation();

		// 先保存焦点上下文
		await saveFocusContext();

		// 先下载图片并转为 base64
		let imageBase64 = '';
		try {
			imageBase64 = await getImageFromBlob(imageUrl);
			console.log('📷 Image downloaded and converted to base64');
		} catch (err) {
			console.warn('[ReadingPage] Failed to download image:', err);
		}

		// 保存图片 base64 和 AI 描述到 IndexedDB
		try {
			const dataToSave = { selectedImageBase64: imageBase64 };
			if (aiDescription) {
				dataToSave.selectedImageDescription = aiDescription;
				console.log('📝 Saved AI description:', aiDescription);
			}
			await indexedDBService.setItems(dataToSave);
			
			// 如果没有描述，确保移除旧的描述
			if (!aiDescription) {
				await indexedDBService.removeItem('selectedImageDescription');
			}
			// 移除旧的 URL 字段（如果存在）
			await indexedDBService.removeItem('selectedImageUrl');
		} catch (err) {
			console.warn('[ReadingPage] Failed to persist image data to IndexedDB:', err);
		}

		// 跳转到 AIChat
		window.location.hash = '#/AIChat';
	}
}
</script>


<style scoped>
/* 屏幕阅读器专用：视觉隐藏但可被屏幕阅读器读取的内容 */
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

.reading-page {
	height: 100vh;
	background: #f5f7fa;
	display: flex;
	align-items: stretch;
	justify-content: center;
	padding: 74px 12px 12px 12px;
	/* 优化：减少 padding 以增加内容显示空间 */
	box-sizing: border-box;
	overflow: hidden;
	/* 防止外层滚动 */
}

/* 容器 - 2部分布局（内容区 + 页面选择器） */
.page-container {
	width: 100%;
	max-width: 1800px;
	height: 100%;
	display: grid;
	grid-template-rows: 1fr auto;
	gap: 12px;
	/* 优化：进一步减少 gap */
	background: white;
	border-radius: 8px;
	/* 优化：减小圆角 */
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
	/* 优化：减轻阴影 */
	padding: 16px 16px 8px 16px;
	/* 优化：减少底部 padding */
	box-sizing: border-box;
	overflow: hidden;
	/* 防止容器溢出 */
}

/* 面包屑导航 - 在TopNav中显示 */
.breadcrumb {
	display: flex;
	align-items: center;
	gap: 8px;
}

.breadcrumb-book-info {
	font-size: 15px;
	font-weight: 600;
	color: #667eea;
	max-width: 300px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: help;
}

.breadcrumb-separator {
	font-size: 15px;
	font-weight: 600;
	color: #9ca3af;
}

.breadcrumb-text {
	font-size: 15px;
	font-weight: 600;
	color: #5f6368;
}

/* TTS 控制按钮容器 - 在TopNav中显示 */
.read-aloud-container {
	display: flex;
	align-items: center;
	gap: 12px;
}

.read-aloud-btn {
	font-size: 14px;
	font-weight: 600;
	color: white;
	background: linear-gradient(135deg, #10b981 0%, #059669 100%);
	border: none;
	border-radius: 10px;
	padding: 10px 20px;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 2px 12px rgba(16, 185, 129, 0.3);
	white-space: nowrap;
}

.read-aloud-btn:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
}

.read-aloud-btn:active:not(:disabled) {
	transform: translateY(0);
}

.read-aloud-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

/* 键盘提示 */
.keyboard-hint {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 16px;
	border-radius: 8px;
	font-size: 0.9rem;
	animation: fadeInBounce 0.5s ease-out;
}

/* 引导提示 - 蓝色主题 */
.keyboard-hint-guide {
	background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
	border: 2px solid #3b82f6;
	color: #1e40af;
	box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

/* 播放提示 - 黄色主题 */
.keyboard-hint-play {
	background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
	border: 2px solid #ffc107;
	color: #856404;
	box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
}

/* 停止提示 - 红色主题 */
.keyboard-hint-stop {
	background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
	border: 2px solid #ef4444;
	color: #991b1b;
	box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
	animation: fadeInBounce 0.5s ease-out, pulse 2s ease-in-out infinite;
}

@keyframes pulse {

	0%,
	100% {
		box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
	}

	50% {
		box-shadow: 0 4px 16px rgba(239, 68, 68, 0.5);
	}
}

.hint-icon {
	font-size: 1.2rem;
}

.hint-text {
	font-weight: 500;
	display: flex;
	align-items: center;
	gap: 4px;
}

.keyboard-hint kbd {
	display: inline-block;
	padding: 4px 8px;
	font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
	font-size: 0.85rem;
	font-weight: 700;
	color: #333;
	background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
	border: 2px solid #495057;
	border-radius: 4px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 -2px 0 rgba(0, 0, 0, 0.1);
}

@keyframes fadeInBounce {
	0% {
		opacity: 0;
		transform: translateY(-10px) scale(0.9);
	}

	60% {
		opacity: 1;
		transform: translateY(2px) scale(1.02);
	}

	100% {
		transform: translateY(0) scale(1);
	}
}

/* 从开头开始读按钮 - 蓝紫色渐变 */
.read-from-start-btn {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.read-from-start-btn:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.read-from-start-btn:focus {
	outline: 2px solid #667eea;
	outline-offset: 2px;
}

/* 从选中元素开始读按钮 - 绿色渐变 */
.read-from-selection-btn {
	background: linear-gradient(135deg, #10b981 0%, #059669 100%);
	box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.read-from-selection-btn:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.read-from-selection-btn:focus {
	outline: 2px solid #10b981;
	outline-offset: 2px;
}

/* 停止按钮 - 红色渐变 */
.stop-reading-btn {
	background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
	box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.stop-reading-btn:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.stop-reading-btn:focus {
	outline: 2px solid #ef4444;
	outline-offset: 2px;
}

/* 按钮活动状态 */
.read-aloud-btn:active:not(:disabled) {
	transform: translateY(0);
}

/* 加载中状态 */
.read-aloud-btn.loading {
	background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
	cursor: not-allowed;
	opacity: 0.8;
}

/* 禁用状态 */
.read-aloud-btn:disabled {
	background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
	cursor: not-allowed;
	opacity: 0.6;
	box-shadow: none;
}

/* ============= 中部：左右分栏 ============= */
.content-area {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
	/* 优化：减少左右间距 */
	overflow: hidden;
	min-height: 0;
}

/* 左侧：PDF 查看器 */
.pdf-viewer {
	background: #f8f9fa;
	border-radius: 6px;
	/* 优化：减小圆角 */
	overflow: hidden;
	display: flex;
	flex-direction: column;
	border: 1px solid #e0e0e0;
	/* 优化：减细边框 */
	min-height: 0;
	/* 确保 flex 子元素可以缩小 */
}

.pdf-container {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: auto;
	/* 改为 auto 以支持大 PDF 滚动 */
	padding: 10px;
	/* 添加一点内边距 */
	min-height: 0;
	width: 100%;
	height: 100%;
}

.pdf-canvas {
	display: block;
	/* Canvas 会自动设置尺寸，不需要额外限制 */
	background: white;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	/* 添加阴影增强视觉效果 */
}

.no-pdf {
	text-align: center;
	color: #999;
	padding: 40px;
}

.no-pdf p {
	margin: 8px 0;
	font-size: 1.1rem;
}

.no-pdf .hint {
	font-size: 0.9rem;
	color: #bbb;
}

/* 右侧：识别结果 */
.analysis-result {
	background: #ffffff;
	border-radius: 6px;
	/* 优化：减小圆角 */
	overflow-y: auto;
	overflow-x: hidden;
	padding: 16px;
	/* 优化：减少内边距 */
	border: 1px solid #e0e0e0;
	/* 优化：减细边框 */
	position: relative;
	scrollbar-width: thin;
	scrollbar-color: #888 #f1f1f1;
}

.analysis-result::-webkit-scrollbar {
	width: 10px;
}

.analysis-result::-webkit-scrollbar-track {
	background: #f1f1f1;
	border-radius: 5px;
}

.analysis-result::-webkit-scrollbar-thumb {
	background: #888;
	border-radius: 5px;
}

.analysis-result::-webkit-scrollbar-thumb:hover {
	background: #555;
}

.result-content {
	min-height: 100%;
}

.no-data {
	display: flex;
	align-items: center;
	justify-content: center;
	color: #999;
	font-size: 1.2rem;
	padding: 40px;
}

/* ============= 内容块样式 ============= */
.reading-block {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	gap: 12px;
	/* 优化：减少内部元素间距 */
	margin-bottom: 16px;
	/* 优化：减少块间距 */
	background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
	border-radius: 8px;
	/* 优化：减小圆角 */
	padding: 14px 12px;
	/* 优化：减少内边距 */
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	border: 1px solid #e8eaed;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
	/* 优化：减轻阴影 */
}

.reading-block:hover {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	border-color: #d0d7de;
	transform: translateY(-1px);
	/* 优化：减少移动距离 */
}

.reading-block:focus {
	outline: 3px solid #409eff;
	outline-offset: 2px;
	box-shadow: 0 2px 12px rgba(64, 158, 255, 0.12);
	background: linear-gradient(135deg, #f0f8ff 0%, #e3f2fd 100%);
}

.reading-block>* {
	margin: 0;
	max-width: 100%;
	box-sizing: border-box;
}

.reading-block>.table {
	flex: 1 1 100%;
	width: 100%;
}

.paragraph {
	font-size: 1.05rem;
	line-height: 1.7;
	/* 优化：略微减少行高 */
	padding: 6px 10px;
	/* 优化：减少内边距 */
	text-align: left;
	flex: 1 1 100%;
	color: #2c3e50;
	border-radius: 6px;
}

.paragraph:focus {
	outline: 2px solid #667eea;
	outline-offset: 2px;
}

/* 正在阅读的元素 - 明显的背景高亮 */
.paragraph.currently-reading,
.figure-with-description.currently-reading,
.table-with-description.currently-reading,
.formula-with-description.currently-reading {
	background: #DCEDED !important;
	color: #2c3e50 !important;
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15) !important;
	transform: scale(1.01);
	transition: all 0.3s ease;
	border-left: 4px solid #90a4ae;
}

/* 确保正在阅读的段落文字颜色 */
.paragraph.currently-reading {
	color: #2c3e50 !important;
}

/* 正在阅读的图片容器的描述保持原样 */
.figure-with-description.currently-reading .ai-description,
.table-with-description.currently-reading .ai-description,
.formula-with-description.currently-reading .ai-description {
	background: rgba(255, 255, 255, 0.98) !important;
}

.figure-with-description.currently-reading .ai-description .description-text,
.table-with-description.currently-reading .ai-description .description-text,
.formula-with-description.currently-reading .latex-code {
	color: #2c3e50 !important;
}

/* 点击视觉反馈 - 短暂的高亮效果 */
.click-feedback {
	background: rgba(102, 126, 234, 0.15) !important;
	transition: background 0.3s ease-out;
}

.figure-img,
.figure img {
	width: 100%;
	max-width: 600px;
	height: auto;
	border-radius: 8px;
	object-fit: contain;
	display: block;
	margin: 0 auto;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.figure {
	margin: 0;
	text-align: center;
	display: block;
	width: 100%;
}

.image-placeholder {
	width: 100%;
	min-height: 160px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 24px 12px;
	border-radius: 8px;
	background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
	border: 1px dashed rgba(102, 126, 234, 0.4);
}

.image-spinner {
	width: 36px;
	height: 36px;
	border-radius: 50%;
	border: 3px solid rgba(102, 126, 234, 0.2);
	border-top-color: #667eea;
	animation: spin 1s linear infinite;
	margin-bottom: 8px;
}

.image-placeholder-text {
	font-size: 0.95rem;
	color: #4b5563;
}

@keyframes spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

.figure-desc {
	color: #666;
	font-size: 0.95rem;
	margin-top: 4px;
}

.table {
	width: 100%;
	max-width: 100%;
	overflow-x: auto;
	overflow-y: visible;
	margin: 12px 0;
	border: 1px solid #dee2e6;
	border-radius: 8px;
	background: white;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.table::-webkit-scrollbar {
	height: 10px;
}

.table::-webkit-scrollbar-track {
	background: #f8f9fa;
	border-radius: 5px;
}

.table::-webkit-scrollbar-thumb {
	background: linear-gradient(135deg, #adb5bd 0%, #868e96 100%);
	border-radius: 5px;
}

.table::-webkit-scrollbar-thumb:hover {
	background: linear-gradient(135deg, #868e96 0%, #6c757d 100%);
}

.result-table {
	border-collapse: collapse;
	width: 100%;
	min-width: 100%;
	white-space: nowrap;
}

.result-table:focus {
	outline: 3px solid #409eff;
	outline-offset: 3px;
}

.result-table th,
.result-table td {
	border: 1px solid #dee2e6;
	padding: 12px 16px;
	text-align: left;
	white-space: normal;
	word-wrap: break-word;
	min-width: 100px;
	transition: background 0.2s ease;
}

.result-table th {
	background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
	font-weight: 600;
	color: #495057;
}

.result-table td:hover {
	background: #f1f3f5;
}

.result-table tr:nth-child(even) td {
	background: #fafbfc;
}

.result-table tr:nth-child(even) td:hover {
	background: #f1f3f5;
}

/* ============= 底部：页面控制器 ============= */
.page-controls {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	/* 优化：减少间距 */
	padding: 8px 0 6px 0;
	/* 优化：进一步减少上下padding */
	border-top: 1px solid #e8eaed;
	/* 优化：减细边框 */
}

.page-controls button {
	padding: 6px 12px;
	/* 优化：减少按钮内边距 */
	background: #409eff;
	color: white;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	transition: background 0.2s;
	font-size: 0.875rem;
	/* 优化：略微减小字体 */
	font-weight: 500;
	min-width: 60px;
	/* 保持按钮最小宽度 */
}

.page-controls button:hover:not(:disabled) {
	background: #66b1ff;
}

.page-controls button:disabled {
	background: #c0c4cc;
	cursor: not-allowed;
	opacity: 0.6;
}

.page-controls span {
	font-size: 0.9rem;
	/* 优化：减小字体 */
	color: #606266;
	padding: 0 6px;
	/* 优化：减少padding */
	font-weight: 500;
	white-space: nowrap;
}

.page-controls span:focus {
	outline: 2px solid #409eff;
	outline-offset: 2px;
	border-radius: 2px;
}

.jump-input {
	width: 70px;
	/* 优化：减少宽度 */
	padding: 5px 8px;
	/* 优化：减少内边距 */
	border: 1px solid #dcdfe6;
	border-radius: 4px;
	font-size: 0.875rem;
	/* 优化：减小字体 */
	transition: border-color 0.2s;
	text-align: center;
}

.jump-input:focus {
	outline: none;
	border-color: #409eff;
	box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

/* ============= 默认布局容器 ============= */
.table-with-description,
.figure-with-description,
.formula-with-description {
	margin: 0;
	padding: 0;
	background: transparent;
	width: 100%;
	flex: 1 1 100%;
	border-radius: 0;
	cursor: pointer;
	outline: none;
	border: none;
	box-shadow: none;
}

/* 容器hover样式 */
.table-with-description:hover,
.figure-with-description:hover,
.formula-with-description:hover {
	background: transparent;
	box-shadow: none;
	border: none;
	transform: none;
}

/* 容器获得焦点时的样式 */
.table-with-description:focus,
.figure-with-description:focus,
.formula-with-description:focus {
	outline: 2px solid #667eea;
	outline-offset: 2px;
}

/* 上下布局（扁图） */
.figure-with-description.layout-vertical {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

/* 左右布局（方图、高图） */
.figure-with-description.layout-horizontal {
	display: grid;
	grid-template-columns: 1fr 350px;
	gap: 16px;
	align-items: start;
}

/* 表格和公式默认使用上下布局 */
.table-with-description,
.formula-with-description {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

/* 响应式：小屏幕时全部改为上下布局 */
@media (max-width: 1024px) {
	.figure-with-description.layout-horizontal {
		grid-template-columns: 1fr;
		gap: 12px;
	}
}

.table-content {
	overflow-x: auto;
	width: 100%;
}

/* ============= AI生成描述样式 ============= */
.ai-description {
	display: flex;
	flex-direction: column;
	gap: 14px;
	padding: 16px 18px;
	background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
	border-left: 5px solid #0ea5e9;
	border-radius: 10px;
	font-size: 0.95rem;
	line-height: 1.7;
	color: #0c4a6e;
	box-shadow: 0 3px 12px rgba(14, 165, 233, 0.2);
	max-width: 100%;
	width: auto;
	flex: 1;
	position: relative;
	overflow: hidden;
	box-sizing: border-box;
}

.ai-description::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 2px;
	background: linear-gradient(90deg, transparent 0%, #0ea5e9 50%, transparent 100%);
	opacity: 0.5;
}

.ai-badge {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 8px 16px;
	background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
	color: white;
	border-radius: 20px;
	font-size: 0.85rem;
	font-weight: 700;
	white-space: nowrap;
	width: fit-content;
	box-shadow: 0 3px 8px rgba(14, 165, 233, 0.4);
	letter-spacing: 0.5px;
}

.description-text {
	color: #0c4a6e;
	word-wrap: break-word;
	line-height: 1.8;
	font-size: 0.95rem;
}

.latex-code {
	font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
	font-size: 0.85rem;
	background: #1e293b;
	color: #e2e8f0;
	padding: 12px;
	border-radius: 6px;
	overflow-x: auto;
	display: block;
	white-space: pre-wrap;
	word-break: break-all;
	line-height: 1.5;
}

/* 焦点恢复视觉效果 */
.focus-restored {
	animation: focusPulse 1.5s ease-out;
}

@keyframes focusPulse {
	0% {
		box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.7);
		outline: 2px solid rgba(66, 153, 225, 0.7);
	}

	50% {
		box-shadow: 0 0 0 10px rgba(66, 153, 225, 0);
		outline: 2px solid rgba(66, 153, 225, 0.4);
	}

	100% {
		box-shadow: 0 0 0 0 rgba(66, 153, 225, 0);
		outline: 2px solid transparent;
	}
}

/* ============= 无结果提示 ============= */
.no-result {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 60vh;
	color: #999;
	font-size: 1.5rem;
}

/* ============= 响应式设计 ============= */
@media (max-width: 1200px) {
	.content-area {
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 1fr;
	}

	.page-container {
		/* 保持固定高度，避免产生外层滚动条 */
		height: 100%;
		overflow: hidden;
		padding: 12px 12px 6px 12px;
		/* 优化：移动端底部更紧凑 */
		gap: 10px;
		/* 优化：移动端进一步减少 gap */
	}

	.reading-page {
		/* 调整移动端的padding */
		padding: 70px 8px 8px 8px;
		/* 优化：移动端更紧凑 */
	}
}

@media (max-width: 768px) {
	.page-title {
		font-size: 1.5rem;
		min-width: auto;
		text-align: center;
	}

	.keyboard-hint,
	.keyboard-hint-guide,
	.keyboard-hint-play,
	.keyboard-hint-stop {
		font-size: 0.85rem;
		padding: 8px 12px;
		width: 100%;
		justify-content: center;
	}

	.keyboard-hint kbd {
		padding: 3px 6px;
		font-size: 0.8rem;
	}

	.hint-icon {
		font-size: 1rem;
	}

	.read-aloud-container {
		flex-direction: column;
		width: 100%;
	}

	.read-aloud-btn {
		width: 100%;
		min-width: auto;
		font-size: 13px;
		padding: 9px 16px;
	}

	.breadcrumb-text {
		font-size: 14px;
	}

	.page-container {
		padding: 16px;
		gap: 16px;
	}

	/* 移动端内容区域优化 */
	.content-area {
		padding: 12px;
		gap: 16px;
	}

	.result-element {
		margin-bottom: 16px;
	}

	/* 移动端表格优化 */
	.table-with-description {
		flex-direction: column;
		gap: 12px;
	}

	.table-content {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.result-table {
		min-width: 100%;
		font-size: 0.85rem;
	}

	.result-table td {
		padding: 6px 8px;
		white-space: nowrap;
	}

	/* 移动端公式优化 */
	.formula-with-description {
		flex-direction: column;
		gap: 12px;
	}

	.math {
		font-size: 0.9rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	/* 移动端图片优化 */
	.figure-with-description {
		flex-direction: column;
		gap: 12px;
	}

	.figure-image {
		max-width: 100%;
		max-height: 50vh;
	}

	/* 移动端AI描述优化 */
	.ai-description {
		font-size: 0.85rem;
		padding: 8px 12px;
	}

	.ai-badge {
		font-size: 0.75rem;
		padding: 3px 8px;
	}

	/* 移动端按钮优化 */
	.read-aloud-btn {
		min-height: 44px;
		font-size: 0.9rem;
		padding: 12px 16px;
	}

	.back-to-home-btn {
		min-height: 44px;
		font-size: 0.9rem;
		padding: 10px 16px;
	}

	/* 移动端段落优化 */
	.result-p {
		font-size: 1rem;
		line-height: 1.6;
		margin-bottom: 12px;
	}

	/* 移动端标题优化 */
	.result-title {
		font-size: 1.1rem;
		margin-bottom: 8px;
	}
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
	.page-container {
		padding: 12px;
		gap: 12px;
	}

	.page-title {
		font-size: 1.3rem;
	}

	.back-to-home-btn {
		font-size: 0.8rem;
		padding: 8px 12px;
		min-height: 40px;
	}

	.content-area {
		padding: 8px;
		gap: 12px;
	}

	.result-table {
		font-size: 0.8rem;
	}

	.result-table td {
		padding: 4px 6px;
	}

	.ai-description {
		font-size: 0.8rem;
		padding: 6px 8px;
	}

	.result-p {
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.keyboard-hint {
		font-size: 0.8rem;
		padding: 6px 8px;
	}

	.keyboard-hint kbd {
		font-size: 0.75rem;
		padding: 2px 4px;
	}
}

/* ============= 键盘快捷键帮助 ============= */

/* 帮助按钮 - 放在导航按钮组的最上方（同一列）*/
.keyboard-help-toggle {
	position: fixed;
	bottom: 20px;
	right: 15px;
	width: 56px;
	height: 56px;
	border-radius: 50%;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
	border: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	z-index: 1001;
	font-size: 1.5rem;
	animation: slideIn 0.5s ease-out;
}

.keyboard-help-toggle:hover {
	transform: scale(1.15);
	box-shadow: 0 6px 24px rgba(102, 126, 234, 0.5);
	background: linear-gradient(135deg, #7c8ef5 0%, #8c5bb5 100%);
}

.keyboard-help-toggle:active {
	transform: scale(1.05);
}

.keyboard-help-toggle:focus {
	outline: 3px solid rgba(255, 255, 255, 0.8);
	outline-offset: 3px;
}

.help-icon {
	font-size: 1.5rem;
}

/* 帮助面板 - 从右下角向上展开，向左偏移避免遮挡按钮 */
.keyboard-help-panel {
	position: fixed;
	bottom: 90px;
	right: 85px;
	width: 440px;
	max-height: calc(100vh - 120px);
	background: white;
	border-radius: 16px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	z-index: 999;
	overflow: hidden;
	border: 2px solid #667eea;
}

.help-header {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
	padding: 16px 20px;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.help-header h3 {
	margin: 0;
	font-size: 1.1rem;
	font-weight: 600;
}

.close-btn {
	background: transparent;
	border: none;
	color: white;
	font-size: 1.5rem;
	cursor: pointer;
	padding: 0;
	width: 30px;
	height: 30px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 4px;
	transition: background 0.2s;
}

.close-btn:hover {
	background: rgba(255, 255, 255, 0.2);
}

.shortcuts-list {
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.shortcut-item {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px;
	background: #f8f9fa;
	border-radius: 8px;
	transition: background 0.2s;
	flex-wrap: wrap;
}

.shortcut-item:hover {
	background: #e9ecef;
}

.shortcut-item kbd {
	display: inline-block;
	padding: 5px 8px;
	font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
	font-size: 0.8rem;
	font-weight: 700;
	color: #333;
	background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
	border: 2px solid #495057;
	border-radius: 6px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 -2px 0 rgba(0, 0, 0, 0.1);
	min-width: 32px;
	text-align: center;
}

/* 箭头键特殊样式 - 更大的字体 */
.shortcut-item kbd.arrow-key {
	font-size: 1.3rem;
	padding: 4px 10px;
	line-height: 1;
}

.shortcut-keys {
	display: flex;
	align-items: center;
	gap: 4px;
	flex-shrink: 0;
}

.key-plus {
	color: #6c757d;
	font-size: 0.9rem;
	font-weight: 600;
	padding: 0 2px;
}

.shortcut-desc {
	flex: 1;
	font-size: 0.9rem;
	color: #495057;
	font-weight: 500;
	min-width: 0;
	word-wrap: break-word;
}

/* 过渡动画 - 从下往上滑入 */
.slide-fade-enter-active {
	transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
	transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
	transform: translateY(20px);
	opacity: 0;
}

.slide-fade-leave-to {
	transform: translateY(20px);
	opacity: 0;
}

/* 响应式 */
@media (max-width: 768px) {
	.scroll-nav-buttons {
		bottom: 76px;
	}

	.keyboard-help-toggle {
		bottom: 16px;
		right: 16px;
		width: 48px;
		height: 48px;
	}

	.help-icon {
		font-size: 1.2rem;
	}

	.keyboard-help-panel {
		bottom: 76px;
		right: 16px;
		left: 16px;
		width: auto;
		max-width: none;
		max-height: calc(100vh - 100px);
	}

	.scroll-nav-btn {
		width: 48px;
		height: 48px;
	}
}
</style>
