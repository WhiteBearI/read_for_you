// 国际化配置
export const translations = {
  en: {
    // IndexPage
    subtitle: 'Your personal reading assistant with AI-powered insights',
    uploadFile: 'Upload File',
    uploadPDF: 'Upload PDF',
    search: 'Search',
    searchPlaceholder: 'Search...',
    bookCenter: 'Book Center',
    loadingBooks: 'Loading books...',
    book: 'Book',
    bookPrefix: 'Book:',
    selectFile: 'Upload PDF Document',
    chooseFile: 'Choose PDF File',
    pageNumbers: 'Page Range (Optional)',
    pageNumbersPlaceholder: 'Enter an range, e.g., 1-1, 1-2, 15-25',
    pageNumbersHint: 'Leave empty to process all pages',
    pageFormatInvalid: 'Invalid format. Please enter a number (e.g., 5) or range (e.g., 1-10)',
    pageRangeInvalid: 'End page must be greater than or equal to start page',
    startRecognition: 'Start Recognition',
    cancel: 'Cancel',
    recognizing: 'Recognizing Document...',
    translating: 'Translating Document...',
    loading: 'Loading Book...',
    loadingDescription: 'Please wait while we process your document',
    loadingBookDescription: 'Please wait while we load the book',
    checkMyBooksHint: 'You can also check the recognition result in "My Books"',
    viewHelp: 'View Help',
    helpDocumentation: 'Help Documentation',
    closeHelp: 'Close',
    
    // Welcome Page
    welcomeTitle: 'Welcome to Read for You',
    welcomeDescription: 'Your AI-powered reading assistant. Choose from our online library or upload your own PDF documents.',
    onlineLibrary: 'Online Library',
    onlineLibraryDescription: 'Browse and read books from our curated collection',
    onlineLibraryCardDesc: 'Browse and read books from our curated collection',
    uploadPDFCardDesc: 'Upload your own PDF documents for AI-enhanced reading',
    myBooks: 'My Books',
    myBooksDesc: 'View your reading history and saved books',
    pageRangeLabel: 'Page Range',
    time: 'Time',
    status: 'Status',
    startReading: 'Start Reading',
    viewDetails: 'View Details',
    noHistoryFound: 'No history found.',
    fetchError: 'Failed to fetch data',
    status_success: 'Success',
    status_fail: 'Failed',
    status_processing: 'Processing',
    status_completed: 'Completed',
    status_running: 'Running',
    status_queued: 'Queued',

    // Help Content
    helpTitle: 'ReadForYou - User Guide',
    helpIntroduction: 'Introduction',
    helpIntroText: 'ReadForYou is an intelligent document reading assistant that converts PDF documents into audio and provides AI-powered Q&A functionality.',
    helpFeatures: 'Main Features',
    helpFeaturesText: '• PDF document upload and recognition\\n• Text-to-speech (TTS) reading\\n• AI chat for document Q&A\\n• Multi-language support\\n• Accessibility features for screen readers',
    helpUsage: 'How to Use',
    helpUsageText: '1. Upload a PDF file and specify page range\\n2. Navigate through pages using controls or keyboard shortcuts\\n3. Click on text blocks to start reading\\n4. Use AI chat to ask questions about the document',
    helpKeyboardShortcuts: 'Keyboard Shortcuts',
    helpShortcutsText: '• Ctrl+Shift+← : Previous page\\n• Ctrl+Shift+→ : Next page\\n• Ctrl+Shift+I : Start AI conversation about the focused image\\n• Tab : Navigate between readable elements\\n• Enter : Start reading selected element\\n• Esc : Stop reading',
    helpAccessibility: 'Accessibility Features',
    helpAccessibilityText: '• Full keyboard navigation support\\n• Screen reader compatible\\n• Focus management for better navigation\\n• ARIA labels for improved accessibility',

    // ReadingPage
    page: 'Page',
    pageTitle: 'Page {currentPage}',
    home: 'Home',
    backToHome: 'Back to Home',
    backToReadingPage: 'Back to Reading Page',
    clickToReturnHome: 'Click to return to homepage',
    clickOrPressTab: 'Click or press',
    toSelectBlock: 'to select a block, then',
    orClickToRead: 'or click again to read',
    pressEnterToRead: 'Press',
    toReadFromBlock: 'or click again to read from selected block',
    pressEscToStop: 'Press',
    toStopReading: 'to stop reading',
    readFromStart: 'Read from Start',
    stopReading: 'Stop Reading',
    preparing: 'Preparing...',
    noPdfAvailable: 'No PDF available',
    pleaseUploadPdf: 'Please upload a PDF with page range to preview',
    imageLoading: 'Loading...',
    thisIsAnImage: 'This is an image, ',
    imageDescriptionEnd: 'End of image description.',
    thisIsATable: 'This is a table, ',
    tableDescriptionEnd: 'End of table description.',
    mergedCell: 'Merged cell: from row {startRow} column {startCol} to row {endRow} column {endCol}',
    cellPosition: 'Row {row}, Column {col}',
    
    // AIChat
    aiDescription: 'AI Description',
    holdToTalk: 'Hold to talk'
  },
  zh: {
    // IndexPage
    subtitle: '您的个人AI智能阅读助手',
    uploadFile: '上传文件',
    uploadPDF: '上传PDF',
    search: '搜索',
    searchPlaceholder: '搜索...',
    bookCenter: '书籍中心',
    loadingBooks: '加载书籍中...',
    book: '书籍',
    bookPrefix: '书籍：',
    selectFile: '上传PDF文档',
    chooseFile: '选择PDF文件',
    pageNumbers: '页码范围（可选）',
    pageNumbersPlaceholder: '输入一个范围，例如：1-1, 1-2, 15-25',
    pageNumbersHint: '留空将处理所有页面',
    pageFormatInvalid: '格式无效。请输入数字（如：5）或范围（如：1-10）',
    pageRangeInvalid: '结束页码必须大于或等于起始页码',
    startRecognition: '开始识别',
    cancel: '取消',
    recognizing: '正在识别文档...',
    translating: '正在翻译文档...',
    loading: '正在加载书籍...',
    loadingDescription: '请稍候，我们正在处理您的文档',
    loadingBookDescription: '请稍候，我们正在加载书籍',
    checkMyBooksHint: '您也可以在"我的书籍"中查看识别结果',
    viewHelp: '查看帮助',
    helpDocumentation: '帮助文档',
    closeHelp: '关闭',
    
    // Welcome Page
    welcomeTitle: '欢迎使用 Read for You',
    welcomeDescription: '您的AI智能阅读助手。从在线书城浏览书籍或上传您自己的PDF文档。',
    onlineLibrary: '在线书城',
    onlineLibraryDescription: '浏览和阅读精选书籍集合',
    onlineLibraryCardDesc: '浏览和阅读精选书籍集合',
    uploadPDFCardDesc: '上传您自己的PDF文档进行AI增强阅读',
    myBooks: '我的书籍',
    myBooksDesc: '查看您的阅读历史和收藏书籍',
    pageRangeLabel: '页码范围',
    time: '时间',
    status: '状态',
    startReading: '开始阅读',
    viewDetails: '查看详情',
    noHistoryFound: '暂无阅读历史。',
    fetchError: '获取数据失败',
    status_success: '成功',
    status_fail: '失败',
    status_processing: '处理中',
    status_completed: '已完成',
    status_running: '识别中',
    status_queued: '排队中',

    // Help Content
    helpTitle: 'ReadForYou - 用户指南',
    helpIntroduction: '简介',
    helpIntroText: 'ReadForYou 是一个智能文档阅读助手，能够将PDF文档转换为音频并提供AI问答功能。',
    helpFeatures: '主要功能',
    helpFeaturesText: '• PDF文档上传和识别\\n• 文本转语音(TTS)朗读\\n• AI聊天文档问答\\n• 多语言支持\\n• 屏幕阅读器无障碍功能',
    helpUsage: '使用方法',
    helpUsageText: '1. 上传PDF文件并指定页码范围\\n2. 使用控件或键盘快捷键浏览页面\\n3. 点击文本块开始朗读\\n4. 使用AI聊天询问文档相关问题',
    helpKeyboardShortcuts: '键盘快捷键',
    helpShortcutsText: '• Ctrl+Shift+← : 上一页\\n• Ctrl+Shift+→ : 下一页\\n• Control + Shift + I : 针对焦点所在图片进行AI对话。\\n• Tab : 在可朗读元素间导航\\n• Enter : 开始朗读选中元素\\n• Esc : 停止朗读',
    helpAccessibility: '无障碍功能',
    helpAccessibilityText: '• 完整的键盘导航支持\\n• 兼容屏幕阅读器\\n• 焦点管理优化导航\\n• ARIA标签提升可访问性',

    // ReadingPage
    page: '第',
    pageTitle: '第 {currentPage} 页',
    home: '首页',
    backToHome: '返回首页',
    backToReadingPage: '返回阅读页面',
    clickToReturnHome: '点此返回首页',
    clickOrPressTab: '点击或按',
    toSelectBlock: '选择块，然后按',
    orClickToRead: '或再次点击以朗读',
    pressEnterToRead: '按',
    toReadFromBlock: '或再次点击从选定块开始朗读',
    pressEscToStop: '按',
    toStopReading: '停止朗读',
    readFromStart: '从头开始朗读',
    stopReading: '停止朗读',
    preparing: '准备中...',
    noPdfAvailable: '无可用 PDF',
    pleaseUploadPdf: '请上传带有页码范围的 PDF 以预览',
    imageLoading: '加载中...',
    thisIsAnImage: '这是一张图片，',
    imageDescriptionEnd: '图片描述结束。',
    thisIsATable: '这是一张表格，',
    tableDescriptionEnd: '表格描述结束。',
    mergedCell: '合并单元格：从第{startRow}行第{startCol}列到第{endRow}行第{endCol}列',
    cellPosition: '第{row}行，第{col}列',
    
    // AIChat
    aiDescription: 'AI 描述',
    holdToTalk: '长按说话'
  }
};

// 获取当前语言的翻译函数
export function useTranslation() {
  const language = localStorage.getItem('language') || 'en';
  const t = (key, params = {}) => {
    let translation = translations[language]?.[key] || translations.en[key] || key;
    
    // 替换参数占位符
    if (typeof translation === 'string' && Object.keys(params).length > 0) {
      Object.keys(params).forEach(param => {
        translation = translation.replace(`{${param}}`, params[param]);
      });
    }
    
    return translation;
  };
  return { t, language };
}

// 获取当前语言代码
export function getCurrentLanguage() {
  return localStorage.getItem('language') || 'en';
}

// 为 URL 添加 language 参数
export function addLanguageParam(url) {
  const language = getCurrentLanguage();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}language=${language}`;
}
