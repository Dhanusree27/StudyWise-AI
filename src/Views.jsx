import {useMemo,useState} from 'react'
import {Link} from 'react-router-dom'
import {upd} from './lib/db'
import {generatePlan,todayStr,diff,addDays,fmt12,dayName,PHASES} from './lib/planner'
import {savePlan,rebalance} from './lib/planService'
import {Feasibility} from './Setup'
const sn=(d,id)=>d.subjects.find(s=>s.id===id)?.name||''
const ln=(d,id)=>d.lessons.find(l=>l.id===id)?.name||''
const byTime=(a,b)=>(a.date+a.start).localeCompare(b.date+b.start)
const dur=m=>`${Math.floor(m/60)?Math.floor(m/60)+'h ':''}${m%60}m`.replace(/^0m$/,'0m')
const lessonMin=l=>(l.hours||1)*60
const learnedMin=l=>l.done?lessonMin(l):Math.min(l.learned_min||0,lessonMin(l))

export function Dashboard({ctx}){
  const {data:d}=ctx,p=d.profile,t=todayStr()
  const total=d.lessons.reduce((a,l)=>a+lessonMin(l),0)||1, got=d.lessons.reduce((a,l)=>a+learnedMin(l),0)
  const today=d.tasks.filter(x=>x.date===t).sort(byTime), pend=today.filter(x=>['pending','started'].includes(x.status))
  const sim=useMemo(()=>generatePlan({...d,from:t}),[d])
  const next=d.exams.filter(e=>e.date>=t).sort((a,b)=>a.date.localeCompare(b.date))[0]
  const weak=d.subjects.filter(s=>s.level==='Weak').map(s=>s.name).join(', ')||'None marked'
  const revDue=d.tasks.filter(x=>x.type==='Revision'&&x.status==='pending'&&x.date>=t&&x.date<=addDays(t,3)).length
  const dayNo=Math.min(Math.max(1,diff(p.start_date,t)+1),p.days)
  return <div className="stackv"><h2>Hi {p.name} 👋</h2>
    {sim.feasibility&&!sim.feasibility.ok&&<Feasibility f={sim.feasibility}/>}{sim.error&&<p className="warn">{sim.error}</p>}
    <div className="stats">
      <div className="card"><div className="big">{Math.round(100*got/total)}%</div><small>Overall progress</small><div className="bar"><i style={{width:`${100*got/total}%`}}/></div></div>
      <div className="card"><div className="big">Day {dayNo}</div><small>of {p.days}</small></div>
      <div className="card"><div className="big">{dur(today.reduce((a,x)=>a+x.minutes,0))}</div><small>Today's study · done {dur(today.filter(x=>x.status==='done').reduce((a,x)=>a+x.minutes,0))}</small></div>
      <div className="card"><div className="big">{next?`${diff(t,next.date)} days`:'–'}</div><small>{next?`Next exam: ${sn(d,next.subject_id)}`:'No upcoming exam'}</small></div>
      <div className="card"><div className="big sm">{weak}</div><small>Weak subject</small></div>
      <div className="card"><div className="big">{d.lessons.filter(l=>!l.done).length}</div><small>Remaining lessons · {revDue} revisions due soon</small></div></div>
    <section className="card"><h3>Today's tasks</h3>{today.length===0?<p className="hint">No study planned today. Enjoy your rest.</p>:today.map(x=><TaskLine key={x.id} x={x} d={d}/>)}
      <Link className="btn" to="/today">Open Today's Study</Link></section>
    {pend.length>0&&<section className="card"><h3>Couldn't Finish Today's Plan?</h3><p className="hint">No problem. We will rebalance your remaining days.</p><Link className="btn ghost" to="/today">Change My Plan</Link></section>}
  </div>
}
const TaskLine=({x,d})=><div className={`task ${x.status}`}><div className="time">{fmt12(x.start)} – {fmt12(x.end)}</div><div><b>{sn(d,x.subject_id)} – {ln(d,x.lesson_id)}</b><br/><span className={`tag ${x.type}`}>{x.type}</span> <small>{dur(x.minutes)} · {x.status}{x.difficult?' · difficult':''}</small></div></div>

