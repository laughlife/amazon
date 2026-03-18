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

let state = {
  model:'station',
  analysis:{
    info:{ productType:'-', packaging:'-', keywords:[], category:'-', tags:[], risks:[] },
    scores:{}, total:0, action:'暂不推进', risk:'中', summary:'请选择评分模型并执行分析。', level:'-', staff:'0人', reasons:[]
  },
  uploads:[],
  brain:{
    endpoint:'',
    apiKey:'',
    model:'',
    mode:'openai_compatible',
    taskPreset:'scoring',
    systemPrompt:'',
    connected:false,
    lastRaw:''
  },
  words:[], watch:[], projects:[], pipeline:[], monitors:[], siteResources:[], connectors:[],
  keywordMonitors:[], siteMonitors:[], monitorEvents:[], aiQueue:[], alerts:[], actionCards:[],
  search:{ query:'', scope:'all', results:[] },
  monitorAuto:false, monitorTimer:null, taskAuto:false, taskTimer:null
};

const $ = id => document.getElementById(id);
const clamp = (num, min, max) => Math.max(min, Math.min(max, Number(num || 0)));


function updateTopChips(){
  $('chipBrain').textContent = `大脑接口：${state.brain.connected ? '已连接' : '未连接'}`;
  $('chipImages').textContent = `图片上传：${state.uploads.length}张`;
  if($('chipBridge')) $('chipBridge').textContent = `第三方源：${state.connectors.length}个`;
  if($('chipTasks')) $('chipTasks').textContent = `监控任务：${state.keywordMonitors.length + state.siteMonitors.length}个`;
}

