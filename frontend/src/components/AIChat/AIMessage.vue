<template>
	<div class="chat-row left">
		<img src="../../assets/AIIcon.jpg" class="avatar" aria-hidden="true" />
		<div
			class="voice-bubble"
			:class="{ 'is-playing': isPlaying }"
			:style="{ width: bubbleWidth + 'px' }"
			:aria-label="ariaLabel"
			tabindex="3"
			role="button"
			@click="handlePlay"
			@keydown.enter.prevent="handlePlay"
			@keydown.space.prevent="handlePlay"
		>
			<span class="icon" aria-hidden="true">{{ isPlaying ? '⏸️' : '🔊' }}</span>
			<span class="duration" aria-hidden="true">{{ durationSeconds }}s</span>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	seq: { type: Number, required: true },
	duration: { type: Number, required: true },
	isPlaying: { type: Boolean, default: false }
})

const emit = defineEmits(['play'])

const MIN_WIDTH = 60
const MAX_WIDTH = 300
const MAX_DURATION = 10

const durationSeconds = computed(() => Math.max(0, Math.round(props.duration / 1000)))

const ariaLabel = computed(() => {
	const status = props.isPlaying ? 'playing' : 'paused'
	return `Assistant audio ${durationSeconds.value} s, ${status}`
})

const bubbleWidth = computed(() => {
	const ratio = Math.min(durationSeconds.value / MAX_DURATION, 1)
	return Math.round(MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * ratio)
})

function handlePlay() {
	emit('play')
}
</script>

<style scoped>
.chat-row {
	display: flex;
	align-items: center;
	margin: 10px;
}

.chat-row.left {
	justify-content: flex-start;
}

.avatar {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	object-fit: cover;
	margin-right: 8px;
}

.voice-bubble {
	display: flex;
	align-items: center;
	padding: 8px 10px;
	border-radius: 8px;
	background-color: #e1f3fb;
	font-size: 14px;
	cursor: pointer;
	transition: all 0.2s ease;
	user-select: none;
}

.voice-bubble:hover {
	background-color: #d0e9f7;
	transform: scale(1.02);
}

.voice-bubble:active {
	transform: scale(0.98);
}

/* 播放中的样式 */
.voice-bubble.is-playing {
	background-color: #c0dff3;
	animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.8;
	}
}

.icon {
	margin-right: 6px;
	font-size: 16px;
}

.duration {
	font-size: 13px;
}

/* ============= 移动端适配 ============= */
@media (max-width: 768px) {
	.chat-row {
		margin-bottom: 12px;
	}

	.avatar {
		width: 32px;
		height: 32px;
	}

	.voice-bubble {
		max-width: 200px;
		padding: 8px 12px;
		font-size: 14px;
		min-height: 36px;
	}

	.icon {
		font-size: 14px;
		margin-right: 4px;
	}

	.duration {
		font-size: 12px;
	}
}

@media (max-width: 480px) {
	.chat-row {
		margin-bottom: 8px;
	}

	.avatar {
		width: 28px;
		height: 28px;
	}

	.voice-bubble {
		max-width: 160px;
		padding: 6px 10px;
		font-size: 13px;
		min-height: 32px;
	}

	.icon {
		font-size: 13px;
	}

	.duration {
		font-size: 11px;
	}
}
</style>
