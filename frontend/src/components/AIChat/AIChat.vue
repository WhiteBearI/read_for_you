<template>
	<div class="container">
		<!-- 顶部导航栏 -->
		<TopNav :show-language-switcher="false">
			<template #center>
				<span class="page-indicator">AI Chat</span>
			</template>
		</TopNav>

		<div class="content">
			<!-- 返回阅读页面按钮 - 左上角 -->
			<button ref="backButtonRef" class="back-btn-corner" tabindex="2" @click="goBackToReading" :aria-label="t('backToReadingPage')">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
					<path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>

			<!-- 固定的图片区域 -->
			<div class="target-image" aria-hidden="true">
				<img :src="targetImage" alt="" tabindex="-1" />
			</div>

			<!-- 可滚动的聊天区域 -->
			<div class="chat-area" ref="chatAreaRef">
				<!-- AI 描述区域 -->
				<div v-if="imageDescription" class="ai-description-box" aria-hidden="true">
					<div class="ai-badge">🤖 {{ t('aiDescription') }}</div>
					<p class="ai-description-text" tabindex="-1">{{ imageDescription }}</p>
				</div>
				<div v-for="(message, index) in messages" :key="index">
					<UserMessage 
						v-if="message.role === 'user'" 
						:seq="index" 
						:duration="message.duration"
						:isPlaying="currentPlayingIndex === index"
						@play="handlePlayAudio(index)" />
					<AIMessage 
						v-else 
						:ref="el => setAIMessageRef(el, index)"
						:seq="index" 
						:duration="message.duration"
						:isPlaying="currentPlayingIndex === index"
						@play="handlePlayAudio(index)" />
				</div>
			</div>
			<div class="control-area">
				<!-- Connection error message -->
				<div v-if="connectionError" class="connection-error">
					⚠️ {{ connectionError }}
				</div>
				<button
					ref="talkButtonRef"
					class="talk-button"
					tabindex="1"
					:class="{ 'is-recording': isRecording }"
					:disabled="!isWebSocketReady || connectionError"
					@mousedown="startRecording"
					@mouseup="stopRecording"
					@keydown.space.prevent="startRecording"
					@keyup.space.prevent="stopRecording">
					{{ isWebSocketReady ? t('holdToTalk') : 'Connecting...' }}
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
const aiChatUrl = import.meta.env.VITE_AI_CHAT_URL;
import UserMessage from './UserMessage.vue';
import AIMessage from './AIMessage.vue';
import { useTranslation, addLanguageParam } from '../../utils/i18n.js';
import TopNav from '../TopNav.vue';
import indexedDBService from '../../utils/IndexedDBService.js';

const { t } = useTranslation();

const messages = ref([])
const imageDescription = ref('') // AI生成的图片描述
const useChunkedAudioSend = true // 切换 true 使用分片发送；false 使用原先整段 base64 一次性发送
const targetImage = ref(null)
const chatAreaRef = ref(null)
const talkButtonRef = ref(null)
const backButtonRef = ref(null)
const aiMessageRefs = ref({})
const isRecording = ref(false)
const currentPlayingIndex = ref(null) // 当前正在播放的消息索引
const isWebSocketReady = ref(false) // WebSocket connection status
const connectionError = ref(null) // Connection error message

let messageCounter = 0;
let ws = null
let audioContext = null
let mediaStream = null
let mediaRecorder = null
let playingSource = null // 当前正在播放的音频源
let startTime = null
let endTime = null

function connectWS() {
	return new Promise((resolve, reject) => {
		const wsUrlWithLang = addLanguageParam(aiChatUrl);
		console.log('[connectWS] Connecting to:', wsUrlWithLang);
		ws = new window.WebSocket(wsUrlWithLang);
		ws.binaryType = 'blob';

		// Timeout after 10 seconds
		const timeout = setTimeout(() => {
			if (ws.readyState !== WebSocket.OPEN) {
				connectionError.value = 'Connection timeout. Please refresh the page.';
				reject(new Error('WebSocket connection timeout'));
			}
		}, 10000);

		ws.onopen = () => {
			clearTimeout(timeout);
			console.log('[WebSocket] ✓ Connected successfully');
			console.log('[WebSocket] readyState:', ws.readyState, '(1 = OPEN)');
			isWebSocketReady.value = true;
			connectionError.value = null;
			resolve();
		};

		ws.onerror = (error) => {
			clearTimeout(timeout);
			console.error('[WebSocket] ❌ Error:', error);
			connectionError.value = 'Connection failed. Please check your network.';
			reject(error);
		};

		ws.onclose = (event) => {
			console.log('[WebSocket] ⚠ Connection closed');
			console.log('[WebSocket] Code:', event.code, 'Reason:', event.reason);
			isWebSocketReady.value = false;
		};

		// Log any messages received (for debugging)
		ws.onmessage = (event) => {
			console.log('[WebSocket] ← Received raw message:', event.data.substring(0, 200));
		};
	});
}

async function parseHashImage() {
	let storedBase64 = null
	let storedDescription = null
	try {
		// 从 IndexedDB 读取图片 base64 数据（已由 ReadingPage 预先下载）
		storedBase64 = await indexedDBService.getItem('selectedImageBase64')
		storedDescription = await indexedDBService.getItem('selectedImageDescription')
	} catch (err) {
		console.warn('Failed to read image data from IndexedDB:', err)
	}
	if (storedBase64) {
		targetImage.value = storedBase64
		console.log('📷 Loaded image base64 from IndexedDB')
		if (storedDescription) {
			imageDescription.value = storedDescription
			console.log('📝 Loaded AI description:', storedDescription)
		}
		return
	}
}

