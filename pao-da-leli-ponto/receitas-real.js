const $=selector=>document.querySelector(selector);
const API='/leli-api';
const batchOptions=[1,1.5,2,3];
const categoryOrder=['Todas','Pães','Doces','Salgados','Bebidas'];
const numberFormatter=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
let recipes=[],filteredRecipes=[],selectedId='',category='Todas',query='',mode='batches',batches=1,referenceAmount=0;

async function api(action,method='GET',data){
  const params=new URLSearchParams({action}),options={method,headers:{'Content-Type':'application/json'}};
  if(method==='GET'&&data){for(const [key,value] of Object.entries(data))params.set(key,String(value))}
  else if(data!==undefined)options.body=JSON.stringify(data);
  const response=await fetch(API+'?'+params.toString(),options);
  const result=await response.json().catch(()=>({error:'Resposta inválida do servidor.'}));
  if(!response.ok){const error=new Error(result.error||'Erro no sistema.');error.status=response.status;throw error}
  return result;
}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function formatAmount(value){
  if(!Number.isFinite(value))return'0';
  if(value>=100)return numberFormatter.format(Math.round(value));
  if(value>=10)return numberFormatter.format(Math.round(value*10)/10);
  return numberFormatter.format(Math.round(value*100)/100);
}
function formatMeasure(measure,factor=1){
  const amount=Number(measure?.amount||0)*factor,unit=measure?.unit||'g';
  if(unit==='ml')return amount>=1000?formatAmount(amount/1000)+' L':formatAmount(amount)+' ml';
  return amount>=1000?formatAmount(amount/1000)+' kg':formatAmount(amount)+' g';
}
function pluralRecipes(value){return Math.abs(value-1)<.001?'receita':'receitas'}
function selectedRecipe(){return recipes.find(recipe=>recipe.id===selectedId)||filteredRecipes[0]||recipes[0]}
function factorFor(recipe){
  if(mode==='batches')return Number(batches)||1;
  return Math.max(Number(referenceAmount)||recipe.reference.amount,0.01)/recipe.reference.amount;
}
function showAuth(message=''){$('#recipeApp').classList.add('hidden');$('#authGate').classList.remove('hidden');$('#authMessage').textContent=message||'Entre primeiro pela área ADM.'}
function showApp(){$('#authGate').classList.add('hidden');$('#recipeApp').classList.remove('hidden')}

