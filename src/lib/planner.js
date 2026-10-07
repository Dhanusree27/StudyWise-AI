// StudyWise planning engine: pure, deterministic, no UI or network code.
const pad=n=>String(n).padStart(2,'0')
export const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
const P=s=>{const [y,m,d]=s.split('-');return new Date(Date.UTC(+y,+m-1,+d))}
export const addDays=(s,n)=>new Date(P(s).getTime()+n*864e5).toISOString().slice(0,10)
export const diff=(a,b)=>Math.round((P(b)-P(a))/864e5)
export const dayName=s=>['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][P(s).getUTCDay()]
const tm=t=>{const [h,m]=(t||'0:0').split(':');return +h*60+ +m}
const hm=m=>`${pad(Math.floor(m/60)%24)}:${pad(m%60)}`
export const fmt12=t=>{const [h,m]=t.split(':').map(Number);return `${h%12||12}:${pad(m)} ${h<12?'AM':'PM'}`}
export const PHASES=['','Learn the syllabus','Practice + first revision','Weak areas + second revision','Mock tests + final revision']
// slot.day: 0=Sun..6=Sat, 7=every day, 8=Mon-Fri
const dayMatch=(d,dow)=>d==dow||d==7||(d==8&&dow>=1&&dow<=5)

export function sessionsFor(date,{profile:p,slots,session,brk}){
  const dow=P(date).getUTCDay(), wake=tm(p.wake||'06:00'); let sleep=tm(p.sleep||'22:30'); if(sleep<=wake)sleep+=1440
  let free=slots.filter(s=>s.kind==='free'&&dayMatch(s.day,dow)).map(s=>[Math.max(tm(s.start),wake),Math.min(tm(s.end),sleep)]).filter(([a,b])=>b>a)
  const busy=slots.filter(s=>s.kind==='busy'&&dayMatch(s.day,dow)).map(s=>[tm(s.start),tm(s.end)])
  if(p.school_start&&p.school_end&&dow>=1&&dow<=5)busy.push([tm(p.school_start)-(p.travel_to||0),tm(p.school_end)+(p.travel_from||0)])
  for(const [x,y] of busy)free=free.flatMap(([a,b])=>{if(y<=a||x>=b)return [[a,b]];const r=[];if(x>a)r.push([a,x]);if(y<b)r.push([y,b]);return r})
  const out=[]
  for(const [a,b] of free){let t=a;while(b-t>=20){const l=Math.min(session,b-t);out.push([t,t+l]);t+=l+brk}}
  return out
}

export function generatePlan({profile:p,subjects,lessons,slots,exams,tasks=[],from}){
  const today=todayStr(); from=from||today
  if(!p||!p.start_date||!p.days)return {error:'Please set your preparation start date and duration.'}
  if(!subjects.length)return {error:'Please add at least one subject first.'}
  if(!lessons.length)return {error:'Please add lessons to your syllabus first.'}
  const end=addDays(p.start_date,p.days-1), start=from>p.start_date?from:p.start_date
  if(end<start)return {error:'Your preparation period has ended. Please change the start date or duration.'}
  const session=p.session_min||45, brk=p.break_min??10, nowMin=new Date().getHours()*60+new Date().getMinutes()
  let sess=[]
  for(let d=start;d<=end;d=addDays(d,1))for(const [a,b] of sessionsFor(d,{profile:p,slots,session,brk}))if(!(d===today&&a<nowMin))sess.push({date:d,s:a,e:b})
  if(!sess.length)return {error:'No study time found. Add your free study times, and check they are not during school, sleep or fixed activities.'}
  const rem={}; lessons.forEach(l=>{if(!l.done)rem[l.id]=Math.max(0,(l.hours||1)*60-(l.learned_min||0))})
  const need=Object.values(rem).reduce((a,b)=>a+b,0)
  const win={Morning:[300,720],Afternoon:[720,1020],Evening:[1020,1440]}[p.pref_time]
  if(win){const f=sess.filter(x=>x.s>=win[0]&&x.s<win[1]);if(f.length&&f.reduce((a,x)=>a+x.e-x.s,0)>=need*1.6)sess=f}
  const total=sess.reduce((a,x)=>a+x.e-x.s,0)
  const subj=Object.fromEntries(subjects.map(s=>[s.id,s]))
  const subRem=id=>lessons.filter(l=>l.subject_id===id).reduce((a,l)=>a+(rem[l.id]||0),0)
  const missedBy={}; tasks.filter(t=>t.status==='missed').forEach(t=>missedBy[t.subject_id]=(missedBy[t.subject_id]||0)+1)
  const scale=Math.min(1,p.days/60), iv=[2,5,10,20].map(x=>Math.max(1,Math.round(x*scale)))
  const last={},cnt={}
  tasks.filter(t=>t.status==='done'&&t.lesson_id).forEach(t=>{const di=diff(p.start_date,t.date);if(last[t.lesson_id]==null||di>last[t.lesson_id])last[t.lesson_id]=di;if(t.type!=='Learn')cnt[t.lesson_id]=(cnt[t.lesson_id]||0)+1})
  const learned=new Set(lessons.filter(l=>l.done||rem[l.id]===0).map(l=>l.id))
  const ex=(sid,d)=>{const x=exams.filter(e=>e.subject_id===sid&&e.date>=d).map(e=>diff(d,e.date));return x.length?1/(1+Math.min(...x)/10):0}
  const weak=s=>({Weak:1,Average:.5,Strong:.1}[s?.level]??.5)
  const diffOf=sid=>Math.min(lessons.filter(l=>l.subject_id===sid).reduce((a,l)=>a+(l.difficult||0),0),3)/3
  const share=need===0?0:need>=total?1:Math.min(.75,Math.max(.3,need/total))
  const out=[],phases={},perDay={}
  sess.forEach((x,k)=>{
    const f=k/sess.length, di=diff(p.start_date,x.date)
    let ph=f<share?1:f<share+(1-share)*.4?2:f<share+(1-share)*.8?3:4
    if(p.days<14&&ph===4)ph=3
    const load=sid=>(perDay[x.date+sid]||0)*8
    // Weights: exam 30, unfinished syllabus 25, weak 20, missed 10, difficult/revision 10-15, preferred time handled above (5)
    const subScore=s=>30*ex(s.id,x.date)+25*subRem(s.id)/(need||1)+20*weak(s)+10*Math.min(missedBy[s.id]||0,5)/5+10*diffOf(s.id)-load(s.id)
    const revScore=l=>{const gap=di-(last[l.id]??-3),t=iv[Math.min(cnt[l.id]||0,3)];return 30*ex(l.subject_id,x.date)+20*weak(subj[l.subject_id])+20*Math.min(gap/t,2)/2+15*Math.min(l.difficult||0,3)/3+10*Math.min(missedBy[l.subject_id]||0,5)/5-(gap<1?100:0)-load(l.subject_id)}
    const pickLearn=()=>{const c=subjects.filter(s=>subRem(s.id)>0).sort((a,b)=>subScore(b)-subScore(a))[0];return c&&lessons.find(l=>l.subject_id===c.id&&rem[l.id]>0)}
    const pickRev=()=>{const c=lessons.filter(l=>learned.has(l.id)&&di-(last[l.id]??-3)>=1).sort((a,b)=>revScore(b)-revScore(a));return c[0]}
    const anyRem=Object.values(rem).some(v=>v>0)
    let want=ph===1?(k%4===3?'Revision':'Learn'):ph===2?(k%2?'Revision':'Practice'):ph===3?(k%3===2?'Practice':'Revision'):(p.mock!==false&&k%3===0?'Test':k%2?'Practice':'Revision')
    if(ph>1&&anyRem&&k%3===0)want='Learn'
    let type=want,l=type==='Learn'?pickLearn():pickRev()
    if(!l){type=type==='Learn'?'Revision':'Learn';l=type==='Learn'?pickLearn():pickRev()}
    if(!l)return
    let mins=x.e-x.s
    if(type==='Learn'){mins=Math.min(mins,rem[l.id]);rem[l.id]-=mins;if(rem[l.id]<=0)learned.add(l.id)}
    last[l.id]=di; if(type!=='Learn')cnt[l.id]=(cnt[l.id]||0)+1
    perDay[x.date+l.subject_id]=(perDay[x.date+l.subject_id]||0)+1
    out.push({date:x.date,start:hm(x.s),end:hm(x.s+mins),subject_id:l.subject_id,lesson_id:l.id,type,minutes:mins,status:'pending',difficult:false})
    phases[ph]=phases[ph]||{n:ph,name:PHASES[ph],from:x.date,to:x.date}; phases[ph].to=x.date
  })
  const left=Object.values(rem).reduce((a,b)=>a+b,0), ok=left===0
  const priorities=subjects.filter(s=>subRem(s.id)>0).sort((a,b)=>(30*ex(b.id,today)+20*weak(b))-(30*ex(a.id,today)+20*weak(a))).map(s=>s.name)
  return {tasks:out,phases:Object.values(phases),feasibility:{ok,needH:+(need/60).toFixed(1),availH:+(total/60).toFixed(1),leftH:+(left/60).toFixed(1),priorities,
    message:ok?'':'Your available study time is not enough to complete everything before your target date.'}}
}
