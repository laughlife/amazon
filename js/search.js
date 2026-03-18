function normalizeSearchValue(value){
  return String(value || '').toLowerCase().trim();
}

function matchesSearchQuery(query, fields){
  if(!query) return true;
  return fields.some(field => normalizeSearchValue(field).includes(query));
}

function primeAnalysisFromSearch(keyword='', source='', remark='', link=''){
  if(!keyword) return;
  $('keyword').value = keyword;
  if(source) $('sourceChannel').value = source;
  if(link) $('sourceLink').value = link;
  $('remark').value = [remark, $('remark').value].filter(Boolean).join('｜').slice(0,200);
  renderSearchCenter(`已将“${keyword}”带入分析区，可直接执行一键分析。`, true);
  scrollToId('control');
}

function toNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSellerSpriteItems(payload){
  const data = payload?.data;
  if(Array.isArray(data?.items)) return data.items;
  if(Array.isArray(data?.records)) return data.records;
  if(Array.isArray(data?.list)) return data.list;
  if(Array.isArray(data)) return data;
  return [];
}

function buildSellerSpriteSummary(item){
  const searches = toNumber(item.searches);
  const purchases = toNumber(item.purchases);
  const searchRank = toNumber(item.searchRank);
  const rankGrowthRate = toNumber(item.searchRankCr || item.searchRankGrowthRate || item.w1RankGrowthRate);
  return `搜索量：${searches || '-'}｜购买量：${purchases || '-'}｜搜索排名：${searchRank || '-'}｜排名增长率：${rankGrowthRate || '-'}`;
}

function buildSellerSpriteSuggestion(item){
  const growth = toNumber(item.searchRankCr || item.searchRankGrowthRate || item.w1RankGrowthRate);
  const purchaseRate = toNumber(item.purchaseRate);
  if(growth > 0.08 && purchaseRate > 0.03) return '增长和购买率同时偏强，建议优先让大模型给出打分建议。';
  if(growth > 0.03) return '排名有上升趋势，建议加入观察并补充竞品与利润核算。';
  return '先保守观察，建议结合大模型输出判断是否继续跟踪。';
}

function buildSellerSpriteSearchResults(items){
  return items.map(item => ({
    kind:'sellersprite',
    areaKey:'keyword',
    areaLabel:'卖家精灵 ABA 周数据',
    anchor:'searchhub',
    name:item.keyword || item.keywordCn || '卖家精灵关键词',
    status:`来源：${item.marketplace || (state.sellerSprite?.marketplace || 'US')}`,
    summary:buildSellerSpriteSummary(item),
    suggestion:buildSellerSpriteSuggestion(item),
    keyword:item.keyword || item.keywordCn || '',
    source:'卖家精灵',
    remark:`ABA 日期：${item.date || state.sellerSprite?.date || '最新周'}`
  }));
}

function buildSellerSpriteExternalContext(query, payload, items){
  return {
    provider:'sellersprite',
    api:'/v1/aba/research/weekly',
    query,
    marketplace: state.sellerSprite?.marketplace || 'US',
    date: state.sellerSprite?.date || '',
    total: toNumber(payload?.data?.total || items.length),
    fetchedAt: new Date().toISOString(),
    items: items.slice(0, 5).map(item => ({
      keyword: item.keyword || '',
      marketplace: item.marketplace || '',
      date: item.date || '',
      searches: toNumber(item.searches),
      purchases: toNumber(item.purchases),
      purchaseRate: toNumber(item.purchaseRate),
      searchRank: toNumber(item.searchRank),
      searchRankGrowthRate: toNumber(item.searchRankCr || item.searchRankGrowthRate || item.w1RankGrowthRate),
      clicks: toNumber(item.clicks),
      impressions: toNumber(item.impressions),
      cprExact: toNumber(item.cprExact),
      departments: Array.isArray(item.departments) ? item.departments : []
    }))
  };
}

