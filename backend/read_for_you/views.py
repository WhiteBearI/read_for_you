import os
import json
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, FileResponse, HttpResponse
from django.conf import settings
from .Services.PDFService import PDFService
from .Services.ProcessingService import ProcessingService
from .Services.AzureBlobService import AzureBlobService
from .Services.AzureBlobService2 import AzureBlobService2
from .Services.test import testBulkJSON
import asyncio


def _standard_api_response(success: bool, data=None, error_msg: str = "") -> JsonResponse:
	"""统一结构的 JSON 响应，HTTP 状态码固定为 200"""
	return JsonResponse({
		"status": "success" if success else "failed",
		"data": data,
		"error_msg": error_msg,
	}, status=200)

@csrf_exempt
def recognition(request):
	"""
	识别路由：处理PDF文件上传并进行识别
	"""
	# 1. 解析请求参数
	file = request.FILES.get('file')
	page_num = request.POST.get('pageNum')
	language = request.GET.get('language', '')  # 从URL参数中获取language

	# 2. 调用处理服务
	try:
		result = asyncio.run(ProcessingService.processRecognitionAsync(file, page_num, language))
		
		# 将 PDF bytes 转换为 base64 以便 JSON 序列化
		if 'pdf' in result and isinstance(result['pdf'], bytes):
			import base64
			pdf_base64 = base64.b64encode(result['pdf']).decode('utf-8')
			result['pdf'] = f'data:application/pdf;base64,{pdf_base64}'
			
	except Exception as e:
		print("调用Document Intelligence识别过程中发生错误：", e)
		return JsonResponse({'error': str(e)}, status=500)
	
	# 3. 返回识别结果
	return JsonResponse(result)

@csrf_exempt
def getCoverImages(request):
	"""
	获取所有封面图片的 URL
	"""
	try:
		# 调用 AzureBlobService 获取所有封面图片
		blob_service = AzureBlobService()
		cover_images = blob_service.getAllCoverImages()
		
		return JsonResponse({
			'success': True,
			'count': len(cover_images),
			'images': cover_images
		})
	except Exception as e:
		return JsonResponse({'error': f'获取封面图片失败: {str(e)}'}, status=500)


@csrf_exempt
def getStoragedData(request):
	"""
	从 Azure Blob Storage 获取指定文件

	参数:
		prefix: 文件路径前缀
		type: 文件类型（如 pdf, jpg, png）

	返回:
		如果是 PDF: JSON 格式的 PDF base64 数组
		如果不是 PDF: 文件的二进制数据
	"""
	try:
		# 1. 解析请求参数
		prefix = request.GET.get('prefix', '')
		file_type = request.GET.get('type', '')

		if not file_type:
			return JsonResponse({'error': '缺少参数: type'}, status=400)

		# 2. 调用 AzureBlobService 下载文件
		blob_service = AzureBlobService()
		file_data = blob_service.downloadFile(prefix, file_type)

		# 3. 根据文件类型返回数据
		if file_type.lower() == 'pdf':
			# PDF 文件：转换为 base64 返回
			import base64
			pdf_base64 = base64.b64encode(file_data).decode('utf-8')
			return JsonResponse({
				'type': 'pdf',
				'data': f'data:application/pdf;base64,{pdf_base64}'
			})
		elif file_type.lower() == 'json':
			# JSON 文件：解析后返回
			import json
			json_data = json.loads(file_data.decode('utf-8'))
			return JsonResponse({
				'type': 'json',
				'data': json_data
			})
		else:
			# 其他文件：返回二进制数据
			content_type_map = {
				'jpg': 'image/jpeg',
				'jpeg': 'image/jpeg',
				'png': 'image/png',
				'txt': 'text/plain',
			}
			content_type = content_type_map.get(file_type.lower(), 'application/octet-stream')
			
			response = HttpResponse(file_data, content_type=content_type)
			response['Content-Disposition'] = f'attachment; filename="file.{file_type}"'
			return response

	except FileNotFoundError as e:
		return JsonResponse({'error': str(e)}, status=404)
	except Exception as e:
		return JsonResponse({'error': f'获取文件失败: {str(e)}'}, status=500)


@csrf_exempt
def getBookMetadata(request):
	blob_service=AzureBlobService()
	try:
		metadata=blob_service.download_meta_data()
		return JsonResponse(metadata)
	except Exception as e:
		print("Fail to download meta data, ", e)
		return JsonResponse({
			'success': False,
			'error': f'获取书籍元数据失败: {str(e)}'
		}, status=500)


@csrf_exempt
def getImageFromAB2(request):
	if request.method != 'POST':
		return _standard_api_response(False, error_msg='仅支持 POST 请求')

	try:
		payload = json.loads(request.body.decode('utf-8') or '{}')
		image_url = payload.get('imageUrl') or payload.get('image_url')
	except json.JSONDecodeError as exc:
		return _standard_api_response(False, error_msg=f'请求体不是有效的 JSON: {exc}')

	if not image_url:
		return _standard_api_response(False, error_msg='缺少参数 imageUrl')

	try:
		blob_service = AzureBlobService2()
		data_url = blob_service.downloadImageAsBase64(image_url)
		return _standard_api_response(True, data=data_url)
	except Exception as exc:
		return _standard_api_response(False, error_msg=f'获取图片失败: {exc}')
