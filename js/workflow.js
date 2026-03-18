function parseWordScore(value){
  if(typeof value === 'number') return value;
  const n = Number(String(value||'').replace(/[^\d.-]/g,''));
  return Number.isFinite(n) ? n : 0;
}

function createKeywordMonitor(word){
  return {
    id:'kw_'+word.id,
    refId: word.id,
    type:'keyword',
    name: word.keyword,
    category: word.category || '-',
    source: word.type || '词库',
    freq: ['已推观察池','重点观察'].includes(word.status) ? '15分钟' : '1小时',
    status:'正常',
    aiStatus:'待判读',
    lastSnapshot:`分数 ${parseWordScore(word.score)} / 趋势 ${word.trend||'待判'}`,
    lastAnomaly:'-',
    suggestedAction:'继续观察',
    score: parseWordScore(word.score),
    sourceCount: 1,
    updatedAt: nowText()
  };
}

function createSiteMonitor(site){
  return {
    id:'site_'+site.id,
    refId: site.id,
    type:'site',
    name: site.siteName,
    category: site.keyword || '-',
    source: site.source || '独立站',
    freq: '30分钟',
    status:'正常',
    aiStatus:'待判读',
    lastSnapshot:`新品 0 / 价格变动 0 / 词扩散 0`,
    lastAnomaly:'-',
    suggestedAction:'继续监控',
    productCount: 1,
    newProducts: 0,
    priceChanges: 0,
    keywordSpread: 0,
    updatedAt: nowText()
  };
}

function queueAiTask(task){
  const exists = state.aiQueue.find(x=>x.sourceType===task.sourceType && String(x.sourceId)===String(task.sourceId) && x.reason===task.reason && x.status!=='已完成');
  if(exists) return exists;
  const item = {
    id: Date.now()+Math.random(),
    name: task.name,
    sourceType: task.sourceType,
    sourceId: task.sourceId,
    reason: task.reason,
    priority: task.priority || '中',
    status:'待判读',
    conclusion:'待 AI 判断',
    createdAt: nowText()
  };
  state.aiQueue.unshift(item);
  return item;
}

function addMonitorEvent(evt){
  const item = { id: Date.now()+Math.random(), time: nowText(), ...evt };
  state.monitorEvents.unshift(item);
  state.monitorEvents = state.monitorEvents.slice(0,80);
  ensureOpportunityAlertFromEvent(item);
  return item;
}
function levelRank(level){
  return ({'S':4,'A':3,'B':2,'R':1}[level] || 0);
}

function inferOwnerByName(name=''){
  const lower = String(name).toLowerCase();
  if(lower.includes('tooth') || lower.includes('oral')) return '口腔类目负责人';
  if(lower.includes('hair')) return '个护类目负责人';
  if(lower.includes('water flosser')) return '小家电负责人';
  return '当班选品运营';
}

function deadlineByLevel(level){
  if(level === 'S') return '2小时内';
  if(level === 'A') return '4小时内';
  if(level === 'B') return '24小时内';
  return '尽快人工复核';
}

function nextActionByLevel(level, evt){
  if(level === 'S') return '快速复核 → 转正式项目';
  if(level === 'A') return evt.sourceType === 'site' ? '拆词 → 转机会词/观察池' : '补数 → 转观察池';
  if(level === 'B') return '继续监控';
  return '人工复核风险';
}

function buildActionPlan(alert){
  if(alert.level === 'S') return '2小时内复核站内搜索结果、竞品结构与风险灯；通过后转正式项目，并决定是否进入待抢上。';
  if(alert.level === 'A') return alert.sourceType === 'site'
    ? '4小时内拆出核心词、补独立站截图和类目归因，再决定转机会词或观察池。'
    : '4小时内补卖家精灵 / 社媒 / 独立站数据，给出是否升级正式项目结论。';
  if(alert.level === 'B') return '加入监控任务继续观察，等待下一轮异动再升级。';
  return '立即人工复核知识产权、受限品或敏感宣称风险，未复核前暂停推进。';
}

function deriveRiskLamp(evt){
  const text = `${evt.object || ''} ${evt.summary || ''}`.toLowerCase();
  if(evt.type === '风险变化' || /ip|trademark|patent|受限|restricted|fda|medical|claim/.test(text)) return '橙色';
  if(/warning|敏感|功效/.test(text)) return '黄色';
  return '绿色';
}

function alertLevelFromEvent(evt){
  if(evt.type === '风险变化') return 'R';
  if(evt.type === '热度上升' && evt.priority === '高') return 'S';
  if(evt.type === '新品上架' && evt.priority === '高') return 'A';
  if(['来源新增','关键词扩散','新品上架'].includes(evt.type)) return 'A';
  return evt.priority === '高' ? 'A' : 'B';
}

function resolveKeywordFromAlert(alert){
  if(alert.sourceType === 'keyword'){
    const word = state.words.find(x=>String(x.id)===String(alert.sourceId));
    return word?.keyword || alert.name;
  }
  const site = state.siteResources.find(x=>String(x.id)===String(alert.sourceId));
  return site?.keyword || extractKeywordFromUrl(site?.url || '') || alert.name;
}

function ensureActionCardFromAlert(alert){
  let card = state.actionCards.find(x=>x.sourceType===alert.sourceType && String(x.sourceId)===String(alert.sourceId) && !['已完成','已放弃'].includes(x.status));
  if(card){
    card.priority = alert.level;
    card.owner = alert.assignee;
    card.sla = alert.deadline;
    card.plan = buildActionPlan(alert);
    card.recommendedAction = alert.nextAction;
    card.updatedAt = nowText();
    return card;
  }
  card = {
    id: Date.now()+Math.random(),
    alertId: alert.id,
    name: alert.name,
    sourceType: alert.sourceType,
    sourceId: alert.sourceId,
    owner: alert.assignee,
    priority: alert.level,
    sla: alert.deadline,
    plan: buildActionPlan(alert),
    recommendedAction: alert.nextAction,
    status: '待接单',
    createdAt: nowText(),
    updatedAt: nowText()
  };
  state.actionCards.unshift(card);
  state.actionCards = state.actionCards.slice(0,60);
  return card;
}

function ensureOpportunityAlertFromEvent(evt){
  let alert = state.alerts.find(x=>x.sourceType===evt.sourceType && String(x.sourceId)===String(evt.sourceId) && x.eventType===evt.type && !['已转正式项目','已放弃'].includes(x.status));
  const level = alertLevelFromEvent(evt);
  if(alert){
    if(levelRank(level) > levelRank(alert.level)) alert.level = level;
    alert.triggerSummary = evt.summary;
    alert.triggerReason = evt.type;
    alert.riskLamp = deriveRiskLamp(evt);
    alert.updatedAt = nowText();
    return alert;
  }
  alert = {
    id: Date.now()+Math.random(),
    name: evt.name,
    object: evt.object,
    sourceType: evt.sourceType,
    sourceId: evt.sourceId,
    sourceLabel: evt.sourceType === 'keyword' ? '词库/监控' : '独立站/监控',
    level,
    triggerReason: evt.type,
    triggerSummary: evt.summary,
    riskLamp: deriveRiskLamp(evt),
    aiAdvice: '待 AI 补充结论',
    assignee: inferOwnerByName(evt.name),
    deadline: deadlineByLevel(level),
    nextAction: nextActionByLevel(level, evt),
    status: '新发现',
    pushedAt: nowText(),
    updatedAt: nowText()
  };
  state.alerts.unshift(alert);
  state.alerts = state.alerts.slice(0,60);
  return alert;
}

