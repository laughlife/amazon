const MODEL_CONFIG = {
  station: {
    name: '模型A：亚马逊机会型',
    passThreshold: 80,
    formalThreshold: 70,
    watchThreshold: 60,
    guide: '适合从 ABA、关键词和亚马逊站内需求中发现“需求真实、承接不足、具备切入口”的机会产品。硬规则：亚马逊需求机会分低于 35/60，直接不立项。',
    fields: [
      { key:'amazonOpportunity', label:'亚马逊需求机会', weight:60, demo:49.2, hint:'核心判断项：词需求强度 + 结果满足缺口 + 细分切口空间 + 上架承接难度' },
      { key:'facebookAds', label:'Facebook 广告验证', weight:20, demo:14.0, hint:'看广告主数量、持续时长、创意数量、多品牌/多站点投放情况' },
      { key:'googleTrends', label:'Google 趋势', weight:10, demo:7.8, hint:'看 30/90 天趋势、12 个月趋势和季节性' },
      { key:'socialAssist', label:'社媒辅助验证', weight:10, demo:9.0, hint:'TikTok / Instagram / YouTube / Reddit 只做辅助加分，不替代站内机会' }
    ],
    decide(scores, total){
      const reasons = [];
      if((scores.amazonOpportunity||0) < 35){
        reasons.push('亚马逊需求机会未过线（<35/60），外部热度不能替代站内机会。');
        return { level:'C', action:'不立项', staff:'0人', reasons, badge:'gray' };
      }
      if(total >= 80){
        reasons.push('站内需求机会强，且综合分达到抢上阈值。');
        return { level:'S', action:'进入抢上池', staff:'最多2–4人', reasons, badge:'green' };
      }
      if(total >= 70){
        reasons.push('具备正式立项价值，可进入打样、竞品拆解和利润核算。');
        return { level:'A', action:'进入正式项目池', staff:'1–2人预研', reasons, badge:'blue' };
      }
      if(total >= 60){
        reasons.push('信号成立但强度不足，建议继续观察。');
        return { level:'B', action:'进入观察池', staff:'1人跟踪', reasons, badge:'yellow' };
      }
      reasons.push('总分不足，暂不建议投入。');
      return { level:'C', action:'淘汰', staff:'0人', reasons, badge:'gray' };
    }
  },
  social: {
    name: '模型B：社媒热评分型',
    passThreshold: 85,
    formalThreshold: 75,
    watchThreshold: 65,
    guide: '适合从 Reddit、Facebook Groups、Instagram、YouTube、DTC 品牌等社媒热度中反推“站外已热、站内仍有空白”的产品。硬规则：亚马逊空白度低于 20/35 不能进抢上池；社媒热度低于 24/40 不能定义为社媒热品。',
    fields: [
      { key:'socialHeat', label:'社媒热度', weight:40, demo:31.2, hint:'包含 Reddit、Facebook Groups、Instagram、YouTube、DTC 品牌' },
      { key:'amazonBlank', label:'亚马逊空白度', weight:35, demo:34.3, hint:'看结果错位度、精准承接缺口、细分切口空间、头部垄断压力' },
      { key:'crossPlatform', label:'跨平台验证', weight:15, demo:15.0, hint:'包含独立站、沃尔玛、TikTok Shop 多平台验证情况' },
      { key:'trendSpeed', label:'趋势速度', weight:10, demo:9.5, hint:'包含 ABA 数据增长速度、Google Trends 增长速度' }
    ],
    decide(scores, total){
      const reasons = [];
      const socialHeat = scores.socialHeat || 0;
      const amazonBlank = scores.amazonBlank || 0;
      const crossPlatform = scores.crossPlatform || 0;
      if(socialHeat < 24){
        reasons.push('社媒热度未过线（<24/40），当前不足以定义为社媒热品。');
      }
      if(amazonBlank < 20){
        reasons.push('亚马逊空白度未过线（<20/35），站外再热也不能直接抢上。');
      }
      if(crossPlatform < 6){
        reasons.push('跨平台验证偏弱（<6/15），最多进入观察或机会词库。');
      }
      const hardPass = socialHeat >= 24 && amazonBlank >= 20 && crossPlatform >= 6;
      if(hardPass && total >= 85){
        reasons.unshift('站外已形成热度，亚马逊仍有承接缺口，适合快速测试。');
        return { level:'S', action:'进入抢上池', staff:'最多2–4人', reasons, badge:'green' };
      }
      if(hardPass && total >= 75){
        reasons.unshift('社媒热度和站内空白同时成立，可作为正式项目推进。');
        return { level:'A', action:'进入正式项目池', staff:'1–2人预研', reasons, badge:'blue' };
      }
      if(total >= 65){
        if(!reasons.length) reasons.push('具备一定热度和验证，建议先进入机会词库持续跟踪。');
        return { level:'B', action:'进入机会词库', staff:'1人跟踪', reasons, badge:'yellow' };
      }
      if(!reasons.length) reasons.push('总分和门槛均不足，建议淘汰。');
      return { level:'C', action:'淘汰', staff:'0人', reasons, badge:'gray' };
    }
  }
};

