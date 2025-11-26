/**
 * TTSPlayer.js - Text-to-Speech Player Class
 *
 * 职责：
 * 1. 管理音频播放状态和生命周期
 * 2. 处理播放队列和并发控制
 * 3. 管理音频资源（Audio 对象、Blob URL）
 * 4. 提供播放控制接口（播放、停止）
 *
 * 使用示例：
 * ```javascript
 * const player = new TTSPlayer();
 * player.init(audioMap, totalElements, currentPage);
 * await player.start(0); // 从第 0 个元素开始播放
 * player.stop(); // 停止播放
 * ```
 */

export class TTSPlayer {
  constructor() {
    // ============= 播放状态 =============
    /**
     * 是否正在播放
     * @type {boolean}
     */
    this.isPlaying = false;

    /**
     * 当前播放的元素的页面内索引
     * @type {number}
     */
    this.currentIndex = 0;

    /**
     * 当前页码
     * @type {number}
     */
    this.currentPage = 1;

    /**
     * 当前页总元素数量
     * @type {number}
     */
    this.totalElements = 0;

    // ============= 音频资源 =============
    /**
     * 当前正在播放的 Audio 对象
     * @type {HTMLAudioElement|null}
     */
    this.currentAudio = null;

    /**
     * 当前 Audio 对象的 Blob URL
     * @type {string|null}
     */
    this.currentAudioUrl = null;

    /**
     * 音频缓存映射表（外部传入）
     * Key: 'pageNumber-elementIndex'
     * Value: { status, audioBlob, elementIndex, type, text, success }
     * @type {Map<string, Object>|null}
     */
    this.audioMap = null;

    // ============= 并发控制 =============
    /**
     * 播放锁：防止 _playNext() 并发执行
     * @type {boolean}
     */
    this.playLock = false;

    // ============= 事件处理器引用（用于移除监听器） =============
    /**
     * 音频播放结束事件处理器
     * @type {Function|null}
     */
    this.onAudioEnded = null;

    /**
     * 音频播放错误事件处理器
     * @type {Function|null}
     */
    this.onAudioError = null;

    // ============= 回调钩子 =============
    /**
     * 元素开始播放时的回调（用于更新 UI 高亮等）
     * @type {Function|null}
     * @param {number} elementIndex - 元素索引
     * @param {Object} audioItem - 音频数据对象
     */
    this.onElementStart = null;

    /**
     * 元素播放结束时的回调
     * @type {Function|null}
     * @param {number} elementIndex - 元素索引
     */
    this.onElementEnd = null;

    /**
     * 当前页播放完成时的回调（用于自动翻页）
     * @type {Function|null}
     * @param {number} currentPage - 当前页码
     * @returns {Promise<boolean>} - true: 继续播放（已翻页），false: 停止播放
     */
    this.onPageComplete = null;

    /**
     * 播放完成时的回调（所有元素播放完毕，无下一页）
     * @type {Function|null}
     */
    this.onPlaybackComplete = null;

    /**
     * 播放错误时的回调
     * @type {Function|null}
     * @param {Error} error - 错误对象
     */
    this.onError = null;
  }

  /**
   * 初始化播放器（设置外部依赖）
   * @param {Map} audioMap - 音频缓存映射表
   * @param {number} totalElements - 当前页总元素数量
   * @param {number} currentPage - 当前页码
   */
  init(audioMap, totalElements, currentPage) {
    this.audioMap = audioMap;
    this.totalElements = totalElements;
    this.currentPage = currentPage;
    // console.log(`🎵 TTSPlayer initialized: page=${currentPage}, totalElements=${totalElements}`);
  }

  /**
   * 开始播放
   * @param {number} startIndex - 起始元素索引（默认 0）
   * @returns {Promise<void>}
   */
  async start(startIndex = 0) {
    if (this.isPlaying) {
      console.warn('⚠️ TTSPlayer is already playing');
      return;
    }

    if (!this.audioMap) {
      throw new Error('TTSPlayer not initialized. Call init() first.');
    }

    if (startIndex < 0 || startIndex >= this.totalElements) {
      throw new Error(`Invalid startIndex: ${startIndex}. Must be in range [0, ${this.totalElements - 1}]`);
    }

    // console.log(`🎬 TTSPlayer starting from element ${startIndex}`);
    this.isPlaying = true;
    this.currentIndex = startIndex;

    // 开始播放第一个元素
    await this._playNext();
  }