// 返回阅读页面
function goBackToReading() {
	window.location.hash = '#/reading';
}

async function initRecorder() {
	try {
		const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
		navigator.permissions.query({ name: 'microphone' }).then(result => {
			console.log('麦克风权限状态:', result.state); // "granted", "denied", "prompt"
		});
		mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' })
		mediaRecorder.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) {
				addMessage("user", endTime - startTime, e.data);
				handleResponse(e.data)
			}
		}
	} catch (error) {
		console.log("Record initialization failed, fail reason: " + error)
	}
}

function startRecording(event) {
	// 处理空格键或鼠标按下
	if (event.type === 'mousedown' || (event.type === 'keydown' && event.key === ' ' && !event.repeat)) {
		// 如果正在播放音频，先停止播放
		if (currentPlayingIndex.value !== null) {
			stopCurrentAudio();
		}
		isRecording.value = true;
		mediaRecorder.start();
		startTime = performance.now();
	}
}

function stopRecording(event) {
	// 处理空格键或鼠标释放
	if (event.type === 'mouseup' || (event.type === 'keyup' && event.key === ' ')) {
		isRecording.value = false;
		mediaRecorder.stop();
		endTime = performance.now();
	}
}

function addMessage(role, duration, data) {
	const newIndex = messages.value.length;
	messages.value.push({
		"role": role,
		"duration": duration,
		"data": data
	});
	// 添加消息后自动滚动到底部
	scrollToBottom();
	// 如果是AI消息，自动播放
	if (role === 'assistant') {
		nextTick(() => {
			handlePlayAudio(newIndex);
		});
	}
}

// 设置AI消息的ref
function setAIMessageRef(el, index) {
	if (el) {
		aiMessageRefs.value[index] = el;
	}
}

// 聚焦到最新的AI消息
function focusLatestAIMessage(index) {
	const aiMessageComponent = aiMessageRefs.value[index];
	if (aiMessageComponent && aiMessageComponent.$el) {
		const bubble = aiMessageComponent.$el.querySelector('.voice-bubble');
		if (bubble) {
			bubble.tabIndex = 3;
			bubble.focus();
		}
	}
}

function scrollToBottom() {
	nextTick(() => {
		if (chatAreaRef.value) {
			chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight;
		}
	});
}

function createMessage(msgType, data, requestId = null) {
	const messageId = generateMessageId();
	const timestamp = new Date().toISOString();
	const message = {
		message_id: messageId,
		timestamp: timestamp,
		type: msgType,
		data: data
	};

	if (requestId) {
		message.request_id = requestId;
	}

	return message;
}

function generateMessageId() {
	messageCounter += 1;
	return 'msg_' + String(messageCounter).padStart(3, '0');
}

function sendMessage(message) {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		throw new Error('Not connected to WebSocket')
	}
	try {
		const json = JSON.stringify(message)
		ws.send(json)
	} catch (err) {
		console.error('sendMessage failed:', err)
	}
}

// 将音频 Blob 转换为 WAV 格式
async function convertToWav(audioBlob) {
	console.log('[convertToWav] Converting audio to WAV format...');
	console.log('[convertToWav] Input blob size:', audioBlob.size, 'type:', audioBlob.type);
	
	try {
		// 1. 读取音频数据
		const arrayBuffer = await audioBlob.arrayBuffer();
		
		// 2. 使用 AudioContext 解码音频
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		console.log('[convertToWav] Decoded audio:', {
			duration: audioBuffer.duration,
			sampleRate: audioBuffer.sampleRate,
			numberOfChannels: audioBuffer.numberOfChannels,
			length: audioBuffer.length
		});
		
		// 3. 提取音频数据 (转换为单声道)
		const numberOfChannels = 1; // 转为单声道
		const sampleRate = audioBuffer.sampleRate;
		const length = audioBuffer.length;
		
		// 获取音频数据 (如果是多声道,混合成单声道)
		let audioData;
		if (audioBuffer.numberOfChannels === 1) {
			audioData = audioBuffer.getChannelData(0);
		} else {
			// 混合多声道为单声道
			audioData = new Float32Array(length);
			for (let i = 0; i < length; i++) {
				let sum = 0;
				for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
					sum += audioBuffer.getChannelData(channel)[i];
				}
				audioData[i] = sum / audioBuffer.numberOfChannels;
			}
		}
		
		// 4. 转换为 16 位 PCM
		const pcmData = new Int16Array(audioData.length);
		for (let i = 0; i < audioData.length; i++) {
			// 将浮点数 [-1, 1] 转换为 16 位整数 [-32768, 32767]
			const s = Math.max(-1, Math.min(1, audioData[i]));
			pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
		}
		
		// 5. 添加 WAV 文件头
		const wavData = addWavHeader(new Uint8Array(pcmData.buffer), sampleRate, numberOfChannels, 16);
		const wavBlob = new Blob([wavData], { type: 'audio/wav' });
		
		console.log('[convertToWav] ✓ Conversion complete');
		console.log('[convertToWav] Output WAV size:', wavBlob.size, 'bytes');
		
		return wavBlob;
	} catch (error) {
		console.error('[convertToWav] ❌ Conversion failed:', error);
		// 如果转换失败,返回原始 blob
		console.warn('[convertToWav] Returning original blob');
		return audioBlob;
	}
}

