function setModel(model){
  state.model = model;
  $('modelStation').classList.toggle('active', model==='station');
  $('modelSocial').classList.toggle('active', model==='social');
  $('modelGuide').textContent = MODEL_CONFIG[model].guide;
  renderScoreForm();
  calcSummary();
}

function renderAnalysisInfo(){
  const a = state.analysis.info;
  $('analysisInfo').innerHTML = `
    <div class="kv"><div class="muted">产品类型</div><div>${a.productType}</div></div>
    <div class="kv"><div class="muted">包装形式</div><div>${a.packaging}</div></div>
    <div class="kv"><div class="muted">推荐关键词</div><div>${(a.keywords||[]).map(k=>`<span class="badge blue">${k}</span>`).join(' ') || '-'}</div></div>
    <div class="kv"><div class="muted">推荐类目</div><div>${a.category}</div></div>
    <div class="kv"><div class="muted">知识库命中</div><div>${(a.tags||[]).map(k=>`<span class="badge green">${k}</span>`).join(' ') || '-'}</div></div>
    <div class="kv"><div class="muted">风险命中</div><div>${(a.risks||[]).map(k=>`<span class="badge red">${k}</span>`).join(' ') || '<span class="badge green">未见明显风险</span>'}</div></div>
    <div class="kv"><div class="muted">已传图片</div><div>${state.uploads.length ? `<span class="badge blue">${state.uploads.length} 张</span>` : '-'}</div></div>
  `;
}

function renderScoreForm(){
  const config = MODEL_CONFIG[state.model];
  const scores = state.analysis.scores;
  $('scoreForm').innerHTML = config.fields.map(f=>`
    <div class="score-row">
      <div>
        <div>${f.label}</div>
        <div class="small muted">${f.hint}</div>
        <div class="weight">权重 ${f.weight}%</div>
      </div>
      <input type="number" step="0.1" min="0" max="${f.weight}" value="${scores[f.key] ?? ''}" data-key="${f.key}" />
      <div class="small muted">满分 ${f.weight}</div>
    </div>
  `).join('') + `<div class="notice" style="margin-top:10px">这里录入的是每个主维度的贡献分，不是原始 100 分。比如“亚马逊需求机会”直接按 0–60 录入。</div>`;
  [...$('scoreForm').querySelectorAll('input')].forEach(input=>{
    input.addEventListener('input', e=>{ 
      const field = config.fields.find(f=>f.key===e.target.dataset.key);
      let val = Number(e.target.value||0);
      if(field) val = Math.max(0, Math.min(field.weight, val));
      e.target.value = val;
      state.analysis.scores[e.target.dataset.key] = val;
      calcSummary();
    });
  });
}

