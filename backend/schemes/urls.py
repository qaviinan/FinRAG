from django.urls import path
from . import views

urlpatterns = [
    path('advice/', views.investment_advice, name='investment_advice'),
] 