async function sendAudio(audioBlob, requestId) {
	console.log('\n┌─────────────────────────────────────────────────┐');
	console.log('│ [sendAudio] START                               │');
	console.log('└─────────────────────────────────────────────────┘');
	console.log('[sendAudio] Original blob size:', audioBlob.size, 'type:', audioBlob.type);
	console.log('[sendAudio] Request ID:', requestId);
	
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		console.error('[sendAudio] ❌ WebSocket not connected!');
		throw new Error('Not connected to WebSocket');
	}
	console.log('[sendAudio] ✓ WebSocket is OPEN');

	// 转换为 WAV 格式
	console.log('[sendAudio] → Converting to WAV format...');
	const wavBlob = await convertToWav(audioBlob);
	console.log('[sendAudio] ✓ Converted to WAV, size:', wavBlob.size);

	const audioData = new Uint8Array(await wavBlob.arrayBuffer());
	const fileSize = audioData.length;
	const filename = 'recording.wav';
	const fileFormat = 'wav';
	
	// Convert to base64
	const audioBase64 = uint8ToBase64(audioData);
	
	// Calculate estimated message size
	const testMessage = {
		input_type: "audio",
		content: audioBase64,
		metadata: { 
			filename: filename, 
			size: fileSize, 
			format: fileFormat 
		}
	};
	const estimatedMessageSize = JSON.stringify(testMessage).length + 200; // Account for message wrapper
	
	console.log('[sendAudio] File size:', fileSize, 'bytes');
	console.log('[sendAudio] Estimated message size:', estimatedMessageSize, 'bytes');
	
	// Check if file needs chunking (800KB threshold, leave buffer for 1MB limit)
	if (estimatedMessageSize > 800000) {
		console.log('[sendAudio] ⚠ Large file detected, using chunking...');
		await sendAudioChunked(audioData, filename, fileFormat, requestId);
	} else {
		console.log('[sendAudio] → Sending as single message...');
		// Send as single message
		const audioMsg = createMessage("request", {
			input_type: "audio",
			content: audioBase64,
			metadata: {
				filename: filename,
				size: fileSize,
				format: fileFormat,
				is_final: true
			}
		}, requestId);
		
		await sendMessage(audioMsg);
		console.log(`[sendAudio] ✓ Sent audio file: ${filename} (${fileSize} bytes)`);
		
		// Wait for acknowledgment
		console.log('[sendAudio] ⏳ Waiting for ACK...');
		try {
			const response = await receiveMessage();
			console.log('[sendAudio] ← Received ACK response:', response);
			
			if (response.type === "ack" && response.data?.status?.includes("input_received")) {
				console.log('[sendAudio] ✓ Audio input acknowledged');
			} else {
				console.log('[sendAudio] ⚠ Unexpected response:', response);
			}
		} catch (err) {
			console.error('[sendAudio] ❌ Failed to receive acknowledgment:', err);
			throw err;
		}
	}
	
	console.log('┌─────────────────────────────────────────────────┐');
	console.log('│ [sendAudio] COMPLETED                           │');
	console.log('└─────────────────────────────────────────────────┘\n');
}

async function sendAudioChunked(audioData, filename, fileFormat, requestId, chunkSize = 500000) {
	console.log('[sendAudioChunked] Starting chunked send...');

	const totalSize = audioData.length;
	const totalChunks = Math.ceil(totalSize / chunkSize);
	
	console.log(`[sendAudioChunked] Total chunks: ${totalChunks}, chunk size: ${chunkSize}`);
	
	for (let i = 0; i < totalChunks; i++) {
		const start = i * chunkSize;
		const end = Math.min(start + chunkSize, totalSize);
		const chunk = audioData.subarray(start, end);
		const chunkBase64 = uint8ToBase64(chunk);
		const isFinal = (i === totalChunks - 1);
		
		const chunkMsg = createMessage("request", {
			input_type: "audio",
			content: chunkBase64,
			metadata: {
				filename: filename,
				size: totalSize,        // ← 添加总大小
				format: fileFormat,
				is_final: isFinal,
				chunk_index: i,
				total_chunks: totalChunks
			}
		}, requestId);
		
		await sendMessage(chunkMsg);
		console.log(`✓ Sent chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)`);
		
		// Wait for acknowledgment of EACH chunk (not just the last one)
		try {
			const response = await receiveMessage();
			console.log(`[sendAudioChunked] Chunk ${i + 1} response:`, response);
			
			if (response.type === "ack" && response.data?.status?.includes("input_received")) {
				console.log(`✓ Chunk ${i + 1} acknowledged`);
			} else {
				console.log(`⚠ Unexpected response for chunk ${i + 1}:`, response);
			}
		} catch (err) {
			console.error(`[sendAudioChunked] Failed to receive acknowledgment for chunk ${i + 1}:`, err);
		}
	}
	
	console.log(`✓ Completed sending ${totalChunks} chunks (${totalSize} bytes total)`);
}

function uint8ToBase64(uint8Array) {
	let binary = '';
	const len = uint8Array.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(uint8Array[i]);
	}
	return btoa(binary);
}

