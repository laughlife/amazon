function normalizeKeywordRecord(parts){
  const [keyword='', category='', source='', remark=''] = parts.map(x=>String(x||'').trim());
  return { keyword, category: category || $('amazonCategory').value, source: source || '手动词库', remark };
}

function normalizeSiteRecord(parts){
  const [name='', url='', keyword='', remark=''] = parts.map(x=>String(x||'').trim());
  const link = url || name;
  const siteName = url ? name || new URL(url).hostname.replace(/^www\./,'') : (link ? new URL(link).hostname.replace(/^www\./,'') : '未命名站点');
  return { siteName, url: link, keyword, remark };
}

function extractKeywordFromUrl(url=''){
  try{
    const pathname = new URL(url).pathname.replace(/[-_]/g,' ').replace(/\//g,' ').trim();
    const parts = pathname.split(/\s+/).filter(Boolean).slice(-4);
    return parts.join(' ').trim();
  }catch(e){
    return '';
  }
}

function addKeywordToLibrary(record){
  if(!record.keyword) return false;
  if(state.words.find(x=>x.keyword.toLowerCase()===record.keyword.toLowerCase())) return false;
  state.words.unshift({
    id: Date.now()+Math.random(),
    keyword: record.keyword,
    type: record.source || '手动词库',
    category: record.category || $('amazonCategory').value,
    score: '待分析',
    change: '-',
    trend: '待验证',
    status: '待初筛',
    remark: record.remark || ''
  });
  return true;
}

function fillAnalysisFromSite(id){
  const site = state.siteResources.find(x=>String(x.id)===String(id));
  if(!site) return;
  $('sourceChannel').value = '独立站';
  $('sourceLink').value = site.url;
  $('keyword').value = site.keyword || extractKeywordFromUrl(site.url);
  $('remark').value = site.remark || `${site.siteName} 独立站投喂`;
  setImageStatus(`已把 ${site.siteName} 回填到分析区，可直接一键初筛或调用大脑分析。`);
}

function convertSiteToWord(id){
  const site = state.siteResources.find(x=>String(x.id)===String(id));
  if(!site) return;
  const keyword = site.keyword || extractKeywordFromUrl(site.url);
  if(!keyword){
    $('siteImportStatus').textContent = `站点 ${site.siteName} 缺少核心词，请补充后再转机会词。`;
    return;
  }
  const ok = addKeywordToLibrary({ keyword, category:$('amazonCategory').value, source:'独立站', remark: site.remark || site.siteName });
  site.status = ok ? '已转机会词' : '已存在';
  renderWords();
  renderFeedCenter();
}

function renderFeedCenter(){
  const importedWords = state.words.filter(x=>['手动词库','独立站','卖家精灵','Google Trends','TikTok','手动导入'].includes(x.type));
  $('keywordImportTable').innerHTML = importedWords.length ? importedWords.slice(0,12).map(w=>`
    <tr>
      <td>${w.keyword}</td>
      <td>${w.category||'-'}</td>
      <td>${w.type||'-'}</td>
      <td>${w.remark||'-'}</td>
      <td>${w.status||'待初筛'}</td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="muted">暂无导入词库</td></tr>';
  $('siteResourceTable').innerHTML = state.siteResources.length ? state.siteResources.slice(0,12).map(s=>`
    <tr>
      <td><b>${s.siteName}</b><div class="small muted">${s.url}</div></td>
      <td>${s.keyword || '<span class="muted">待提取</span>'}</td>
      <td>${s.source||'手动投喂'}</td>
      <td>${s.status||'待分析'}</td>
      <td>
        <button class="btn-ghost small" data-site-fill="${s.id}">回填分析区</button>
        <button class="btn-ghost small" data-site-word="${s.id}">转机会词</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="muted">暂无独立站资源</td></tr>';
  document.querySelectorAll('[data-site-fill]').forEach(btn=>btn.onclick=()=>fillAnalysisFromSite(btn.dataset.siteFill));
  document.querySelectorAll('[data-site-word]').forEach(btn=>btn.onclick=()=>convertSiteToWord(btn.dataset.siteWord));
}

function importKeywordBatch(){
  const raw = $('keywordBatchInput').value.trim();
  if(!raw){ $('keywordImportStatus').textContent = '请先粘贴词库内容。'; return; }
  const lines = raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  let added = 0;
  lines.forEach(line=>{
    const parts = line.includes('	') ? line.split('	') : line.split(/\s*,\s*/);
    const rec = parts.length===1 ? { keyword: parts[0], category:$('amazonCategory').value, source:'手动导入', remark:'' } : normalizeKeywordRecord(parts);
    if(addKeywordToLibrary(rec)) added++;
  });
  renderWords();
  renderFeedCenter();
  $('keywordImportStatus').textContent = `本次导入 ${added} 个关键词，已进入机会词库。`;
}

function importSiteBatch(){
  const raw = $('siteBatchInput').value.trim();
  if(!raw){ $('siteImportStatus').textContent = '请先粘贴独立站内容。'; return; }
  const lines = raw.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  let added = 0;
  lines.forEach(line=>{
    let rec;
    if(/^https?:\/\//i.test(line)){
      rec = { siteName: (()=>{ try{return new URL(line).hostname.replace(/^www\./,'')}catch(e){return '独立站'}})(), url: line, keyword: extractKeywordFromUrl(line), remark:'', source:'手动投喂', status:'待分析' };
    }else{
      const parts = line.includes('	') ? line.split('	') : line.split(/\s*,\s*/);
      try{ rec = { ...normalizeSiteRecord(parts), source:'手动投喂', status:'待分析' }; }catch(e){ rec = null; }
    }
    if(rec && rec.url && !state.siteResources.find(x=>x.url===rec.url)){
      rec.id = Date.now()+Math.random();
      state.siteResources.unshift(rec);
      added++;
    }
  });
  renderFeedCenter();
  $('siteImportStatus').textContent = `本次导入 ${added} 个独立站资源。可直接回填到分析区，或批量转成机会词。`;
}

function bulkSitesToWords(){
  let added = 0;
  state.siteResources.forEach(site=>{
    const keyword = site.keyword || extractKeywordFromUrl(site.url);
    if(keyword && addKeywordToLibrary({ keyword, category:$('amazonCategory').value, source:'独立站', remark: site.remark || site.siteName })){
      site.status = '已转机会词';
      added++;
    }
  });
  renderWords();
  renderFeedCenter();
  $('siteImportStatus').textContent = added ? `已从独立站资源生成 ${added} 个机会词。` : '没有新的核心词可转入机会词库。';
}
