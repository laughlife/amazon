function renderWords(){
  $('wordTable').innerHTML = state.words.map(w=>`
    <tr>
      <td><input type="checkbox" class="word-check" value="${w.id}"></td>
      <td>${w.keyword}</td><td>${w.type}</td><td>${w.category}</td><td>${w.score}</td><td>${w.change}</td><td><span class="badge ${w.trend==='上升'?'green':w.trend==='下降'?'red':'gray'}">${w.trend}</span></td><td>${w.status}</td>
    </tr>
  `).join('');
}

function renderWatch(){
  $('watchTable').innerHTML = state.watch.map(w=>`
    <tr>
      <td><input type="checkbox" class="watch-check" value="${w.id}"></td>
      <td>${w.keyword}<div class="small muted">${w.model||''}</div></td><td>${w.score}</td><td><span class="badge ${w.trend==='上升'?'green':'gray'}">${w.trend}</span></td><td><span class="badge ${w.risk==='高'?'red':w.risk==='中'?'yellow':'green'}">${w.risk}</span></td><td>${(w.tags||[]).map(t=>`<span class="badge blue">${t}</span>`).join(' ')}</td><td>${w.status}</td>
    </tr>
  `).join('');
}

function renderProjects(){
  $('projectCount').textContent = state.projects.length;
  $('projectPendingCount').textContent = state.projects.filter(p=>p.launchStatus==='待抢上').length;
  $('projectLaunchingCount').textContent = state.projects.filter(p=>p.launchStatus==='抢上中').length;
  $('projectFbmCount').textContent = state.projects.filter(p=>p.launchStatus==='FBM测品中').length;
  $('projectTable').innerHTML = state.projects.map(p=>`
    <tr>
      <td><b>${p.project}</b></td>
      <td>${p.source}</td>
      <td>${p.status}</td>
      <td><span class="badge ${p.launchStatus==='FBM测品中'?'blue':p.launchStatus==='抢上中'?'yellow':p.launchStatus==='开发通过'?'green':p.launchStatus==='淘汰'?'red':'gray'}">${p.launchStatus}</span></td>
      <td>${p.owner||'-'}</td>
      <td>${p.teamMembers}人</td>
      <td><span class="badge ${p.teamHealth==='人数超限'?'red':'green'}">${p.teamHealth}</span></td>
    </tr>
  `).join('');
}

function getCheckedValues(selector){ return [...document.querySelectorAll(selector+':checked')].map(i=>String(i.value)); }

function renderCompare(source, targetId, type){
  const checked = getCheckedValues(source);
  const data = (type==='word'?state.words:state.watch).filter(x=>checked.includes(String(x.id)));
  const panel = $(targetId);
  if(!data.length){ panel.style.display='none'; panel.innerHTML=''; return; }
  panel.style.display='block';
  panel.innerHTML = `
    <div class="section-title">${type==='word'?'机会词':'观察池'}对比面板</div>
    <table>
      <thead><tr><th>关键词</th><th>总分</th><th>趋势</th><th>风险/状态</th><th>标签/类型</th></tr></thead>
      <tbody>
      ${data.map(x=>`<tr><td>${x.keyword}</td><td>${x.score}</td><td>${x.trend}</td><td>${x.risk||x.status}</td><td>${(x.tags||[x.type||'']).join(' / ')}</td></tr>`).join('')}
      </tbody>
    </table>`;
}


function scrollToId(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.scrollIntoView({ behavior:'smooth', block:'start' });
}

function getPendingAlertCount(){
  return state.alerts.filter(x=>['新发现','待处理','已推送'].includes(x.status)).length;
}

function getPendingActionCount(){
  return state.actionCards.filter(x=>['待接单','执行中'].includes(x.status)).length;
}

function getRedRiskCount(){
  return state.pipeline.filter(item=>evaluatePipelineRisk(item).level==='红色').length;
}

function buildFocusQueue(){
  const items = [];
  state.alerts.filter(x=>x.level==='S' && ['新发现','待处理','已推送'].includes(x.status)).slice(0,3).forEach(a=>{
    items.push({
      type:'S级机会词',
      name:a.name,
      badge:'green',
      desc:`${a.triggerReason}｜AI建议：${a.aiAdvice || '待判读'}`,
      action:'先派单或直接转正式项目',
      anchor:'alerts'
    });
  });
  state.actionCards.filter(x=>x.status==='待接单').slice(0,3).forEach(card=>{
    items.push({
      type:'待接单',
      name:card.name,
      badge:'blue',
      desc:`负责人：${card.owner || '待指派'}｜建议：${card.recommend || card.suggestedAction || '尽快接单'}`,
      action:'优先接单并推进下一步',
      anchor:'alerts'
    });
  });
  state.pipeline.filter(x=>x.stage==='待抢上').slice(0,2).forEach(item=>{
    items.push({
      type:'待抢上',
      name:item.project,
      badge:'yellow',
      desc:`负责人：${item.owner}｜当前建议：${evaluatePipelineDecision(item).label}`,
      action:'确认关键词和页面方案，进入抢上中',
      anchor:'devtest'
    });
  });
  state.pipeline.filter(x=>['FBM测品中','待复盘'].includes(x.stage)).slice(0,3).forEach(item=>{
    const risk = evaluatePipelineRisk(item);
    items.push({
      type:item.stage,
      name:item.project,
      badge:risk.level==='红色'?'red':risk.level==='橙色'?'orange':risk.level==='黄色'?'yellow':'green',
      desc:`风险灯：${risk.level}｜订单：${item.orders}｜CVR：${item.cvr}`,
      action:item.stage==='待复盘'?'优先出复盘结论':'继续看点击、订单和风险灯',
      anchor:item.stage==='待复盘'?'governance':'devtest'
    });
  });
  return items.slice(0,8);
}

