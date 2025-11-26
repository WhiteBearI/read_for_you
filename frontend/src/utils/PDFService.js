import { PDFDocument } from 'pdf-lib';

/**
 * 解析页面范围字符串
 * @param {string} pageRange - 页面范围字符串，如 "1-5" 或 "3"
 * @returns {Object|null} - 返回 { startPage: number, endPage: number } 或 null
 */
export function parsePageRange(pageRange) {
	if (!pageRange || typeof pageRange !== 'string') {
		return null;
	}

	const trimmed = pageRange.trim();
	
	// 如果只有一个数字，比如 "5"
	if (/^\d+$/.test(trimmed)) {
		const page = parseInt(trimmed, 10);
		if (isNaN(page) || page <= 0) {
			return null;
		}
		return { startPage: page, endPage: page };
	}
	
	// 如果是范围格式，比如 "1-5"
	if (/^\d+-\d+$/.test(trimmed)) {
		const parts = trimmed.split('-');
		const startPage = parseInt(parts[0], 10);
		const endPage = parseInt(parts[1], 10);
		
		if (isNaN(startPage) || isNaN(endPage) || startPage <= 0 || endPage <= 0) {
			return null;
		}
		
		return { startPage, endPage };
	}
	
	// 其他格式都无效
	return null;
}

/**
 * 验证页面范围是否有效（辅助函数）
 * @param {string} pageRange - 页面范围字符串
 * @param {number} totalPages - PDF 总页数
 * @returns {Object} - 返回 { valid: boolean, error: string }
 */
export function validatePageRange(pageRange, totalPages) {
	const parsed = parsePageRange(pageRange);

	if (!parsed) {
		return {
			valid: false,
			error: 'Invalid page range format. Expected format: "x-y"'
		};
	}

	const { startPage, endPage } = parsed;

	if (startPage < 1) {
		return {
			valid: false,
			error: 'Start page must be at least 1'
		};
	}

	if (endPage < startPage) {
		return {
			valid: false,
			error: 'End page must be greater than or equal to start page'
		};
	}

	if (startPage > totalPages) {
		return {
			valid: false,
			error: `Start page ${startPage} exceeds total pages ${totalPages}`
		};
	}

	if (endPage > totalPages) {
		return {
			valid: false,
			error: `End page ${endPage} exceeds total pages ${totalPages}`
		};
	}

	return {
		valid: true,
		error: null
	};
}

/**
 * 获取 PDF 文件的总页数（辅助函数）
 * @param {File} pdfFile - PDF 文件对象
 * @returns {Promise<number>} - 返回总页数
 */
export async function getPDFPageCount(pdfFile) {
	if (!pdfFile || !(pdfFile instanceof File)) {
		throw new Error('Invalid PDF file');
	}

	try {
		const arrayBuffer = await pdfFile.arrayBuffer();
		const pdfDoc = await PDFDocument.load(arrayBuffer, {ignoreEncryption: true});
		return pdfDoc.getPageCount();
	} catch (error) {
		throw new Error(`Failed to read PDF: ${error.message}`);
	}
}