function buildBreakdownTable(config){
  return `
    <table>
      <thead><tr><th>维度</th><th>得分</th><th>权重</th></tr></thead>
      <tbody>
        ${config.fields.map(f=>`<tr><td>${f.label}</td><td>${Number(state.analysis.scores[f.key]||0).toFixed(1)}</td><td>${f.weight}% / 满分 ${f.weight}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

function calcSummary(){
  const config = MODEL_CONFIG[state.model];
  const total = config.fields.reduce((s,f)=>s + Number(state.analysis.scores[f.key]||0), 0);
  state.analysis.total = Number(total.toFixed(1));
  const result = config.decide(state.analysis.scores, state.analysis.total);
  state.analysis.action = result.action;
  state.analysis.level = result.level;
  state.analysis.staff = result.staff;
  state.analysis.reasons = result.reasons;
  state.analysis.summary = state.model==='station'
    ? '模型A更偏亚马逊词选品：先看站内机会，再看广告与趋势做验证。'
    : '模型B更偏社媒爆点反推：先看站外热度，再验证亚马逊是否仍有空白。';
  $('summary').innerHTML = `
    <div class="summary-box">
      <div class="small muted">当前评分模型</div>
      <div style="font-size:18px;font-weight:800;margin:4px 0 10px">${config.name}</div>
      <div class="kv"><div class="muted">综合评分</div><div><b>${state.analysis.total}</b></div></div>
      <div class="kv"><div class="muted">等级</div><div><span class="badge ${result.badge}">${state.analysis.level}级</span></div></div>
      <div class="kv"><div class="muted">建议动作</div><div><span class="badge ${result.badge}">${state.analysis.action}</span></div></div>
      <div class="kv"><div class="muted">建议人数</div><div>${state.analysis.staff}</div></div>
      <div class="kv"><div class="muted">风险等级</div><div><span class="badge ${state.analysis.info.risks.length ? 'red' : 'green'}">${state.analysis.info.risks.length ? '中高' : '低'}</span></div></div>
    </div>
    ${buildBreakdownTable(config)}
    <div class="summary-box" style="margin-top:10px">
      <div class="small muted">系统判定依据</div>
      <div style="margin-top:6px">${(state.analysis.reasons||[]).map(x=>`<div style="margin-bottom:6px">• ${x}</div>`).join('') || '暂无'}</div>
    </div>
    <div class="small muted" style="margin-top:8px">${state.analysis.summary}</div>
  `;
}

function basicAnalyze(){
  const keyword = $('keyword').value.trim() || 'purple toothpaste';
  const lower = keyword.toLowerCase();
  let info = { productType:$('productType').value.trim() || '常规消费品', packaging:'盒装/瓶装', keywords:[keyword], category:$('amazonCategory').value, tags:[], risks:[] };
  if(lower.includes('toothpaste')) info = { productType:'toothpaste', packaging:'tube', keywords:[keyword,'whitening toothpaste','color correcting toothpaste'], category:'Beauty & Personal Care', tags:['口腔护理词','长期赛道词'], risks:[] };
  if(lower.includes('hydroxyapatite')) info.tags.push('高潜力词');
  if(lower.includes('hair growth')) info = { productType:'hair serum', packaging:'dropper bottle', keywords:[keyword,'hair growth serum','scalp serum'], category:'Beauty & Personal Care', tags:['社媒潜力词'], risks:['宣称需复核'] };
  if(lower.includes('fda approved') || lower.includes('medical') || lower.includes('cure')) info.risks.push('宣称风险');
  state.analysis.info = info;
  renderAnalysisInfo();
}

const SELLERSPRITE_PROXY_DEFAULT = 'http://localhost:3001';

function getSellerSpriteProxy(){
  const configured = state?.sellerSprite?.proxyBaseUrl;
  return (localStorage.getItem('sellerSpriteProxy') || configured || SELLERSPRITE_PROXY_DEFAULT).trim();
}

function normalizeSpriteList(payload){
  const data = payload?.data;
  if(Array.isArray(data)) return data;
  if(Array.isArray(data?.items)) return data.items;
  if(Array.isArray(data?.records)) return data.records;
  if(Array.isArray(data?.list)) return data.list;
  if(Array.isArray(data?.rows)) return data.rows;
  return [];
}

function num(val){
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function pickKeywordRow(payload, fallbackKeyword){
  const rows = normalizeSpriteList(payload);
  if(!rows.length) return {};
  const lower = (fallbackKeyword || '').toLowerCase();
  return rows.find(r => String(r.keyword || r.keywords || '').toLowerCase().includes(lower)) || rows[0] || {};
}

function averageTrendValue(items){
  if(!Array.isArray(items) || !items.length) return 0;
  const values = items.map(x => num(x.value)).filter(Boolean);
  if(!values.length) return 0;
  return values.reduce((a,b)=>a+b,0) / values.length;
}

async function testSellerSprite(){
  const proxy = getSellerSpriteProxy();
  setImageStatus('正在测试卖家精灵本地代理...');
  try{
    const resp = await fetch(`${proxy}/api/sellersprite/test`);
    const data = await resp.json();
    if(!resp.ok || data.code && data.code !== 'OK'){
      throw new Error(data.message || '测试失败');
    }
    setImageStatus(`卖家精灵已连通：${data.code || 'OK'}`);
    alert('卖家精灵本地代理已连通，可以开始分析。');
  }catch(err){
    setImageStatus('卖家精灵测试失败：' + err.message);
    alert('卖家精灵测试失败，请先启动本地代理（npm run start:proxy），再重试。\n默认地址：' + proxy);
  }
}

async function spriteFill(){
  const keyword = ($('keyword').value || '').trim();
  if(!keyword){
    alert('请先输入关键词');
    return;
  }
  const marketplace = 'US';
  const proxy = getSellerSpriteProxy();
  setImageStatus('正在拉取卖家精灵数据...');
  try{
    const [kwRes, abaRes, trendRes] = await Promise.all([
      fetch(`${proxy}/api/sellersprite/keyword-research`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ marketplace, keywords: keyword, page:1, size:10 })
      }).then(async r=>({ ok:r.ok, data: await r.json() })),
      fetch(`${proxy}/api/sellersprite/aba-weekly`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ marketplace, includeKeywords: keyword, page:1, size:10 })
      }).then(async r=>({ ok:r.ok, data: await r.json() })),
      fetch(`${proxy}/api/sellersprite/google-trends?marketplace=${encodeURIComponent(marketplace)}&keyword=${encodeURIComponent(keyword)}`)
        .then(async r=>({ ok:r.ok, data: await r.json() }))
    ]);

    const failures = [kwRes, abaRes, trendRes].filter(x => !x.ok || (x.data?.code && x.data.code !== 'OK'));
    if(failures.length){
      throw new Error(failures[0].data?.message || '卖家精灵返回异常');
    }

    const kwRow = pickKeywordRow(kwRes.data, keyword);
    const abaRow = pickKeywordRow(abaRes.data, keyword);
    const trendItems = trendRes.data?.data?.items || trendRes.data?.items || [];

    const searches = num(kwRow.searches);
    const purchases = num(kwRow.purchases);
    const purchaseRate = num(kwRow.purchaseRate);
    const products = num(kwRow.products);
    const supplyDemandRatio = num(kwRow.supplyDemandRatio || kwRow.spr);
    const rankGrowthRate = num(abaRow.rankGrowthRate);
    const monopolyClickRate = num(abaRow.monopolyClickRate);
    const conversionRate = num(abaRow.conversionRate);
    const avgTrend = averageTrendValue(trendItems);

    if(state.model === 'station'){
      const amazonOpportunity = clamp(
        Math.round(
          Math.min(25, searches / 800) +
          Math.min(15, purchases / 120) +
          Math.min(10, Math.max(0, 12 - products / 200)) +
          Math.min(10, purchaseRate / 2) +
          Math.min(8, rankGrowthRate / 8) +
          Math.min(5, Math.max(0, 6 - supplyDemandRatio))
        ),
        0, 60
      );
      state.analysis.scores.amazonOpportunity = amazonOpportunity;
      state.analysis.scores.facebookAds = clamp(state.analysis.scores.facebookAds || 8, 0, 20);
      state.analysis.scores.googleTrends = clamp(Math.round(Math.min(10, avgTrend / 10 + rankGrowthRate / 15)), 0, 10);
      state.analysis.scores.socialAssist = clamp(Math.round(Math.min(10, purchaseRate / 4 + conversionRate / 10)), 0, 10);
      state.analysis.reasons = [
        `卖家精灵关键词数据已回填：月搜索量 ${searches || 0}，月购买量 ${purchases || 0}，商品数 ${products || 0}。`,
        `ABA 周数据参考：搜索增长率 ${rankGrowthRate || 0}，点击集中度 ${monopolyClickRate || 0}，转化率 ${conversionRate || 0}。`
      ];
    }else{
      state.analysis.scores.socialHeat = clamp(state.analysis.scores.socialHeat || 24, 0, 40);
      state.analysis.scores.amazonBlank = clamp(
        Math.round(
          Math.min(15, Math.max(0, 20 - products / 120)) +
          Math.min(10, purchaseRate / 2) +
          Math.min(10, rankGrowthRate / 8)
        ),
        0, 35
      );
      state.analysis.scores.crossPlatform = clamp(state.analysis.scores.crossPlatform || 8, 0, 15);
      state.analysis.scores.trendSpeed = clamp(Math.round(Math.min(10, avgTrend / 10 + rankGrowthRate / 12)), 0, 10);
      state.analysis.reasons = [
        `卖家精灵已补充站内空白与趋势：商品数 ${products || 0}，购买率 ${purchaseRate || 0}。`,
        `谷歌趋势平均热度 ${avgTrend.toFixed(1)}，ABA 搜索增长率 ${rankGrowthRate || 0}。`
      ];
    }

    if(searches || purchases){
      state.analysis.info.keywords = Array.from(new Set([...(state.analysis.info.keywords || []), keyword]));
      state.analysis.info.tags = Array.from(new Set([...(state.analysis.info.tags || []), '卖家精灵已验证']));
    }

    renderAnalysisInfo();
    renderScoreForm();
    calcSummary();
    setImageStatus('卖家精灵数据已回填评分。');
  }catch(err){
    console.error(err);
    setImageStatus('卖家精灵调用失败：' + err.message);
    alert('卖家精灵调用失败，请确认本地代理已启动，且秘钥有效。');
  }
}