function renderControlCenter(message){
  if(!$('ccAlertPending')) return;
  $('ccAlertPending').textContent = getPendingAlertCount();
  $('ccActionPending').textContent = getPendingActionCount();
  $('ccProjectCount').textContent = state.projects.length;
  $('ccRushPending').textContent = state.pipeline.filter(x=>x.stage==='待抢上').length;
  $('ccFbmRunning').textContent = state.pipeline.filter(x=>x.stage==='FBM测品中').length;
  $('ccReviewRisk').textContent = state.pipeline.filter(x=>x.stage==='待复盘').length + getRedRiskCount();

  $('stageWords').textContent = state.words.length;
  $('stageWatch').textContent = state.watch.length;
  $('stageProjects').textContent = state.projects.length;
  $('stageRush').textContent = state.pipeline.filter(x=>x.stage==='待抢上').length;
  $('stageFbm').textContent = state.pipeline.filter(x=>x.stage==='FBM测品中').length;
  $('stageReview').textContent = state.pipeline.filter(x=>x.stage==='待复盘').length;
  $('stageAlerts').textContent = getPendingAlertCount();

  $('controlCenterStatus').innerHTML = message || `当前有 <b>${getPendingAlertCount()}</b> 条待处理预警、<b>${getPendingActionCount()}</b> 张待接单行动卡、<b>${state.pipeline.filter(x=>x.stage==='待抢上').length}</b> 个待抢上项目、<b>${state.pipeline.filter(x=>x.stage==='待复盘').length}</b> 个待复盘项目。建议先处理高等级预警，再推进待抢上和 FBM 复盘。`;

  const focus = buildFocusQueue();
  $('focusQueueList').innerHTML = focus.length ? focus.map(item=>`
    <div class="focus-item anchor-link" onclick="scrollToId('${item.anchor}')">
      <div class="focus-head">
        <div>
          <div><span class="badge ${item.badge}">${item.type}</span> <b style="margin-left:8px">${item.name}</b></div>
          <div class="small muted" style="margin-top:6px">${item.desc}</div>
        </div>
        <div class="small muted">点击定位</div>
      </div>
      <div class="small">下一步：<b>${item.action}</b></div>
    </div>
  `).join('') : '<div class="focus-item"><div class="small muted">当前还没有高优先级事项。你可以先生成一轮测试闭环，或者导入词库与独立站数据。</div></div>';
}

function quickSeedFlow(){
  if(!state.siteResources.length){
    state.siteResources.unshift(
      { id:Date.now()+1, siteName:'GlowSmile', url:'https://glowsmile.co/products/purple-toothpaste', keyword:'purple toothpaste', remark:'独立站新品', source:'PPSPY', status:'待分析' },
      { id:Date.now()+2, siteName:'NanoWhite', url:'https://nanowhite.co/products/hydroxyapatite-toothpaste', keyword:'hydroxyapatite toothpaste', remark:'修复线新品', source:'PPSPY', status:'待分析' }
    );
    renderFeedCenter();
  }
  syncWordTasks();
  syncSiteTasks();
  refreshSurveillance();
  runAiSweep();
  dispatchAllAlerts();
  renderControlCenter('已生成一轮测试闭环：词库、独立站、监控、AI预警和派单已联动起来。');
}

function quickRefreshIntel(){
  syncWordTasks();
  syncSiteTasks();
  refreshSurveillance();
  runAiSweep();
  renderControlCenter('已完成“监控刷新 + AI判读”。现在先看机会预警中心和行动卡。');
}

function quickDispatchFlow(){
  dispatchAllAlerts();
  renderControlCenter('已把待处理预警推成行动卡。建议先在派单中心接单，再决定转观察池还是正式项目。');
}

function quickPromoteProjects(){
  pushTopAlertsToProject();
  renderControlCenter('已把符合条件的 S 级机会转入正式项目池。下一步可同步到抢上 / FBM 测品执行池。');
}

function quickSyncPipelineFlow(){
  syncProjectsToPipeline();
  renderControlCenter('已把正式项目同步到执行池。现在重点看“待抢上”和“FBM测品中”。');
  scrollToId('devtest');
}

function quickOpenReview(){
  renderControlCenter('已定位到待复盘区域。优先处理红灯项目和待复盘项目。');
  scrollToId('governance');
}