// 为原始 PCM 数据添加 WAV 文件头
function addWavHeader(pcmData, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
	const dataLength = pcmData.length;
	const buffer = new ArrayBuffer(44 + dataLength);
	const view = new DataView(buffer);
	
	// RIFF 标识符
	writeString(view, 0, 'RIFF');
	// 文件大小
	view.setUint32(4, 36 + dataLength, true);
	// WAVE 标识符
	writeString(view, 8, 'WAVE');
	// fmt 子块
	writeString(view, 12, 'fmt ');
	// fmt 子块大小
	view.setUint32(16, 16, true);
	// 音频格式 (1 = PCM)
	view.setUint16(20, 1, true);
	// 声道数
	view.setUint16(22, numChannels, true);
	// 采样率
	view.setUint32(24, sampleRate, true);
	// 字节率 (采样率 * 声道数 * 位深度/8)
	view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
	// 块对齐 (声道数 * 位深度/8)
	view.setUint16(32, numChannels * (bitsPerSample / 8), true);
	// 位深度
	view.setUint16(34, bitsPerSample, true);
	// data 子块
	writeString(view, 36, 'data');
	// data 子块大小
	view.setUint32(40, dataLength, true);
	
	// 写入 PCM 数据
	const pcmView = new Uint8Array(buffer, 44);
	pcmView.set(pcmData);
	
	return new Uint8Array(buffer);
}

