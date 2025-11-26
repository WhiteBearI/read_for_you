/**
 * TTSManager.js - Text-to-Speech Manager Class
 *
 * 职责：
 * 1. 管理全局音频缓存 (audioMap)
 * 2. 实现智能预加载策略（当前页 + 接下来4页）
 * 3. 协调 TTSPlayer 和 TTS API
 * 4. 处理页面切换时的缓存清理
 *
 * 架构说明：
 * TTSManager 是业务逻辑层，位于 UI 层（ReadingPage.vue）和播放引擎层（TTSPlayer）之间
 * - ReadingPage：负责UI渲染和事件处理，调用 TTSManager 的方法
 * - TTSManager：负责音频缓存、预加载策略、与 TTS API 交互
 * - TTSPlayer：负责音频播放控制、资源管理、并发控制
 *
 * 使用示例：
 * ```javascript
 * const ttsManager = new TTSManager();
 *
 * // 预加载当前页
 * await ttsManager.preloadPage(1, elements);
 *
 * // 开始播放
 * await ttsManager.startPlayback(1, elements, 0);
 *
 * // 停止播放
 * ttsManager.stopPlayback();
 *
 * // 设置回调监听播放状态
 * ttsManager.player.onElementStart = (index, audioItem) => {
 *   console.log(`Now playing element ${index}`);
 * };
 * ```
 */

import { TTSPlayer } from './TTSPlayer.js';
import { textToSpeech } from './TTS.js';

export class TTSManager {
  constructor() {
    // ============= 音频缓存 =============
    /**
     * 音频缓存更新回调（用于触发 Vue 响应式更新）
     * @type {Function|null}
     */
    this.onAudioMapUpdate = null;

    /**
     * 全局音频缓存映射表（使用 Proxy 自动触发更新回调）
     * Key: 'pageNumber-elementIndex' (例如 '2-5' 表示第2页的第5个元素)
     * Value: {
     *   status: 'loading' | 'loaded' | 'failed',
     *   audioBlob: Blob | null,
     *   elementIndex: number,
     *   type: string,
     *   text: string,
     *   success: boolean
     * }
     * @type {Map<string, Object>}
     */
    const rawMap = new Map();
    this.audioMap = new Proxy(rawMap, {
      get: (target, prop) => {
        const value = target[prop];
        // 如果是方法，拦截 set、delete、clear 操作
        if (typeof value === 'function') {
          return (...args) => {
            const result = value.apply(target, args);
            // 只在修改操作时触发回调
            if (['set', 'delete', 'clear'].includes(prop) && this.onAudioMapUpdate) {
              this.onAudioMapUpdate();
            }
            return result;
          };
        }
        return value;
      }
    });

    // ============= 播放引擎 =============
    /**
     * TTSPlayer 实例 - 负责音频播放控制
     * @type {TTSPlayer}
     */
    this.player = new TTSPlayer();

    // ============= 加载状态 =============
    /**
     * 当前是否正在加载某个页面
     * @type {boolean}
     */
    this.isLoadingPage = false;

    /**
     * 正在加载的页面集合（用于避免重复加载）
     * @type {Set<number>}
     */
    this.loadingPages = new Set();

    // ============= 配置参数 =============
    /**
     * TTS请求最大重试次数
     * @type {number}
     */
    this.maxRetries = 3;

    /**
     * TTS请求超时时间（毫秒）
     * @type {number}
     */
    this.requestTimeout = 30000;

    /**
     * 预加载接下来的页数
     * @type {number}
     */
    this.prefetchPageCount = 4;

    /**
     * 语言设置
     * @type {string}
     */
    this.language = 'zh-CN'; // 'en-US' or 'zh-CN'
  }

  /**
   * 检查页面缓存状态
   * @param {number} pageNum - 页码
   * @param {Array} elements - 元素数组
   * @returns {Object} 缓存状态对象
   */
  checkPageCacheStatus(pageNum, elements) {
    const cached = [];
    const loading = [];
    const missing = [];
    const failed = [];

    elements.forEach((element, idx) => {
      const cacheKey = `${pageNum}-${idx}`;
      const audioData = this.audioMap.get(cacheKey);

      if (!audioData) {
        missing.push(idx);
      } else if (audioData.status === 'loading') {
        loading.push(idx);
      } else if (audioData.status === 'loaded') {
        cached.push(idx);
      } else if (audioData.status === 'failed') {
        failed.push(idx);
      }
    });

    const isFullyCached = (cached.length + failed.length) === elements.length;

    return {
      cached,
      loading,
      missing,
      failed,
      isFullyCached,
      totalCount: elements.length
    };
  }

