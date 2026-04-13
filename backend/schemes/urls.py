from django.urls import path
from . import views

urlpatterns = [
    path("chat/", views.chat, name="chat"),
    path("feedback/", views.feedback, name="feedback"),
    path("raptor/tree/", views.raptor_tree, name="raptor_tree"),
]
