const __renderWords = renderWords;
renderWords = function(){ __renderWords.apply(this, arguments); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };
const __renderWatch = renderWatch;
renderWatch = function(){ __renderWatch.apply(this, arguments); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };
const __renderProjects = renderProjects;
renderProjects = function(){ __renderProjects.apply(this, arguments); renderControlCenter(); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };
const __renderPipeline = renderPipeline;
renderPipeline = function(){ __renderPipeline.apply(this, arguments); renderControlCenter(); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };
const __renderSurveillance = renderSurveillance;
renderSurveillance = function(){ __renderSurveillance.apply(this, arguments); renderControlCenter(); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };
const __renderOpportunityFlow = renderOpportunityFlow;
renderOpportunityFlow = function(){ __renderOpportunityFlow.apply(this, arguments); renderControlCenter(); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };
const __renderFeedCenter = renderFeedCenter;
renderFeedCenter = function(){ __renderFeedCenter.apply(this, arguments); renderControlCenter(); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };
const __renderGovernance = renderGovernance;
renderGovernance = function(){ __renderGovernance.apply(this, arguments); renderControlCenter(); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };
const __renderMonitoring = renderMonitoring;
renderMonitoring = function(){ __renderMonitoring.apply(this, arguments); renderControlCenter(); if(state.search.query) runUnifiedSearch(state.search.query, false); else renderSearchCenter(); };