function syncAlertFromAiTask(task){
  const alert = state.alerts.find(x=>x.sourceType===task.sourceType && String(x.sourceId)===String(task.sourceId));
  if(!alert) return null;
  if(task.sourceType === 'keyword'){
    if(task.reason === '热度上升'){
      alert.level = 'S';
      alert.aiAdvice = '建议 2 小时内快速复核，并优先转正式项目。';
      alert.nextAction = '快速复核 → 转正式项目';
    } else if(task.reason === '来源新增'){
      alert.level = levelRank(alert.level) >= levelRank('A') ? alert.level : 'A';
      alert.aiAdvice = '建议补卖家精灵/独立站数据后升级观察。';
      alert.nextAction = '转观察池 / 补数';
    } else if(task.reason === '风险变化'){
      alert.level = 'R';
      alert.riskLamp = '橙色';
      alert.aiAdvice = '建议暂停推进并人工复核知识产权/受限风险。';
      alert.nextAction = '人工复核';
    } else {
      alert.aiAdvice = '继续观察即可。';
    }
  } else {
    if(task.reason === '新品上架'){
      alert.level = 'A';
      alert.aiAdvice = '建议拆词转机会词，并由独立站研究岗 4 小时内补站点截图。';
      alert.nextAction = '拆词 → 转机会词';
    } else {
      alert.aiAdvice = '继续监控，连续两轮异动再升级处理。';
      alert.nextAction = '继续监控';
    }
  }
  alert.deadline = deadlineByLevel(alert.level);
  alert.assignee = inferOwnerByName(alert.name);
  alert.status = '已推送';
  alert.updatedAt = nowText();
  ensureActionCardFromAlert(alert);
  return alert;
}

function dispatchAlert(id){
  const alert = state.alerts.find(x=>String(x.id)===String(id));
  if(!alert) return;
  alert.status = '已推送';
  alert.updatedAt = nowText();
  ensureActionCardFromAlert(alert);
  renderOpportunityFlow(`已派出机会卡：${alert.name}`);
}

function pushAlertToWatch(id){
  const alert = state.alerts.find(x=>String(x.id)===String(id));
  if(!alert) return;
  const keyword = resolveKeywordFromAlert(alert);
  if(keyword && !state.watch.find(x=>x.keyword===keyword)){
    state.watch.unshift({ id:Date.now()+Math.random(), keyword, score: alert.level==='S'?82:72, trend:'上升', risk: alert.riskLamp==='橙色'?'高':'低', tags:[alert.sourceLabel], status:'待复核', model:'机会预警推入' });
  }
  alert.status = '已转观察池';
  alert.updatedAt = nowText();
  renderWatch();
  renderOpportunityFlow(`已把 ${keyword || alert.name} 推入观察池。`);
}

function pushAlertToProject(id){
  const alert = state.alerts.find(x=>String(x.id)===String(id));
  if(!alert) return;
  const keyword = resolveKeywordFromAlert(alert);
  if(keyword) transferToProject(keyword);
  alert.status = '已转正式项目';
  alert.updatedAt = nowText();
  renderProjects();
  renderPipeline();
  renderOpportunityFlow(`已把 ${keyword || alert.name} 转入正式项目。`);
}

function claimActionCard(id){
  const card = state.actionCards.find(x=>String(x.id)===String(id));
  if(!card) return;
  card.status = '执行中';
  card.updatedAt = nowText();
  renderOpportunityFlow(`已接单：${card.name}`);
}

function completeActionCard(id){
  const card = state.actionCards.find(x=>String(x.id)===String(id));
  if(!card) return;
  if(card.recommendedAction.includes('正式项目')) pushAlertToProject(card.alertId);
  else if(card.recommendedAction.includes('观察池') || card.recommendedAction.includes('机会词')) pushAlertToWatch(card.alertId);
  card.status = '已完成';
  card.updatedAt = nowText();
  renderOpportunityFlow(`已完成行动卡：${card.name}`);
}

function dropActionCard(id){
  const card = state.actionCards.find(x=>String(x.id)===String(id));
  if(!card) return;
  card.status = '已放弃';
  card.updatedAt = nowText();
  const alert = state.alerts.find(x=>String(x.id)===String(card.alertId));
  if(alert){ alert.status = '已放弃'; alert.updatedAt = nowText(); }
  renderOpportunityFlow(`已放弃行动卡：${card.name}`);
}

function dispatchAllAlerts(){
  const targets = state.alerts.filter(x=>['新发现','待处理'].includes(x.status));
  if(!targets.length){ renderOpportunityFlow('当前没有待派单的预警。'); return; }
  targets.forEach(a=>{ a.status='已推送'; a.updatedAt=nowText(); ensureActionCardFromAlert(a); });
  renderOpportunityFlow(`已批量派单 ${targets.length} 条预警。`);
}

function pushTopAlertsToProject(){
  const targets = state.alerts.filter(x=>x.level==='S' && !['已转正式项目','已放弃'].includes(x.status));
  if(!targets.length){ renderOpportunityFlow('当前没有可直接转正式项目的 S 级预警。'); return; }
  targets.forEach(a=>pushAlertToProject(a.id));
  renderOpportunityFlow(`已把 ${targets.length} 条 S 级预警转入正式项目。`);
}

