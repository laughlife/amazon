function normalizeConnectorPayload(){
  return {
    platform: $('bridgePlatform').value,
    accessMode: $('bridgeAccessMode').value,
    accountName: $('bridgeAccountName').value.trim() || '未命名账户',
    syncTarget: $('bridgeSyncTarget').value,
    modules: $('bridgeModules').value.trim() || '-',
    fieldHint: $('bridgeFieldHint').value.trim() || '-',
    notes: $('bridgeNotes').value.trim() || '',
    status: '框架已录入',
    aiAdvice: '',
    lastSyncAt: '-'
  };
}

function aiAdviceForConnector(connector, mode='save'){
  const base = connector.platform === 'FastMoss'
    ? 'AI建议：优先把 FastMoss 数据用于 TikTok 社媒热评分、趋势速度、达人/店铺热度判断。'
    : connector.platform === 'PPSPY'
      ? 'AI建议：优先把 PPSPY 数据用于独立站新品发现、竞店监控、机会词反查。'
      : 'AI建议：先让大脑识别这个源适合进入哪一个池子，再决定同步方向。';
  const tail = connector.syncTarget === '社媒热度池'
    ? '建议先进入模型B，结合 Amazon 空白度再决定是否立项。'
    : connector.syncTarget === '独立站资源区'
      ? '建议先进入独立站资源区，再转机会词或回填分析区。'
      : connector.syncTarget === '机会词库'
        ? '建议先拆成核心词和长尾词，再批量导入机会词库。'
        : '建议把它当补数源，用于正式项目和 FBM 测品复盘。';
  const actionHint = mode === 'sync' ? '本轮同步后，AI 会先做去重、来源判断和转池建议。' : '当前阶段先保存框架，后续拿到 API、导出或网页规则后即可升级为真实接入。';
  return `${base}${tail}${actionHint}`;
}