export function Plan({ctx}){
  const {data:d,uid,reload}=ctx,[fd,setFd]=useState(''),[fs,setFs]=useState(''),[ft,setFt]=useState(''),[busy,setBusy]=useState(false),[m,setM]=useState('')
  const rows=d.tasks.filter(x=>(!fd||x.date===fd)&&(!fs||x.subject_id===fs)&&(!ft||x.type===ft)).sort(byTime)
  const days=[...new Set(d.tasks.map(x=>x.date))].sort()
  const regen=async()=>{setBusy(true);const r=await savePlan(d,uid);setM(r.error||'Plan updated.');await reload();setBusy(false)}
  const sim=useMemo(()=>generatePlan({...d,from:todayStr()}),[d])
  let cur=''
  return <div className="stackv"><h2>My Plan</h2>
    {sim.phases?.length>0&&<div className="card phases">{sim.phases.map(ph=><div key={ph.n}><b>Phase {ph.n}: {PHASES[ph.n]}</b><br/><small>{ph.from} to {ph.to}</small></div>)}</div>}
    <div className="card filters"><select value={fd} onChange={e=>setFd(e.target.value)}><option value="">All days</option>{days.map(x=><option key={x} value={x}>{dayName(x).slice(0,3)} {x}</option>)}</select>
      <select value={fs} onChange={e=>setFs(e.target.value)}><option value="">All subjects</option>{d.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select value={ft} onChange={e=>setFt(e.target.value)}><option value="">All types</option>{['Learn','Revision','Practice','Test'].map(x=><option key={x}>{x}</option>)}</select>
      <button className="btn ghost" disabled={busy} onClick={regen}>Rebuild from today</button>{m&&<span className="msg">{m}</span>}</div>
    <div className="card">{rows.length===0?<p className="hint">No tasks match these filters.</p>:rows.map(x=>{const h=x.date!==cur;cur=x.date
      return <div key={x.id}>{h&&<h4>{dayName(x.date)}, {x.date}</h4>}<TaskLine x={x} d={d}/></div>})}</div></div>
}

export function Today({ctx}){
  const {data:d,reload,uid,token}=ctx,t=todayStr(),[modal,setModal]=useState(false),[note,setNote]=useState(''),[ai,setAi]=useState({}),[err,setErr]=useState('')
  const tasks=d.tasks.filter(x=>x.date===t).sort(byTime), pend=tasks.filter(x=>['pending','started'].includes(x.status))
  const finish=async(x,hard)=>{try{await upd('tasks',x.id,{status:'done',difficult:!!hard})
    const l=d.lessons.find(y=>y.id===x.lesson_id);if(l){const patch={}
      if(x.type==='Learn'){const lm=(l.learned_min||0)+x.minutes;patch.learned_min=lm;if(lm>=lessonMin(l))patch.done=true}
      if(hard)patch.difficult=(l.difficult||0)+1;if(Object.keys(patch).length)await upd('lessons',l.id,patch)}
    await reload()}catch(e){setErr(e.message)}}
  const set=async(x,status)=>{try{await upd('tasks',x.id,{status});await reload()}catch(e){setErr(e.message)}}
  const ask=async(x,kind)=>{const topic=`${ln(d,x.lesson_id)} (${sn(d,x.subject_id)}, class ${d.profile.class}, ${d.profile.board||'school'} board)`
    const prompt=kind==='explain'?`Explain this topic simply with one example and 3 key points: ${topic}`:`Why is it smart to do a ${x.type} session on ${topic} today? The student's level in the subject is ${d.subjects.find(s=>s.id===x.subject_id)?.level}. Give 2 study tips.`
    setAi(a=>({...a,[x.id]:'Thinking…'}))
    try{const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({prompt})});const j=await r.json()
      setAi(a=>({...a,[x.id]:r.ok?j.text:(j.error||'The AI helper is not available. Your plan still works.')}))}
    catch{setAi(a=>({...a,[x.id]:'The AI helper is not available right now. Your plan still works.'}))}}
  const reasons=[['understand',"I didn't understand the topic"],['time',"I didn't have enough time"],['school','School work'],['personal','Personal reason'],['other','Other']]
  const adjust=async r=>{setModal(false);const res=await rebalance(d,uid,r);setNote(res.error||res.explanation);await reload()}
  return <div className="stackv"><h2>Today's Study</h2>{err&&<p className="warn">{err}</p>}{note&&<p className="msg card">{note}</p>}
    {tasks.length===0?<div className="card"><p className="hint">Nothing planned for today.</p></div>:tasks.map(x=><section className="card" key={x.id}>
      <TaskLine x={x} d={d}/>
      <div className="actions">
        {x.status==='pending'&&<button className="btn" onClick={()=>set(x,'started')}>Start</button>}
        {['pending','started'].includes(x.status)&&<><button className="btn" onClick={()=>finish(x)}>Complete</button><button className="btn ghost" onClick={()=>set(x,'skipped')}>Skip</button><button className="btn ghost" onClick={()=>finish(x,true)}>Mark as Difficult</button></>}
        <button className="btn ghost" onClick={()=>ask(x,'explain')}>Explain topic</button><button className="btn ghost" onClick={()=>ask(x,'why')}>Why today?</button></div>
      {ai[x.id]&&<p className="ai">{ai[x.id]}</p>}</section>)}
    {pend.length>0&&<section className="card"><h3>Couldn't Finish Today's Plan?</h3><button className="btn" onClick={()=>setModal(true)}>Change My Plan</button></section>}
    {modal&&<div className="modal" onClick={()=>setModal(false)}><div className="card" onClick={e=>e.stopPropagation()}><h3>Why couldn't you finish?</h3>
      {reasons.map(([k,l])=><button key={k} className="btn ghost block" onClick={()=>adjust(k)}>{l}</button>)}</div></div>}</div>
}