function knowledgeMatch(){
  const keyword = ($('keyword').value||'').toLowerCase();
  if(keyword.includes('hydroxyapatite')) state.analysis.info.tags = Array.from(new Set([...(state.analysis.info.tags||[]),'高潜力词','机会词库命中']));
  else state.analysis.info.tags = Array.from(new Set([...(state.analysis.info.tags||[]),'历史观察词']));
  renderAnalysisInfo();
}

function riskCheck(){
  const keyword = ($('keyword').value||'').toLowerCase();
  const risks = [];
  if(keyword.includes('fda approved')||keyword.includes('medical')||keyword.includes('cure')) risks.push('宣称风险');
  if(keyword.includes('disney')||keyword.includes('nike')||keyword.includes('colgate')) risks.push('知识产权风险');
  if(keyword.includes('supplement')||keyword.includes('serum')) risks.push('受限品需复核');
  state.analysis.info.risks = Array.from(new Set([...(state.analysis.info.risks||[]), ...risks]));
  renderAnalysisInfo();
  $('pane-ip').innerHTML = `<div>${state.analysis.info.risks.includes('知识产权风险') ? '<span class="badge red">命中知识产权风险</span>' : '<span class="badge green">未命中明显IP风险</span>'}</div>`;
  $('pane-restricted').innerHTML = `<div>${state.analysis.info.risks.includes('受限品需复核') ? '<span class="badge yellow">受限品需复核</span>' : '<span class="badge green">普通类</span>'}</div>`;
  $('pane-claim').innerHTML = `<div>${state.analysis.info.risks.includes('宣称风险') ? '<span class="badge red">宣称风险</span>' : '<span class="badge green">未见明显宣称风险</span>'}</div>`;
  $('pane-detail').innerHTML = `<div><span class="badge gray">详情页风险暂未命中</span></div>`;
}

