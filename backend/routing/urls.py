from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TripViewSet, calculate_trip

router = DefaultRouter()
router.register(r'trips', TripViewSet, basename='trip')

urlpatterns = [
    path('trips/calculate/', calculate_trip, name='calculate-trip'),
    path('', include(router.urls)),
]
