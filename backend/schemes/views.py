from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from embedchain.config import BaseLlmConfig
from .services import ec_app
from .utils import load_schemes_data, extract_filters

@csrf_exempt
@require_http_methods(["POST"])
def investment_advice(request):
    data = json.loads(request.body)
    query = data['query']
    
    if query == "initial":
        df = load_schemes_data()
        filters = []
    else:
        config = BaseLlmConfig(stream=False)
        response = ec_app.chat(query, citations=True, config=config)
        
        df = load_schemes_data()
        local_vars = {'df': df}
        exec_string = "filtered_df=" + response[0]
        exec(exec_string, globals(), local_vars)
        filtered_df = local_vars['filtered_df']
        
        filters = extract_filters(response[0])

    schemes_data = filtered_df[[
        'scheme_id', 'name', 'category', 'risk_level',
        'min_investment', 'returns_3yr', 'returns_5yr',
        'expense_ratio', 'fund_size', 'fund_manager',
        'description'
    ]].to_dict('records')
    
    response_data = {
        "filters": filters,
        "schemes": schemes_data
    }
    
    return JsonResponse(response_data)