function writeString(view, offset, string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

async function getAudioDuration(blob, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
	console.log('[getAudioDuration] Input params:', { 
		blobSize: blob.size, 
		blobType: blob.type,
		sampleRate, 
		channels, 
		bitsPerSample 
	});
	
	// 检查 blob 是否为空
	if (!blob || blob.size === 0) {
		console.error('[getAudioDuration] ❌ Empty blob!');
		return 0;
	}
	
	try {
		const arrayBuffer = await blob.arrayBuffer();
		console.log('[getAudioDuration] ArrayBuffer size:', arrayBuffer.byteLength);
		
		// 再次检查数据是否为空
		if (arrayBuffer.byteLength === 0) {
			console.error('[getAudioDuration] ❌ Empty arrayBuffer!');
			return 0;
		}
		
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		console.log('[getAudioDuration] ✓ Successfully decoded, duration:', audioBuffer.duration);
		console.log('[getAudioDuration] AudioBuffer info:', {
			duration: audioBuffer.duration,
			length: audioBuffer.length,
			sampleRate: audioBuffer.sampleRate,
			numberOfChannels: audioBuffer.numberOfChannels
		});
		
		// 如果解码成功但 duration 为 0，使用估算方式
		if (audioBuffer.duration === 0 && arrayBuffer.byteLength > 44) {
			const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
			const estimatedDuration = (arrayBuffer.byteLength - 44) / bytesPerSecond; // 减去 WAV 头的 44 字节
			console.log('[getAudioDuration] ⚠ Duration is 0, using estimated:', estimatedDuration);
			return estimatedDuration;
		}
		
		return audioBuffer.duration;
	} catch (error) {
		console.warn('[getAudioDuration] Failed to decode audio, trying with WAV header...', error);
		
		// 如果解码失败,尝试添加 WAV 头 (使用传入的音频参数)
		try {
			const arrayBuffer = await blob.arrayBuffer();
			const pcmData = new Uint8Array(arrayBuffer);
			
			// 添加 WAV 文件头 (使用真实的音频参数)
			const wavData = addWavHeader(pcmData, sampleRate, channels, bitsPerSample);
			const wavBlob = new Blob([wavData], { type: 'audio/wav' });
			const wavBuffer = await wavBlob.arrayBuffer();
			const audioBuffer = await audioContext.decodeAudioData(wavBuffer);
			
			console.log('[getAudioDuration] ✓ Successfully decoded with WAV header, duration:', audioBuffer.duration);
			console.log('[getAudioDuration] AudioBuffer info:', {
				duration: audioBuffer.duration,
				length: audioBuffer.length,
				sampleRate: audioBuffer.sampleRate,
				numberOfChannels: audioBuffer.numberOfChannels
			});
			return audioBuffer.duration;
		} catch (retryError) {
			console.error('[getAudioDuration] ❌ Failed to decode even with WAV header:', retryError);
			// 返回一个估算的时长 (基于数据大小)
			// 字节率 = 采样率 * 声道数 * (位深度/8)
			const arrayBuffer = await blob.arrayBuffer();
			const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
			const estimatedDuration = arrayBuffer.byteLength / bytesPerSecond;
			console.log('[getAudioDuration] Using estimated duration:', estimatedDuration, 'from', arrayBuffer.byteLength, 'bytes at', bytesPerSecond, 'bytes/sec');
			return estimatedDuration;
		}
	}
}

// 停止当前正在播放的音频
function stopCurrentAudio() {
	if (playingSource) {
		try {
			playingSource.stop();
		} catch (err) {
			console.log('[stopCurrentAudio] Audio already stopped');
		}
		playingSource = null;
	}
	currentPlayingIndex.value = null;
}

// 处理音频播放请求
async function handlePlayAudio(index) {
	console.log('[handlePlayAudio] Clicked index:', index, 'Currently playing:', currentPlayingIndex.value);
	
	// 如果点击的是正在播放的音频,则停止播放
	if (currentPlayingIndex.value === index) {
		console.log('[handlePlayAudio] Stopping current audio');
		stopCurrentAudio();
		return;
	}
	
	// 停止当前正在播放的音频(如果有)
	if (currentPlayingIndex.value !== null) {
		console.log('[handlePlayAudio] Stopping previous audio:', currentPlayingIndex.value);
		stopCurrentAudio();
	}
	
	// 播放新的音频
	console.log('[handlePlayAudio] Starting new audio:', index);
	currentPlayingIndex.value = index;
	
	try {
		const blob = messages.value[index].data;
		const arrayBuffer = await blob.arrayBuffer();
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		
		console.log('[handlePlayAudio] Decoded audio for playback:', {
			duration: audioBuffer.duration,
			length: audioBuffer.length,
			sampleRate: audioBuffer.sampleRate,
			numberOfChannels: audioBuffer.numberOfChannels
		});
		
		const source = audioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(audioContext.destination);
		
		// 播放结束时清除状态
		source.onended = () => {
			console.log('[handlePlayAudio] Audio playback ended');
			if (currentPlayingIndex.value === index) {
				currentPlayingIndex.value = null;
				playingSource = null;
			}
		};
		
		playingSource = source;
		source.start();
		console.log('[handlePlayAudio] ✓ Audio started');
	} catch (err) {
		console.error('[handlePlayAudio] ❌ Error playing audio:', err);
		currentPlayingIndex.value = null;
		playingSource = null;
	}
}

function playAudioBlob(index) {
	const blob = messages.value[index].data;
	blob.arrayBuffer().then(buf => {
		audioContext.decodeAudioData(buf).then(decoded => {
			const src = audioContext.createBufferSource()
			playingSource = src
			src.buffer = decoded
			src.connect(audioContext.destination)
			src.start()
		}).catch(err => {
			console.log("Audio processing error: " + error)
		})
	})
}

async function sendImageMessage(requestId) {
	console.log('\n┌─────────────────────────────────────────────────┐');
	console.log('│ [sendImageMessage] START                        │');
	console.log('└─────────────────────────────────────────────────┘');
	console.log('[sendImageMessage] Request ID:', requestId);
	
	if (!targetImage.value) {
		console.warn('[sendImageMessage] ⚠ No image data available');
		return;
	}

	try {
		// 1. 从 targetImage 提取 base64 数据 (已经是 data:image/xxx;base64,... 格式)
		const dataUrlMatch = targetImage.value.match(/^data:image\/(\w+);base64,(.+)$/);
		if (!dataUrlMatch) {
			throw new Error('Invalid image data format');
		}
		
		const fileFormat = dataUrlMatch[1].toLowerCase();
		const imageBase64 = dataUrlMatch[2];
		
		// 2. 计算文件大小（base64 解码后的字节数）
		const fileSize = Math.floor(imageBase64.length * 3 / 4);
		console.log('[sendImageMessage] ✓ Image data extracted:', fileSize, 'bytes');

		// 3. 生成文件名
		const filename = `image.${fileFormat === 'jpeg' ? 'jpg' : fileFormat}`;

		// 4. MIME 类型映射
		const mimeTypeMap = {
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			png: 'image/png',
			gif: 'image/gif',
			bmp: 'image/bmp',
			webp: 'image/webp'
		};
		const mimeType = mimeTypeMap[fileFormat] || `image/${fileFormat}`;

		console.log('[sendImageMessage] File info:', {
			filename,
			size: fileSize,
			format: fileFormat,
			mimeType
		});

		// 5. 构造消息
		const imageMsg = createMessage("request", {
			input_type: "image",
			content: imageBase64,
			metadata: {
				filename,
				size: fileSize,
				format: fileFormat,
				mime_type: mimeType
			}
		}, requestId);  // ← 传递 requestId

		// 6. 发送消息
		console.log('[sendImageMessage] → Sending image message...');
		await sendMessage(imageMsg);
		console.log(`[sendImageMessage] ✓ Sent image file: ${filename} (${fileSize} bytes)`);
		
		// 7. 等待 ACK 确认
		console.log('[sendImageMessage] ⏳ Waiting for ACK...');
		try {
			const ackResponse = await receiveMessage();
			console.log('[sendImageMessage] ← Received ACK response:', ackResponse);
			
			if (ackResponse.type === "ack" && ackResponse.data?.status?.includes("input_received")) {
				console.log('[sendImageMessage] ✓ Image input acknowledged');
			} else {
				console.log('[sendImageMessage] ⚠ Unexpected response:', ackResponse);
			}
		} catch (err) {
			console.error('[sendImageMessage] ❌ Failed to receive acknowledgment:', err);
			throw err;
		}
		
		console.log('┌─────────────────────────────────────────────────┐');
		console.log('│ [sendImageMessage] COMPLETED                    │');
		console.log('└─────────────────────────────────────────────────┘\n');
	} catch (err) {
		console.error('[sendImageMessage] ❌ Error:', err);
		throw err;
	}
}

async function completeInput(requestId) {
	console.log('[completeInput] Creating control message...');
	const completeMsg = createMessage("control", {
		action: "input_complete",
		request_id: requestId
	}, requestId)
	
	console.log('[completeInput] Message to send:', JSON.stringify(completeMsg, null, 2));
	await sendMessage(completeMsg)
	console.log('[completeInput] Sent with request_id:', requestId);
	
	// Wait for processing acknowledgment
	try {
		console.log('[completeInput] Waiting for acknowledgment...');
		const response = await receiveMessage();
		console.log('[completeInput] Received response:', JSON.stringify(response, null, 2));
		
		if (response.type === "ack" && response.data?.status?.includes("inputs_received")) {
			console.log('✓ Processing started');
		} else {
			console.log('⚠ Unexpected response:', response);
		}
	} catch (err) {
		console.error('[completeInput] Failed to receive acknowledgment:', err);
	}
}

async function receiveMessage() {
	console.log('[receiveMessage] Waiting for message...');
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		console.error('[receiveMessage] WebSocket not connected');
		throw new Error("Not connected to WebSocket");
	}

	return new Promise((resolve, reject) => {
		const messageHandler = (event) => {
			try {
				const message = JSON.parse(event.data);
				console.log('[receiveMessage] Received:', {
					type: message.type,
					id: message.message_id,
					output_type: message.data?.output_type,
					is_final: message.data?.metadata?.is_final
				});
				resolve(message);
			} catch (err) {
				console.error('[receiveMessage] Parse error:', err);
				reject(err);
			}
		};

		ws.addEventListener('message', messageHandler, { once: true });
		ws.addEventListener('error', (err) => {
			console.error('[receiveMessage] WebSocket error:', err);
			reject(err);
		}, { once: true });
	});
}