function renderOpportunityFlow(message){
  $('alertCount').textContent = state.alerts.length;
  $('alertSCount').textContent = state.alerts.filter(x=>x.level==='S').length;
  $('alertACount').textContent = state.alerts.filter(x=>x.level==='A').length;
  $('alertPendingCount').textContent = state.alerts.filter(x=>['新发现','已推送','待处理'].includes(x.status)).length;

  $('alertTable').innerHTML = state.alerts.length ? state.alerts.slice(0,30).map(alert=>`
    <tr>
      <td><b>${alert.name}</b><div class="small muted">${alert.sourceLabel} / ${alert.object}</div></td>
      <td><span class="badge ${alert.level==='S'?'green':alert.level==='A'?'blue':alert.level==='B'?'yellow':'red'}">${alert.level==='R'?'风险预警':alert.level+'级'}</span></td>
      <td>${alert.triggerReason}<div class="small muted">${alert.triggerSummary}</div></td>
      <td><span class="badge ${alert.riskLamp==='绿色'?'green':alert.riskLamp==='黄色'?'yellow':alert.riskLamp==='橙色'?'orange':'red'}">${alert.riskLamp}</span></td>
      <td>${alert.aiAdvice}</td>
      <td>${alert.assignee}</td>
      <td>${alert.deadline}</td>
      <td><span class="badge ${['已转正式项目'].includes(alert.status)?'green':['已放弃'].includes(alert.status)?'gray':['已推送','已转观察池'].includes(alert.status)?'blue':'yellow'}">${alert.status}</span></td>
      <td>
        <button class="btn-ghost small" data-alert-dispatch="${alert.id}">派单</button>
        <button class="btn-ghost small" data-alert-watch="${alert.id}">转观察池</button>
        <button class="btn-ghost small" data-alert-project="${alert.id}">转正式项目</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="9" class="muted">暂无机会预警</td></tr>';

  document.querySelectorAll('[data-alert-dispatch]').forEach(btn=>btn.onclick=()=>dispatchAlert(btn.dataset.alertDispatch));
  document.querySelectorAll('[data-alert-watch]').forEach(btn=>btn.onclick=()=>pushAlertToWatch(btn.dataset.alertWatch));
  document.querySelectorAll('[data-alert-project]').forEach(btn=>btn.onclick=()=>pushAlertToProject(btn.dataset.alertProject));

  $('actionTable').innerHTML = state.actionCards.length ? state.actionCards.slice(0,30).map(card=>`
    <tr>
      <td><b>${card.name}</b><div class="small muted">${card.sourceType==='keyword'?'机会词/监控':'独立站/监控'} / ${card.createdAt}</div></td>
      <td>${card.owner}</td>
      <td><span class="badge ${card.priority==='S'?'green':card.priority==='A'?'blue':card.priority==='B'?'yellow':'red'}">${card.priority==='R'?'风险':'P'+card.priority}</span></td>
      <td>${card.sla}</td>
      <td>${card.plan}</td>
      <td>${card.recommendedAction}</td>
      <td><span class="badge ${card.status==='已完成'?'green':card.status==='执行中'?'blue':card.status==='已放弃'?'gray':'yellow'}">${card.status}</span></td>
      <td>
        <button class="btn-ghost small" data-action-claim="${card.id}">接单</button>
        <button class="btn-ghost small" data-action-done="${card.id}">完成</button>
        <button class="btn-ghost small" data-action-drop="${card.id}">放弃</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="8" class="muted">暂无行动卡</td></tr>';

  document.querySelectorAll('[data-action-claim]').forEach(btn=>btn.onclick=()=>claimActionCard(btn.dataset.actionClaim));
  document.querySelectorAll('[data-action-done]').forEach(btn=>btn.onclick=()=>completeActionCard(btn.dataset.actionDone));
  document.querySelectorAll('[data-action-drop]').forEach(btn=>btn.onclick=()=>dropActionCard(btn.dataset.actionDrop));

  $('alertStatus').textContent = message || (state.alerts.length ? '系统会把高价值异动自动整理成机会预警卡，并把 AI 建议、负责人和截止时间一起推给运营。' : '当前还没有机会预警。等词库、独立站或监控任务出现重要异动后，系统会自动生成机会卡并推给运营。');
  $('actionStatus').textContent = state.actionCards.length ? `当前共有 ${state.actionCards.length} 张行动卡。建议优先处理 S 级和已推送但未接单任务。` : '当前还没有行动卡。预警进入 AI 判读或被派单后，会自动生成执行卡。';
}

function syncWordTasks(){
  let added = 0;
  state.words.forEach(word=>{
    if(!state.keywordMonitors.find(x=>String(x.refId)===String(word.id))){
      state.keywordMonitors.unshift(createKeywordMonitor(word));
      added++;
    }
  });
  renderSurveillance(added ? `已同步 ${added} 个词库监控任务。` : '词库监控任务已是最新。');
}

function syncSiteTasks(){
  let added = 0;
  state.siteResources.forEach(site=>{
    if(!state.siteMonitors.find(x=>String(x.refId)===String(site.id))){
      state.siteMonitors.unshift(createSiteMonitor(site));
      added++;
    }
  });
  renderSurveillance(added ? `已同步 ${added} 个独立站监控任务。` : '独立站监控任务已是最新。');
}

function evaluateKeywordAnomaly(task){
  const delta = Math.floor(Math.random()*10) - 2;
  const sourceDelta = Math.random() > .72 ? 1 : 0;
  const riskUp = /fda approved|hair growth|medical|cure/i.test(task.name) && Math.random() > .55;
  const oldScore = task.score || 0;
  task.score = clamp(oldScore + delta, 0, 100);
  task.sourceCount = Math.max(1, (task.sourceCount||1) + sourceDelta);
  task.updatedAt = nowText();
  task.lastSnapshot = `分数 ${task.score} / 来源 ${task.sourceCount}`;
  let event = null;
  if(riskUp){
    task.status = '风险上升';
    task.lastAnomaly = '风险灯上升';
    task.suggestedAction = '转人工复核';
    task.aiStatus = '待判读';
    event = { object:`关键词：${task.name}`, type:'风险变化', summary:'检测到敏感宣称/IP/受限风险信号上升', priority:'高', suggestion:'优先 AI 风险判读，并决定是否暂停推进', sourceType:'keyword', sourceId:task.refId, name:task.name };
  } else if(delta >= 8 || sourceDelta >= 1){
    task.status = delta >= 8 ? '爆发' : '待升级';
    task.lastAnomaly = delta >= 8 ? `评分上涨 ${delta} 分` : '新增来源信号';
    task.suggestedAction = 'AI判断是否转观察池/正式项目';
    task.aiStatus = '待判读';
    event = { object:`关键词：${task.name}`, type: delta >=8 ? '热度上升' : '来源新增', summary: delta >=8 ? `综合评分从 ${oldScore} 提升到 ${task.score}` : `来源数增加到 ${task.sourceCount}` , priority: delta >=8 ? '高' : '中', suggestion:'让 AI 判断是否升级优先级', sourceType:'keyword', sourceId:task.refId, name:task.name };
  } else if(delta <= -4){
    task.status = '回落';
    task.lastAnomaly = `评分回落 ${Math.abs(delta)} 分`;
    task.suggestedAction = '继续观察';
  } else {
    task.status = '正常';
    task.lastAnomaly = '-';
    task.suggestedAction = '继续观察';
  }
  return event;
}

function evaluateSiteAnomaly(task){
  const newProducts = Math.random() > .55 ? Math.floor(Math.random()*3)+1 : 0;
  const priceChanges = Math.random() > .7 ? Math.floor(Math.random()*2)+1 : 0;
  const keywordSpread = Math.random() > .72 ? 1 : 0;
  task.newProducts = newProducts;
  task.priceChanges = priceChanges;
  task.keywordSpread = (task.keywordSpread||0) + keywordSpread;
  task.updatedAt = nowText();
  task.lastSnapshot = `新品 ${newProducts} / 价格变动 ${priceChanges} / 词扩散 ${task.keywordSpread||0}`;
  let event = null;
  if(newProducts > 0){
    task.status = '新上产品';
    task.lastAnomaly = `新增 ${newProducts} 个产品`;
    task.suggestedAction = 'AI拆关键词并转机会词';
    task.aiStatus = '待判读';
    event = { object:`站点：${task.name}`, type:'新品上架', summary:`监控到 ${newProducts} 个新产品，建议拆词和场景`, priority:'高', suggestion:'推送 AI 识别新品价值并转词库', sourceType:'site', sourceId:task.refId, name:task.name };
  } else if(priceChanges > 0 || keywordSpread > 0){
    task.status = keywordSpread > 0 ? '高关注' : '扩品中';
    task.lastAnomaly = keywordSpread > 0 ? '重点词扩散' : `价格变动 ${priceChanges} 处`;
    task.suggestedAction = 'AI判断是否值得跟踪';
    task.aiStatus = '待判读';
    event = { object:`站点：${task.name}`, type: keywordSpread > 0 ? '关键词扩散' : '价格变动', summary: keywordSpread > 0 ? `重点词覆盖新增 ${keywordSpread}` : `发现 ${priceChanges} 处价格波动`, priority:'中', suggestion:'AI判断是普通调整还是新品信号', sourceType:'site', sourceId:task.refId, name:task.name };
  } else {
    task.status = '正常';
    task.lastAnomaly = '-';
    task.suggestedAction = '继续监控';
  }
  return event;
}

function refreshSurveillance(){
  const events = [];
  state.keywordMonitors.forEach(task=>{
    const evt = evaluateKeywordAnomaly(task);
    if(evt) events.push(addMonitorEvent(evt));
  });
  state.siteMonitors.forEach(task=>{
    const evt = evaluateSiteAnomaly(task);
    if(evt) events.push(addMonitorEvent(evt));
  });
  events.forEach(evt=>queueAiTask({ name: evt.name, sourceType: evt.sourceType, sourceId: evt.sourceId, reason: evt.type, priority: evt.priority }));
  renderSurveillance(events.length ? `本轮刷新发现 ${events.length} 条异动，已自动推入 AI 判读队列。` : '本轮刷新没有发现高优异动，系统已更新快照。');
}

function runAiTask(id){
  const task = state.aiQueue.find(x=>String(x.id)===String(id));
  if(!task) return;
  task.status = '已完成';
  if(task.sourceType === 'keyword'){
    const monitor = state.keywordMonitors.find(x=>String(x.refId)===String(task.sourceId));
    if(monitor){
      if(task.reason === '热度上升' || task.reason === '来源新增'){
        task.conclusion = 'AI判断：建议升级为重点观察，满足条件时转正式项目。';
        monitor.aiStatus = '已判读';
        monitor.suggestedAction = '升级观察 / 评估立项';
      }else if(task.reason === '风险变化'){
        task.conclusion = 'AI判断：建议人工复核知识产权/受限风险，暂缓推进。';
        monitor.aiStatus = '已判读';
        monitor.suggestedAction = '人工复核';
      } else {
        task.conclusion = 'AI判断：继续跟踪即可。';
        monitor.aiStatus = '已判读';
      }
    }
  } else {
    const monitor = state.siteMonitors.find(x=>String(x.refId)===String(task.sourceId));
    if(monitor){
      if(task.reason === '新品上架'){
        task.conclusion = 'AI判断：建议拆出核心词并推入机会词库，同时标记为高关注站点。';
        monitor.aiStatus = '已判读';
        monitor.suggestedAction = '拆词转机会词';
      } else {
        task.conclusion = 'AI判断：先继续监控，若连续两轮异动再升级处理。';
        monitor.aiStatus = '已判读';
        monitor.suggestedAction = '继续监控';
      }
    }
  }
  syncAlertFromAiTask(task);
  renderSurveillance(`已完成 1 条 AI 判读：${task.name} / ${task.reason}`);
  renderOpportunityFlow(`已完成 1 条 AI 判读：${task.name} / ${task.reason}`);
}

function runAiSweep(){
  const pending = state.aiQueue.filter(x=>x.status!=='已完成');
  if(!pending.length){ renderSurveillance('当前没有待判读任务。'); return; }
  pending.forEach(task=>runAiTask(task.id));
  renderSurveillance(`已批量完成 ${pending.length} 条 AI 判读。`);
}

function removeMonitorTask(kind, id){
  if(kind==='keyword') state.keywordMonitors = state.keywordMonitors.filter(x=>String(x.refId)!==String(id));
  else state.siteMonitors = state.siteMonitors.filter(x=>String(x.refId)!==String(id));
  renderSurveillance('已移除 1 条监控任务。');
}

function pushEventToAi(id){
  const evt = state.monitorEvents.find(x=>String(x.id)===String(id));
  if(!evt) return;
  queueAiTask({ name: evt.name, sourceType: evt.sourceType, sourceId: evt.sourceId, reason: evt.type, priority: evt.priority });
  renderSurveillance(`已把事件“${evt.type}”推入 AI 判读队列。`);
}

function toggleTaskAuto(){
  state.taskAuto = !state.taskAuto;
  if(state.taskAuto){
    state.taskTimer = setInterval(refreshSurveillance, 12000);
    renderSurveillance('已开启自动监控（演示：每 12 秒刷新一轮快照与异动）。');
  } else {
    clearInterval(state.taskTimer);
    state.taskTimer = null;
    renderSurveillance('已关闭自动监控。');
  }
}

function renderSurveillance(message){
  const tasks = [
    ...state.keywordMonitors.map(x=>({...x, typeLabel:'词库'})),
    ...state.siteMonitors.map(x=>({...x, typeLabel:'独立站'}))
  ];
  $('taskCount').textContent = tasks.length;
  $('taskKeywordCount').textContent = state.keywordMonitors.length;
  $('taskSiteCount').textContent = state.siteMonitors.length;
  $('taskAlertCount').textContent = tasks.filter(x=>['爆发','风险上升','新上产品','高关注','待升级'].includes(x.status)).length;
  $('taskTable').innerHTML = tasks.length ? tasks.map(item=>`
    <tr>
      <td><b>${item.name}</b><div class="small muted">${item.category || '-'} / ${item.source || '-'}</div></td>
      <td>${item.typeLabel}</td>
      <td>${item.freq}</td>
      <td>${item.lastSnapshot}</td>
      <td><span class="badge ${['爆发','新上产品'].includes(item.status)?'green':['风险上升'].includes(item.status)?'red':['高关注','待升级','扩品中'].includes(item.status)?'yellow':'gray'}">${item.status}</span></td>
      <td><span class="badge ${item.aiStatus==='已判读'?'green':'blue'}">${item.aiStatus}</span></td>
      <td>${item.lastAnomaly || '-'}</td>
      <td>${item.suggestedAction || '-'}</td>
      <td>
        <button class="btn-ghost small" data-task-refresh="${item.type}_${item.refId}">刷新</button>
        <button class="btn-ghost small" data-task-ai="${item.type}_${item.refId}">AI判读</button>
        <button class="btn-ghost small" data-task-remove="${item.type}_${item.refId}">移除</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="9" class="muted">暂无监控任务</td></tr>';
  document.querySelectorAll('[data-task-refresh]').forEach(btn=>btn.onclick=()=>{ const [kind,id]=btn.dataset.taskRefresh.split('_'); if(kind==='keyword'){ const t=state.keywordMonitors.find(x=>String(x.refId)===String(id)); const evt=t && evaluateKeywordAnomaly(t); if(evt){ const added=addMonitorEvent(evt); queueAiTask({ name: added.name, sourceType: added.sourceType, sourceId: added.sourceId, reason: added.type, priority: added.priority }); } } else { const t=state.siteMonitors.find(x=>String(x.refId)===String(id)); const evt=t && evaluateSiteAnomaly(t); if(evt){ const added=addMonitorEvent(evt); queueAiTask({ name: added.name, sourceType: added.sourceType, sourceId: added.sourceId, reason: added.type, priority: added.priority }); } } renderSurveillance('已刷新 1 条监控任务。'); });
  document.querySelectorAll('[data-task-ai]').forEach(btn=>btn.onclick=()=>{ const [kind,id]=btn.dataset.taskAi.split('_'); const task = queueAiTask({ name: (kind==='keyword'?state.keywordMonitors.find(x=>String(x.refId)===String(id))?.name:state.siteMonitors.find(x=>String(x.refId)===String(id))?.name) || '监控对象', sourceType: kind, sourceId:id, reason:'手动判读', priority:'中' }); renderSurveillance(`已把 ${task.name} 推入 AI 队列。`); });
  document.querySelectorAll('[data-task-remove]').forEach(btn=>btn.onclick=()=>{ const [kind,id]=btn.dataset.taskRemove.split('_'); removeMonitorTask(kind,id); });

  $('eventTable').innerHTML = state.monitorEvents.length ? state.monitorEvents.slice(0,30).map(evt=>`
    <tr>
      <td>${evt.time}</td>
      <td>${evt.object}</td>
      <td>${evt.type}</td>
      <td>${evt.summary}</td>
      <td><span class="badge ${evt.priority==='高'?'red':evt.priority==='中'?'yellow':'gray'}">${evt.priority}</span></td>
      <td>${evt.suggestion}</td>
      <td><button class="btn-ghost small" data-event-ai="${evt.id}">推AI</button></td>
    </tr>
  `).join('') : '<tr><td colspan="7" class="muted">暂无异动事件</td></tr>';
  document.querySelectorAll('[data-event-ai]').forEach(btn=>btn.onclick=()=>pushEventToAi(btn.dataset.eventAi));

  $('aiQueueTable').innerHTML = state.aiQueue.length ? state.aiQueue.slice(0,30).map(task=>`
    <tr>
      <td>${task.name}</td>
      <td>${task.reason}</td>
      <td><span class="badge ${task.priority==='高'?'red':task.priority==='中'?'yellow':'gray'}">${task.priority}</span></td>
      <td><span class="badge ${task.status==='已完成'?'green':'blue'}">${task.status}</span></td>
      <td>${task.conclusion}</td>
      <td>${task.createdAt}</td>
      <td>${task.status==='已完成' ? '<span class="small muted">已完成</span>' : `<button class="btn-ghost small" data-ai-run="${task.id}">立即判读</button>`}</td>
    </tr>
  `).join('') : '<tr><td colspan="7" class="muted">暂无 AI 队列任务</td></tr>';
  document.querySelectorAll('[data-ai-run]').forEach(btn=>btn.onclick=()=>runAiTask(btn.dataset.aiRun));

  $('surveillanceStatus').textContent = message || (tasks.length ? `当前正在监控 ${tasks.length} 个对象。系统会对词库关注热度、来源、风险变化，对独立站关注新品、价格、关键词扩散，并自动推入 AI 队列。` : '当前还没有监控任务。你把词库和独立站投喂后，可以在这里同步成监控任务，由 AI 负责判读异动和升级建议。');
  $('aiQueueStatus').textContent = state.aiQueue.some(x=>x.status!=='已完成') ? `当前待 AI 判读 ${state.aiQueue.filter(x=>x.status!=='已完成').length} 条。建议先处理高优异动。` : '当前还没有待判读任务。';
  renderOpportunityFlow();
  updateTopChips();
}


function nowText(){
  return new Date().toLocaleString('zh-CN', { hour12:false });
}

function createSkuFromKeyword(keyword){
  return 'SKU-' + (keyword || 'demo').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toUpperCase().slice(0,18);
}

function createAsin(){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = 'B0';
  while(out.length < 10) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}


function mapProjectStatusFromStage(stage){
  if(stage==='待抢上') return '正式项目';
  if(['抢上中','抢上成功'].includes(stage)) return '抢上推进';
  if(stage==='转开发中') return '转开发中';
  if(stage==='FBM测品中') return 'FBM测品';
  if(stage==='待复盘') return '待复盘';
  if(stage==='开发通过') return '开发通过';
  if(stage==='淘汰') return '淘汰';
  return '正式项目';
}

function createPipelineFromProject(project){
  return {
    id: Date.now() + Math.random(),
    projectId: project.id,
    project: project.project,
    source: project.source,
    owner: project.owner || '负责人待定',
    marketplace: project.marketplace || 'US',
    sku: project.sku || createSkuFromKeyword(project.source),
    asin: project.asin || createAsin(),
    stage: project.launchStatus || '待抢上',
    rushMembers: project.teamMembers || 1,
    rushHealth: evaluateTeamHealthByMembers(project.teamMembers || 1),
    devStatus: '待安排',
    testStartAt: '-',
    testDays: 0,
    impressions: 0,
    clicks: 0,
    ctr: '-',
    orders: 0,
    cvr: '-',
    review: '待验证',
    cycleCount: 0,
    nextAction: '安排抢上'
  };
}

function syncProjectsToPipeline(silent=false){
  let added = 0;
  state.projects.forEach(project=>{
    if(!state.pipeline.find(x=>String(x.projectId)===String(project.id))){
      state.pipeline.unshift(createPipelineFromProject(project));
      added += 1;
    }
  });
  renderPipeline(added ? `已从正式项目池同步 ${added} 个项目到执行池。` : (silent ? undefined : '暂无新的正式项目需要同步。'));
}

function calcRate(numerator, denominator){
  if(!denominator) return '-';
  return ((numerator/denominator)*100).toFixed(1) + '%';
}

function percentValue(value){
  if(value == null || value === '-' || value === '') return 0;
  return Number(String(value).replace('%','')) || 0;
}

function getMonitorByProjectId(projectId){
  return state.monitors.find(m=>String(m.projectId)===String(projectId));
}

function evaluatePipelineRisk(item){
  const text = `${item.project||''} ${item.source||''} ${item.devStatus||''} ${item.review||''}`.toLowerCase();
  const monitor = getMonitorByProjectId(item.projectId);
  const issuesCount = Number(monitor?.issuesCount || 0);
  const groups = {
    ip: ['disney','nike','colgate','apple','lego','pokemon','marvel'],
    restricted: ['supplement','melatonin','pain relief','medical device','prescription','fda approved'],
    claim: ['cure','treat','medical','therapeutic','antibacterial','heal','whitening guarantee'],
    detail: ['compare to','compatible with','best on amazon','for colgate','top 1']
  };
  const hits = { ip: [], restricted: [], claim: [], detail: [] };
  Object.entries(groups).forEach(([key, arr])=>{ arr.forEach(word=>{ if(text.includes(word)) hits[key].push(word); }); });
  const reasons = [];
  let level = '绿色';
  let badge = 'green';
  let advice = '可推进';

  if(issuesCount > 0 || hits.ip.length){
    level = '红色'; badge = 'red'; advice = '暂停/淘汰';
    if(hits.ip.length) reasons.push(`命中疑似知识产权词：${hits.ip.join('、')}`);
    if(issuesCount > 0) reasons.push(`监控中心存在 ${issuesCount} 个 issue`);
  } else if(hits.restricted.length || hits.claim.length){
    level = '橙色'; badge = 'orange'; advice = '人工复核';
    if(hits.restricted.length) reasons.push(`存在受限/高敏信号：${hits.restricted.join('、')}`);
    if(hits.claim.length) reasons.push(`存在宣称风险：${hits.claim.join('、')}`);
  } else if(hits.detail.length || item.rushMembers > 4){
    level = '黄色'; badge = 'yellow'; advice = '整改后推进';
    if(hits.detail.length) reasons.push(`详情页/蹭词风险：${hits.detail.join('、')}`);
    if(item.rushMembers > 4) reasons.push('抢上协同人数超过 4 人上限');
  }

  if(!reasons.length) reasons.push('当前未命中明显红线，可继续推进。');
  return { level, badge, advice, reasons, hits, issuesCount };
}

function evaluatePipelineDecision(item){
  const risk = evaluatePipelineRisk(item);
  const clicks = Number(item.clicks || 0);
  const orders = Number(item.orders || 0);
  const testDays = Number(item.testDays || 0);
  const cvr = percentValue(item.cvr);

  if(risk.level === '红色'){
    return { result:'淘汰建议', badge:'red', reason:'命中红灯风险，优先暂停或淘汰。', next:'停止推进，先处理 IP / issue / 合规问题' };
  }
  if(['待抢上','抢上中','抢上成功','转开发中'].includes(item.stage)){
    return { result:'待测品', badge:'gray', reason:'先完成抢上与转开发，再看 FBM 测试结果。', next:'推进到 FBM 测品' };
  }
  if(risk.level === '橙色' && orders >= 3 && clicks >= 20){
    return { result:'人工复核', badge:'orange', reason:'数据有潜力，但受限/宣称风险需人工复核。', next:'人工审核后再决定开发通过' };
  }
  if(testDays >= 7 && clicks >= 20 && orders >= 3 && cvr >= 8 && risk.level !== '橙色'){
    return { result:'开发通过', badge:'green', reason:'点击、订单、CVR 达标，且风险可控。', next:'转正式开发 / 量产 / FBA' };
  }
  if(testDays >= 10 && (orders === 0 || cvr < 5)){
    return { result:'淘汰建议', badge:'red', reason:'测试周期已足，但订单或 CVR 明显不足。', next:'淘汰或退回观察池' };
  }
  return { result:'继续测品', badge:'yellow', reason:'样本量或转化数据还不够，继续测更稳。', next:'继续测 3–7 天并优化图/词/价' };
}

function governanceListHtml(title, items, emptyText){
  if(!items.length) return `<div class="muted">${emptyText}</div>`;
  return `<div class="section-title" style="font-size:14px;margin:0 0 10px">${title}</div><table><thead><tr><th>项目</th><th>风险灯</th><th>命中内容</th><th>建议</th></tr></thead><tbody>${items.map(entry=>`<tr><td><b>${entry.item.project}</b><div class="small muted">${entry.item.source}</div></td><td><span class="badge ${entry.risk.badge}">${entry.risk.level}</span></td><td>${entry.hitText}</td><td>${entry.risk.advice}</td></tr>`).join('')}</tbody></table>`;
}

function renderGovernance(){
  const entries = state.pipeline.map(item=>({ item, risk:evaluatePipelineRisk(item), decision:evaluatePipelineDecision(item) }));
  $('govGreenCount').textContent = entries.filter(x=>x.risk.level==='绿色').length;
  $('govYellowCount').textContent = entries.filter(x=>x.risk.level==='黄色').length;
  $('govOrangeCount').textContent = entries.filter(x=>x.risk.level==='橙色').length;
  $('govRedCount').textContent = entries.filter(x=>x.risk.level==='红色').length;
  if(!entries.length){
    $('govSummary').innerHTML = '当前还没有执行数据，待正式项目同步进入抢上/测品后，这里会自动计算风险灯、FBM通过线和开发通过建议。';
    return;
  }
  const passCount = entries.filter(x=>x.decision.result==='开发通过').length;
  const continueCount = entries.filter(x=>x.decision.result==='继续测品').length;
  const reviewCount = entries.filter(x=>x.decision.result==='人工复核').length;
  const rejectCount = entries.filter(x=>x.decision.result==='淘汰建议').length;
  $('govSummary').innerHTML = `当前执行池 <b>${entries.length}</b> 个项目：<span class="badge green">开发通过 ${passCount}</span> <span class="badge yellow">继续测品 ${continueCount}</span> <span class="badge orange">人工复核 ${reviewCount}</span> <span class="badge red">淘汰建议 ${rejectCount}</span><div class="risk-note" style="margin-top:8px">规则重点：正式项目先通过基础风险筛查；抢上前再审一次；FBM 测品后按天数、点击、订单、CVR 与风险灯共同决策。</div>`;
}

function renderRiskCenter(){
  const entries = state.pipeline.map(item=>{
    const risk = evaluatePipelineRisk(item);
    const hitText = [
      risk.hits.ip.length ? `IP：${risk.hits.ip.join('、')}` : '',
      risk.hits.restricted.length ? `受限：${risk.hits.restricted.join('、')}` : '',
      risk.hits.claim.length ? `宣称：${risk.hits.claim.join('、')}` : '',
      risk.hits.detail.length ? `详情：${risk.hits.detail.join('、')}` : '',
      risk.issuesCount ? `监控 issue：${risk.issuesCount}` : ''
    ].filter(Boolean).join('；') || '当前未命中明显风险';
    return { item, risk, hitText };
  });
  $('pane-ip').innerHTML = governanceListHtml('知识产权风险清单', entries.filter(x=>x.risk.hits.ip.length || x.risk.issuesCount), '当前没有明显知识产权或 issue 风险。');
  $('pane-restricted').innerHTML = governanceListHtml('受限品 / 高敏类风险', entries.filter(x=>x.risk.hits.restricted.length), '当前没有明显受限品风险。');
  $('pane-claim').innerHTML = governanceListHtml('宣称风险清单', entries.filter(x=>x.risk.hits.claim.length), '当前没有明显宣称风险。');
  $('pane-detail').innerHTML = governanceListHtml('详情页 / 蹭词风险', entries.filter(x=>x.risk.hits.detail.length || x.item.rushMembers > 4), '当前没有明显详情页或蹭词风险。');
}

function updateProjectFromPipeline(item){
  state.projects = state.projects.map(project=> String(project.id)===String(item.projectId)
    ? { ...project, status: mapProjectStatusFromStage(item.stage), launchStatus: item.stage, teamMembers:item.rushMembers, teamHealth:item.rushHealth }
    : project
  );
}

function advancePipelineItem(item, boost=false){
  const next = { ...item, cycleCount:(item.cycleCount||0)+1 };
  if(next.stage === '待抢上'){
    next.stage = '抢上中';
    next.nextAction = '推进链接创建与抢坑位';
  } else if(next.stage === '抢上中'){
    next.stage = '抢上成功';
    next.nextAction = '确认坑位稳定，准备转开发';
  } else if(next.stage === '抢上成功'){
    next.stage = '转开发中';
    next.devStatus = '页面 / 供应链 / SKU 方案准备中';
    next.nextAction = '整理 FBM 测品方案';
  } else if(next.stage === '转开发中'){
    next.stage = 'FBM测品中';
    next.devStatus = '已进入 FBM 测试';
    if(next.testStartAt === '-') next.testStartAt = nowText();
    next.testDays = Math.max(next.testDays, 1);
    next.impressions = Math.max(next.impressions, boost ? 480 : 120 + next.cycleCount*90);
    next.clicks = Math.max(next.clicks, boost ? 42 : 8 + next.cycleCount*6);
    next.orders = Math.max(next.orders, boost ? 5 : Math.floor(next.clicks/10));
    next.ctr = calcRate(next.clicks, next.impressions);
    next.cvr = calcRate(next.orders, next.clicks);
    next.review = 'FBM测试进行中';
    next.nextAction = '继续观察 7–14 天';
  } else if(next.stage === 'FBM测品中'){
    const risk = evaluatePipelineRisk(next);
    next.testDays += boost ? 7 : 3;
    next.impressions += boost ? 600 : 160 + next.cycleCount*40;
    next.clicks += boost ? 50 : 10 + next.cycleCount*4;
    next.orders += risk.level === '红色' ? 0 : (boost ? 6 : Math.max(1, Math.floor((next.clicks||1)/14)));
    next.ctr = calcRate(next.clicks, next.impressions);
    next.cvr = calcRate(next.orders, next.clicks);
    if(next.testDays >= 10 || boost){
      next.stage = '待复盘';
      next.nextAction = '进入复盘，按风险灯 + FBM通过线决策';
      next.review = '待复盘（系统将给出开发通过 / 继续测品 / 淘汰建议）';
    }
  } else if(next.stage === '待复盘'){
    const decision = evaluatePipelineDecision(next);
    if(decision.result === '开发通过'){
      next.stage = '开发通过';
      next.review = 'FBM测品通过，建议正式开发 / 量产 / FBA';
      next.nextAction = '转正式开发';
    } else if(decision.result === '继续测品'){
      next.stage = 'FBM测品中';
      next.review = '复盘后建议继续测品';
      next.nextAction = '继续测 3–7 天并优化图/词/价';
      next.testDays += 3;
    } else if(decision.result === '人工复核'){
      next.stage = '待复盘';
      next.review = '数据有潜力，但需人工复核受限 / 宣称 / IP 风险';
      next.nextAction = '人工审核后再决定';
    } else {
      next.stage = '淘汰';
      next.review = 'FBM测品未达标，建议淘汰或退回观察';
      next.nextAction = '结束项目';
    }
  }
  next.rushHealth = evaluateTeamHealthByMembers(next.rushMembers);
  updateProjectFromPipeline(next);
  return next;
}

function progressSinglePipeline(id){
  state.pipeline = state.pipeline.map(item=> String(item.id)===String(id) ? advancePipelineItem(item, true) : item);
  renderProjects();
  renderPipeline('已推进单个执行项目。');
}
window.progressSinglePipeline = progressSinglePipeline;

function syncSinglePipelineToMonitoring(id){
  const target = state.pipeline.find(item=>String(item.id)===String(id));
  if(!target) return;
  if(['抢上中','抢上成功','转开发中','FBM测品中','待复盘'].includes(target.stage)){
    if(!state.monitors.find(m=>String(m.projectId)===String(target.projectId))){
      state.monitors.unshift(createMonitorFromPipeline(target));
      renderMonitoring('已将单个项目同步到上架监控中心。');
      return;
    }
  }
  renderMonitoring('该项目当前阶段暂不需要新增监控，或已在监控中。');
}
window.syncSinglePipelineToMonitoring = syncSinglePipelineToMonitoring;

function seedPipelineData(){
  if(!state.pipeline.length){ syncProjectsToPipeline(true); }
  state.pipeline = state.pipeline.map((item, idx)=>{
    let next = { ...item };
    const boosts = idx % 4;
    for(let i=0;i<=boosts;i++) next = advancePipelineItem(next, true);
    return next;
  });
  renderProjects();
  renderPipeline('已为执行池生成测试数据，方便直接查看抢上与 FBM 测品链路。');
}

function renderPipeline(message){
  $('pipePendingCount').textContent = state.pipeline.filter(p=>p.stage==='待抢上').length;
  $('pipeRushCount').textContent = state.pipeline.filter(p=>p.stage==='抢上中').length;
  $('pipeFbmCount').textContent = state.pipeline.filter(p=>p.stage==='FBM测品中').length;
  $('pipeReviewCount').textContent = state.pipeline.filter(p=>p.stage==='待复盘').length;
  $('pipelineStatus').innerHTML = message || (state.pipeline.length
    ? `当前执行池中有 <b>${state.pipeline.length}</b> 个项目。这里重点看抢上、转开发与 FBM 测品，同时把<b>风险评估灯、FBM通过线、开发通过建议</b>一起挂在执行链路上。`
    : '当前还没有执行中的项目。把正式项目同步进来后，这里会显示抢上、转开发和 FBM 测品链路。');
  $('pipelineTable').innerHTML = state.pipeline.map(item=>{
    const risk = evaluatePipelineRisk(item);
    const decision = evaluatePipelineDecision(item);
    return `
    <tr>
      <td>
        <div><b>${item.project}</b></div>
        <div class="small muted">${item.source}</div>
        <div class="small muted">${item.owner}</div>
      </td>
      <td><span class="badge ${item.stage==='开发通过'?'green':item.stage==='淘汰'?'red':item.stage==='FBM测品中'?'blue':item.stage==='待复盘'?'yellow':'gray'}">${item.stage}</span></td>
      <td><span class="badge ${risk.badge}">${risk.level}</span><div class="small muted" style="margin-top:6px">${risk.advice}</div></td>
      <td><div class="risk-note">${risk.reasons[0] || '无'}</div><div class="risk-line">${risk.hits.ip.length?'<span class="badge red">IP</span>':''}${risk.hits.restricted.length?'<span class="badge orange">受限</span>':''}${risk.hits.claim.length?'<span class="badge orange">宣称</span>':''}${risk.hits.detail.length?'<span class="badge yellow">详情</span>':''}${risk.issuesCount?'<span class="badge red">Issue</span>':''}</div></td>
      <td>${item.rushMembers}人</td>
      <td><span class="badge ${item.rushHealth==='人数超限'?'red':'green'}">${item.rushHealth}</span></td>
      <td>${item.devStatus}</td>
      <td>${item.testStartAt}</td>
      <td>${item.testDays}</td>
      <td>${item.impressions}</td>
      <td>${item.clicks}</td>
      <td>${item.ctr}</td>
      <td>${item.orders}</td>
      <td>${item.cvr}</td>
      <td><span class="badge ${decision.badge}">${decision.result}</span><div class="small muted" style="margin-top:6px">${decision.reason}</div></td>
      <td>${item.review}<div class="small muted">${item.nextAction}</div></td>
      <td>
        <button class="secondary" style="padding:6px 10px;margin-bottom:6px" onclick="progressSinglePipeline('${item.id}')">推进</button>
        <button class="secondary" style="padding:6px 10px" onclick="syncSinglePipelineToMonitoring('${item.id}')">同步监控</button>
      </td>
    </tr>`;
  }).join('');
  renderGovernance();
  renderRiskCenter();
}

function deriveMonitorStage(item){
  if(item.firstOrderAt) return '有订单';
  if(item.hasTraffic === '是') return '有流量';
  if(item.discoverable === '是') return '可搜索';
  if(item.buyable === '是') return '可售';
  if(item.submittedAt) return item.pollCount > 0 ? 'Amazon处理中' : '已提交';
  return '待上架';
}

function evaluateMonitorAlert(item){
  if((item.issuesCount||0) > 0) return '红色预警';
  if(item.quantity <= 0 && item.buyable === '是') return '红色预警';
  if(item.pollCount >= 6 && item.buyable !== '是') return '红色预警';
  if(item.pollCount >= 6 && item.discoverable !== '是') return '红色预警';
  if(item.buyable === '是' && item.discoverable !== '是') return '黄色预警';
  if(item.pollCount >= 3 && item.buyable !== '是') return '黄色预警';
  return '正常';
}

function monitorProgressHtml(item){
  const steps = ['已提交','Amazon处理中','可售','可搜索','有流量','有订单'];
  const current = steps.indexOf(item.stage);
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;max-width:260px">${steps.map((step, idx)=>{
    const cls = idx < current ? 'green' : idx === current ? 'blue' : 'gray';
    return `<span class="badge ${cls}">${step}</span>`;
  }).join('')}</div>`;
}

function createMonitorFromPipeline(project){
  return {
    id: Date.now() + Math.random(),
    projectId: project.id,
    project: project.project,
    sourceKeyword: project.source,
    sku: project.sku || createSkuFromKeyword(project.source),
    asin: project.asin || createAsin(),
    owner: project.owner || '抢上负责人待定',
    marketplace: project.marketplace || 'US',
    submittedAt: nowText(),
    amazonStatus: project.launchStatus === '抢上中' ? '已提交，等待Amazon处理' : '待上架',
    buyable: '否',
    discoverable: '否',
    issuesCount: /fda approved|medical|cure|disney|nike|colgate/i.test(project.source||'') ? 1 : 0,
    issueText: /fda approved|medical|cure|disney|nike|colgate/i.test(project.source||'') ? '命中高风险词，需复核属性或文案。' : '',
    quantity: project.launchStatus === '抢上中' ? 20 : 0,
    firstBuyableAt: '-',
    firstDiscoverableAt: '-',
    firstOrderAt: '-',
    lastCheckedAt: nowText(),
    hasTraffic: '否',
    pollCount: 0,
    stage: project.launchStatus === '抢上中' ? '已提交' : '待上架',
    alert: '正常'
  };
}

function syncRushProjectsToMonitoring(){
  const candidates = state.pipeline.filter(p=>['抢上中','抢上成功','转开发中','FBM测品中','待复盘'].includes(p.stage));
  let added = 0;
  candidates.forEach(project=>{
    if(!state.monitors.find(m=>String(m.projectId)===String(project.projectId))){
      state.monitors.unshift(createMonitorFromPipeline(project));
      added += 1;
    }
  });
  renderMonitoring(added ? `已同步 ${added} 个执行项目到上架监控中心。` : '暂无新的执行项目需要同步。');
}

function advanceMonitorState(item, boost=false){
  const next = { ...item, pollCount:(item.pollCount||0)+1, lastCheckedAt: nowText() };
  const risky = /fda approved|medical|cure|disney|nike|colgate/i.test(next.sourceKeyword || '');
  if(risky && next.pollCount >= 2){
    next.amazonStatus = '存在 issues，等待修复';
    next.issuesCount = Math.max(next.issuesCount||0, 1);
    next.issueText = next.issueText || '命中高风险词，需修复属性、标题或合规信息。';
    next.buyable = '否';
    next.discoverable = '否';
    next.quantity = 0;
  } else {
    if(next.pollCount >= 1) next.amazonStatus = 'Amazon处理中';
    if(next.pollCount >= 2 || boost){
      next.buyable = '是';
      next.quantity = Math.max(next.quantity || 0, 20 + (next.pollCount*3));
      if(next.firstBuyableAt === '-') next.firstBuyableAt = nowText();
      next.amazonStatus = '可售';
    }
    if(next.pollCount >= 3 || boost){
      next.discoverable = '是';
      if(next.firstDiscoverableAt === '-') next.firstDiscoverableAt = nowText();
      next.amazonStatus = '可搜索';
    }
    if(next.pollCount >= 4 || boost){
      next.hasTraffic = '是';
      next.amazonStatus = '已获得流量';
    }
    if(next.pollCount >= 5 || boost){
      if(next.firstOrderAt === '-') next.firstOrderAt = nowText();
      next.amazonStatus = '已出首单';
    }
  }
  next.stage = deriveMonitorStage(next);
  next.alert = evaluateMonitorAlert(next);
  return next;
}

function pollMonitoring(){
  if(!state.monitors.length){
    renderMonitoring('当前还没有监控任务，先把抢上项目同步进来。');
    return;
  }
  state.monitors = state.monitors.map(item=>advanceMonitorState(item));
  renderMonitoring('已执行一次轮询：系统更新了 Amazon 状态、可售、可搜索、库存与预警。');
}

function simulateMonitorNotification(){
  if(!state.monitors.length){
    renderMonitoring('当前还没有监控任务，先把抢上项目同步进来。');
    return;
  }
  const idx = Math.floor(Math.random()*state.monitors.length);
  state.monitors = state.monitors.map((item, i)=> i===idx ? advanceMonitorState(item, true) : item);
  renderMonitoring('已模拟收到 Amazon 状态通知：其中一个项目被推进到更靠后的节点。');
}

function pollSingleMonitor(id){
  state.monitors = state.monitors.map(item=> String(item.id)===String(id) ? advanceMonitorState(item) : item);
  renderMonitoring('已手动轮询单个项目。');
}
window.pollSingleMonitor = pollSingleMonitor;

function forceAdvanceMonitor(id){
  state.monitors = state.monitors.map(item=> String(item.id)===String(id) ? advanceMonitorState(item, true) : item);
  renderMonitoring('已手动推进单个项目节点。');
}
window.forceAdvanceMonitor = forceAdvanceMonitor;

function toggleMonitorAuto(){
  if(state.monitorAuto){
    clearInterval(state.monitorTimer);
    state.monitorTimer = null;
    state.monitorAuto = false;
    renderMonitoring('已关闭自动监控。');
    return;
  }
  state.monitorAuto = true;
  state.monitorTimer = setInterval(()=>{
    if(!state.monitors.length) return;
    state.monitors = state.monitors.map(item=>Math.random() > 0.45 ? advanceMonitorState(item) : item);
    renderMonitoring('自动监控运行中：系统正在按节奏刷新上架状态。');
  }, 8000);
  renderMonitoring('已开启自动监控：演示版每 8 秒刷新一次。');
}

function renderMonitoring(message){
  $('monitorCount').textContent = state.monitors.length;
  $('monitorBuyableCount').textContent = state.monitors.filter(m=>m.buyable==='是').length;
  $('monitorDiscoverableCount').textContent = state.monitors.filter(m=>m.discoverable==='是').length;
  $('monitorAlertCount').textContent = state.monitors.filter(m=>m.alert==='红色预警').length;
  $('btnMonitorAuto').textContent = state.monitorAuto ? '关闭自动监控' : '开启自动监控';
  $('monitorStatus').innerHTML = message || (state.monitors.length
    ? `当前正在监控 <b>${state.monitors.length}</b> 个上架任务。绿色代表已可售/可搜索，黄色代表链路中仍有卡点，红色代表需要立刻处理的问题。`
    : '当前还没有监控任务。把抢上项目同步进来后，系统会跟踪上架状态、可售状态、可搜索状态、库存和首单时间。');
  $('monitorTable').innerHTML = state.monitors.map(m=>`
    <tr>
      <td>
        <div><b>${m.project}</b></div>
        <div class="small muted">${m.marketplace} · ${m.sku}</div>
        <div class="small muted">${m.asin}</div>
      </td>
      <td>${m.owner}</td>
      <td>${monitorProgressHtml(m)}</td>
      <td><span class="badge ${m.stage==='有订单'?'green':m.stage==='可搜索' || m.stage==='可售'?'blue':m.alert==='红色预警'?'red':'yellow'}">${m.amazonStatus}</span>${m.issueText ? `<div class="small" style="color:#b91c1c;margin-top:6px">${m.issueText}</div>` : ''}</td>
      <td><span class="badge ${m.buyable==='是'?'green':'gray'}">${m.buyable}</span></td>
      <td><span class="badge ${m.discoverable==='是'?'green':'gray'}">${m.discoverable}</span></td>
      <td>${m.issuesCount}</td>
      <td>${m.quantity}</td>
      <td>${m.firstBuyableAt}</td>
      <td>${m.firstDiscoverableAt}</td>
      <td>${m.firstOrderAt}</td>
      <td>${m.lastCheckedAt}</td>
      <td><span class="badge ${m.alert==='红色预警'?'red':m.alert==='黄色预警'?'yellow':'green'}">${m.alert}</span></td>
      <td>
        <button class="secondary" style="padding:6px 10px;margin-bottom:6px" onclick="pollSingleMonitor('${m.id}')">轮询</button>
        <button class="secondary" style="padding:6px 10px" onclick="forceAdvanceMonitor('${m.id}')">推进</button>
      </td>
    </tr>
  `).join('');
  renderGovernance();
  renderRiskCenter();
}
