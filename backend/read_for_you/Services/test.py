import os
import json
import asyncio
from pathlib import Path
from .PDFService import PDFService


def testBulkJSON():
    """
    测试函数：读取BulkFile文件夹中的文件并返回伪造的API响应
    
    返回:
        dict: 包含status、result和PDFArray的字典，模拟views.py中API调用的响应格式
    """
    # 获取项目根目录（backend目录）
    current_dir = Path(__file__).resolve().parent  # Services目录
    backend_dir = current_dir.parent.parent  # backend目录
    bulk_file_dir = backend_dir / "BulkFile"
    
    # 文件路径
    pdf_path = bulk_file_dir / "bulkpdf.pdf"
    json_path = bulk_file_dir / "bulkjson.json"
    
    try:
        # 1. 读取 JSON 文件
        with open(json_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # 2. 读取 PDF 文件并使用 getPDFArray 处理成数组
        with open(pdf_path, 'rb') as pdf_file:
            # 由于 getPDFArray 是异步函数，需要使用 asyncio.run
            pdf_array = asyncio.run(PDFService.getPDFArray(pdf_file))
        
        # 3. 构造伪造的 API 响应结果（模拟 views.py 中的返回格式）
        response = {
            'status': 'success',  # HTTP 状态码
            'result': json.dumps(json_data, ensure_ascii=False),  # 将 JSON 数据转换为字符串
            'PDFArray': pdf_array  # getPDFArray 处理后的结果
        }
        
        return response
    
    except FileNotFoundError as e:
        return {
            'status': 404,
            'result': json.dumps({'error': f'文件未找到: {str(e)}'}, ensure_ascii=False),
            'PDFArray': []
        }
    except Exception as e:
        return {
            'status': 500,
            'result': json.dumps({'error': f'处理失败: {str(e)}'}, ensure_ascii=False),
            'PDFArray': []
        }


# 可选：添加一个测试运行函数
if __name__ == "__main__":
    result = testBulkJSON()
    print(f"Status: {result['status']}")
    print(f"Result: {result['result'][:200]}...")  # 只打印前200个字符
    print(f"PDFArray length: {len(result['PDFArray'])}")
    if result['PDFArray']:
        print(f"First PDF preview: {result['PDFArray'][0][:100]}...")