function webEnhance(){
  const extra = state.model==='station'
    ? '已执行联网增强（演示）：建议重点补充 ABA、亚马逊前排承接缺口、Facebook 广告验证。'
    : '已执行联网增强（演示）：建议重点补充 Reddit/Facebook Groups 热度、DTC 品牌站点和 TikTok Shop 验证。';
  state.analysis.reasons = Array.from(new Set([...(state.analysis.reasons||[]), extra]));
  calcSummary();
}

function addToWatch(){
  const keyword = $('keyword').value.trim() || '未命名对象';
  const item = { id:Date.now(), keyword, score:state.analysis.total, trend: state.analysis.total>=70?'上升':'平稳', risk: state.analysis.info.risks.length?'中':'低', tags:[...(state.analysis.info.tags||[])], status:'待复核', model:MODEL_CONFIG[state.model].name };
  state.watch.unshift(item); renderWatch();
}

function evaluateTeamHealthByMembers(members){
  return members > 4 ? '人数超限' : '符合上限';
}

function transferToProject(name){
  const keyword = name || $('keyword').value.trim() || '未命名对象';
  const demoMembers = [1,2,3,4,5];
  const owners = ['运营A组','运营B组','开发联动组','抢上专项组'];
  const members = demoMembers[state.projects.length % demoMembers.length];
  const project = {
    id:Date.now()+Math.random(),
    project:`项目-${keyword}`,
    source:keyword,
    status:'正式项目',
    launchStatus:'待抢上',
    teamMembers:members,
    teamHealth:evaluateTeamHealthByMembers(members),
    owner:owners[state.projects.length % owners.length],
    marketplace:'US',
    sku:createSkuFromKeyword(keyword),
    asin:createAsin()
  };
  state.projects.unshift(project);
  renderProjects();
  syncProjectsToPipeline(true);
}

function importWords(){
  state.words = [
    {id:1, keyword:'purple toothpaste', type:'亚马逊机会词', category:'Beauty & Personal Care', score:62, change:'+8%', trend:'平稳', status:'普通观察'},
    {id:2, keyword:'hydroxyapatite toothpaste', type:'高潜力词', category:'Beauty & Personal Care', score:74, change:'+18%', trend:'上升', status:'重点观察'},
    {id:3, keyword:'hair growth serum women', type:'社媒潜力词', category:'Beauty & Personal Care', score:68, change:'+12%', trend:'上升', status:'普通观察'},
    {id:4, keyword:'fda approved toothpaste', type:'风险观察词', category:'Beauty & Personal Care', score:38, change:'-6%', trend:'下降', status:'待观察'}
  ]; renderWords();
}

function scanWords(){
  state.words = state.words.map(w=>{
    const delta = w.keyword.includes('hydroxy') ? 9 : w.keyword.includes('purple') ? 6 : w.keyword.includes('hair growth') ? 7 : -4;
    const score = Math.max(0, Math.min(100, w.score + delta));
    const trend = delta>0?'上升':delta<0?'下降':'平稳';
    const status = score>=70 && !w.keyword.includes('fda approved') ? '已推观察池' : score<40 ? '已淘汰' : w.status;
    if(status==='已推观察池' && !state.watch.find(x=>x.keyword===w.keyword)) state.watch.unshift({ id:Date.now()+Math.random(), keyword:w.keyword, score, trend, risk:w.keyword.includes('fda approved')?'高':'低', tags:[w.type], status:'待复核', model:'自动扫描' });
    return {...w, score, change:(delta>=0?'+':'')+delta+'%', trend, status};
  });
  renderWords(); renderWatch();
}