const DEFAULT_BRAIN_SYSTEM_PROMPT = '你是跨境电商亚马逊选品分析大脑。请结合用户提供的关键词、来源链接、备注、截图或产品图，输出严格 JSON。你需要识别产品类型、包装形式、建议类目、关键词、标签、风险，并按当前评分模型返回每个评分维度的贡献分。不要输出解释，不要输出 markdown，只返回 JSON。';
const DEFAULT_SELLERSPRITE_ENDPOINT = 'https://api.sellersprite.com/v1/aba/research/weekly';
const DEFAULT_RUNTIME_CONFIG = {
  brain: {
    mode: 'openai_responses',
    endpoint: 'https://api.openai.com/v1/responses',
    apiKey: '',
    model: 'gpt-5.4',
    taskPreset: 'scoring',
    reasoningEffort: 'medium',
    systemPrompt: DEFAULT_BRAIN_SYSTEM_PROMPT
  },
  sellerSprite: {
    enabled: true,
    endpoint: DEFAULT_SELLERSPRITE_ENDPOINT,
    secretKey: '',
    marketplace: 'US',
    date: '',
    page: 1,
    size: 10,
    searchModel: 1
  }
};
const BRAIN_MODE_CONFIG = {
  openai_responses: {
    endpoint: 'https://api.openai.com/v1/responses'
  },
  openai_compatible: {
    endpoint: 'https://api.openai.com/v1/chat/completions'
  }
};

let state = {
  model:'station',
  analysis:{
    info:{ productType:'-', packaging:'-', keywords:[], category:'-', tags:[], risks:[] },
    scores:{}, total:0, action:'暂不推进', risk:'中', summary:'请选择评分模型并执行分析。', level:'-', staff:'0人', reasons:[]
  },
  uploads:[],
  brain:{
    endpoint:DEFAULT_RUNTIME_CONFIG.brain.endpoint,
    apiKey:DEFAULT_RUNTIME_CONFIG.brain.apiKey,
    model:DEFAULT_RUNTIME_CONFIG.brain.model,
    mode:DEFAULT_RUNTIME_CONFIG.brain.mode,
    taskPreset:DEFAULT_RUNTIME_CONFIG.brain.taskPreset,
    reasoningEffort:DEFAULT_RUNTIME_CONFIG.brain.reasoningEffort,
    systemPrompt:DEFAULT_RUNTIME_CONFIG.brain.systemPrompt,
    connected:false,
    lastRaw:''
  },
  sellerSprite:{
    enabled:DEFAULT_RUNTIME_CONFIG.sellerSprite.enabled,
    endpoint:DEFAULT_RUNTIME_CONFIG.sellerSprite.endpoint,
    secretKey:DEFAULT_RUNTIME_CONFIG.sellerSprite.secretKey,
    marketplace:DEFAULT_RUNTIME_CONFIG.sellerSprite.marketplace,
    date:DEFAULT_RUNTIME_CONFIG.sellerSprite.date,
    page:DEFAULT_RUNTIME_CONFIG.sellerSprite.page,
    size:DEFAULT_RUNTIME_CONFIG.sellerSprite.size,
    searchModel:DEFAULT_RUNTIME_CONFIG.sellerSprite.searchModel
  },
  words:[], watch:[], projects:[], pipeline:[], monitors:[], siteResources:[], connectors:[],
  keywordMonitors:[], siteMonitors:[], monitorEvents:[], aiQueue:[], alerts:[], actionCards:[],
  search:{ query:'', scope:'all', results:[], externalContext:null, externalStatus:'' },
  monitorAuto:false, monitorTimer:null, taskAuto:false, taskTimer:null,
  runtimeConfig:{ loaded:false, source:'default', error:'' }
};

const $ = id => document.getElementById(id);
const clamp = (num, min, max) => Math.max(min, Math.min(max, Number(num || 0)));


