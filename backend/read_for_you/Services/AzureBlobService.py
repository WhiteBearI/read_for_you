import os
import traceback
from typing import List, Dict, Union
from azure.storage.blob import BlobServiceClient, BlobClient, generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta
from io import BytesIO
import asyncio
from ..constants import (
	AZURE_STORAGE_CONNECTION_STRING,
	AZURE_STORAGE_CONTAINER_NAME,
	AZURE_STORAGE_ACCOUNT_NAME,
	AZURE_STORAGE_ACCOUNT_KEY,
)

class AzureBlobService:
	"""Azure Blob Storage 服务类"""

	def __init__(self):
		"""初始化 Azure Blob Storage 客户端"""
		# 下载优化参数
		self.download_concurrency = 8
		self.max_chunk_get_size = 32 * 1024 * 1024
		self.max_single_get_size = 1024 * 1024 * 1024
		connection_string = AZURE_STORAGE_CONNECTION_STRING
		if not connection_string:
			raise ValueError("AZURE_STORAGE_CONNECTION_STRING 未配置，请在 constants.py 中设置")
		self.connection_string = connection_string
		self.blob_service_client = BlobServiceClient.from_connection_string(connection_string)
		self.container_name = AZURE_STORAGE_CONTAINER_NAME
		if not self.container_name:
			raise ValueError("AZURE_STORAGE_CONTAINER_NAME 未配置，请在 constants.py 中设置")

	def getAllCoverImages(self) -> List[str]:
		try:
			container_client = self.blob_service_client.get_container_client(self.container_name)
			
			# 列出容器中的所有 blob
			blob_list = container_client.list_blobs()
			
			image_urls = []
			
			for blob in blob_list:
				blob_name = blob.name.lower()
				
				# 检查文件是否为 jpg 或 png 格式
				if blob_name.endswith('.jpg') or blob_name.endswith('.jpeg') or blob_name.endswith('.png'):
					# 生成带 SAS Token 的 URL
					blob_url_with_sas = self._generate_blob_url_with_sas(blob.name)
					image_urls.append(blob_url_with_sas)
			
			return image_urls
		
		except Exception as e:
			print("Fail to get cover images: ", e)
			raise Exception(f"获取封面图片失败: {str(e)}")

	def _generate_blob_url_with_sas(self, blob_name: str, expiry_hours: int = 24) -> str:
		"""生成带 SAS Token 的 Blob 访问 URL，默认有效期 24 小时。"""
		try:
			if AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY:
				sas_token = generate_blob_sas(
					account_name=AZURE_STORAGE_ACCOUNT_NAME,
					container_name=self.container_name,
					blob_name=blob_name,
					account_key=AZURE_STORAGE_ACCOUNT_KEY,
					permission=BlobSasPermissions(read=True),
					expiry=datetime.utcnow() + timedelta(hours=expiry_hours)
				)
				return f"https://{AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{self.container_name}/{blob_name}?{sas_token}"
			# 如果缺少账号信息，退化为直接返回公开 URL
			container_client = self.blob_service_client.get_container_client(self.container_name)
			blob_client = container_client.get_blob_client(blob_name)
			return blob_client.url
		except Exception:
			# 如果生成失败，返回普通 URL 以保证功能可用
			container_client = self.blob_service_client.get_container_client(self.container_name)
			return container_client.get_blob_client(blob_name).url

	def downloadFile(self, prefix: str, file_type: str) -> Union[bytes, List[str]]:
		try:
			container_client = self.blob_service_client.get_container_client(
				self.container_name)
			blob_list = container_client.list_blobs(name_starts_with=prefix)

			for blob in blob_list:
				blob_name = blob.name

				if blob_name.lower().endswith(file_type.lower()):
					blob_client = BlobClient.from_connection_string(
						conn_str=self.connection_string,
						container_name=self.container_name,
						blob_name=blob_name,
						max_single_get_size=self.max_single_get_size,
						max_chunk_get_size=self.max_chunk_get_size,
					)
					# 仅 max_concurrency 可以放在 download_blob()
					download_stream = blob_client.download_blob(
						max_concurrency=self.download_concurrency
					)

					chunks = []
					try:
						for chunk in download_stream.chunks():
							chunks.append(chunk)
						file_data = b''.join(chunks)
					finally:
						del download_stream
						del chunks

					return file_data

			raise FileNotFoundError(f"未找到符合条件的文件: prefix='{prefix}', type='{file_type}'")

		except Exception as e:
			print(f"❌ downloadFile Error:")
			print(f"   错误类型: {type(e).__name__}")
			print(f"   错误信息: {e}")
			raise
	
	def download_meta_data(self):
		container_client = self.blob_service_client.get_container_client(self.container_name)
		blob_client = container_client.get_blob_client('metadata/books_list.json')
		download_stream = blob_client.download_blob()
		file_data = download_stream.readall()

		import json
		books_metadata = json.loads(file_data.decode('utf-8'))

		return {
			'success': True,
			'count': len(books_metadata),
			'data': books_metadata
		}