async function wait_for_responses(requestId) {
	console.log('[wait_for_responses] Starting, requestId:', requestId);
	console.log('[wait_for_responses] WebSocket state:', ws?.readyState);
	
	let textResponse = null;
	let audioResponse = null;
	let audioChunks = [];
	let audioFormat = "wav";
	let audioSampleRate = 24000; // 默认采样率
	let audioChannels = 1; // 默认声道数
	let audioBitsPerSample = 16; // 默认位深度
	let loopCount = 0;

	while (true) {
		loopCount++;
		console.log(`[wait_for_responses] Loop #${loopCount}`);
		
		try {
			const response = await Promise.race([
				receiveMessage(),
				new Promise((_, reject) => 
				setTimeout(() => reject(new Error('Timeout')), 60000)
				)
			]);

			console.log('[wait_for_responses] Response type:', response.type);

			if (response.type === "response") {
				const data = response.data || {};
				const outputType = data.output_type;
				console.log('[wait_for_responses] Output type:', outputType);

				if (outputType === "text") {
					textResponse = data.content || "";
					console.log(`[wait_for_responses] 📝 Text response: ${textResponse.substring(0, 50)}...`);
				} else if (outputType === "audio") {
					const audioContent = data.content || "";
					const isFinal = data.metadata?.is_final || false;
					audioFormat = data.metadata?.format || "wav";
					
					// 从 metadata 中获取音频参数
					if (data.metadata?.sample_rate) {
						audioSampleRate = data.metadata.sample_rate;
					}
					if (data.metadata?.channels) {
						audioChannels = data.metadata.channels;
					}
					if (data.metadata?.bits_per_sample) {
						audioBitsPerSample = data.metadata.bits_per_sample;
					}

					console.log('[wait_for_responses] 🔊 Audio chunk received:', {
						format: audioFormat,
						size: audioContent.length,
						isFinal: isFinal,
						chunkCount: audioChunks.length + 1,
						sampleRate: audioSampleRate,
						channels: audioChannels,
						bitsPerSample: audioBitsPerSample
					});

					const byteArray = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
					audioChunks.push(byteArray);

					if (isFinal) {
						console.log('[wait_for_responses] Final audio chunk, merging...');
						audioResponse = audioContent;
						
						const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
						console.log('[wait_for_responses] Total audio size:', totalLength);
						console.log('[wait_for_responses] Audio format:', audioFormat);
						
						let offset = 0;
						const mergedArray = new Uint8Array(totalLength);
						for (const chunk of audioChunks) {
							mergedArray.set(chunk, offset);
							offset += chunk.length;
						}
						
						// 检查是否需要添加 WAV 头
						let finalAudioData = mergedArray;
						let mimeType = `audio/${audioFormat}`;
						
						// 检查是否已经有 WAV 文件头 (检查前4个字节是否为 "RIFF")
						const hasWavHeader = mergedArray.length >= 4 && 
							mergedArray[0] === 0x52 && // 'R'
							mergedArray[1] === 0x49 && // 'I'
							mergedArray[2] === 0x46 && // 'F'
							mergedArray[3] === 0x46;   // 'F'
						
						console.log('[wait_for_responses] Has WAV header:', hasWavHeader);
						
						// 如果已经有 WAV 头，从头部读取真实的音频参数
						if (hasWavHeader) {
							const view = new DataView(mergedArray.buffer, mergedArray.byteOffset);
							const extractedChannels = view.getUint16(22, true);
							const extractedSampleRate = view.getUint32(24, true);
							const extractedBitsPerSample = view.getUint16(34, true);
							
							console.log('[wait_for_responses] ℹ Found existing WAV header, extracted params:', {
								sampleRate: extractedSampleRate,
								channels: extractedChannels,
								bitsPerSample: extractedBitsPerSample
							});
							
							// 使用从 WAV 头提取的参数（更准确）
							audioSampleRate = extractedSampleRate;
							audioChannels = extractedChannels;
							audioBitsPerSample = extractedBitsPerSample;
						}
						
						if (audioFormat === 'wav' && !hasWavHeader) {
							console.log('[wait_for_responses] ⚠ WAV format but no header detected, adding WAV header...');
							console.log('[wait_for_responses] Using audio params:', {
								sampleRate: audioSampleRate,
								channels: audioChannels,
								bitsPerSample: audioBitsPerSample
							});
							console.log('[wait_for_responses] Input data size:', mergedArray.length);
							// 使用从服务器获取的真实参数添加 WAV 文件头
							finalAudioData = addWavHeader(mergedArray, audioSampleRate, audioChannels, audioBitsPerSample);
							mimeType = 'audio/wav';
							console.log('[wait_for_responses] ✓ WAV header added, new size:', finalAudioData.length, 'diff:', finalAudioData.length - mergedArray.length);
						} else {
							console.log('[wait_for_responses] ℹ Using original audio data without adding header');
						}
						
						const completeAudioBlob = new Blob([finalAudioData], { type: mimeType });
						console.log('[wait_for_responses] Audio blob created, calculating duration...');
						console.log('[wait_for_responses] Blob size:', completeAudioBlob.size, 'MIME type:', mimeType);
						
						// 计算理论时长（用于对比）
						const bytesPerSecond = audioSampleRate * audioChannels * (audioBitsPerSample / 8);
						const theoreticalDuration = (finalAudioData.length - 44) / bytesPerSecond; // 减去 WAV 头
						console.log('[wait_for_responses] Theoretical duration:', theoreticalDuration.toFixed(2), 's');
						
						const duration = await getAudioDuration(completeAudioBlob, audioSampleRate, audioChannels, audioBitsPerSample);
						console.log('[wait_for_responses] Actual duration:', duration, 's');
						
						// 将秒转换为毫秒
						const durationMs = duration * 1000;
						console.log('[wait_for_responses] Duration in ms:', durationMs);
						
						addMessage("assistant", durationMs, completeAudioBlob);
						console.log(`[wait_for_responses] ✓ Complete: ${audioChunks.length} chunks, ${duration.toFixed(2)}s (${durationMs.toFixed(0)}ms)`);
						
						break;
					}
				}
			} else if (response.type === "error") {
				const errorData = response.data || {};
				console.error('[wait_for_responses] ✗ Error response:', errorData);
				break;
			}
		} catch (err) {
			if (err.message === 'Timeout') {
				console.warn("\n⚠ Timeout waiting for response");
			} else {
				console.error(`\n✗ Error receiving response:`, err);
			}
			break;
		}
	}

	return { textResponse, audioResponse };
}