async function fetchSellerSpriteAbaWeekly(query){
  const cfg = state.sellerSprite || {};
  if(cfg.enabled === false){
    return { skipped:true, reason:'配置中已禁用卖家精灵调用。' };
  }
  const body = {
    marketplace: cfg.marketplace || 'US',
    includeKeywords: query,
    page: cfg.page || 1,
    size: cfg.size || 10,
    searchModel: cfg.searchModel || 1
  };
  if(cfg.date) body.date = cfg.date;
  const proxyEnabled = cfg.proxyEnabled !== false;
  const proxyBaseUrl = String(cfg.proxyBaseUrl || 'http://localhost:3001').trim().replace(/\/+$/, '');
  if(proxyEnabled){
    const proxyEndpoint = `${proxyBaseUrl}/api/sellersprite/aba-weekly`;
    const proxyResp = await fetch(proxyEndpoint, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    const proxyData = await proxyResp.json().catch(()=>({}));
    if(!proxyResp.ok){
      throw new Error(proxyData?.message || `本地代理请求失败（${proxyResp.status}）`);
    }
    if(proxyData?.code && proxyData.code !== 'OK'){
      throw new Error(proxyData?.message || `卖家精灵返回状态异常（${proxyData.code}）`);
    }
    const proxyItems = normalizeSellerSpriteItems(proxyData);
    return { skipped:false, payload:proxyData, items:proxyItems };
  }
  if(!cfg.secretKey){
    return { skipped:true, reason:'config/conf.json 未配置 sellerSprite.secretKey。' };
  }
  const endpoint = String(cfg.endpoint || '').trim() || 'https://api.sellersprite.com/v1/aba/research/weekly';
  const resp = await fetch(endpoint, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'secret-key': cfg.secretKey
    },
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(()=>({}));
  if(!resp.ok){
    throw new Error(data?.message || `卖家精灵请求失败（${resp.status}）`);
  }
  if(data?.code && data.code !== 'OK'){
    throw new Error(data?.message || `卖家精灵返回状态异常（${data.code}）`);
  }
  const items = normalizeSellerSpriteItems(data);
  return { skipped:false, payload:data, items };
}

async function feedbackSellerSpriteToBrain(query){
  if(!query) return { skipped:true, reason:'关键词为空，跳过大模型回传。' };
  if(!state.brain?.endpoint || !state.brain?.model || !state.brain?.apiKey){
    return { skipped:true, reason:'当前大模型配置不完整，已跳过回传。' };
  }
  $('keyword').value = query;
  if([...$('sourceChannel').options].some(opt => opt.value === '卖家精灵')){
    $('sourceChannel').value = '卖家精灵';
  }
  setBrainStatus('统一搜索命中卖家精灵数据，正在回传给大模型...');
  try{
    const result = await callBrain('full');
    applyBrainResult(result);
    state.brain.connected = true;
    updateTopChips();
    setBrainStatus('统一搜索已完成“卖家精灵数据 -> 大模型分析”回填。', true);
    return { skipped:false, ok:true };
  }catch(err){
    state.brain.connected = false;
    updateTopChips();
    setBrainStatus(`统一搜索回传大模型失败：${err.message}`);
    return { skipped:false, ok:false, reason: err.message };
  }
}

function buildUnifiedSearchResults(query, scope='all'){
  const q = normalizeSearchValue(query);
  const want = area => scope === 'all' || scope === area;
  const results = [];
  const push = item => results.push(item);

  if(want('keyword')){
    state.words.forEach(w=>{
      if(matchesSearchQuery(q, [w.keyword, w.type, w.category, w.status, w.remark, w.trend])) push({
        kind:'keyword', areaKey:'keyword', areaLabel:'机会词库', anchor:'opportunity', name:w.keyword,
        status:w.status || '待初筛', summary:`来源：${w.type || '-'}｜类目：${w.category || '-'}｜分数：${w.score || '-'}｜趋势：${w.trend || '-'}`,
        suggestion:w.status === '已推观察池' ? '优先转观察池并补充数据' : '先做快速初筛或加入监控',
        keyword:w.keyword, source:w.type || '词库', remark:w.remark || ''
      });
    });
    state.watch.forEach(w=>{
      if(matchesSearchQuery(q, [w.keyword, w.status, w.model, (w.tags||[]).join(' '), w.risk, w.trend])) push({
        kind:'watch', areaKey:'keyword', areaLabel:'观察池', anchor:'watch', name:w.keyword,
        status:w.status || '继续观察', summary:`风险：${w.risk || '-'}｜模型：${w.model || '-'}｜标签：${(w.tags||[]).join(' / ') || '-'}`,
        suggestion:'继续补独立站与站内数据，确认是否转正式项目',
        keyword:w.keyword, source:'观察池', remark:(w.tags||[]).join(' / ')
      });
    });
  }

  if(want('site')){
    state.siteResources.forEach(site=>{
      if(matchesSearchQuery(q, [site.siteName, site.url, site.keyword, site.source, site.status, site.remark])) push({
        kind:'site', areaKey:'site', areaLabel:'独立站资源区', anchor:'feedCenter', name:site.siteName || site.keyword || '独立站资源',
        status:site.status || '待分析', summary:`核心词：${site.keyword || '-'}｜来源：${site.source || '手动投喂'}｜链接：${site.url}`,
        suggestion:'可回填分析区，或转机会词后进入监控',
        keyword:site.keyword || extractKeywordFromUrl(site.url), source:site.source || '独立站', remark:site.remark || site.siteName, link:site.url, fillType:'site', fillId:site.id
      });
    });
    state.keywordMonitors.forEach(task=>{
      if(matchesSearchQuery(q, [task.name, task.category, task.source, task.status, task.lastAnomaly, task.suggestedAction])) push({
        kind:'task-keyword', areaKey:'site', areaLabel:'监控任务中心', anchor:'surveillance', name:task.name,
        status:task.status || '正常', summary:`词库任务｜频率：${task.freq}｜快照：${task.lastSnapshot}｜异动：${task.lastAnomaly || '-'}`,
        suggestion:task.suggestedAction || '继续监控',
        keyword:task.name, source:task.source || '监控任务', remark:task.lastAnomaly || task.lastSnapshot
      });
    });
    state.siteMonitors.forEach(task=>{
      if(matchesSearchQuery(q, [task.name, task.category, task.source, task.status, task.lastAnomaly, task.suggestedAction])) push({
        kind:'task-site', areaKey:'site', areaLabel:'监控任务中心', anchor:'surveillance', name:task.name,
        status:task.status || '正常', summary:`独立站任务｜频率：${task.freq}｜快照：${task.lastSnapshot}｜异动：${task.lastAnomaly || '-'}`,
        suggestion:task.suggestedAction || '继续监控',
        keyword:task.category && task.category !== '-' ? task.category : task.name, source:task.source || '独立站监控', remark:task.lastAnomaly || task.lastSnapshot
      });
    });
  }

  if(want('project')){
    state.projects.forEach(p=>{
      if(matchesSearchQuery(q, [p.project, p.source, p.owner, p.status, p.launchStatus, p.marketplace, p.sku, p.asin])) push({
        kind:'project', areaKey:'project', areaLabel:'正式项目池', anchor:'project', name:p.project,
        status:p.launchStatus || p.status || '正式项目', summary:`关键词：${p.source}｜负责人：${p.owner || '-'}｜站点：${p.marketplace || '-'}｜SKU：${p.sku || '-'}`,
        suggestion:(p.launchStatus || '') === '待抢上' ? '可直接同步到执行池，安排抢上' : '继续补充执行信息',
        keyword:p.source, source:'正式项目', remark:p.project
      });
    });
    state.pipeline.forEach(item=>{
      if(matchesSearchQuery(q, [item.project, item.keyword, item.owner, item.stage, item.sku, item.asin, item.riskMemo])) push({
        kind:'pipeline', areaKey:'project', areaLabel:'抢上 / FBM测品', anchor:'devtest', name:item.project,
        status:item.stage || '执行中', summary:`关键词：${item.keyword || '-'}｜负责人：${item.owner || '-'}｜订单：${item.orders ?? 0}｜CVR：${item.cvr || '-'}｜风险：${evaluatePipelineRisk(item).level}`,
        suggestion:item.stage === '待复盘' ? '优先做复盘结论' : item.stage === '待抢上' ? '优先安排坑位推进' : '继续跟进点击、订单和风险灯',
        keyword:item.keyword || item.project, source:'执行池', remark:item.stage
      });
    });
    state.monitors.forEach(m=>{
      if(matchesSearchQuery(q, [m.project, m.sku, m.asin, m.statusText, m.warning, m.owner])) push({
        kind:'monitor', areaKey:'project', areaLabel:'上架监控中心', anchor:'monitoring', name:m.project,
        status:m.statusText || '监控中', summary:`SKU：${m.sku || '-'}｜ASIN：${m.asin || '-'}｜预警：${m.warning || '-'}｜负责人：${m.owner || '-'}`,
        suggestion:m.warning === '红色预警' ? '优先排查 listing 问题或库存问题' : '继续轮询 buyable / discoverable',
        keyword:m.project, source:'上架监控', remark:m.warning || m.statusText
      });
    });
  }

  if(want('alert')){
    state.alerts.forEach(alert=>{
      if(matchesSearchQuery(q, [alert.name, alert.sourceLabel, alert.triggerReason, alert.triggerSummary, alert.assignee, alert.status, alert.aiAdvice])) push({
        kind:'alert', areaKey:'alert', areaLabel:'机会预警中心', anchor:'alerts', name:alert.name,
        status:`${alert.level}级 / ${alert.status}`, summary:`触发：${alert.triggerReason}｜风险灯：${alert.riskLamp}｜负责人：${alert.assignee || '-'}`,
        suggestion:alert.aiAdvice || alert.nextAction || '待 AI 判读',
        keyword:alert.name, source:alert.sourceLabel || '预警', remark:alert.triggerSummary || alert.triggerReason
      });
    });
    state.actionCards.forEach(card=>{
      if(matchesSearchQuery(q, [card.name, card.owner, card.priority, card.status, card.plan, card.recommendedAction])) push({
        kind:'action', areaKey:'alert', areaLabel:'行动卡 / 派单中心', anchor:'alerts', name:card.name,
        status:`${card.priority}级 / ${card.status}`, summary:`负责人：${card.owner || '-'}｜SLA：${card.sla || '-'}｜计划：${card.plan || '-'}`,
        suggestion:card.recommendedAction || '先接单，再推进下一步',
        keyword:card.name, source:'行动卡', remark:card.plan || card.recommendedAction
      });
    });
  }

  return results.slice(0,80);
}

function renderSearchCenter(message='', preserve=false){
  if(!$('searchHubTable')) return;
  if(!preserve){
    $('searchHubInput').value = state.search.query || '';
    $('searchHubScope').value = state.search.scope || 'all';
  }
  const results = state.search.results || [];
  $('searchResultCount').textContent = results.length;
  $('searchKeywordCount').textContent = results.filter(x=>x.areaKey==='keyword').length;
  $('searchSiteCount').textContent = results.filter(x=>x.areaKey==='site').length;
  $('searchProjectCount').textContent = results.filter(x=>x.areaKey==='project').length;
  $('searchAlertCount').textContent = results.filter(x=>x.areaKey==='alert').length;

  const baseStatus = message || (state.search.query ? `已搜索 “${state.search.query}”，找到 ${results.length} 条结果。可以直接定位区域，或一键把关键词带入分析区。` : '当前可直接搜索测试程序里的词库、独立站、监控、预警、正式项目和执行状态。搜索结果会直接告诉你“现在在哪”和“下一步建议”。');
  const statusMsg = state.search.externalStatus ? `${baseStatus} ${state.search.externalStatus}` : baseStatus;
  $('searchHubStatus').textContent = statusMsg;

  $('searchHubTable').innerHTML = results.length ? results.slice(0,30).map(item => `
    <tr>
      <td><b>${item.name}</b><div class="small muted">${item.kind}</div></td>
      <td>${item.areaLabel}</td>
      <td>${item.status}</td>
      <td>${item.summary}</td>
      <td>${item.suggestion}</td>
      <td>
        <button class="btn-ghost small" data-search-anchor="${item.anchor}">定位</button>
        <button class="btn-ghost small" data-search-fill="${item.keyword || item.name}" data-search-source="${item.source || ''}" data-search-remark="${item.remark || ''}" data-search-link="${item.link || ''}" data-search-fill-type="${item.fillType || ''}" data-search-fill-id="${item.fillId || ''}">带入分析</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="muted">暂无匹配结果。你可以先搜索词库中的关键词、独立站名称、负责人、预警状态或项目阶段。</td></tr>';

  document.querySelectorAll('[data-search-anchor]').forEach(btn=>btn.onclick = ()=>scrollToId(btn.dataset.searchAnchor));
  document.querySelectorAll('[data-search-fill]').forEach(btn=>btn.onclick = ()=>{
    if(btn.dataset.searchFillType === 'site' && btn.dataset.searchFillId){
      fillAnalysisFromSite(btn.dataset.searchFillId);
      renderSearchCenter(`已将独立站资源回填到分析区：${btn.dataset.searchFill}`, true);
      scrollToId('control');
      return;
    }
    primeAnalysisFromSearch(btn.dataset.searchFill, btn.dataset.searchSource, btn.dataset.searchRemark, btn.dataset.searchLink);
  });
}

async function runUnifiedSearch(query, fromInput=true){
  const previousQuery = state.search.query;
  const finalQuery = String(query != null ? query : $('searchHubInput').value).trim();
  const scope = $('searchHubScope').value || 'all';
  state.search.query = finalQuery;
  state.search.scope = scope;
  state.search.results = buildUnifiedSearchResults(finalQuery, scope);
  const shouldResetExternal = fromInput || finalQuery !== previousQuery;
  if(shouldResetExternal){
    state.search.externalContext = null;
    state.search.externalStatus = '';
  }
  if(fromInput && finalQuery){
    try{
      const spriteResp = await fetchSellerSpriteAbaWeekly(finalQuery);
      if(spriteResp.skipped){
        state.search.externalStatus = `外部数据：${spriteResp.reason}`;
      }else{
        const spriteItems = Array.isArray(spriteResp.items) ? spriteResp.items : [];
        const spriteResults = buildSellerSpriteSearchResults(spriteItems);
        if(spriteResults.length){
          state.search.results = [...spriteResults, ...state.search.results].slice(0, 80);
          state.search.externalStatus = `外部数据：已命中卖家精灵 ${spriteResults.length} 条。`;
        }else{
          state.search.externalStatus = '外部数据：卖家精灵未返回匹配项。';
        }
        state.search.externalContext = buildSellerSpriteExternalContext(finalQuery, spriteResp.payload, spriteItems);
        if(spriteItems.length){
          const top = spriteItems[0];
          const summary = `统一搜索卖家精灵：${finalQuery}｜搜索量 ${toNumber(top.searches)}｜购买量 ${toNumber(top.purchases)}｜排名 ${toNumber(top.searchRank)}｜增长率 ${toNumber(top.searchRankCr || top.searchRankGrowthRate || top.w1RankGrowthRate)}`;
          $('remark').value = [summary, $('remark').value].filter(Boolean).join('｜').slice(0, 500);
          const brainResp = await feedbackSellerSpriteToBrain(finalQuery);
          if(brainResp.skipped && brainResp.reason){
            state.search.externalStatus += ` 大模型：${brainResp.reason}`;
          }else if(brainResp.ok){
            state.search.externalStatus += ' 大模型：已完成分析回填。';
          }else if(brainResp.reason){
            state.search.externalStatus += ` 大模型：回传失败（${brainResp.reason}）。`;
          }
        }
      }
    }catch(err){
      state.search.externalStatus = `外部数据：卖家精灵调用失败（${err.message}）。`;
    }
  }
  renderSearchCenter('', !fromInput);
}

function clearUnifiedSearch(){
  state.search.query = '';
  state.search.scope = 'all';
  state.search.results = [];
  state.search.externalContext = null;
  state.search.externalStatus = '';
  renderSearchCenter('已清空搜索结果。现在可重新输入关键词、站点、负责人或状态。');
}
