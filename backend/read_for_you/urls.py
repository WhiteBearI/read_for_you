from django.views.generic import TemplateView
from django.views.static import serve as static_serve
from django.contrib import admin
from django.urls import path, re_path
from . import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("recognition", views.recognition, name="recognition"),
    path("getCoverImages", views.getCoverImages, name="getCoverImages"),
    path("getStoragedData", views.getStoragedData, name="getStoragedData"),
    path("getBookMetadata", views.getBookMetadata, name="getBookMetadata"),
    path("getImageFromAB2", views.getImageFromAB2, name="getImageFromAB2"),
]

# Serve static files in development
if settings.DEBUG:
    dist_root = settings.BASE_DIR / 'read_for_you' / 'static' / 'dist'
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += [
        re_path(r'^(?P<path>(assets/.*|vite\.svg))$', static_serve, {'document_root': dist_root}),
    ]

# Catch-all route for SPA - must be AFTER static files
urlpatterns += [
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html'), name='frontend'),
]