$('modelStation').onclick = ()=>setModel('station');
$('btnSearchHub').onclick = ()=>runUnifiedSearch();
$('btnSearchCurrent').onclick = ()=>{ const current = ($('keyword').value || '').trim(); if(current){ $('searchHubInput').value = current; runUnifiedSearch(current); scrollToId('searchhub'); } else { renderSearchCenter('当前分析区还没有关键词，可先输入词或从独立站回填。'); scrollToId('searchhub'); } };
$('btnSearchClear').onclick = clearUnifiedSearch;
$('searchHubInput').addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); runUnifiedSearch(); } });
$('searchHubScope').onchange = ()=>{ if(state.search.query || $('searchHubInput').value.trim()) runUnifiedSearch(); };
$('btnQuickSeedFlow').onclick = quickSeedFlow;
$('btnQuickRefreshIntel').onclick = quickRefreshIntel;
$('btnQuickDispatch').onclick = quickDispatchFlow;
$('btnQuickPromote').onclick = quickPromoteProjects;
$('btnQuickSyncPipeline').onclick = quickSyncPipelineFlow;
$('btnQuickOpenReview').onclick = quickOpenReview;
$('modelSocial').onclick = ()=>setModel('social');
$('btnBasic').onclick = basicAnalyze;
$('btnSprite').onclick = spriteFill;
$('btnSpriteTest').onclick = testSellerSprite;
$('btnKnowledge').onclick = knowledgeMatch;
$('btnRisk').onclick = riskCheck;
$('btnWeb').onclick = webEnhance;
$('btnSaveScore').onclick = calcSummary;
$('btnAddWatch').onclick = addToWatch;
$('btnTransfer').onclick = ()=>transferToProject();
$('btnDiscard').onclick = ()=>alert('已标记淘汰（演示）');
$('btnImportWords').onclick = importWords;
$('btnScanWords').onclick = scanWords;
$('btnCompareWords').onclick = ()=>renderCompare('.word-check','wordCompare','word');
$('btnPushWatch').onclick = ()=>{ const ids=getCheckedValues('.word-check'); state.words.filter(x=>ids.includes(String(x.id))).forEach(w=>{ if(!state.watch.find(y=>y.keyword===w.keyword)) state.watch.unshift({ id:Date.now()+Math.random(), keyword:w.keyword, score:w.score, trend:w.trend, risk:w.keyword.includes('fda approved')?'高':'低', tags:[w.type], status:'待复核', model:'机会词库推入' }); }); renderWatch(); };
$('btnCompareWatch').onclick = ()=>renderCompare('.watch-check','watchCompare','watch');
$('btnWatchKeep').onclick = ()=>{ const ids=getCheckedValues('.watch-check'); state.watch = state.watch.map(w=> ids.includes(String(w.id)) ? {...w,status:'继续观察'} : w); renderWatch(); };
$('btnWatchTransfer').onclick = ()=>{ const ids=getCheckedValues('.watch-check'); state.watch.filter(w=>ids.includes(String(w.id))).forEach(w=>transferToProject(w.keyword)); };
$('btnWatchDiscard').onclick = ()=>{ const ids=getCheckedValues('.watch-check'); state.watch = state.watch.map(w=> ids.includes(String(w.id)) ? {...w,status:'已淘汰'} : w); renderWatch(); };
$('btnPipelineSync').onclick = ()=>syncProjectsToPipeline();
$('btnPipelineAdvance').onclick = ()=>{
  if(!state.pipeline.length){ renderPipeline('当前还没有执行项目，先从正式项目池同步。'); return; }
  state.pipeline = state.pipeline.map(item=>['开发通过','淘汰'].includes(item.stage) ? item : advancePipelineItem(item));
  renderProjects();
  renderPipeline('已推进一轮：系统更新了抢上、转开发和 FBM 测品阶段。');
};
$('btnPipelineSeed').onclick = seedPipelineData;
$('checkAllWords').onclick = e=>document.querySelectorAll('.word-check').forEach(i=>i.checked=e.target.checked);
$('checkAllWatch').onclick = e=>document.querySelectorAll('.watch-check').forEach(i=>i.checked=e.target.checked);
$('btnMonitorSync').onclick = syncRushProjectsToMonitoring;
$('btnMonitorPoll').onclick = pollMonitoring;
$('btnMonitorNotify').onclick = simulateMonitorNotification;
$('btnMonitorAuto').onclick = toggleMonitorAuto;
$('btnImportKeywords').onclick = importKeywordBatch;
$('btnClearKeywordInput').onclick = ()=>{ $('keywordBatchInput').value=''; $('keywordImportStatus').textContent='已清空词库输入框。'; };
$('btnImportSites').onclick = importSiteBatch;
$('btnSitesToWords').onclick = bulkSitesToWords;
$('btnClearSiteInput').onclick = ()=>{ $('siteBatchInput').value=''; $('siteImportStatus').textContent='已清空独立站输入框。'; };
$('btnBridgeSave').onclick = saveConnectorFramework;
$('btnBridgeTest').onclick = simulateConnectorTest;
$('btnBridgeSync').onclick = syncCurrentConnectorMock;
$('btnBridgeSeed').onclick = seedConnectorExamples;
$('btnTaskWordsSync').onclick = syncWordTasks;
$('btnTaskSitesSync').onclick = syncSiteTasks;
$('btnTaskRefresh').onclick = refreshSurveillance;
$('btnTaskAiSweep').onclick = runAiSweep;
$('btnTaskAuto').onclick = toggleTaskAuto;
$('btnAlertDispatchAll').onclick = dispatchAllAlerts;
$('btnAlertProjectAll').onclick = pushTopAlertsToProject;
$('btnAlertRefresh').onclick = ()=>renderOpportunityFlow('已刷新预警与行动卡视图。');
$('imageUpload').addEventListener('change', e=>handleImageFiles(e.target.files));
$('uploadDrop').addEventListener('dragover', e=>{ e.preventDefault(); $('uploadDrop').style.borderColor = '#60a5fa'; });
$('uploadDrop').addEventListener('dragleave', ()=>{ $('uploadDrop').style.borderColor = '#bfdbfe'; });
$('uploadDrop').addEventListener('drop', e=>{ e.preventDefault(); $('uploadDrop').style.borderColor = '#bfdbfe'; handleImageFiles(e.dataTransfer.files); });
$('btnClearImages').onclick = ()=>{ state.uploads = []; renderUploads(); };
$('btnImageParse').onclick = ()=>runBrainAnalysis('image');
$('btnBrainTest').onclick = testBrainConnection;
$('btnBrainAnalyze').onclick = ()=>runBrainAnalysis('full');
['brainMode','brainModel','brainEndpoint','brainApiKey','brainTaskPreset','brainSystemPrompt'].forEach(id=>$(id).addEventListener('input', syncBrainFormToState));
[...document.querySelectorAll('.tab')].forEach(t=>t.onclick=()=>{ document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.tab-pane').forEach(x=>x.classList.remove('active')); t.classList.add('active'); $('pane-'+t.dataset.tab).classList.add('active'); });


importWords();
state.watch = [
  { id:101, keyword:'purple toothpaste', score:72, trend:'上升', risk:'低', tags:['亚马逊机会词'], status:'待复核', model:'示例' },
  { id:102, keyword:'hydroxyapatite toothpaste', score:78, trend:'上升', risk:'低', tags:['高潜力词'], status:'继续观察', model:'示例' }
];
transferToProject('purple toothpaste');
transferToProject('hydroxyapatite toothpaste');
if(state.pipeline.length){
  state.pipeline[0] = advancePipelineItem(state.pipeline[0], true);
  if(state.pipeline[1]){
    state.pipeline[1] = advancePipelineItem(state.pipeline[1], true);
    state.pipeline[1] = advancePipelineItem(state.pipeline[1], true);
    state.pipeline[1] = advancePipelineItem(state.pipeline[1], true);
  }
}
renderProjects();
renderPipeline('已预置 2 个示例项目，方便直接查看“正式项目 → 抢上 → FBM测品”的链路。');

setModel('station'); renderAnalysisInfo(); renderWords(); renderWatch(); renderProjects(); renderPipeline(); renderMonitoring(); renderGovernance(); renderRiskCenter(); renderUploads(); renderFeedCenter(); renderBridgeCenter(); syncWordTasks(); renderSurveillance(); renderOpportunityFlow(); renderSearchCenter(); syncBrainFormToState(); updateTopChips();
