let adminCommentMap=new Map();

async function loadAdminComments(){
  adminCommentMap=new Map();
  if(!rows.length) return;
  const ids=[...new Set(rows.map(r=>r.id))];
  const {data,error}=await sb
    .from('prayer_comments')
    .select('id,source,prayer_id,commenter,body,created_at,updated_at')
    .in('prayer_id',ids)
    .order('created_at',{ascending:true});
  if(error){console.error(error);return;}
  (data||[]).forEach(c=>{
    const key=`${c.source}:${c.prayer_id}`;
    if(!adminCommentMap.has(key)) adminCommentMap.set(key,[]);
    adminCommentMap.get(key).push(c);
  });
}

function renderAdminComments(){
  const cards=[...document.querySelectorAll('#list .row-card')];
  cards.forEach((card,i)=>{
    const r=rows[i];
    if(!r) return;
    card.querySelectorAll('.admin-comment-box').forEach(x=>x.remove());
    const cs=adminCommentMap.get(`${r.community_key}:${r.id}`)||[];
    const box=document.createElement('div');
    box.className='admin-comment-box';
    box.style.cssText='margin-top:12px;padding-top:10px;border-top:1px dashed #d9e3ec';
    const title=document.createElement('div');
    title.textContent=`💬 댓글 ${cs.length}개`;
    title.style.cssText='font-size:13px;font-weight:800;margin-bottom:7px';
    box.append(title);
    if(!cs.length){
      const empty=document.createElement('div');
      empty.textContent='댓글 없음';
      empty.style.cssText='font-size:12px;color:#8290a1';
      box.append(empty);
    }
    cs.forEach(c=>{
      const item=document.createElement('div');
      item.style.cssText='background:#f7fafc;border:1px solid #e3eaf1;border-radius:10px;padding:9px 10px;margin-top:6px';
      const top=document.createElement('div');
      top.style.cssText='display:flex;justify-content:space-between;gap:8px;align-items:flex-start';
      const who=document.createElement('div');
      const name=document.createElement('b');
      name.textContent=c.commenter;
      name.style.fontSize='12px';
      const time=document.createElement('span');
      time.textContent=' · '+new Date(c.updated_at||c.created_at).toLocaleString('ko-KR');
      time.style.cssText='font-size:11px;color:#8190a0';
      who.append(name,time);
      const del=document.createElement('button');
      del.className='danger';
      del.textContent='댓글 삭제';
      del.style.cssText='padding:5px 8px;font-size:11px';
      del.onclick=()=>removeAdminComment(c.id);
      top.append(who,del);
      const body=document.createElement('div');
      body.textContent=c.body;
      body.style.cssText='white-space:pre-wrap;font-size:13px;color:#58687a;margin-top:3px';
      item.append(top,body);
      box.append(item);
    });
    card.append(box);
  });
  const count=[...adminCommentMap.values()].reduce((n,a)=>n+a.length,0);
  if($('statusText')) $('statusText').textContent=`${rows.length}개 기록 · 댓글 ${count}개`;
}

async function removeAdminComment(id){
  if(!confirm('이 댓글을 관리자 권한으로 삭제할까요?')) return;
  const {data,error}=await sb.rpc('prayer_admin_delete_comment',{p_token:token,p_id:id});
  if(error){alert(errMsg(error));return;}
  if(!data){alert('댓글을 찾지 못했습니다.');return;}
  await enhancedLoad();
}

const baseAdminLoad=load;
async function enhancedLoad(){
  await baseAdminLoad();
  if(!token) return;
  await loadAdminComments();
  renderAdminComments();
}
load=enhancedLoad;

$('year').onchange=enhancedLoad;
$('month').onchange=enhancedLoad;
$('refreshBtn').onclick=enhancedLoad;
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  community=b.dataset.community;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));
  enhancedLoad();
});
$('search').onkeydown=e=>{if(e.key==='Enter')enhancedLoad()};
$('clearBtn').onclick=()=>{
  $('year').value=String(now.getFullYear());
  $('month').value=String(now.getMonth()+1);
  $('search').value='';
  enhancedLoad();
};

if(token) enhancedLoad();