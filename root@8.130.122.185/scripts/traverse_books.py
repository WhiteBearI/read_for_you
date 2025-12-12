"""
遍历 Azure Blob Storage 中的书籍列表脚本

此脚本用于扫描 zbooksnap/ 目录下的所有书籍，
并提取每本书的封面图片和 metadata.json 信息
"""

import sys
import os
import json
from typing import List, Dict

# 将 backend 目录添加到 Python 路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from read_for_you.Services.AzureBlobService import AzureBlobService


def traverse_books() -> List[Dict]:
    """
    遍历所有书籍并返回元数据列表

    返回:
        List[Dict]: 书籍列表，每项包含:
            - book_id: 书籍序号
            - book_prefix: 书籍目录前缀 (例如: "zbooksnap/1/")
            - cover_url: 封面图片URL (带SAS)
            - has_pdf: 是否存在PDF文件
            - has_metadata: 是否存在metadata.json
            - metadata: 元数据内容 (如果存在)
    """
    blob_service = AzureBlobService()
    container_client = blob_service.blob_service_client.get_container_client(blob_service.container_name)

    # 列出所有以 zbooksnap/ 开头的 blob
    blob_list = container_client.list_blobs(name_starts_with="zbooksnap/")

    print("blob_list: ", blob_list)

    # 按书籍目录分组
    books_dict = {}

    for blob in blob_list:
        blob_name = blob.name
        # 解析路径: zbooksnap/{book_id}/filename
        parts = blob_name.split('/')

        if len(parts) >= 3 and parts[0] == "zbooksnap":
            book_id = parts[1]
            file_name = parts[2] if len(parts) == 3 else '/'.join(parts[2:])

            # 初始化书籍记录
            if book_id not in books_dict:
                books_dict[book_id] = {
                    'book_id': book_id,
                    'book_prefix': f"zbooksnap/{book_id}/",
                    'cover_url': None,
                    'cover_file': None,
                    'has_pdf': False,
                    'pdf_file': None,
                    'has_metadata': False,
                    'metadata': None,
                    'all_files': []
                }

            # 记录所有文件
            books_dict[book_id]['all_files'].append(file_name)

            # 检测文件类型
            file_lower = file_name.lower()

            # 封面图片 (jpg, jpeg, png)
            if file_lower.endswith(('.jpg', '.jpeg', '.png')) and not books_dict[book_id]['cover_url']:
                books_dict[book_id]['cover_url'] = blob_service._generate_blob_url_with_sas(blob_name)
                books_dict[book_id]['cover_file'] = file_name

            # PDF 文件
            if file_lower.endswith('.pdf'):
                books_dict[book_id]['has_pdf'] = True
                books_dict[book_id]['pdf_file'] = file_name

            # metadata.json
            if file_lower == 'metadata.json':
                books_dict[book_id]['has_metadata'] = True
                try:
                    # 下载并解析 metadata.json
                    blob_client = container_client.get_blob_client(blob_name)
                    download_stream = blob_client.download_blob()
                    metadata_bytes = download_stream.readall()
                    metadata_json = json.loads(metadata_bytes.decode('utf-8'))
                    books_dict[book_id]['metadata'] = metadata_json
                except Exception as e:
                    print(f"⚠️  警告: 无法解析 {blob_name} 的 metadata.json: {str(e)}")
                    books_dict[book_id]['metadata'] = {'error': str(e)}

    # 转换为列表并排序
    books_list = sorted(books_dict.values(), key=lambda x: x['book_id'])

    return books_list


def print_books_summary(books: List[Dict]):
    """打印书籍列表摘要"""
    print(f"\n{'='*80}")
    print(f"📚 发现 {len(books)} 本书籍")
    print(f"{'='*80}\n")

    for book in books:
        print(f"📖 书籍 ID: {book['book_id']}")
        print(f"   目录: {book['book_prefix']}")
        print(f"   文件列表: {', '.join(book['all_files'])}")

        # 封面状态
        if book['cover_url']:
            print(f"   ✅ 封面图片: {book['cover_file']}")
        else:
            print(f"   ❌ 缺少封面图片")

        # PDF 状态
        if book['has_pdf']:
            print(f"   ✅ PDF 文件: {book['pdf_file']}")
        else:
            print(f"   ❌ 缺少 PDF 文件")

        # 元数据状态
        if book['has_metadata']:
            print(f"   ✅ 元数据:")
            metadata = book['metadata']
            if 'error' in metadata:
                print(f"      ❌ 解析错误: {metadata['error']}")
            else:
                print(f"      英文名: {metadata.get('english_name', 'N/A')}")
                print(f"      中文名: {metadata.get('chinese_name', 'N/A')}")
                print(f"      分类: {metadata.get('category', 'N/A')}")
        else:
            print(f"   ❌ 缺少 metadata.json")

        print(f"{'-'*80}\n")


def print_statistics(books: List[Dict]):
    """打印统计信息"""
    total = len(books)
    has_cover = sum(1 for b in books if b['cover_url'])
    has_pdf = sum(1 for b in books if b['has_pdf'])
    has_metadata = sum(1 for b in books if b['has_metadata'])
    complete = sum(1 for b in books if b['cover_url'] and b['has_pdf'] and b['has_metadata'])

    print(f"\n{'='*80}")
    print(f"📊 统计信息")
    print(f"{'='*80}")
    print(f"总书籍数: {total}")
    print(f"有封面图片: {has_cover} ({has_cover/total*100:.1f}%)")
    print(f"有 PDF 文件: {has_pdf} ({has_pdf/total*100:.1f}%)")
    print(f"有元数据: {has_metadata} ({has_metadata/total*100:.1f}%)")
    print(f"完整书籍 (三者齐全): {complete} ({complete/total*100:.1f}%)")
    print(f"{'='*80}\n")


def export_to_json(books: List[Dict], output_file: str = "books_list.json"):
    """导出为 JSON 文件"""
    # 移除 cover_url (包含临时 SAS token)，保留文件名
    export_data = []
    for book in books:
        export_book = {
            'book_id': book['book_id'],
            'book_prefix': book['book_prefix'],
            'cover_file': book['cover_file'],
            'pdf_file': book['pdf_file'],
            'has_metadata': book['has_metadata'],
            'metadata': book['metadata'],
            'all_files': book['all_files']
        }
        export_data.append(export_book)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)

    print(f"✅ 已导出书籍列表到: {output_file}")


if __name__ == "__main__":
    print("🔍 开始扫描 Azure Blob Storage 中的书籍...")

    try:
        books = traverse_books()

        # 打印详细信息
        print_books_summary(books)

        # 打印统计信息
        print_statistics(books)

        # 导出为 JSON
        export_to_json(books, "books_list.json")

        print("\n✅ 扫描完成！")

    except Exception as e:
        print(f"\n❌ 错误: {str(e)}")
        import traceback
        traceback.print_exc()