  /**
   * 停止播放
   */
  stop() {
    // console.log('⏹️ TTSPlayer stopping...');
    this.isPlaying = false;
    this._cleanupCurrentAudio();
    this.currentIndex = 0;

    // 🔓 释放播放锁（防止锁泄漏）
    // 场景：如果在音频播放期间调用 stop()，_cleanupCurrentAudio() 会移除事件监听器，
    // 导致 onAudioEnded 不会被触发，playLock 可能永远不会被释放。
    // 因此需要在这里显式释放锁。
    if (this.playLock) {
      // console.log('🔓 Releasing playLock in stop()');
      this.playLock = false;
    }

    // console.log('✓ TTSPlayer stopped');
  }

  /**
   * 跳转到指定元素（未来扩展）
   * @param {number} index - 目标元素索引
   */
  seekTo(index) {
    if (index < 0 || index >= this.totalElements) {
      throw new Error(`Invalid index: ${index}. Must be in range [0, ${this.totalElements - 1}]`);
    }

    // console.log(`⏩ Seeking to element ${index}`);
    this._cleanupCurrentAudio();
    this.currentIndex = index;

    if (this.isPlaying) {
      this._playNext();
    }
  }

  /**
   * 获取当前播放状态
   * @returns {Object} 状态对象
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      currentPage: this.currentPage,
      totalElements: this.totalElements,
      progress: this.totalElements > 0 ? (this.currentIndex / this.totalElements) * 100 : 0,
      hasAudio: this.currentAudio !== null
    };
  }

  // ============= 私有方法 =============

  /**
   * 播放下一个元素（核心播放逻辑）
   *
   * 功能概述：
   * 这是播放器的核心方法，负责按顺序播放音频队列中的元素。它处理多种边界情况：
   * - 并发控制：使用 playLock 防止重复调用（支持等待锁释放）
   * - 状态检查：验证播放器是否处于播放状态
   * - 音频等待：如果音频正在加载，等待加载完成
   * - 错误处理：跳过失败或空白的音频
   * - 自动继续：当前音频播放完成后自动播放下一个
   *
   * ⚠️ 播放行为说明：
   * _playNext() 播放完一个元素后，会【自动继续播放下一个元素】，而不是停止！
   * - 播放流程：播放音频 → 触发 onAudioEnded 事件 → 清理资源 → currentIndex++ → 递归调用 _playNext()
   * - 这种链式调用会持续进行，直到满足以下任一条件：
   *   1. currentIndex >= totalElements（当前页所有元素播放完毕）
   *   2. isPlaying === false（用户调用了 stop() 方法）
   *   3. 发生播放错误（触发 _handleError() 停止播放）
   * - 因此，_playNext() 是一个"自驱动"的播放引擎，无需外部循环控制
   * - 如需停止播放，必须显式调用 stop() 方法，将 isPlaying 设置为 false
   *
   * 调用场景：
   * 1. start() - 开始播放时首次调用
   * 2. _playAudio() 的 onAudioEnded - 当前音频播放完成，自动播放下一个
   * 3. _waitForAudio() - 音频加载完成后继续播放
   * 4. seekTo() - 跳转到指定位置播放（未来功能）
   *
   * 并发控制：
   * playLock 锁机制确保 _playNext() 不会并发执行。这很重要，因为：
   * - _playAudio() 中的 onAudioEnded 回调会异步调用 _playNext()
   * - 如果音频播放时间很短，可能在上一次 _playNext() 还未完成时就触发下一次
   * - 使用等待机制：如果检测到锁被占用，会等待最多 3 秒直到锁释放
   * - 如果等待超时，会放弃本次调用（避免死锁）
   *
   * 执行流程：
   * 1. 检查并等待获取播放锁（playLock），最多等待 3 秒
   * 2. 验证播放状态（isPlaying）
   * 3. 检查是否已播放完所有元素（currentIndex >= totalElements）
   * 4. 从 audioMap 获取当前元素的音频数据
   * 5. 根据音频状态决定：
   *    - 'loading' 或不存在：调用 _waitForAudio() 等待
   *    - 'failed' 或空 Blob：跳过，递归调用 _playNext() 播放下一个
   *    - 'loaded' 且有数据：调用 _playAudio() 播放
   * 6. 等待音频播放完成（ended 或 error 事件触发）
   * 7. 在事件回调中释放锁并继续播放下一个
   *
   * 锁的释放时机（重要）：
   * - ✅ 正常播放完成：onAudioEnded 事件中释放（保护整个播放周期）
   * - ✅ 播放出错：onAudioError 事件中释放（与 ended 保持一致）
   * - ✅ 跳过失败元素：立即释放并同步递归（第343行）
   * - ✅ 等待音频加载：_waitForAudio() 中释放并异步递归
   * - ✅ 异常情况：finally 块中释放（兜底机制，防止死锁）
   *
   * 锁保护的范围：
   * - 从 _playNext() 进入 → 到音频播放完成（ended/error 事件）
   * - 保护 currentIndex、currentAudio 等状态的读写
   * - 防止并发调用导致重复播放或状态混乱
   *
   * 注意事项：
   * - 此方法是异步的，但调用者无需等待其完成（fire-and-forget）
   * - 音频播放通过事件驱动（ended 事件）自动继续，不需要外部轮询
   * - stop() 方法通过设置 isPlaying=false 来中断播放链
   *
   * @private
   * @returns {Promise<void>}
   */
  async _playNext() {
    // 🔒 播放锁检查：如果锁被占用，等待锁释放
    // 场景：如果当前正在执行 _playNext()，而音频播放完成触发了 onAudioEnded 回调，
    // 回调中又会调用 _playNext()，此时就会出现并发。
    // 策略：等待锁释放，而不是直接拒绝调用
    if (this.playLock) {
      // console.log('⏳ _playNext: playLock is occupied, waiting for release...');
      const acquired = await this._waitForLock(3000); // 等待最多 3 秒
      if (!acquired) {
        console.warn('⚠️ _playNext: failed to acquire lock after timeout, aborting');
        return;
      }
      // console.log('✓ _playNext: lock acquired after waiting');
    }

    // 🔒 获取锁
    // 从这一刻起，其他 _playNext() 调用将等待锁释放
    this.playLock = true;
    let shouldReleaseLockInFinally = false; // 标记是否需要在 finally 中释放锁

    try {
      // 检查播放状态
      // 如果用户调用了 stop()，isPlaying 会被设置为 false，此时应立即退出
      if (!this.isPlaying) {
        // console.log('⏹️ _playNext: isPlaying=false, stopping');
        shouldReleaseLockInFinally = true; // 提前退出，需要释放锁
        return;
      }

      // 检查是否播放完毕
      // currentIndex 从 0 开始，当它等于 totalElements 时，说明所有元素已播放完毕
      if (this.currentIndex >= this.totalElements) {
        // console.log('✅ _playNext: reached end of elements');

        // 🔥 新增：触发页面完成回调（用于自动翻页）
        if (this.onPageComplete) {
          // console.log('📖 Page complete, calling onPageComplete callback...');
          try {
            const shouldContinue = await this.onPageComplete(this.currentPage);
            if (shouldContinue) {
              // console.log('📖 onPageComplete returned true, playback will continue on next page');
              shouldReleaseLockInFinally = true; // 外部处理翻页，需要释放锁
              return; // 由外部处理翻页后，会重新初始化并启动播放
            }
          } catch (error) {
            console.error('❌ Error in onPageComplete callback:', error);
          }
        }

        // 如果没有 onPageComplete 回调，或回调返回 false，则正常结束播放
        this._onPlaybackCompleteInternal();
        shouldReleaseLockInFinally = true; // 播放完成，需要释放锁
        return;
      }

      // 获取音频数据
      // 缓存键格式：'页码-元素索引'，例如 '2-5' 表示第 2 页的第 5 个元素
      const cacheKey = `${this.currentPage}-${this.currentIndex}`;
      const audioItem = this.audioMap.get(cacheKey);

      // 处理音频未加载或正在加载
      // 场景 1：audioItem 不存在 - 音频尚未开始加载（不应发生，但做防御性检查）
      // 场景 2：audioItem.status === 'loading' - 音频正在加载中
      if (!audioItem || audioItem.status === 'loading') {
        const status = audioItem ? audioItem.status : 'missing';
        // console.log(`⏳ _playNext: element ${this.currentIndex} is ${status}, waiting...`);
        await this._waitForAudio(cacheKey);
        // _waitForAudio 会在音频加载完成后递归调用 _playNext，并在内部释放锁
        // 这里直接返回，不需要在 finally 中释放
        return;
      }

      // 处理音频加载失败或空白音频
      // 场景 1：audioItem.status === 'failed' - TTS 服务返回错误
      // 场景 2：audioBlob 不存在或大小为 0 - 空白音频（例如无声片段）
      // 处理方式：跳过该元素，继续播放下一个
      if (audioItem.status === 'failed' || !audioItem.audioBlob || audioItem.audioBlob.size === 0) {
        console.warn(`⏭️ _playNext: skipping element ${this.currentIndex} (status=${audioItem.status}, size=${audioItem.audioBlob?.size || 0})`);
        this.currentIndex++;
        this.playLock = false; // 🔓 立即释放锁（同步递归前必须释放）
        await this._playNext(); // 递归播放下一个元素
        return; // 已经释放锁，不需要在 finally 中再释放
      }

      // 播放音频
      // 此时音频数据已准备就绪，调用 _playAudio() 播放
      // _playAudio() 会创建 Audio 对象，绑定事件监听器，并开始播放
      await this._playAudio(audioItem);

      // ⚠️ 注意：锁不在这里释放！
      // 锁将在音频播放完成时释放（onAudioEnded 或 onAudioError 中）
      // 这样可以保护整个播放周期，防止并发调用导致的状态混乱
      //
      // 播放结束后，onAudioEnded 或 onAudioError 回调会：
      // 1. 释放锁
      // 2. 调用 _playNext() 播放下一个
      //
      // shouldReleaseLockInFinally 保持 false，不在 finally 中释放

    } catch (error) {
      console.error('❌ _playNext error:', error);
      shouldReleaseLockInFinally = true; // 异常时需要释放锁
      this._handleError(error);
    } finally {
      // 🔓 释放锁（仅在提前退出或异常时）
      // 使用标志位判断是否需要释放锁，避免在正常播放流程中错误释放
      //
      // shouldReleaseLockInFinally === true 的情况：
      // - ✅ isPlaying === false（用户停止播放）
      // - ✅ currentIndex >= totalElements（播放完所有元素）
      // - ✅ onPageComplete 返回 true（外部处理翻页）
      // - ✅ 发生异常（catch 块捕获）
      //
      // shouldReleaseLockInFinally === false 的情况：
      // - ✅ 正常播放流程（await _playAudio 后，音频正在播放）
      // - ✅ 等待加载（_waitForAudio 内部会释放锁）
      // - ✅ 跳过失败元素（已在第350行释放锁）
      if (shouldReleaseLockInFinally && this.playLock) {
        // console.log('🔓 _playNext: releasing lock in finally (early exit or exception)');
        this.playLock = false;
      }
    }
  }

