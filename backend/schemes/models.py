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