function renderBridgeCenter(message){
  $('bridgeTable').innerHTML = state.connectors.length ? state.connectors.map(item=>`
    <tr>
      <td><b>${item.platform}</b><div class="small muted">${item.accountName}</div><div class="small muted">${item.modules}</div></td>
      <td>${item.accessMode}</td>
      <td>${item.syncTarget}</td>
      <td><span class="badge ${item.status.includes('已同步')?'green':item.status.includes('待接')?'yellow':'blue'}">${item.status}</span></td>
      <td><div class="risk-note">${item.aiAdvice || '待生成 AI 建议'}</div></td>
      <td>${item.lastSyncAt || '-'}</td>
      <td>
        <button class="btn-ghost small" data-bridge-ai="${item.id}">AI判读</button>
        <button class="btn-ghost small" data-bridge-sync="${item.id}">模拟同步</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="7" class="muted">暂无第三方源框架</td></tr>';
  document.querySelectorAll('[data-bridge-ai]').forEach(btn=>btn.onclick=()=>bridgeRunAiJudgment(btn.dataset.bridgeAi));
  document.querySelectorAll('[data-bridge-sync]').forEach(btn=>btn.onclick=()=>triggerConnectorSync(btn.dataset.bridgeSync));
  $('bridgeStatus').textContent = message || (state.connectors.length ? `当前已挂 ${state.connectors.length} 个第三方源框架。后面每个动作都可以先让 AI 帮你做判断，再决定转词库、独立站资源区还是正式项目。` : '当前还没有嫁接第三方源。');
  updateTopChips();
}

function saveConnectorFramework(){
  const payload = normalizeConnectorPayload();
  payload.aiAdvice = aiAdviceForConnector(payload, 'save');
  const exists = state.connectors.find(x=>x.platform===payload.platform && x.accountName===payload.accountName);
  if(exists){
    Object.assign(exists, payload, { updatedAt: nowText() });
    renderBridgeCenter(`已更新 ${payload.platform} / ${payload.accountName} 的嫁接框架。`);
    $('bridgeLog').textContent = exists.aiAdvice;
    return;
  }
  state.connectors.unshift({ id: Date.now()+Math.random(), ...payload, createdAt: nowText() });
  renderBridgeCenter(`已保存 ${payload.platform} / ${payload.accountName} 框架。`);
  $('bridgeLog').textContent = payload.aiAdvice;
}

function simulateConnectorTest(){
  const payload = normalizeConnectorPayload();
  const advice = aiAdviceForConnector(payload, 'save');
  $('bridgeStatus').textContent = `${payload.platform} ${payload.accessMode} 测试通过（框架演示）。当前仅验证字段位、同步目标位和 AI 判断链路，不做真实登录。`;
  $('bridgeLog').textContent = advice;
}

function seedConnectorExamples(){
  const seeds = [
    { platform:'FastMoss', accessMode:'账号框架占位', accountName:'TikTok热品组', syncTarget:'社媒热度池', modules:'热视频 / 达人 / 店铺 / GMV估算', fieldHint:'keyword, video_count, creator_count, shop_count, gmv_estimate', notes:'后续优先补 API 或导出模板。', status:'待接真实数据', lastSyncAt:'-' },
    { platform:'PPSPY', accessMode:'账号框架占位', accountName:'独立站监控组', syncTarget:'独立站资源区', modules:'Shopify店铺 / 新品 / 估算销量 / 竞店', fieldHint:'site_name, product_url, product_title, estimated_sales, first_seen_at', notes:'后续可接导出或网页规则。', status:'待接真实数据', lastSyncAt:'-' }
  ];
  seeds.forEach(seed=>{
    if(!state.connectors.find(x=>x.platform===seed.platform && x.accountName===seed.accountName)){
      state.connectors.unshift({ id: Date.now()+Math.random(), ...seed, aiAdvice: aiAdviceForConnector(seed, 'save'), createdAt: nowText() });
    }
  });
  renderBridgeCenter('已填入 FastMoss / PPSPY 示例框架。');
  $('bridgeLog').textContent = '你后面拿到 API、导出或稳定页面规则后，可以直接沿这两个框架补真实接入。';
}

function bridgeRunAiJudgment(id){
  const connector = state.connectors.find(x=>String(x.id)===String(id));
  if(!connector) return;
  $('sourceChannel').value = connector.platform === 'FastMoss' ? 'TikTok' : '独立站';
  $('remark').value = `${connector.platform} / ${connector.accountName}：${connector.aiAdvice || aiAdviceForConnector(connector, 'save')}`;
  $('sourceLink').value = connector.platform === 'PPSPY' ? 'https://ppspy.com/' : '';
  if(connector.platform === 'FastMoss' && !$('keyword').value.trim()) $('keyword').value = 'tiktok trend keyword';
  setBrainStatus(`已把 ${connector.platform} 的判断任务回填到大脑区。下一步可直接点击“调用大脑分析”。`, true);
  $('bridgeLog').textContent = `${connector.platform} 已生成 AI 判断任务，并回填到分析区。`;
}

function pushConnectorMockData(connector){
  const now = nowText();
  if(connector.platform === 'FastMoss'){
    const words = [
      { keyword:'travel water flosser', category:'Beauty & Personal Care', source:'FastMoss', remark:'TikTok热视频高频出现' },
      { keyword:'purple toothpaste', category:'Beauty & Personal Care', source:'FastMoss', remark:'达人带货活跃，适合社媒热评分' }
    ];
    let added = 0;
    words.forEach(w=>{ if(addKeywordToLibrary(w)) added++; });
    connector.status = '已同步模拟 TikTok 数据';
    connector.lastSyncAt = now;
    connector.aiAdvice = aiAdviceForConnector(connector, 'sync');
    $('bridgeLog').textContent = `${connector.platform} 已模拟同步 ${added} 个机会词到词库。AI建议：先走社媒热评分，再看 Amazon 空白度是否达标。`;
  } else if(connector.platform === 'PPSPY'){
    const sites = [
      { siteName:'trend-smile.com', url:'https://trend-smile.com/products/purple-toothpaste', keyword:'purple toothpaste', remark:'PPSPY 发现新品', source:'PPSPY', status:'待分析' },
      { siteName:'nano-care.shop', url:'https://nano-care.shop/products/hydroxyapatite-whitening-kit', keyword:'hydroxyapatite whitening kit', remark:'PPSPY 竞店拓展', source:'PPSPY', status:'待分析' }
    ];
    let added = 0;
    sites.forEach(site=>{
      if(!state.siteResources.find(x=>x.url===site.url)){
        state.siteResources.unshift({ id: Date.now()+Math.random(), ...site });
        added++;
      }
    });
    connector.status = '已同步模拟独立站数据';
    connector.lastSyncAt = now;
    connector.aiAdvice = aiAdviceForConnector(connector, 'sync');
    $('bridgeLog').textContent = `${connector.platform} 已模拟同步 ${added} 条独立站资源。AI建议：先让大脑判断新品价值，再决定转机会词还是直接进入观察池。`;
  } else {
    const keyword = $('keyword').value.trim() || 'custom source keyword';
    addKeywordToLibrary({ keyword, category:$('amazonCategory').value, source:'自定义第三方源', remark:'待 AI 分析来源价值' });
    connector.status = '已同步模拟自定义数据';
    connector.lastSyncAt = now;
    connector.aiAdvice = aiAdviceForConnector(connector, 'sync');
    $('bridgeLog').textContent = `${connector.platform} 已模拟同步 1 条数据。AI建议：先判断来源可信度和同步目标，再决定是否立项。`;
  }
  renderWords();
  renderFeedCenter();
  renderBridgeCenter('已完成一次第三方源模拟同步。');
}

function triggerConnectorSync(id){
  const connector = state.connectors.find(x=>String(x.id)===String(id));
  if(!connector) return;
  pushConnectorMockData(connector);
}

function syncCurrentConnectorMock(){
  const payload = normalizeConnectorPayload();
  let connector = state.connectors.find(x=>x.platform===payload.platform && x.accountName===payload.accountName);
  if(!connector){
    saveConnectorFramework();
    connector = state.connectors.find(x=>x.platform===payload.platform && x.accountName===payload.accountName);
  }
  if(connector) pushConnectorMockData(connector);
}
