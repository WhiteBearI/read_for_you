import asyncio
import base64
from .PDFService import PDFService
from .RecognitionServices import RecognitionServices


class ProcessingService:
    """处理服务类：协调PDF处理和识别API调用"""

    @staticmethod
    async def processRecognitionAsync(file, page_num, language=''):
        """
        异步处理识别逻辑：提取PDF、并发执行PDF转换和API调用
        
        参数:
            file: 上传的PDF文件对象
            page_num: 页码范围字符串
            language: 识别语言参数
        
        返回:
            dict: 包含status、result和PDFArray的字典
        """
        # 使用PDFService提取指定页面
        try:
            extracted_pdf = PDFService.extractPDF(file, page_num)
        except Exception as e:
            raise Exception(f'PDF提取失败: {str(e)}')
        
        # 读取提取后的PDF文件数据
        file_data = extracted_pdf.read()
        
        # 将页码范围转换为从1开始
        normalized_page_range = ''
        if page_num:
            try:
                normalized_page_range = PDFService.normalizePageRange(page_num)
            except Exception as e:
                raise Exception(f'页码范围转换失败: {str(e)}')

        # 调用识别API
        api_response = await RecognitionServices.callRecognitionAPI(file_data, normalized_page_range, language)

        # 将 PDF 转换为 base64 格式
        pdf_base64 = base64.b64encode(file_data).decode('utf-8')
        pdf_data_url = f'data:application/pdf;base64,{pdf_base64}'

        # 返回结果
        return {
            'status': 'success',
            'result': api_response.text,
            'pdf': pdf_data_url  # 返回 base64 编码的 PDF
        }