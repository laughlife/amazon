function syncBrainFormToState(){
  state.brain.mode = $('brainMode').value;
  state.brain.endpoint = $('brainEndpoint').value.trim();
  state.brain.apiKey = $('brainApiKey').value.trim();
  state.brain.model = $('brainModel').value.trim();
  state.brain.taskPreset = $('brainTaskPreset').value;
  state.brain.systemPrompt = $('brainSystemPrompt').value.trim();
}

function setBrainStatus(msg, ok=false){
  $('brainStatus').textContent = msg;
  $('brainStatus').style.borderColor = ok ? '#bbf7d0' : '#fed7aa';
  $('brainStatus').style.background = ok ? '#f0fdf4' : '#fff7ed';
  $('brainStatus').style.color = ok ? '#166534' : '#9a3412';
}

function setImageStatus(msg){
  $('imageStatus').textContent = msg;
}

function renderUploads(){
  const box = $('imagePreviewGrid');
  if(!state.uploads.length){
    box.innerHTML = '';
    setImageStatus('当前未上传图片。');
    updateTopChips();
    return;
  }
  box.innerHTML = state.uploads.map(item => `
    <div class="upload-card">
      <div class="upload-thumb"><img src="${item.dataUrl}" alt="${item.name}" /></div>
      <div class="upload-meta">
        <div class="upload-name">${item.name}</div>
        <div class="small muted" style="margin-top:6px">${item.type || 'image/*'} · ${(item.size/1024).toFixed(1)} KB</div>
        <div class="upload-actions">
          <button class="btn-ghost small" data-remove-image="${item.id}">删除</button>
        </div>
      </div>
    </div>
  `).join('');
  box.querySelectorAll('[data-remove-image]').forEach(btn=>{
    btn.onclick = ()=>{
      state.uploads = state.uploads.filter(x=>x.id !== btn.dataset.removeImage);
      renderUploads();
    };
  });
  setImageStatus(`已上传 ${state.uploads.length} 张图片，可直接调用大脑识别。`);
  updateTopChips();
}

function readFileAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleImageFiles(fileList){
  const files = [...(fileList || [])].filter(f=>f && /^image\//.test(f.type));
  if(!files.length){
    setImageStatus('没有识别到图片文件。');
    return;
  }
  const results = await Promise.all(files.map(async file => ({
    id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    name: file.name,
    size: file.size,
    type: file.type,
    dataUrl: await readFileAsDataURL(file)
  })));
  state.uploads = [...state.uploads, ...results].slice(-8);
  renderUploads();
}

function getCurrentInputContext(){
  return {
    keyword: $('keyword').value.trim(),
    amazonCategory: $('amazonCategory').value,
    productType: $('productType').value.trim(),
    sourceChannel: $('sourceChannel').value,
    sourceLink: $('sourceLink').value.trim(),
    remark: $('remark').value.trim(),
    scoringModel: MODEL_CONFIG[state.model].name,
    scoringFields: MODEL_CONFIG[state.model].fields.map(f=>({ key:f.key, label:f.label, max:f.weight }))
  };
}

function extractTextFromContent(content){
  if(Array.isArray(content)) return content.map(part=>part.text || '').join('\n').trim();
  return String(content || '').trim();
}

function safeJsonParse(text){
  const cleaned = String(text || '').trim().replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```$/,'').trim();
  try { return JSON.parse(cleaned); } catch(e) {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if(start !== -1 && end !== -1 && end > start){
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  throw new Error('大脑返回内容不是有效 JSON');
}

function buildBrainMessages(mode='full'){
  const input = getCurrentInputContext();
  const schemaHint = {
    keyword: 'string',
    suggestedCategory: 'string',
    productType: 'string',
    packaging: 'string',
    tags: ['string'],
    risks: ['string'],
    sourceChannel: 'string',
    summary: 'string',
    modelRecommend: 'station|social',
    scores: Object.fromEntries(MODEL_CONFIG[state.model].fields.map(f=>[f.key, `0-${f.weight}`]))
  };
  const textPart = {
    type:'text',
    text:
`当前任务：${mode==='test' ? '测试接口连通性，请仅返回一个极简 JSON。' : '识别并输出选品分析 JSON。'}

用户输入：${JSON.stringify(input, null, 2)}

返回 JSON 模式：${JSON.stringify(schemaHint, null, 2)}

要求：
1. 只能返回 JSON。
2. scores 里的每个字段都必须是数字，并且不能超过对应满分。
3. tags 和 risks 请尽量简洁。
4. 如果用户上传了图片，请结合图片判断产品类型、包装、类目与风险。
5. 如果信息不足，可以给保守分值，但不要留空。`
  };
  const content = [textPart];
  if(mode !== 'test'){
    state.uploads.forEach(item=>{
      content.push({ type:'image_url', image_url:{ url:item.dataUrl } });
    });
  }
  return [
    { role:'system', content: state.brain.systemPrompt || $('brainSystemPrompt').value.trim() },
    { role:'user', content }
  ];
}

async function callBrain(mode='full'){
  syncBrainFormToState();
  if(!state.brain.endpoint || !state.brain.model){
    throw new Error('请先填写接口地址和模型名');
  }
  const isLocalBrain = /\/api\/openai\//.test(state.brain.endpoint);
  if(isLocalBrain){
    const payload = {
      model: state.brain.model,
      mode,
      systemPrompt: state.brain.systemPrompt || $('brainSystemPrompt').value.trim(),
      context: getCurrentInputContext(),
      images: mode === 'test' ? [] : state.uploads.map(item=>item.dataUrl)
    };
    const res = await fetch(state.brain.endpoint, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok){
      const msg = data?.error?.message || data?.message || `请求失败（${res.status}）`;
      throw new Error(msg);
    }
    const raw = JSON.stringify(data, null, 2);
    state.brain.lastRaw = raw;
    $('brainRaw').classList.remove('hidden');
    $('brainRaw').textContent = raw;
    return data;
  }

  if(!state.brain.apiKey){
    throw new Error('直连模式请填写 API Key');
  }
  const body = {
    model: state.brain.model,
    temperature: mode === 'test' ? 0 : 0.2,
    messages: buildBrainMessages(mode)
  };
  const res = await fetch(state.brain.endpoint, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${state.brain.apiKey}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    const msg = data?.error?.message || data?.message || `请求失败（${res.status}）`;
    throw new Error(msg);
  }
  const content = extractTextFromContent(data?.choices?.[0]?.message?.content || data?.output_text || '');
  if(!content) throw new Error('大脑接口已返回，但没有可解析内容');
  state.brain.lastRaw = content;
  $('brainRaw').classList.remove('hidden');
  $('brainRaw').textContent = content;
  return safeJsonParse(content);
}

function applyBrainResult(data){
  if(data.keyword) $('keyword').value = data.keyword;
  if(data.suggestedCategory) $('amazonCategory').value = data.suggestedCategory;
  if(data.productType) $('productType').value = data.productType;
  if(data.sourceChannel && [...$('sourceChannel').options].some(o=>o.value === data.sourceChannel)) $('sourceChannel').value = data.sourceChannel;
  if(data.summary) $('remark').value = data.summary;

  state.analysis.info = {
    productType: data.productType || $('productType').value.trim() || state.analysis.info.productType || '-',
    packaging: data.packaging || state.analysis.info.packaging || '-',
    keywords: Array.isArray(data.keywords) && data.keywords.length ? data.keywords : [($('keyword').value.trim() || data.keyword || '-')],
    category: data.suggestedCategory || $('amazonCategory').value || state.analysis.info.category || '-',
    tags: Array.isArray(data.tags) ? data.tags : (state.analysis.info.tags || []),
    risks: Array.isArray(data.risks) ? data.risks : (state.analysis.info.risks || [])
  };

  const fields = MODEL_CONFIG[state.model].fields;
  if(data.scores && typeof data.scores === 'object'){
    fields.forEach(f=>{
      if(data.scores[f.key] !== undefined){
        state.analysis.scores[f.key] = clamp(data.scores[f.key], 0, f.weight);
      }
    });
  }
  if(data.modelRecommend && ['station','social'].includes(data.modelRecommend) && data.modelRecommend !== state.model){
    state.analysis.reasons = Array.from(new Set([...(state.analysis.reasons||[]), `大脑建议更适合使用 ${MODEL_CONFIG[data.modelRecommend].name}。当前未自动切换，你可手动切换后再复核。`]));
  }
  if(data.summary){
    state.analysis.reasons = Array.from(new Set([...(state.analysis.reasons||[]), `大脑摘要：${data.summary}`]));
  }
  renderAnalysisInfo();
  renderScoreForm();
  calcSummary();
}

async function testBrainConnection(){
  syncBrainFormToState();
  setBrainStatus('正在测试大脑接口...');
  try {
    if(/\/api\/openai\//.test(state.brain.endpoint)){
      const testUrl = state.brain.endpoint.replace(/\/analyze$/, '/test');
      const res = await fetch(testUrl, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ model: state.brain.model })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data?.error?.message || data?.message || `请求失败（${res.status}）`);
      $('brainRaw').classList.remove('hidden');
      $('brainRaw').textContent = JSON.stringify(data, null, 2);
    } else {
      await callBrain('test');
    }
    state.brain.connected = true;
    updateTopChips();
    setBrainStatus('大脑接口测试通过，可以开始自动识别和评分。', true);
  } catch (err) {
    state.brain.connected = false;
    updateTopChips();
    setBrainStatus(`接口测试失败：${err.message}`);
  }
}

async function runBrainAnalysis(source='full'){
  syncBrainFormToState();
  setBrainStatus(source==='image' ? '正在识别图片并回填字段...' : '正在调用大脑进行自动分析...');
  try {
    const result = await callBrain(source==='image' ? 'image' : 'full');
    applyBrainResult(result);
    state.brain.connected = true;
    updateTopChips();
    setBrainStatus('大脑分析完成，已自动回填识别信息和评分。', true);
  } catch (err) {
    state.brain.connected = false;
    updateTopChips();
    setBrainStatus(`大脑分析失败：${err.message}`);
  }
}