function updateTopChips(){
  $('chipBrain').textContent = `大脑接口：${state.brain.connected ? '已连接' : '未连接'}`;
  $('chipImages').textContent = `图片上传：${state.uploads.length}张`;
  if($('chipBridge')) $('chipBridge').textContent = `第三方源：${state.connectors.length}个`;
  if($('chipTasks')) $('chipTasks').textContent = `监控任务：${state.keywordMonitors.length + state.siteMonitors.length}个`;
  if($('chipSellerSprite')) $('chipSellerSprite').textContent = `卖家精灵：${state.sellerSprite.secretKey ? '已配置' : '未配置'}`;
}

function normalizeBrainMode(value){
  return ['openai_responses', 'openai_compatible'].includes(value) ? value : DEFAULT_RUNTIME_CONFIG.brain.mode;
}

function normalizeReasoningEffort(value){
  return ['none', 'low', 'medium', 'high', 'xhigh'].includes(value) ? value : DEFAULT_RUNTIME_CONFIG.brain.reasoningEffort;
}

function normalizeBrainConfig(raw = {}){
  const mode = normalizeBrainMode(raw.mode);
  return {
    mode,
    endpoint: String(raw.endpoint || '').trim() || BRAIN_MODE_CONFIG[mode].endpoint,
    apiKey: String(raw.apiKey || '').trim(),
    model: String(raw.model || '').trim() || DEFAULT_RUNTIME_CONFIG.brain.model,
    taskPreset: ['scoring', 'recognize'].includes(raw.taskPreset) ? raw.taskPreset : DEFAULT_RUNTIME_CONFIG.brain.taskPreset,
    reasoningEffort: normalizeReasoningEffort(raw.reasoningEffort),
    systemPrompt: String(raw.systemPrompt || '').trim() || DEFAULT_RUNTIME_CONFIG.brain.systemPrompt
  };
}

function applyBrainConfig(raw = {}){
  const nextBrain = normalizeBrainConfig(raw);
  state.brain = { ...state.brain, ...nextBrain };
}

function normalizeSellerSpriteConfig(raw = {}){
  const page = Number(raw.page);
  const size = Number(raw.size);
  const searchModel = Number(raw.searchModel);
  const marketplace = String(raw.marketplace || DEFAULT_RUNTIME_CONFIG.sellerSprite.marketplace).trim().toUpperCase();
  const dateRaw = String(raw.date || '').trim();
  return {
    enabled: raw.enabled !== false,
    endpoint: String(raw.endpoint || '').trim() || DEFAULT_SELLERSPRITE_ENDPOINT,
    secretKey: String(raw.secretKey || '').trim(),
    marketplace: marketplace || DEFAULT_RUNTIME_CONFIG.sellerSprite.marketplace,
    date: /^\d{8}$/.test(dateRaw) ? dateRaw : '',
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : DEFAULT_RUNTIME_CONFIG.sellerSprite.page,
    size: Number.isFinite(size) ? Math.max(1, Math.min(40, Math.floor(size))) : DEFAULT_RUNTIME_CONFIG.sellerSprite.size,
    searchModel: Number.isFinite(searchModel) ? Math.max(1, Math.min(6, Math.floor(searchModel))) : DEFAULT_RUNTIME_CONFIG.sellerSprite.searchModel
  };
}

function applySellerSpriteConfig(raw = {}){
  const nextConfig = normalizeSellerSpriteConfig(raw);
  state.sellerSprite = { ...state.sellerSprite, ...nextConfig };
}

async function loadRuntimeConfig(){
  applyBrainConfig(DEFAULT_RUNTIME_CONFIG.brain);
  applySellerSpriteConfig(DEFAULT_RUNTIME_CONFIG.sellerSprite);
  let source = 'default';
  let error = '';
  try {
    const res = await fetch(`config/conf.json?_=${Date.now()}`, { cache:'no-store' });
    if(!res.ok){
      throw new Error(`配置文件读取失败（${res.status}）`);
    }
    const external = await res.json();
    const hasBrainConfig = external && typeof external.brain === 'object';
    const hasSellerSpriteConfig = external && typeof external.sellerSprite === 'object';
    if(hasBrainConfig) applyBrainConfig(external.brain);
    if(hasSellerSpriteConfig) applySellerSpriteConfig(external.sellerSprite);
    if(hasBrainConfig || hasSellerSpriteConfig){
      source = 'config/conf.json';
    } else {
      throw new Error('配置文件缺少 brain 或 sellerSprite 节点');
    }
  } catch (err) {
    error = err?.message || '未知错误';
  }
  state.runtimeConfig = {
    loaded: source === 'config/conf.json',
    source,
    error
  };
  if(typeof syncBrainStateToForm === 'function'){
    syncBrainStateToForm();
  }
  if(typeof syncBrainFormToState === 'function'){
    syncBrainFormToState();
  }
  updateTopChips();
  return state.runtimeConfig;
}

