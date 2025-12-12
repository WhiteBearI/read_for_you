from uuid import uuid4
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class UUIDCookieMiddleware(MiddlewareMixin):
    """Ensure each visitor has a persistent UUID stored in cookie."""

    cookie_name = 'rfy_uuid'
    cookie_max_age = 60 * 60 * 24 * 365 * 20  # ~20 years

    def process_response(self, request, response):
        if self.cookie_name not in request.COOKIES:
            uuid_value = str(uuid4())
            # 跨域请求需要 SameSite=None + Secure=True
            # 本地开发（同源或 localhost）使用 SameSite=Lax
            if settings.DEBUG:
                # 开发环境：使用 Lax，不强制 Secure
                response.set_cookie(
                    self.cookie_name,
                    uuid_value,
                    max_age=self.cookie_max_age,
                    samesite='Lax',
                    secure=False,
                    httponly=False,
                )
            else:
                # 生产环境：跨域需要 SameSite=None + Secure=True
                response.set_cookie(
                    self.cookie_name,
                    uuid_value,
                    max_age=self.cookie_max_age,
                    samesite='None',
                    secure=True,
                    httponly=False,
                )
        return response
