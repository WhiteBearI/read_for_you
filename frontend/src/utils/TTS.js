/**
 * TTS.js - Text-to-Speech Utility
 * 将文本转换为语音音频
 */

import { TTSUrl } from '../constants.js';
import { addLanguageParam } from './i18n.js';

/**
 * 将文本转换为语音音频
 * @param {string} text - 要转换的文本内容
 * @param {string} [language='en-US'] - 语言代码
 * @param {number} [timeout=30000] - 请求超时时间（毫秒），默认30秒
 * @returns {Promise<Blob>} 返回音频 Blob 对象
 */
export async function textToSpeech(text, language = 'en-US', timeout = 30000) {
	const controller = new AbortController();
    const ttsUrlWithLang = addLanguageParam(TTSUrl);
    const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(ttsUrlWithLang, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				text: text,
				language: language
			}),
			credentials: 'include',
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(`TTS API request failed: ${response.status}`);
		}

		// 调试：打印响应头
		// const contentType = response.headers.get('content-type');
		// console.log(`📦 TTS API response - status: ${response.status}, content-type: ${contentType}`);

		const blob = await response.blob();

		// 检查 blob 大小（空音频也是有效的，表示静默）
		// if (blob.size === 0) {
		// 	console.log('🔇 TTS returned empty blob (size=0), treating as silence');
		// } else {
		// 	console.log(`📦 TTS blob received - size: ${blob.size} bytes, type: ${blob.type}`);
		// }

		// console.log(`📦 Blob is valid: ${blob instanceof Blob}`);

		return blob;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error.name === 'AbortError') {
			throw new Error(`TTS request timeout after ${timeout}ms`);
		}
		throw error;
	}
}

export default textToSpeech;
