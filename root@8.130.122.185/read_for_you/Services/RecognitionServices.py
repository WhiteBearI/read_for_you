import json
import os
from typing import Any, Dict
from django.conf import settings
import requests
import asyncio
from ..constants import RECOGNITION_BASE_URL, ASYNC_API_URL


class RecognitionServices:
	def callAsyncRecognitionAPI(file_data: bytes, normalized_page_range: str = '', language: str = '') -> requests.Response:
		api_url = RECOGNITION_BASE_URL + ASYNC_API_URL
		if language:
			api_url = f"{api_url}?language={language}"

		headers = {
			'Content-Type': 'application/pdf',
			'X-Page-Index-Range': normalized_page_range,
		}
		
		response = requests.post(api_url, data=file_data, headers=headers, timeout=3600)

		if response.status_code == 202:
			return response.headers.get("Operation-Location")
		else:
			print("An error occurs during async recognition API calling.")
			return ""

	# Check the state of async task and get the result if successful.
	@staticmethod
	def checkStatus(request_id: str) -> Dict[str, Any]:
		try:
			resp = requests.get(RECOGNITION_BASE_URL + request_id, timeout=10)
		except Exception as ex:  # network or DNS errors
			return {"status": "error", "error_message": f"request failed: {ex}"}

		try:
			payload = resp.json()
		except json.JSONDecodeError:
			return {"status": "error", "error_message": "invalid JSON in upstream response"}

		status= payload.get("status")
		if status == "Running":
			return {"status": status}
		if status == "error":
			err_msg = payload.get("error_message")
			return {"status": "error", "error_message": err_msg}
		if status == "Completed":
			result = payload["result"]
			return {"status": "success", "result": result}