  /**
   * 等待播放锁释放
   *
   * 功能：
   * - 轮询检查 playLock 状态，等待其变为 false
   * - 支持超时机制，避免无限等待
   * - 每 50ms 检查一次锁状态
   *
   * 使用场景：
   * - 当多个 _playNext() 调用几乎同时发生时（例如极短音频）
   * - 避免直接拒绝调用，而是等待前一个调用完成
   *
   * @private
   * @param {number} timeout - 超时时间（毫秒），默认 3000ms
   * @returns {Promise<boolean>} - true: 成功获取锁, false: 超时
   */
  async _waitForLock(timeout = 3000) {
    const startTime = Date.now();
    const checkInterval = 50; // 每 50ms 检查一次

    while (this.playLock) {
      // 检查是否超时
      if (Date.now() - startTime >= timeout) {
        return false; // 超时，返回失败
      }

      // 检查播放状态（如果已停止，不需要继续等待）
      if (!this.isPlaying) {
        return false;
      }

      // 等待一小段时间后再检查
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return true; // 锁已释放，返回成功
  }

  /**
   * 播放单个音频元素
   * @private
   * @param {Object} audioItem - 音频数据对象
   * @returns {Promise<void>}
   */
  async _playAudio(audioItem) {
    // 清理旧资源
    this._cleanupCurrentAudio();

    // 创建新音频对象
    this.currentAudioUrl = URL.createObjectURL(audioItem.audioBlob);
    this.currentAudio = new Audio(this.currentAudioUrl);

    // console.log(`▶️ Playing element ${this.currentIndex} (${audioItem.type}), blob size=${audioItem.audioBlob.size}`);

    // 触发元素开始播放回调
    if (this.onElementStart) {
      this.onElementStart(this.currentIndex, audioItem);
    }

    // 绑定事件处理器（使用箭头函数保持 this 上下文）
    this.onAudioEnded = async () => {
      // console.log(`✓ Audio ended: element ${this.currentIndex}`);

      // 触发元素播放结束回调
      if (this.onElementEnd) {
        this.onElementEnd(this.currentIndex);
      }

      // 清理资源
      this._cleanupCurrentAudio();

      // 移动到下一个元素
      this.currentIndex++;

      // 🔓 释放播放锁
      // 关键：在这里释放锁，确保整个播放周期（从 _playNext 进入到音频播放完成）都被锁保护
      // 这样可以防止并发的 _playNext() 调用导致状态混乱（例如 currentIndex 被重复修改）
      this.playLock = false;

      // 继续播放下一个
      if (this.isPlaying) {
        await this._playNext();
      }
    };

    this.onAudioError = async (e) => {
      console.error(`❌ Audio error: element ${this.currentIndex}`, e);

      // 清理资源
      this._cleanupCurrentAudio();

      // 跳过失败的元素，继续播放下一个
      this.currentIndex++;

      // 🔓 释放播放锁
      // 与 onAudioEnded 保持一致，在错误情况下也释放锁
      // 确保无论成功还是失败，都能正确释放锁并继续播放
      this.playLock = false;

      if (this.isPlaying) {
        await this._playNext();
      }
    };

    // 注册事件监听器
    this.currentAudio.addEventListener('ended', this.onAudioEnded);
    this.currentAudio.addEventListener('error', this.onAudioError);

    // 开始播放
    try {
      await this.currentAudio.play();
    } catch (error) {
      console.error(`❌ Failed to play audio for element ${this.currentIndex}:`, error);
      // 触发错误事件，让 onAudioError 处理
      this.onAudioError(error);
    }
  }

  /**
   * 等待音频加载完成
   * @private
   * @param {string} cacheKey - 缓存键
   * @param {number} maxRetries - 最大重试次数（默认 20 次，即 6 秒）
   * @returns {Promise<void>}
   */
  async _waitForAudio(cacheKey, maxRetries = 20) {
    for (let i = 0; i < maxRetries; i++) {
      // 等待 300ms
      await new Promise(resolve => setTimeout(resolve, 300));

      // 检查播放状态
      if (!this.isPlaying) {
        // console.log('⏹️ _waitForAudio: playback stopped, aborting wait');
        return; // 播放已停止，退出等待
      }

      // 检查音频是否加载完成
      const audioItem = this.audioMap.get(cacheKey);
      if (audioItem && audioItem.status !== 'loading') {
        // console.log(`✓ _waitForAudio: element ${this.currentIndex} loaded (status=${audioItem.status})`);
        // 音频加载完成，释放锁后继续播放
        this.playLock = false; // 🔓 释放锁
        await this._playNext();
        return;
      }

      // 继续等待
      // console.log(`⏳ _waitForAudio: retry ${i + 1}/${maxRetries} for element ${this.currentIndex}`);
    }

    // 超时，跳过该元素
    console.warn(`⏭️ _waitForAudio: timeout waiting for element ${this.currentIndex}, skipping`);
    this.currentIndex++;
    this.playLock = false; // 🔓 释放锁
    await this._playNext();
  }

  /**
   * 清理当前音频资源
   * @private
   */
  _cleanupCurrentAudio() {
    if (this.currentAudio) {
      // 移除事件监听器
      if (this.onAudioEnded) {
        this.currentAudio.removeEventListener('ended', this.onAudioEnded);
        this.onAudioEnded = null;
      }
      if (this.onAudioError) {
        this.currentAudio.removeEventListener('error', this.onAudioError);
        this.onAudioError = null;
      }

      // 停止播放
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // 释放 Blob URL
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  /**
   * 播放完成内部处理
   * @private
   */
  _onPlaybackCompleteInternal() {
    // console.log('🏁 Playback complete');
    this.stop();

    // 触发播放完成回调
    if (this.onPlaybackComplete) {
      this.onPlaybackComplete();
    }
  }

  /**
   * 错误处理
   * @private
   * @param {Error} error - 错误对象
   */
  _handleError(error) {
    console.error('❌ TTSPlayer error:', error);
    this.stop();

    // 触发错误回调
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * 销毁播放器（释放所有资源）
   */
  destroy() {
    // console.log('🗑️ Destroying TTSPlayer...');
    this.stop();
    this.audioMap = null;
    this.onElementStart = null;
    this.onElementEnd = null;
    this.onPageComplete = null;
    this.onPlaybackComplete = null;
    this.onError = null;
    // console.log('✓ TTSPlayer destroyed');
  }
}

export default TTSPlayer;
