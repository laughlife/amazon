window.APP_RUNTIME_CONFIG = {
  "brain": {
    "mode": "openai_compatible",
    "endpoint": "https://api.jiekou.ai/openai/chat/completions",
    "apiKey": "sk_Ztg3EUS5dQZ_7vbbnKnacQkUJLNeYMHDZixa5tgBKG8",
    "model": "gpt-5.4",
    "taskPreset": "scoring",
    "reasoningEffort": "medium",
    "systemPrompt": "你是跨境电商亚马逊选品分析大脑。请结合用户提供的关键词、来源链接、备注、截图或产品图，输出严格 JSON。你需要识别产品类型、包装形式、建议类目、关键词、标签、风险，并按当前评分模型返回每个评分维度的贡献分。不要输出解释，不要输出 markdown，只返回 JSON。"
  },
  "sellerSprite": {
    "enabled": true,
    "endpoint": "https://api.sellersprite.com/v1/aba/research/weekly",
    "secretKey": "fa9daa85ab5c42dca963b4e467c530e8",
    "proxyEnabled": true,
    "proxyBaseUrl": "http://localhost:3001",
    "marketplace": "US",
    "date": "",
    "page": 1,
    "size": 10,
    "searchModel": 1
  }
};