async function handleResponse(audioBlob) {
	try {
		console.log('═══════════════════════════════════════════════════');
		console.log('[handleResponse] 🚀 START');
		console.log('[handleResponse] Received audio blob:', audioBlob.size, 'bytes');
		
		// Generate ONE requestId for the entire workflow
		const requestId = `req_${Date.now()}`;
		console.log('[handleResponse] Generated request ID:', requestId);
		console.log('═══════════════════════════════════════════════════');
		
		// Send audio with the requestId
		console.log('\n[handleResponse] ▶ STEP 1a: Sending audio...');
		await sendAudio(audioBlob, requestId);
		console.log('[handleResponse] ✓ STEP 1a completed');
		
		// Send image with the SAME requestId
		console.log('\n[handleResponse] ▶ STEP 1b: Sending image...');
		await sendImageMessage(requestId);
		console.log('[handleResponse] ✓ STEP 1b completed');
		
		// Complete input with the SAME requestId - MUST wait for completion!
		console.log('\n[handleResponse] ▶ STEP 2: Completing input...');
		await completeInput(requestId);
		console.log('[handleResponse] ✓ STEP 2 completed');
		
		// Wait for responses with the SAME requestId
		console.log('\n[handleResponse] ▶ STEP 3: Waiting for responses...');
		await wait_for_responses(requestId);
		console.log('[handleResponse] ✓ STEP 3 completed');
		
		console.log('\n═══════════════════════════════════════════════════');
		console.log('[handleResponse] 🎉 ALL STEPS COMPLETED');
		console.log('═══════════════════════════════════════════════════\n');
	} catch (err) {
		console.error('═══════════════════════════════════════════════════');
		console.error('[handleResponse] ❌ FAILED at some step');
		console.error('[handleResponse] Error:', err);
		console.error('═══════════════════════════════════════════════════');
	}
}

onMounted(async () => {
	audioContext = new (window.AudioContext || window.webkitAudioContext)();
	await parseHashImage();

	// Connect to WebSocket and wait for connection to be ready
	try {
		await connectWS();
		console.log('[onMounted] ✓ WebSocket connection established');
	} catch (error) {
		console.error('[onMounted] ❌ WebSocket connection failed:', error);
		connectionError.value = connectionError.value || 'Failed to connect. Please refresh the page.';
	}

	initRecorder();

	// Auto-focus on talk button for accessibility (first in tab order)
	nextTick(() => {
		talkButtonRef.value?.focus();
	});
})

onUnmounted(() => {
	stopCurrentAudio(); 
	ws?.close(); 
	if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
	mediaStream?.getTracks().forEach(t => t.stop()); 
	audioContext?.close();
})
</script>

<style scoped>

.container {
	width: 100vw;
	height: 100vh;
	display: flex;
	flex-direction: column;
	align-items: center;
	overflow: hidden; /* 防止整个页面滚动 */
	position: fixed; /* 固定在视口 */
	top: 0;
	left: 0;
}

/* 页面指示器 - 在TopNav中显示 */
.page-indicator {
	font-size: 15px;
	font-weight: 600;
	color: #5f6368;
}

/* 返回按钮 - 左上角箭头 */
.back-btn-corner {
	position: absolute;
	top: 10px;
	left: 10px;
	z-index: 10;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	padding: 0;
	background: rgba(255, 255, 255, 0.15);
	color: white;
	border: none;
	border-radius: 50%;
	cursor: pointer;
	transition: all 0.3s ease;
}

.back-btn-corner:hover {
	background: rgba(255, 255, 255, 0.25);
	transform: scale(1.1);
}

.back-btn-corner:focus {
	outline: 2px solid white;
	outline-offset: 2px;
}

.content {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 50%;
	height: calc(100vh - 64px); /* 减去顶部导航栏高度 */
	margin-top: 64px; /* 为顶部导航栏留出空间 */
	background-color: black;
	overflow: hidden; /* 防止内容溢出 */
}

