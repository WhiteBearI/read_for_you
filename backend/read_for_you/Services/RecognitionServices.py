import json
import os
from typing import Any, Dict
from django.conf import settings
import requests
import asyncio
from ..constants import RECOGNITION_API_URL


class RecognitionServices:
    # 从 constants.py 获取 API URL
    API_URL = RECOGNITION_API_URL
    
    @staticmethod
    async def callRecognitionAPI(file_data: bytes, normalized_page_range: str = '', language: str = '') -> requests.Response:
        """
        异步调用识别API，带重试逻辑
        
        参数:
            file_data: PDF文件的二进制数据
            normalized_page_range: 标准化后的页码范围（从1开始）
            language: 识别语言参数
        
        返回:
            requests.Response: API响应对象
        """
        # 构建API URL，如果有language参数则拼接到URL
        api_url = RecognitionServices.API_URL
        if language:
            api_url = f"{api_url}?language={language}"
        
        headers = {
            'Content-Type': 'application/pdf',
            'X-Page-Index-Range': normalized_page_range,
        }
        
        max_retries = 3
        loop = asyncio.get_event_loop()
        
        for attempt in range(1, max_retries + 1):
            try:
                # 将同步的requests调用转换为异步
                response = await loop.run_in_executor(
                    None,
                    lambda: requests.post(api_url, data=file_data, headers=headers, timeout=3600)
                )
                
                # 检查状态码
                if response.status_code == 200:
                    return response
                else:
                    print(f"[Retry {attempt}/{max_retries}] API返回非200状态码: {response.status_code}")
                    if attempt < max_retries:
                        # 等待一段时间后重试（递增等待时间）
                        await asyncio.sleep(1 * attempt)
                    else:
                        # 最后一次尝试失败，返回响应
                        print(f"[重试失败] 已达到最大重试次数({max_retries})，最终状态码: {response.status_code}")
                        return response
            
            except Exception as e:
                print(f"[Retry {attempt}/{max_retries}] API调用异常: {str(e)}")
                if attempt < max_retries:
                    await asyncio.sleep(1 * attempt)
                else:
                    # 最后一次尝试失败，抛出异常
                    print(f"[重试失败] 已达到最大重试次数({max_retries})，异常: {str(e)}")
                    raise
        
        return response
    

    # Notes: the following codes are currently unused. They're prepared for future development
    # Check the state of async task and get the result if successful.
    @staticmethod
    def checkStatus(request_id: str) -> Dict[str, Any]:
        try:
            resp = requests.get("", timeout=10)
        except Exception as ex:  # network or DNS errors
            return {"status": "error", "error_message": f"request failed: {ex}"}

        try:
            payload = resp.json()
        except json.JSONDecodeError:
            return {"status": "error", "error_message": "invalid JSON in upstream response"}

        status= payload.get("status")
        if status in ("running", "queued"):
            return {"status": status}
        if status == "error":
            err_msg = payload.get("error_message")
            return {"status": "error", "error_message": err_msg}
        if status == "completed":
            result = payload["result"]
            return {"status": "successful", "result": result}