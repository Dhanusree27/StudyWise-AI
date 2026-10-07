import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import Crud from './Crud'
import {saveProfile} from './lib/db'
import {savePlan} from './lib/planService'
import {todayStr,fmt12} from './lib/planner'
const DAYS=[{v:8,l:'Mon–Fri'},{v:7,l:'Every day'},...['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((l,v)=>({v,l}))]
const dn=v=>DAYS.find(d=>d.v==v)?.l
const timeCheck=r=>r.end<=r.start?'End time must be after start time.':''
export default function Setup({ctx}){
  const {data,reload,uid}=ctx, nav=useNavigate()
  const [p,setP]=useState({name:'',class:'12th',board:'',goal:'',start_date:todayStr(),days:80,wake:'06:00',sleep:'22:30',session_min:45,break_min:10,pref_time:'Evening',mock:true,travel_to:0,travel_from:0,...data.profile})
  const [custom,setCustom]=useState(![30,60,80,90].includes(p.days)),[msg,setMsg]=useState(''),[res,setRes]=useState(null),[busy,setBusy]=useState(false)
  const set=(k,v)=>setP(s=>({...s,[k]:v}))
  const I=(l,k,type='text',extra={})=><label>{l}<input type={type} value={p[k]??''} onChange={e=>set(k,type==='number'?+e.target.value:e.target.value)} {...extra}/></label>
  const save=async e=>{e&&e.preventDefault();if(!p.name.trim())return setMsg('Please enter your name.')
    if(!p.start_date||!(p.days>0))return setMsg('Please set a start date and a number of days.')
    try{await saveProfile(uid,{...p,school_start:p.school_start||null,school_end:p.school_end||null});await reload();setMsg('Saved.');return true}catch(x){setMsg('Could not save: '+x.message)}}
  const gen=async()=>{setBusy(true);setRes(null);if(await save()){const prof={...p};const r=await savePlan({...data,profile:prof},uid);setRes(r);if(!r.error){await reload();if(r.feasibility.ok)nav('/')}}setBusy(false)}
  const subs=data.subjects.map(s=>({v:s.id,l:s.name}))
  return <div className="stackv"><h2>Set up your study plan</h2>
    <form className="card" onSubmit={save}><h3>About you and your routine</h3>
      <div className="grid">{I('Name','name')}{I('Class','class')}{I('Board (e.g. CBSE)','board')}{I('Goal','goal')}{I('Preparation start date','start_date','date')}
        <label>Preparation duration<select value={custom?'custom':p.days} onChange={e=>{if(e.target.value==='custom')setCustom(true);else{setCustom(false);set('days',+e.target.value)}}}>{[30,60,80,90].map(d=><option key={d} value={d}>{d} days</option>)}<option value="custom">Custom</option></select></label>
        {custom&&I('Number of days','days','number',{min:1,max:365})}
        {I('School start time','school_start','time')}{I('School end time','school_end','time')}{I('Travel to school (minutes)','travel_to','number',{min:0})}{I('Travel from school (minutes)','travel_from','number',{min:0})}
        {I('Wake-up time','wake','time')}{I('Sleep time','sleep','time')}
        {I('Study session (minutes)','session_min','number',{min:20,max:120})}{I('Break (minutes)','break_min','number',{min:0,max:30})}
        <label>Preferred study time<select value={p.pref_time} onChange={e=>set('pref_time',e.target.value)}>{['Morning','Afternoon','Evening'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="chk"><input type="checkbox" checked={!!p.mock} onChange={e=>set('mock',e.target.checked)}/> Include mock tests</label></div>
      <button className="btn">Save</button> {msg&&<span className="msg">{msg}</span>}</form>
    <Crud table="subjects" title="Subjects" rows={data.subjects} reload={reload} defaults={{level:'Average'}} help="Mark each subject as Strong, Average or Weak."
      fields={[{k:'name',l:'Subject name',required:true},{k:'level',l:'Level',type:'select',options:['Strong','Average','Weak'],required:true},{k:'target',l:'Target score (optional)',type:'number'}]}
      show={r=>`${r.name} – ${r.level}${r.target?` (target ${r.target})`:''}`}/>
    <Crud table="lessons" title="Syllabus: lessons and chapters" rows={data.lessons} reload={reload} defaults={{done:false}}
      help="Completed lessons are used for revision and practice. For lessons not completed, tell us the Completing Time."
      fields={[{k:'subject_id',l:'Subject',type:'select',options:subs,required:true},{k:'name',l:'Lesson name',required:true},{k:'done',l:'Completed',type:'check'},
        {k:'hours',l:'Completing Time (hours)',type:'number',step:'0.5',min:0.5,showIf:r=>!r.done,required:true}]}
      check={r=>r.hours!=null&&r.hours<=0?'Completing Time must be more than 0.':''}
      show={r=>`${data.subjects.find(s=>s.id===r.subject_id)?.name||''}: ${r.done?'✓':'○'} ${r.name}${r.done?'':` – ${r.hours} hours`}`}/>
    <Crud table="slots" title="Free study time" rows={data.slots.filter(s=>s.kind==='free')} reload={reload} defaults={{kind:'free',day:8}}
      help="Add the real times you can study. We only plan inside these times."
      fields={[{k:'day',l:'Day',type:'select',options:DAYS,num:true,required:true},{k:'start',l:'From',type:'time',required:true},{k:'end',l:'To',type:'time',required:true}]}
      check={timeCheck} show={r=>`${dn(r.day)}: ${fmt12(r.start)} – ${fmt12(r.end)}`}/>
    <Crud table="slots" title="Fixed activities (tuition, sports, other)" rows={data.slots.filter(s=>s.kind==='busy')} reload={reload} defaults={{kind:'busy',day:8}}
      help="These times are blocked. School time above is blocked automatically."
      fields={[{k:'label',l:'Activity',required:true},{k:'day',l:'Day',type:'select',options:DAYS,num:true,required:true},{k:'start',l:'From',type:'time',required:true},{k:'end',l:'To',type:'time',required:true}]}
      check={timeCheck} show={r=>`${r.label} – ${dn(r.day)}: ${fmt12(r.start)} – ${fmt12(r.end)}`}/>
    <Crud table="exams" title="Exams" rows={data.exams} reload={reload}
      fields={[{k:'name',l:'Exam name',required:true},{k:'subject_id',l:'Subject',type:'select',options:subs,required:true},{k:'date',l:'Exam date',type:'date',min:todayStr(),required:true}]}
      check={r=>r.date<todayStr()?'Exam date must be today or later.':''}
      show={r=>`${r.name} – ${data.subjects.find(s=>s.id===r.subject_id)?.name||''} – ${r.date}`}/>
    <section className="card"><h3>Generate my plan</h3>
      <button className="btn big-btn" disabled={busy} onClick={gen}>{busy?'Building your plan…':data.tasks.length?'Rebuild my plan':'Generate my plan'}</button>
      {res?.error&&<p className="warn">{res.error}</p>}
      {res?.feasibility&&!res.feasibility.ok&&<Feasibility f={res.feasibility}/>}
      {res?.feasibility&&!res.feasibility.ok&&<button className="btn ghost" onClick={()=>nav('/')}>Go to dashboard anyway</button>}</section></div>
}
export const Feasibility=({f})=><div className="warn"><b>{f.message}</b><br/>You need about {f.needH} hours for unfinished lessons, but have about {f.availH} hours of study time. About {f.leftH} hours will stay unfinished.
  {f.priorities.length>0&&<><br/>Focus first on: {f.priorities.join(', ')}. Add more free study time or a longer duration to fit everything.</>}</div>
