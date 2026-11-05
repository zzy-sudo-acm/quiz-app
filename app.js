"use strict";
const IMPORT_KEY = "mayuan_import_v1";
const $ = (id) => document.getElementById(id);
const modeNames = {sequence:"顺序练习", random:"随机练习", wrong:"错题本", starred:"我的收藏"};
let questions = [], byId = new Map(), state, storageKey = "", imported = false;
function freshState() {
  return {mode:"sequence",year:"all",type:"all",search:"",index:0,order:[],round:{},drafts:{},history:{},wrong:[],starred:[]};
}
function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
  $("notice").hidden = !message;
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { $("saveStatus").textContent = "存储空间不足，本次进度暂未保存"; notice("浏览器无法保存进度。可以继续练习，请勿关闭页面。",true); }
}
function validateBank(data) {
  const list = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(list) || !list.length || list.length > 10000) throw new Error("题库应包含 1–10000 道题目。");
  const ids = new Set();
  return list.map((q, i) => {
    const prefix = "第 " + (i+1) + " 题：";
    if (!q || typeof q !== "object" || !["single","multiple"].includes(q.type)) throw new Error(prefix+"题型须为 single 或 multiple。");
    if (!Number.isSafeInteger(q.id) || q.id <= 0 || ids.has(q.id)) throw new Error(prefix+"id 须为不重复的正整数。");
    ids.add(q.id);
    if (typeof q.question !== "string" || !q.question.trim()) throw new Error(prefix+"缺少题干。");
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) throw new Error(prefix+"选项数量应为 2–8。");
    const keys = q.options.map(o => o?.key);
    if (new Set(keys).size !== keys.length || q.options.some(o => !/^[A-H]$/.test(o?.key) || typeof o.text !== "string" || !o.text.trim())) throw new Error(prefix+"选项须包含唯一的 A–H 标识和文字。");
    if (!Array.isArray(q.answer) || !q.answer.length || new Set(q.answer).size !== q.answer.length || q.answer.some(k => !keys.includes(k))) throw new Error(prefix+"答案必须对应现有选项。");
    if ((q.type === "single" && q.answer.length !== 1) || (q.type === "multiple" && q.answer.length < 2)) throw new Error(prefix+"答案数量与题型不符。");
    const result = {id:q.id,type:q.type,question:q.question,options:q.options.map(o=>({key:o.key,text:o.text})),answer:[...q.answer].sort()};
    for (const key of ["year","source","explanation","note","answerSource","answerStatus","sourceHash"]) if(typeof q[key]==="string") result[key]=q[key];
    for (const key of ["number","page"]) if(Number.isSafeInteger(q[key]) && q[key]>0) result[key]=q[key];
    result.references = Array.isArray(q.references) ? q.references.filter(r=>r && typeof r.title==="string" && typeof r.url==="string" && /^https:\/\//.test(r.url)).map(r=>({title:r.title,url:r.url})) : [];
    return result;
  });
}
function fingerprint(bank) {
  let hash = 2166136261;
  const content = bank.map(q => [q.id, q.type, q.question, q.options.map(o => [o.key, o.text]), [...q.answer].sort()]);
  for (const ch of JSON.stringify(content)) hash = Math.imul(hash ^ ch.charCodeAt(0),16777619);
  return (hash>>>0).toString(16);
}
function shuffle(items) {
  const copy = [...items];
  for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
}
function matching() {
  const query = state.search.trim().toLocaleLowerCase();
  return questions.filter(q =>
    (state.year==="all" || (q.year || "未标注年份")===state.year) &&
    (state.type==="all" || q.type===state.type) &&
    (!query || (q.question+" "+q.options.map(o=>o.text).join(" ")).toLocaleLowerCase().includes(query)) &&
    (state.mode!=="wrong" || state.wrong.includes(q.id)) &&
    (state.mode!=="starred" || state.starred.includes(q.id))
  );
}
function newRound() {
  const ids=matching().map(q=>q.id);
  state.order=state.mode==="random"?shuffle(ids):ids;
  state.index=0; state.round={}; state.drafts={};
  save(); render();
}
function activate(bank, isImported) {
  questions=bank; imported=isImported; byId=new Map(bank.map(q=>[q.id,q]));
  storageKey="mayuan_progress_v1_"+fingerprint(bank);
  let saved;
  try { saved=JSON.parse(localStorage.getItem(storageKey)); } catch {}
  state=freshState();
  if(saved && typeof saved==="object" && Array.isArray(saved.order) &&
    saved.order.every(id=>byId.has(id)) && new Set(saved.order).size===saved.order.length) {
    for(const key of ["round","drafts","history"]) if(saved[key] && typeof saved[key]==="object" && !Array.isArray(saved[key])) state[key]=saved[key];
    for(const key of ["wrong","starred"]) if(Array.isArray(saved[key])) state[key]=[...new Set(saved[key].filter(id=>byId.has(id)))];
    state.mode=modeNames[saved.mode]?saved.mode:"sequence";
    state.type=["all","single","multiple"].includes(saved.type)?saved.type:"all";
    state.year=typeof saved.year==="string"?saved.year:"all";
    state.search=typeof saved.search==="string"?saved.search:"";
    state.order=saved.order;
    state.index=Number.isInteger(saved.index)?Math.max(0,Math.min(saved.index,state.order.length)):0;
    for (const [id,result] of Object.entries(state.round)) {
      const q=byId.get(Number(id));
      if(!q || !Array.isArray(result?.selected) || !result.selected.length || result.selected.some(k=>!q.options.some(o=>o.key===k))) delete state.round[id];
      else result.correct=equalAnswers(result.selected,q.answer);
    }
  }
  $("defaultBtn").hidden=!imported; $("exportBtn").disabled=false;
  $("searchInput").value=state.search;
  renderYears();
  if(!saved) newRound(); else render();
}
function renderYears() {
  const years=[...new Set(questions.map(q=>q.year||"未标注年份"))].sort();
  $("yearSelect").replaceChildren(); $("yearList").replaceChildren();
  for(const year of ["all",...years]){
    const label=year==="all"?"全部年份":year;
    const count=year==="all"?questions.length:questions.filter(q=>(q.year||"未标注年份")===year).length;
    const option=document.createElement("option");option.value=year;option.textContent=label+" · "+count+" 题";$("yearSelect").append(option);
    const button=document.createElement("button");button.className="year-button";button.dataset.year=year;
    const name=document.createElement("span"),num=document.createElement("span");name.textContent=label;num.textContent=count;
    button.append(name,num);button.addEventListener("click",()=>changeFilter("year",year));$("yearList").append(button);
  }
  if(!["all",...years].includes(state.year)) state.year="all";
}
function changeFilter(key,value){state[key]=value;newRound();}
function current(){return state && byId.get(state.order[state.index]);}
function equalAnswers(a,b){return a.length===b.length && [...a].sort().every((key,i)=>key===[...b].sort()[i]);}
function selectOption(key){
  const q=current(); if(!q || state.round[q.id] || !q.options.some(o=>o.key===key)) return;
  let selected=state.drafts[q.id]||[];
  selected=q.type==="single"?[key]:selected.includes(key)?selected.filter(k=>k!==key):[...selected,key].sort();
  state.drafts[q.id]=selected;save();renderQuestion();
  document.querySelector('[data-option="'+key+'"]')?.focus({preventScroll:true});
}
function submit(){
  const q=current(), selected=q && state.drafts[q.id];
  if(!q || state.round[q.id] || !selected?.length) return;
  const result={selected:[...selected],correct:equalAnswers(selected,q.answer)};
  state.round[q.id]=result;state.history[q.id]=result;
  state.wrong=state.wrong.filter(id=>id!==q.id);
  if(!result.correct) state.wrong.push(q.id);
  save();render();$("nextBtn").focus({preventScroll:true});
}
function go(index){
  state.index=Math.max(0,Math.min(index,state.order.length));save();render();
  if(current()) $("questionText").focus({preventScroll:true});
}
function render(){
  $("modeTitle").textContent=modeNames[state.mode];
  const years=new Set(questions.map(q=>q.year).filter(Boolean)).size;
  $("bankSummary").textContent=(imported?"已导入题库":"历年真题")+" · "+questions.length+" 道选择题"+(years?" · "+years+" 个学年":"");
  document.querySelectorAll("[data-mode]").forEach(b=>{b.classList.toggle("active",b.dataset.mode===state.mode);b.setAttribute("aria-pressed",String(b.dataset.mode===state.mode));});
  document.querySelectorAll("[data-type]").forEach(b=>{b.classList.toggle("active",b.dataset.type===state.type);b.setAttribute("aria-pressed",String(b.dataset.type===state.type));});
  document.querySelectorAll("[data-year]").forEach(b=>{b.classList.toggle("active",b.dataset.year===state.year);b.setAttribute("aria-pressed",String(b.dataset.year===state.year));});
  $("yearSelect").value=state.year;
  $("wrongCount").textContent=state.wrong.length;$("starCount").textContent=state.starred.length;
  $("restartBtn").disabled=!state.order.length;
  renderSheet();renderQuestion();
}
function renderSheet(){
  const total=state.order.length,done=state.order.filter(id=>state.round[id]).length,correct=state.order.filter(id=>state.round[id]?.correct).length;
  $("sheetTotal").textContent=total+" 题";
  $("completionText").textContent="已完成 "+done+" / "+total+" 题";
  $("progressBar").style.width=(total?done/total*100:0)+"%";
  $("sessionSummary").textContent=done?"本组答对 "+correct+" 题 · 正确率 "+Math.round(correct/done*100)+"%":"答完一题，离掌握更近一点。";
  $("questionGrid").replaceChildren();
  state.order.forEach((id,i)=>{
    const q=byId.get(id),result=state.round[id],b=document.createElement("button");
    b.textContent=i+1;b.className=(result?(result.correct?"correct":"wrong"):"")+(i===state.index?" current":"");
    const status=result?(result.correct?"答对":"待巩固"):"未答";
    b.setAttribute("aria-label","第 "+(i+1)+" 题，"+status+"，"+(q.year||"导入题目"));
    if(i===state.index)b.setAttribute("aria-current","step");
    b.addEventListener("click",()=>go(i));$("questionGrid").append(b);
  });
}
function showEmpty(title,text){
  $("quizPanel").hidden=true;$("emptyPanel").hidden=false;
  $("emptyTitle").textContent=title;$("emptyText").textContent=text;$("emptyAction").hidden=false;
}
function renderQuestion(){
  const q=current();
  if(!q){
    if(!state.order.length){
      const empty=state.mode==="wrong"?"当前范围没有错题":state.mode==="starred"?"当前范围没有收藏":"没有匹配的题目";
      showEmpty(empty,state.mode==="wrong"?"做错的题会自动收进这里，答对后移出。也可以试试其他年份。":state.mode==="starred"?"点击题目右上角的收藏，留下想再看一遍的题。":"调整年份、题型或搜索内容，再试一次。");
    }else{
      const done=state.order.filter(id=>state.round[id]).length;
      showEmpty(done===state.order.length?"这一组，练完了。":"已到本组末尾",done===state.order.length?"回看答题卡里的错题，或点击“再练本组”继续巩固。":"还有 "+(state.order.length-done)+" 道题未作答，可以从答题卡继续。");
    }
    return;
  }
  $("quizPanel").hidden=false;$("emptyPanel").hidden=true;
  const result=state.round[q.id],selected=result?.selected||state.drafts[q.id]||[];
  $("typeText").textContent=q.type==="multiple"?"多选题":"单选题";
  $("sourceText").textContent=(q.year||"导入题目")+(q.number?" · 原卷第 "+q.number+" 题":"")+(q.page?" · 第 "+q.page+" 页":"");
  $("sourceText").title=q.source||"";
  $("questionNumber").textContent=String(state.index+1).padStart(2,"0");
  $("questionText").textContent=q.question;
  $("selectHint").textContent=q.type==="multiple"?"请选择所有符合题意的选项，少选、多选均不算答对":"选择一个答案，然后提交";
  const starred=state.starred.includes(q.id);
  $("starBtn").setAttribute("aria-pressed",String(starred));$("starBtn").setAttribute("aria-label",starred?"取消收藏本题":"收藏本题");
  $("starBtn").querySelector("span").textContent=starred?"已收藏":"收藏";
  $("optionsList").replaceChildren();
  for(const option of q.options){
    const b=document.createElement("button");b.className="option-button";b.dataset.option=option.key;
    b.disabled=Boolean(result);b.setAttribute("aria-pressed",String(selected.includes(option.key)));
    b.classList.toggle("selected",selected.includes(option.key));
    const correct=Boolean(result)&&q.answer.includes(option.key),wrong=Boolean(result)&&selected.includes(option.key)&&!correct;
    b.classList.toggle("is-correct",correct);b.classList.toggle("is-wrong",wrong);
    const key=document.createElement("span"),text=document.createElement("span");key.className="option-key";key.textContent=option.key;text.className="option-text";text.textContent=option.text;b.append(key,text);
    if(correct||wrong){const badge=document.createElement("span");badge.className="option-state";badge.textContent=correct?"参考答案":"你的选择";b.append(badge);}
    b.addEventListener("click",()=>selectOption(option.key));$("optionsList").append(b);
  }
  $("feedback").hidden=!result;
  if(result){
    $("feedback").classList.toggle("wrong",!result.correct);
    $("resultText").textContent=result.correct?"回答正确，继续保持。":"这道题，再记一下。";
    $("answerText").textContent="参考答案 "+q.answer.join("、")+" · 你的选择 "+selected.join("、");
    $("explanationText").textContent=q.explanation||"此题暂无解析。";
    $("questionNote").textContent=q.note||"";$("questionNote").hidden=!q.note;
    $("answerSource").textContent=q.answerSource||"答案由导入题库提供";
    $("referenceLinks").replaceChildren();
    for(const ref of q.references){const a=document.createElement("a");a.textContent="核对资料："+ref.title;a.href=ref.url;a.target="_blank";a.rel="noopener noreferrer";$("referenceLinks").append(a);}
  }
  $("prevBtn").disabled=state.index===0;
  $("progressText").textContent=(state.index+1)+" / "+state.order.length;
  $("submitBtn").hidden=Boolean(result);$("submitBtn").disabled=!selected.length;
  $("nextBtn").hidden=!result;$("nextBtn").textContent=state.index===state.order.length-1?"完成本组":"下一题 →";
}
async function loadDefault(){
  const response=await fetch("./questions.json",{cache:"no-cache"});
  if(!response.ok)throw new Error("题库请求失败（"+response.status+"）");
  return validateBank(await response.json());
}
async function boot(){
  try{
    let data;
    try{data=localStorage.getItem(IMPORT_KEY);}catch{notice("浏览器未开放本地存储，进度可能无法保存。",true);}
    if(data){
      try{activate(validateBank(JSON.parse(data)),true);return;}
      catch{notice("上次导入的题库无法读取，已尝试加载内置题库。",true);}
    }
    activate(await loadDefault(),false);
  }catch(error){showEmpty("题库暂时无法加载","请检查网络后刷新页面，或从右上角导入 JSON 题库。");$("emptyAction").textContent="重新加载";}
}
document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{if(state)changeFilter("mode",b.dataset.mode);}));
document.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>{if(state)changeFilter("type",b.dataset.type);}));
$("yearSelect").addEventListener("change",e=>{if(state)changeFilter("year",e.target.value);});
$("searchInput").addEventListener("input",e=>{if(state)changeFilter("search",e.target.value);});
$("submitBtn").addEventListener("click",submit);
$("prevBtn").addEventListener("click",()=>go(state.index-1));
$("nextBtn").addEventListener("click",()=>go(state.index+1));
$("starBtn").addEventListener("click",()=>{const q=current();if(!q)return;state.starred=state.starred.includes(q.id)?state.starred.filter(id=>id!==q.id):[...state.starred,q.id];save();render();});
$("restartBtn").addEventListener("click",()=>{if(confirm("重新练习当前这一组？本轮答题状态会重置，错题和收藏保留。"))newRound();});
$("emptyAction").addEventListener("click",()=>{if(!questions.length){boot();return;}Object.assign(state,{mode:"sequence",year:"all",type:"all",search:""});$("searchInput").value="";newRound();});
$("importBtn").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>10*1024*1024)throw new Error("文件过大，请选择小于 10 MB 的 JSON 题库。");
    const bank=validateBank(JSON.parse((await file.text()).replace(/^\uFEFF/,"")));
    localStorage.setItem(IMPORT_KEY,JSON.stringify(bank));
    activate(bank,true);notice("已导入 "+bank.length+" 道题。题库仅保存在此浏览器。");
    document.querySelector(".file-menu").open=false;
  }catch(error){notice("导入失败："+(error instanceof SyntaxError?"文件不是有效的 JSON。":error.message)+" 当前题库未更改。",true);}
  finally{e.target.value="";}
});
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(questions,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="马原选择题_"+questions.length+"题.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector(".file-menu").open=false;
});
$("defaultBtn").addEventListener("click",async()=>{
  try{const bank=await loadDefault();localStorage.removeItem(IMPORT_KEY);activate(bank,false);notice("已切换为内置历年题库。");document.querySelector(".file-menu").open=false;}
  catch{notice("内置题库加载失败，请联网后重试。当前题库未更改。",true);}
});
document.addEventListener("keydown",e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.closest("input,select,textarea,summary")||!current())return;
  const key=e.key.toUpperCase();
  if(/^[A-H]$/.test(key)){e.preventDefault();selectOption(key);}
  if(e.key==="Enter" && (e.target===document.body||e.target.id==="questionText"||e.target.closest(".option-button"))){e.preventDefault();state.round[current().id]?go(state.index+1):submit();}
});
if("serviceWorker" in navigator && !["localhost","127.0.0.1"].includes(location.hostname)){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
}
boot();
