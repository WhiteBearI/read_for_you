import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件（优先从 backend/ 根目录）
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

RECOGNITION_API_URL = os.getenv('RECOGNITION_API_URL', '')

AZURE_BLOB_ACCOUNT_URL = os.getenv('AZURE_BLOB_ACCOUNT_URL', '')
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
AZURE_STORAGE_ACCOUNT_NAME = os.getenv('AZURE_STORAGE_ACCOUNT_NAME', '')
AZURE_STORAGE_ACCOUNT_KEY = os.getenv('AZURE_STORAGE_ACCOUNT_KEY', '')
AZURE_STORAGE_CONTAINER_NAME = os.getenv('AZURE_STORAGE_CONTAINER_NAME', '')

AZURE_BLOB_ACCOUNT_URL2 = os.getenv('AZURE_BLOB_ACCOUNT_URL2', '')
AZURE_STORAGE_ACCOUNT_NAME2 = os.getenv('AZURE_STORAGE_ACCOUNT_NAME2', '')
AZURE_STORAGE_CONTAINER_NAME2 = os.getenv('AZURE_STORAGE_CONTAINER_NAME2', '')