export function Progress({ctx}){
  const {data:d}=ctx,done=d.tasks.filter(x=>x.status==='done')
  const total=d.lessons.reduce((a,l)=>a+lessonMin(l),0)||1,got=d.lessons.reduce((a,l)=>a+learnedMin(l),0)
  const hard=d.lessons.filter(l=>l.difficult>0)
  return <div className="stackv"><h2>Progress</h2>
    <div className="stats"><div className="card"><div className="big">{Math.round(100*got/total)}%</div><small>Syllabus complete</small></div>
      <div className="card"><div className="big">{d.lessons.filter(l=>l.done).length}/{d.lessons.length}</div><small>Lessons completed</small></div>
      <div className="card"><div className="big">{dur(done.reduce((a,x)=>a+x.minutes,0))}</div><small>Study time</small></div>
      <div className="card"><div className="big">{done.filter(x=>x.type==='Practice').length}</div><small>Practice sessions</small></div>
      <div className="card"><div className="big">{done.filter(x=>x.type==='Test').length}</div><small>Tests completed</small></div></div>
    <section className="card"><h3>Subjects</h3>{d.subjects.map(s=>{const ls=d.lessons.filter(l=>l.subject_id===s.id),tt=ls.reduce((a,l)=>a+lessonMin(l),0)||1,g=ls.reduce((a,l)=>a+learnedMin(l),0)
      return <div key={s.id} className="srow"><span>{s.name} <small>({s.level}) · {ls.filter(l=>l.done).length}/{ls.length} lessons</small></span><div className="bar"><i style={{width:`${100*g/tt}%`}}/></div></div>})}</section>
    <section className="card"><h3>Weak subjects</h3><p>{d.subjects.filter(s=>s.level==='Weak').map(s=>s.name).join(', ')||'None marked'}</p>
      <h3>Difficult topics</h3>{hard.length?<ul className="list">{hard.map(l=><li key={l.id}>{sn(d,l.subject_id)}: {l.name}</li>)}</ul>:<p className="hint">Mark a task as Difficult and it shows here.</p>}</section></div>
}