  /**
   * 获取当前页的音频加载统计
   * @param {number} pageNum - 页码
   * @param {number} totalElements - 总元素数
   * @returns {Object} 统计结果 { loadedCount, processedCount }
   */
  getAudioLoadStats(pageNum, totalElements) {
    let loadedCount = 0; // 成功加载的有效音频
    let processedCount = 0; // 已处理的元素（包括成功和失败）

    for (let i = 0; i < totalElements; i++) {
      const cacheKey = `${pageNum}-${i}`;
      const audioItem = this.audioMap.get(cacheKey);

      if (audioItem) {
        if (audioItem.status === 'loaded' && audioItem.audioBlob instanceof Blob && audioItem.audioBlob.size > 0) {
          loadedCount++;
          processedCount++;
        } else if (audioItem.status === 'failed') {
          processedCount++;
        }
      }
    }

    return { loadedCount, processedCount };
  }

  /**
   * 计算缓冲状态
   * @param {number} pageNum - 页码
   * @param {number} totalElements - 总元素数
   * @returns {Object} 缓冲状态 { ready, progress, message, loadedCount }
   */
  getBufferStatus(pageNum, totalElements) {
    if (totalElements === 0) {
      return { ready: false, progress: 0, message: '', loadedCount: 0 };
    }

    const { loadedCount, processedCount } = this.getAudioLoadStats(pageNum, totalElements);
    const progress = Math.round((processedCount / totalElements) * 100);
    const ready = processedCount === totalElements;

    let message = '';
    if (ready) {
      const failedCount = processedCount - loadedCount;
      message = failedCount > 0
        ? `Ready to play (${loadedCount} valid, ${failedCount} skipped)`
        : 'Ready to play';
    } else {
      message = `Generating speech... ${processedCount}/${totalElements} (${progress}%)`;
    }

    return { ready, progress, message, loadedCount };
  }

