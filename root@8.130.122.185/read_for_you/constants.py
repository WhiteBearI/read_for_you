import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件（优先从 backend/ 根目录）
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

RECOGNITION_BASE_URL = os.getenv('RECOGNITION_BASE_URL', '')
ASYNC_API_URL = os.getenv('ASYNC_API_URL', '')

AZURE_BLOB_ACCOUNT_URL = os.getenv('AZURE_BLOB_ACCOUNT_URL', '')
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
AZURE_STORAGE_ACCOUNT_NAME = os.getenv('AZURE_STORAGE_ACCOUNT_NAME', '')
AZURE_STORAGE_ACCOUNT_KEY = os.getenv('AZURE_STORAGE_ACCOUNT_KEY', '')
AZURE_STORAGE_CONTAINER_NAME = os.getenv('AZURE_STORAGE_CONTAINER_NAME', '')

AZURE_BLOB_ACCOUNT_URL2 = os.getenv('AZURE_BLOB_ACCOUNT_URL2', '')
AZURE_STORAGE_ACCOUNT_NAME2 = os.getenv('AZURE_STORAGE_ACCOUNT_NAME2', '')
AZURE_STORAGE_CONTAINER_NAME2 = os.getenv('AZURE_STORAGE_CONTAINER_NAME2', '')

# MySQL Database
MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', '3306'))
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'readforyou')