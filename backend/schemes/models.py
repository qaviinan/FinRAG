from django.db import models


class InvestmentScheme(models.Model):
    scheme_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    risk_level = models.CharField(max_length=50)
    min_investment = models.DecimalField(max_digits=10, decimal_places=2)
    returns_3yr = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    returns_5yr = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    expense_ratio = models.DecimalField(max_digits=4, decimal_places=2)
    fund_size = models.DecimalField(max_digits=12, decimal_places=2)
    fund_manager = models.CharField(max_length=100)
    description = models.TextField()

    def __str__(self):
        return self.name


class Feedback(models.Model):
    LIKE = "like"
    DISLIKE = "dislike"
    RATING_CHOICES = [(LIKE, "Like"), (DISLIKE, "Dislike")]

    response_id = models.CharField(max_length=100, db_index=True)
    rating = models.CharField(max_length=10, choices=RATING_CHOICES)
    query = models.TextField(blank=True)
    session_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # One rating per (session, response) — upsert on the frontend side
        unique_together = [("response_id", "session_id")]

    def __str__(self):
        return f"{self.rating} on {self.response_id}"