  /**
   * 使用重试机制调用 TTS API
   * @param {Object} element - 元素对象 { type, text, elementIndex }
   * @param {number} elementIndex - 元素索引
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} TTS 结果对象
   */
  async fetchTTSWithRetry(element, elementIndex, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // console.log(`🔄 TTS request attempt ${attempt}/${maxRetries} for element ${elementIndex} (${element.type})`);

        const audioBlob = await textToSpeech(element.text, this.language, this.requestTimeout);

        // 检查 audioBlob 是否有效
        if (!(audioBlob instanceof Blob)) {
          throw new Error(`Invalid audioBlob: expected Blob, got ${typeof audioBlob}`);
        }

        // console.log(`✅ TTS request succeeded for element ${elementIndex} (size: ${audioBlob.size} bytes)`);

        return {
          status: 'loaded',
          audioBlob,
          elementIndex,
          type: element.type,
          text: element.text,
          success: true
        };

      } catch (error) {
        lastError = error;
        console.warn(`⚠️ TTS request attempt ${attempt}/${maxRetries} failed for element ${elementIndex}:`, error.message);

        // 如果还有重试机会，等待一段时间后重试
        if (attempt < maxRetries) {
          const waitTime = 500 * attempt; // 递增等待时间
          // console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // 所有重试都失败
    console.error(`❌ All ${maxRetries} attempts failed for element ${elementIndex}:`, lastError);

    return {
      status: 'failed',
      audioBlob: null,
      elementIndex,
      type: element.type,
      text: element.text,
      success: false,
      error: lastError.message
    };
  }

  /**
   * 并发加载多个元素的音频
   * @param {Array} elements - 元素数组
   * @param {number} pageNumber - 页码
   * @param {Object} options - 选项 { background: boolean }
   * @returns {Promise<Object>} 加载结果 { successCount, failedCount, totalCount }
   */
  async fetchAllTTSAudioIncrementally(elements, pageNumber, options = {}) {
    const { background = false } = options;

    // console.log(`🎵 Starting ${background ? 'background' : 'foreground'} TTS fetch for ${elements.length} elements on page ${pageNumber}...`);

    let completedCount = 0;
    let successCount = 0;

    // 先标记所有元素为 loading 状态
    elements.forEach((element) => {
      const cacheKey = `${pageNumber}-${element.elementIndex}`;

      // 只有未缓存的元素才标记为 loading
      if (!this.audioMap.has(cacheKey)) {
        this.audioMap.set(cacheKey, {
          status: 'loading',
          elementIndex: element.elementIndex,
          type: element.type,
          text: element.text,
          audioBlob: null,
          success: false
        });
      }
    });

    // 并发调用所有TTS请求
    const promises = elements.map(async (element) => {
      const cacheKey = `${pageNumber}-${element.elementIndex}`;

      // 如果已经缓存且状态是 loaded，跳过
      const existing = this.audioMap.get(cacheKey);
      if (existing && existing.status === 'loaded') {
        // console.log(`⏭️ Element ${element.elementIndex} on page ${pageNumber} already cached, skipping`);
        completedCount++;
        successCount++;
        return existing;
      }

      // console.log(`📤 Sending TTS request for page ${pageNumber}, element ${element.elementIndex}...`);
      const result = await this.fetchTTSWithRetry(element, element.elementIndex, this.maxRetries);

      completedCount++;

      if (result.success) {
        successCount++;
        // 更新缓存（Proxy 会自动触发回调）
        this.audioMap.set(cacheKey, result);
        // console.log(`📥 Audio ${completedCount}/${elements.length} loaded (page ${pageNumber}, element ${result.elementIndex})`);
      } else {
        // 标记为失败（Proxy 会自动触发回调）
        this.audioMap.set(cacheKey, result);
        console.warn(`⏭️ Element ${result.elementIndex} on page ${pageNumber} failed after retries`);
      }

      return result;
    });

    // 等待所有请求完成
    await Promise.all(promises);

    // console.log(`✅ All TTS requests completed for page ${pageNumber}: ${successCount}/${elements.length} successful`);

    if (successCount < elements.length) {
      console.warn(`⚠️ ${elements.length - successCount} elements failed to load on page ${pageNumber}`);
    }

    return {
      successCount,
      failedCount: elements.length - successCount,
      totalCount: elements.length
    };
  }

  /**
   * 等待音频加载完成（纯监控模式）
   * @param {Array} elements - 元素数组
   * @param {number} pageNum - 页码
   * @param {number} maxWaitTime - 最大等待时间（毫秒）
   * @returns {Promise<Object>} 结果 { readyCount, failedCount }
   */
  async waitForAudioMapReady(elements, pageNum, maxWaitTime = 60000) {
    const startTime = Date.now();
    const checkInterval = 300; // 每300ms检查一次

    // console.log(`👀 Monitoring audioMap for page ${pageNum}...`);

    while (true) {
      // 检查是否超时
      if (Date.now() - startTime >= maxWaitTime) {
        console.warn(`⏰ Wait timeout after ${maxWaitTime}ms for page ${pageNum}`);
        break;
      }

      // 统计当前状态
      let readyCount = 0;
      let failedCount = 0;
      let loadingCount = 0;

      for (let i = 0; i < elements.length; i++) {
        const cacheKey = `${pageNum}-${i}`;
        const audioItem = this.audioMap.get(cacheKey);

        if (!audioItem) {
          loadingCount++;
        } else if (audioItem.status === 'loading') {
          loadingCount++;
        } else if (audioItem.status === 'loaded' && audioItem.audioBlob instanceof Blob && audioItem.audioBlob.size > 0) {
          readyCount++;
        } else if (audioItem.status === 'failed') {
          failedCount++;
        }
      }

      // 如果所有元素都已处理完成（loaded 或 failed），退出等待
      if (readyCount + failedCount === elements.length) {
        // console.log(`✅ All audio ready for page ${pageNum}: ${readyCount} loaded, ${failedCount} failed`);
        return { readyCount, failedCount };
      }

      // 继续等待
      // console.log(`⏳ Waiting for audio... ${readyCount + failedCount}/${elements.length} ready (${loadingCount} still loading)`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    // 超时，返回当前状态
    const finalStats = this.getAudioLoadStats(pageNum, elements.length);
    console.warn(`⚠️ Wait timeout, returning partial results: ${finalStats.loadedCount} loaded`);
    return {
      readyCount: finalStats.loadedCount,
      failedCount: finalStats.processedCount - finalStats.loadedCount
    };
  }

  /**
   * 预加载指定页面的TTS音频
   * @param {number} pageNum - 页码
   * @param {Array} elements - 元素数组
   * @param {Object} options - 选项 { background: boolean, getElementsForPage: Function }
   * @returns {Promise<Object>} 加载结果
   */
  async preloadPage(pageNum, elements, options = {}) {
    const { background = false, getElementsForPage = null } = options;

    if (elements.length === 0) {
      // console.log(`⚠️ No readable content on page ${pageNum}`);
      return { success: false, message: 'No readable content' };
    }

    // 检查是否已在加载中
    if (this.loadingPages.has(pageNum)) {
      // console.log(`⏳ Page ${pageNum} is already loading, skipping duplicate request`);
      return { success: false, message: 'Already loading' };
    }

    // 检查缓存状态
    const cacheStatus = this.checkPageCacheStatus(pageNum, elements);

    if (cacheStatus.isFullyCached) {
      // console.log(`✅ Page ${pageNum} TTS already fully cached (${cacheStatus.cached.length}/${elements.length}), skipping preload`);
      return { success: true, message: 'Already cached', cacheStatus };
    }

    // 标记为加载中
    this.loadingPages.add(pageNum);

    try {
      // console.log(`🚀 Preloading TTS for page ${pageNum}: ${cacheStatus.cached.length} cached, ${cacheStatus.loading.length} loading, ${cacheStatus.missing.length} missing, ${cacheStatus.failed.length} failed`);

      // 启动并发加载
      const result = await this.fetchAllTTSAudioIncrementally(elements, pageNum, { background });

      // 重新检查缓存状态
      const finalCacheStatus = this.checkPageCacheStatus(pageNum, elements);

      if (finalCacheStatus.isFullyCached) {
        // console.log(`✅ Preload complete! ${finalCacheStatus.cached.length} audio loaded, ${finalCacheStatus.failed.length} failed for page ${pageNum}`);

        // 如果不是后台加载，自动预加载接下来的页
        if (!background && getElementsForPage) {
          this.prefetchNextPages(pageNum, this.prefetchPageCount, getElementsForPage);
        }

        return { success: true, message: 'Preload complete', cacheStatus: finalCacheStatus, result };
      } else {
        console.warn(`⚠️ Preload incomplete for page ${pageNum}: ${finalCacheStatus.cached.length} cached, ${finalCacheStatus.loading.length} still loading, ${finalCacheStatus.missing.length} missing`);
        return { success: false, message: 'Preload incomplete', cacheStatus: finalCacheStatus, result };
      }
    } finally {
      // 移除加载标记
      this.loadingPages.delete(pageNum);
    }
  }

  /**
   * 预加载接下来的N页TTS音频（后台静默加载）
   * @param {number} currentPageNum - 当前页码
   * @param {number} count - 要预加载的页数
   * @param {Function} getElementsForPage - 获取页面元素的函数 (pageNum) => elements
   */
  async prefetchNextPages(currentPageNum, count, getElementsForPage) {
    if (!getElementsForPage) {
      console.warn('⚠️ prefetchNextPages: getElementsForPage function not provided');
      return;
    }

    // console.log(`🔮 Starting background prefetch for next ${count} pages from page ${currentPageNum}...`);

    // 后台静默加载，不阻塞当前操作
    for (let offset = 1; offset <= count; offset++) {
      const targetPage = currentPageNum + offset;

      // 异步预加载该页（不等待完成）
      this.prefetchPageInBackground(targetPage, getElementsForPage);
    }
  }

  /**
   * 在后台预加载指定页面的TTS音频
   * @param {number} pageNum - 页码
   * @param {Function} getElementsForPage - 获取页面元素的函数
   */
  async prefetchPageInBackground(pageNum, getElementsForPage) {
    try {
      // 获取该页的可朗读元素
      const elements = getElementsForPage(pageNum);

      if (elements.length === 0) {
        // console.log(`⚠️ Page ${pageNum} has no readable content, skipping prefetch`);
        return;
      }

      // 检查该页的缓存状态
      const cacheStatus = this.checkPageCacheStatus(pageNum, elements);

      // 如果已经全部缓存，跳过
      if (cacheStatus.isFullyCached) {
        // console.log(`✅ Page ${pageNum} already fully cached (${cacheStatus.cached.length}/${elements.length}), skipping prefetch`);
        return;
      }

      // 如果正在加载中，跳过
      if (cacheStatus.loading.length > 0) {
        // console.log(`⏳ Page ${pageNum} already loading (${cacheStatus.loading.length} elements), skipping duplicate prefetch`);
        return;
      }

      // 后台加载
      // console.log(`🔮 Background prefetching page ${pageNum}...`);
      await this.preloadPage(pageNum, elements, { background: true });

    } catch (error) {
      console.error(`❌ Error prefetching page ${pageNum}:`, error);
    }
  }

  /**
   * 开始播放音频
   * @param {number} pageNum - 页码
   * @param {Array} elements - 元素数组
   * @param {number} startIndex - 起始索引
   * @param {Function} onPageChange - 页码改变回调（用于检测用户切换页面）
   * @returns {Promise<void>}
   */
  async startPlayback(pageNum, elements, startIndex = 0, onPageChange = null) {
    if (elements.length === 0) {
      throw new Error('No readable content on current page');
    }

    // console.log(`📚 Starting playback for page ${pageNum}, ${elements.length} elements, startIndex ${startIndex}`);

    // 检查缓存状态
    const cacheStatus = this.checkPageCacheStatus(pageNum, elements);

    if (cacheStatus.isFullyCached) {
      // console.log(`🎉 Reusing cached audio for page ${pageNum}! ${cacheStatus.cached.length}/${elements.length} ready`);
    } else {
      // console.log(`⚠️ Page ${pageNum} audio not fully cached, loading...`);

      // 过滤出需要加载的元素
      const elementsToLoad = elements.filter((_el, idx) => {
        return cacheStatus.missing.includes(idx) || cacheStatus.failed.includes(idx);
      });

      if (elementsToLoad.length > 0) {
        // console.log(`🚀 Starting foreground load for ${elementsToLoad.length} elements...`);
        // 启动加载（不等待），让它在后台运行
        this.fetchAllTTSAudioIncrementally(elementsToLoad, pageNum);
      }

      // 等待音频加载完成
      // console.log(`👀 Monitoring audioMap for page ${pageNum}...`);
      const { readyCount, failedCount } = await this.waitForAudioMapReady(elements, pageNum);

      // 检查页码是否变化
      if (onPageChange && onPageChange()) {
        throw new Error('Page changed during audio loading');
      }

      // console.log(`✅ Audio loading complete for page ${pageNum}: ${readyCount}/${elements.length} successfully loaded`);

      if (readyCount === 0) {
        throw new Error(`All audio failed to load for page ${pageNum}`);
      }

      if (failedCount > 0) {
        console.warn(`⚠️ ${failedCount} elements failed to load, some elements may be skipped during playback`);
      }
    }

    // 确保 startIndex 在有效范围内
    if (startIndex < 0 || startIndex >= elements.length) {
      startIndex = 0;
    }

    // 查找第一个有效的音频元素
    let validStartIndex = startIndex;
    let foundValidStart = false;

    for (let i = startIndex; i < elements.length; i++) {
      const cacheKey = `${pageNum}-${i}`;
      const audioItem = this.audioMap.get(cacheKey);

      if (audioItem && audioItem.status === 'loaded' && audioItem.audioBlob instanceof Blob && audioItem.audioBlob.size > 0) {
        validStartIndex = i;
        foundValidStart = true;
        if (i !== startIndex) {
          // console.log(`⚠️ Start element ${startIndex} has invalid audio, skipping to element ${i}`);
        }
        break;
      }
    }

    if (!foundValidStart) {
      throw new Error(`No valid audio found on page ${pageNum} starting from element ${startIndex}`);
    }

    // 初始化并启动播放器
    this.player.init(this.audioMap, elements.length, pageNum);
    await this.player.start(validStartIndex);

    // console.log(`🎬 Playback started from element ${validStartIndex}`);
  }

  /**
   * 停止播放
   */
  stopPlayback() {
    // console.log('⏹️ Stopping playback...');
    this.player.stop();
  }

  /**
   * 清除指定页面的缓存
   * @param {number} pageNum - 页码
   */
  clearPageCache(pageNum) {
    // console.log(`🗑️ Clearing cache for page ${pageNum}...`);

    const keysToDelete = [];
    for (const [key] of this.audioMap) {
      if (key.startsWith(`${pageNum}-`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.audioMap.delete(key));

    // console.log(`✓ Cleared ${keysToDelete.length} cache entries for page ${pageNum}`);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache() {
    // console.log('🗑️ Clearing all audio cache...');
    const size = this.audioMap.size;
    this.audioMap.clear();
    // console.log(`✓ Cleared ${size} cache entries`);
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getCacheStats() {
    const stats = {
      totalEntries: this.audioMap.size,
      loaded: 0,
      loading: 0,
      failed: 0,
      totalSize: 0,
      pageStats: {}
    };

    for (const [key, value] of this.audioMap) {
      if (value.status === 'loaded') {
        stats.loaded++;
        if (value.audioBlob) {
          stats.totalSize += value.audioBlob.size;
        }
      } else if (value.status === 'loading') {
        stats.loading++;
      } else if (value.status === 'failed') {
        stats.failed++;
      }

      // 统计每页的数量
      const pageNum = key.split('-')[0];
      if (!stats.pageStats[pageNum]) {
        stats.pageStats[pageNum] = 0;
      }
      stats.pageStats[pageNum]++;
    }

    return stats;
  }

  /**
   * 销毁管理器（释放所有资源）
   */
  destroy() {
    // console.log('🗑️ Destroying TTSManager...');
    this.player.destroy();
    this.clearAllCache();
    this.loadingPages.clear();
    // console.log('✓ TTSManager destroyed');
  }
}

export default TTSManager;