/* 固定的图片区域 */
.target-image {
	flex-shrink: 0; /* 防止被压缩 */
	margin-top: 2vh;
	margin-bottom: 0;
	padding-bottom: 2vh;
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	background-color: black;
	border-bottom: 1px solid #333; /* 添加分隔线 */
}

.target-image img {
	max-height: 25vh; /* 图片最大高度 */
	max-width: 70%;
	width: auto;
	height: auto;
	object-fit: contain;
}

/* 可滚动的聊天区域 */
.chat-area {
	width: 100%;
	flex: 1; /* 占据剩余空间 */
	overflow-y: auto; /* 启用垂直滚动 */
	overflow-x: hidden; /* 禁止横向滚动 */
	padding: 20px 10px; /* 添加上下内边距 */
	box-sizing: border-box;
	position: relative;
}

/* 自定义滚动条样式（可选，美化滚动条） */
.chat-area::-webkit-scrollbar {
	width: 8px;
}

.chat-area::-webkit-scrollbar-track {
	background: #1a1a1a;
}

.chat-area::-webkit-scrollbar-thumb {
	background: #444;
	border-radius: 4px;
}

.chat-area::-webkit-scrollbar-thumb:hover {
	background: #666;
}

.control-area {
	width: 100%;
	height: 20%; /* 占据 20% 高度 */
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex-shrink: 0; /* 防止被压缩 */
	border-top: 1px solid #333; /* 添加分隔线（可选） */
}

.connection-error {
	color: #ff6b6b;
	font-size: 14px;
	margin-bottom: 10px;
	text-align: center;
	padding: 8px 16px;
	background-color: rgba(255, 107, 107, 0.1);
	border-radius: 6px;
	border: 1px solid rgba(255, 107, 107, 0.3);
}

.talk-button {
	padding: 15px 40px;
	font-size: 16px;
	font-weight: 500;
	border-radius: 8px;
	border: 2px solid #646cff;
	background-color: #1a1a1a;
	color: white;
	cursor: pointer;
	transition: all 0.3s ease;
	user-select: none; /* 防止文字被选中 */
}

.talk-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
	border-color: #444;
	background-color: #0a0a0a;
}

.talk-button:not(:disabled):hover {
	background-color: #2a2a2a;
	border-color: #747bff;
}

.talk-button:focus {
	outline: 2px solid #646cff;
	outline-offset: 2px;
}

/* 按下时的淡蓝色样式 */
.talk-button.is-recording {
	background-color: #87CEEB; /* 淡蓝色 (Sky Blue) */
	border-color: #4682B4; /* 深一点的蓝色边框 */
	color: #1a1a1a; /* 深色文字以提高对比度 */
	transform: scale(0.98); /* 轻微缩小效果 */
}

/* 也可以使用 :active 伪类作为备用 */
.talk-button:active {
	transform: scale(0.98);
}

/* AI 描述区域样式 */
.ai-description-box {
	margin: 0 auto 20px auto;
	padding: 16px 18px;
	max-width: 80%;
	background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
	border-left: 5px solid #0ea5e9;
	border-radius: 10px;
	box-shadow: 0 3px 12px rgba(14, 165, 233, 0.2);
}

.ai-description-box .ai-badge {
	display: inline-block;
	padding: 6px 14px;
	background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
	color: white;
	border-radius: 20px;
	font-size: 0.85rem;
	font-weight: 700;
	margin-bottom: 10px;
	box-shadow: 0 2px 6px rgba(14, 165, 233, 0.4);
}

.ai-description-text {
	color: #0c4a6e;
	font-size: 0.95rem;
	line-height: 1.7;
	margin: 0;
	word-wrap: break-word;
}

/* ============= 移动端适配 ============= */
@media (max-width: 768px) {
	.container {
		padding: 8px;
		height: 100vh;
		height: 100dvh; /* 动态视口高度，适配移动端地址栏 */
	}

	.content {
		border-radius: 12px;
	}

	.target-image {
		height: 20vh; /* 移动端减少图片区域高度 */
		padding: 8px;
	}

	.target-image img {
		max-height: 18vh;
		max-width: 85%;
	}

	.chat-area {
		padding: 12px 8px;
		font-size: 0.9rem;
	}

	.control-area {
		height: 15vh; /* 移动端减少控制区域高度 */
		padding: 8px;
	}

	.talk-button {
		font-size: 1rem;
		padding: 12px 24px;
		min-width: 140px;
		min-height: 44px; /* 移动端推荐的最小点击区域 */
	}

	.ai-description-box {
		margin-bottom: 12px;
		padding: 12px;
	}

	.ai-badge {
		font-size: 0.8rem;
		padding: 4px 10px;
	}

	.ai-description-text {
		font-size: 0.9rem;
		line-height: 1.6;
	}
}

@media (max-width: 480px) {
	.container {
		padding: 4px;
	}

	.target-image {
		height: 18vh;
		padding: 4px;
	}

	.target-image img {
		max-height: 16vh;
		max-width: 90%;
	}

	.chat-area {
		padding: 8px 4px;
		font-size: 0.85rem;
	}

	.control-area {
		height: 12vh;
		padding: 4px;
	}

	.talk-button {
		font-size: 0.9rem;
		padding: 10px 20px;
		min-width: 120px;
		min-height: 40px;
	}

	.ai-description-box {
		margin-bottom: 8px;
		padding: 8px;
	}

	.ai-badge {
		font-size: 0.75rem;
		padding: 3px 8px;
	}

	.ai-description-text {
		font-size: 0.85rem;
		line-height: 1.5;
	}
}
</style>
