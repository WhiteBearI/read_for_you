<template>
	<div class="top-nav">
		<!-- 左侧：Microsoft Logo + 品牌标识 -->
		<div class="brand-section">
			<img
				src="../assets/Microsoft.png"
				alt="Microsoft"
				class="microsoft-logo"
				tabindex="0"
				aria-label="Microsoft"
				role="img"
			/>
			<h1 class="brand-title" tabindex="0" @click="goToHome" @keydown.enter="goToHome" :aria-label="'Read for You, ' + t('clickToReturnHome')">
				Read for You
			</h1>
		</div>

		<!-- 中间：页面特定内容插槽 -->
		<div class="nav-center">
			<slot name="center"></slot>
		</div>

		<!-- 右侧：通用操作区 -->
		<div class="nav-actions">
			<slot name="actions"></slot>

			<!-- 语言选择器（可选显示） -->
			<select v-if="showLanguageSwitcher" v-model="selectedLanguage" @change="onLanguageChange" class="language-dropdown">
				<option value="en">English</option>
				<option value="zh">简体中文</option>
			</select>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useTranslation } from '../utils/i18n.js';

// Props - 控制语言切换器是否显示
const props = defineProps({
	showLanguageSwitcher: {
		type: Boolean,
		default: true  // 默认显示
	}
});

const { t } = useTranslation();
const selectedLanguage = ref('en');

// 初始化语言设置
function initLanguage() {
	const savedLanguage = localStorage.getItem('language');
	if (savedLanguage) {
		selectedLanguage.value = savedLanguage;
	} else {
		selectedLanguage.value = 'en';
		localStorage.setItem('language', 'en');
	}
}

// 语言变更处理
function onLanguageChange() {
	const oldLanguage = localStorage.getItem('language');
	const newLanguage = selectedLanguage.value;

	localStorage.setItem('language', newLanguage);
	console.log('Language changed to:', newLanguage);

	// 触发自定义事件，用于同页面组件监听
	window.dispatchEvent(new CustomEvent('languageChanged', {
		detail: { oldLanguage, newLanguage }
	}));

	// 重新加载页面以应用新语言
	window.location.reload();
}

// 返回首页
function goToHome() {
	window.location.hash = '#/';
}

onMounted(() => {
	initLanguage();
});
</script>

<style scoped>
.top-nav {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 1000;
	background: rgba(255, 255, 255, 0.95);
	backdrop-filter: blur(10px);
	border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
	padding: 16px 32px;
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 24px;
}

/* 品牌区域 - 包含 logo 和标题 */
.brand-section {
	display: flex;
	align-items: center;
	gap: 16px;
	flex-shrink: 0;
}

/* Microsoft Logo */
.microsoft-logo {
	height: 23px;
	width: auto;
	transition: opacity 0.2s ease;
	flex-shrink: 0;
}

.microsoft-logo:hover {
	opacity: 0.8;
}

.microsoft-logo:focus {
	outline: 2px solid #667eea;
	outline-offset: 2px;
	border-radius: 4px;
}

/* 品牌标识 */
.brand-title {
	font-size: 1.5rem;
	font-weight: 700;
	color: #2c3e50;
	margin: 0;
	letter-spacing: 0.5px;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
	cursor: pointer;
	transition: opacity 0.2s ease;
	white-space: nowrap;
	flex-shrink: 0;
}

.brand-title:hover {
	opacity: 0.8;
}

.brand-title:focus {
	outline: 2px solid #667eea;
	outline-offset: 4px;
	border-radius: 4px;
}

/* 中间区域 */
.nav-center {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
}

/* 右侧操作区 */
.nav-actions {
	display: flex;
	align-items: center;
	gap: 16px;
	flex-shrink: 0;
}

/* 语言选择器 */
.language-dropdown {
	padding: 10px 18px;
	font-size: 14px;
	border: 2px solid rgba(102, 126, 234, 0.3);
	border-radius: 10px;
	background: #fff;
	color: #667eea;
	cursor: pointer;
	box-shadow: 0 2px 12px rgba(102, 126, 234, 0.15);
	transition: all 0.3s ease;
	outline: none;
	min-width: 110px;
	font-weight: 600;
	appearance: none;
	background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23667eea' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
	background-repeat: no-repeat;
	background-position: right 12px center;
	padding-right: 36px;
}

.language-dropdown:hover {
	border-color: #667eea;
	background-color: rgba(102, 126, 234, 0.05);
	transform: translateY(-2px);
	box-shadow: 0 4px 20px rgba(102, 126, 234, 0.25);
}

.language-dropdown:focus {
	border-color: #667eea;
	box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
	transform: translateY(-2px);
}

.language-dropdown:active {
	transform: translateY(0);
}

/* 响应式布局 */
@media (max-width: 1024px) {
	.top-nav {
		padding: 14px 24px;
	}

	.brand-section {
		gap: 12px;
	}

	.microsoft-logo {
		height: 20px;
	}

	.brand-title {
		font-size: 1.3rem;
	}

	.language-dropdown {
		padding: 9px 16px;
		padding-right: 34px;
		font-size: 13px;
		min-width: 100px;
	}
}

@media (max-width: 768px) {
	.top-nav {
		padding: 12px 16px;
		gap: 16px;
	}

	.brand-section {
		gap: 10px;
	}

	.microsoft-logo {
		height: 18px;
	}

	.brand-title {
		font-size: 1.2rem;
	}

	.nav-actions {
		gap: 12px;
	}

	.language-dropdown {
		padding: 8px 14px;
		padding-right: 32px;
		font-size: 13px;
		min-width: 90px;
	}
}

@media (max-width: 480px) {
	.top-nav {
		padding: 12px;
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
	}

	.brand-section {
		gap: 8px;
		justify-content: center;
	}

	.microsoft-logo {
		height: 16px;
	}

	.brand-title {
		font-size: 1.1rem;
		text-align: center;
	}

	.nav-center {
		order: 2;
	}

	.nav-actions {
		order: 3;
		flex-direction: column;
		gap: 10px;
	}

	.language-dropdown {
		width: 100%;
		text-align: left;
		padding: 10px 18px;
		padding-right: 38px;
		font-size: 14px;
	}
}
</style>