function renderCategories(){
  const available=new Set(recipes.map(recipe=>recipe.category));
  $('#recipeCategories').innerHTML=categoryOrder.filter(item=>item==='Todas'||available.has(item)).map(item=>'<button type="button" class="'+(item===category?'active':'')+'" data-category="'+esc(item)+'">'+esc(item)+'</button>').join('');
  $('#recipeCategories').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.category;applyFilters()}));
}
function applyFilters(){
  const search=normalize(query);
  filteredRecipes=recipes.filter(recipe=>(category==='Todas'||recipe.category===category)&&(!search||normalize(recipe.name+' '+recipe.description+' '+recipe.category).includes(search)));
  if(!filteredRecipes.some(recipe=>recipe.id===selectedId))selectedId=filteredRecipes[0]?.id||'';
  renderCategories();renderList();renderSheet();
}
function renderList(){
  const list=$('#recipeList'),select=$('#recipeSelect');
  if(!filteredRecipes.length){list.innerHTML='<div class="empty">Nenhuma receita encontrada.</div>';select.innerHTML='<option>Nenhuma receita</option>';select.disabled=true;return}
  list.innerHTML=filteredRecipes.map(recipe=>'<button type="button" class="'+(recipe.id===selectedId?'active':'')+'" data-recipe="'+esc(recipe.id)+'"><span>'+esc(recipe.category)+'</span><strong>'+esc(recipe.name)+'</strong><small>≈ '+esc(formatMeasure(recipe.yieldMeasure))+' · '+esc(formatAmount(recipe.yieldAmount))+' '+esc(recipe.yieldUnit)+'</small></button>').join('');
  list.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>selectRecipe(button.dataset.recipe)));
  select.disabled=false;select.innerHTML=filteredRecipes.map(recipe=>'<option value="'+esc(recipe.id)+'" '+(recipe.id===selectedId?'selected':'')+'>'+esc(recipe.name)+'</option>').join('');
}
function selectRecipe(id){
  const recipe=recipes.find(item=>item.id===id);if(!recipe)return;
  selectedId=id;mode='batches';batches=1;referenceAmount=recipe.reference.amount;renderList();renderSheet();window.scrollTo({top:0,behavior:'smooth'});
}
function ingredientGroups(recipe){
  const groups=[];
  for(const ingredient of recipe.ingredients){
    const name=ingredient.group||'';let group=groups.find(item=>item.name===name);
    if(!group){group={name,items:[]};groups.push(group)}group.items.push(ingredient);
  }
  return groups;
}
function renderSheet(){
  const recipe=selectedRecipe(),sheet=$('#recipeSheet');
  if(!recipe){sheet.innerHTML='<div class="empty">Nenhuma receita encontrada.</div>';return}
  const factor=factorFor(recipe),measureLabel=recipe.yieldMeasure.unit==='ml'?'volume aproximado':'peso aproximado';
  const ingredients=ingredientGroups(recipe).map(group=>'<div class="ingredient-group">'+(group.name?'<h4>'+esc(group.name)+'</h4>':'')+group.items.map(item=>'<div class="ingredient"><span>'+esc(item.name)+'</span><strong>'+esc(formatAmount(item.amount*factor))+' '+esc(item.unit)+'</strong></div>').join('')+'</div>').join('');
  sheet.innerHTML='<div class="sheet-head"><div><span class="status">Receita de demonstração</span><p class="kicker">'+esc(recipe.category)+'</p><h2>'+esc(recipe.name)+'</h2><p class="description">'+esc(recipe.description)+'</p><p class="base-yield"><strong>1 receita</strong> rende aproximadamente <strong>'+esc(formatMeasure(recipe.yieldMeasure))+'</strong> e <strong>'+esc(formatAmount(recipe.yieldAmount))+' '+esc(recipe.yieldUnit)+'</strong>.</p></div><div class="yield-card"><span>Rendimento ajustado</span><div class="yield-values"><p><strong>≈ '+esc(formatMeasure(recipe.yieldMeasure,factor))+'</strong><small>'+measureLabel+'</small></p><i>+</i><p><strong>'+esc(formatAmount(recipe.yieldAmount*factor))+'</strong><small>'+esc(recipe.yieldUnit)+'</small></p></div></div></div>'+
    '<div class="meta"><div><small>Preparo</small><strong>'+esc(recipe.prepTime)+'</strong></div><div><small>Tempo total</small><strong>'+esc(recipe.totalTime)+'</strong></div><div><small>'+esc(recipe.heatLabel||'Forno')+'</small><strong>'+esc(recipe.oven)+'</strong></div></div>'+
    '<section class="calculator"><p class="kicker">Calculadora</p><h3>'+(mode==='batches'?'Quantas receitas você quer fazer?':'Quanto você tem de '+esc(recipe.reference.label)+'?')+'</h3><div class="modes"><button type="button" class="'+(mode==='batches'?'active':'')+'" data-mode="batches">Quantas receitas</button><button type="button" class="'+(mode==='reference'?'active':'')+'" data-mode="reference">Quanto tenho de '+esc(recipe.reference.label)+'</button></div><div class="scale">'+
      (mode==='batches'?'<div class="batch-field"><span>Escolha uma opção</span><div class="batch-options">'+batchOptions.map(option=>'<button type="button" class="'+(Math.abs(batches-option)<.001?'active':'')+'" data-batch="'+option+'">'+formatAmount(option)+'</button>').join('')+'</div></div>':'<label><span>Quantidade de '+esc(recipe.reference.label)+'</span><span class="number-input"><input id="referenceAmount" type="number" min="1" step="10" value="'+esc(referenceAmount)+'"><b>'+esc(recipe.reference.unit)+'</b></span></label>')+
      '<p class="summary">Você fará <strong>'+esc(formatAmount(factor))+' '+pluralRecipes(factor)+'</strong>, com rendimento aproximado de <strong>'+esc(formatMeasure(recipe.yieldMeasure,factor))+'</strong> e <strong>'+esc(formatAmount(recipe.yieldAmount*factor))+' '+esc(recipe.yieldUnit)+'</strong>.</p></div></section>'+
    '<div class="content"><section class="section"><p class="kicker">Quantidades recalculadas</p><h3>Ingredientes</h3><div class="ingredients">'+ingredients+'</div></section><section class="section"><p class="kicker">Passo a passo</p><h3>Modo de preparo</h3><ol class="steps">'+recipe.steps.map((step,index)=>'<li><span>'+(index+1)+'</span><p>'+esc(step)+'</p></li>').join('')+'</ol></section>'+(recipe.notes?'<p class="notes"><strong>Observação:</strong> '+esc(recipe.notes)+'</p>':'')+'</div>';
  sheet.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.mode;if(next===mode)return;
    if(next==='reference')referenceAmount=recipe.reference.amount*(Number(batches)||1);
    else batches=Math.max((Number(referenceAmount)||recipe.reference.amount)/recipe.reference.amount,.01);
    mode=next;renderSheet();
  }));
  sheet.querySelectorAll('[data-batch]').forEach(button=>button.addEventListener('click',()=>{batches=Number(button.dataset.batch);renderSheet()}));
  $('#referenceAmount')?.addEventListener('change',event=>{referenceAmount=Math.max(Number(event.target.value)||recipe.reference.amount,1);renderSheet()});
}

async function loadRecipes(){
  const result=await api('admin-recipes');recipes=result.recipes||[];filteredRecipes=recipes;selectedId=recipes[0]?.id||'';referenceAmount=recipes[0]?.reference?.amount||0;$('#recipeCount').textContent=recipes.length;renderCategories();applyFilters();showApp();
}
async function boot(){
  try{const result=await api('me');if(result.user?.role!=='admin')return showAuth('Entre primeiro pela área ADM.');await loadRecipes()}
  catch{showAuth('Entre primeiro pela área ADM.')}
}

$('#recipeSearch').addEventListener('input',event=>{query=event.target.value;applyFilters()});
$('#recipeSelect').addEventListener('change',event=>selectRecipe(event.target.value));
boot();
