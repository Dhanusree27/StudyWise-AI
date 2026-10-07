import {useEffect,useState,useCallback} from 'react'
import {BrowserRouter,Routes,Route,NavLink,Navigate} from 'react-router-dom'
import {supabase} from './lib/supabase'
import {loadAll} from './lib/db'
import Auth from './Auth'
import Setup from './Setup'
import {Dashboard,Plan,Today,Progress} from './Views'

function NewPassword(){
  const [pw,setPw]=useState(''),[m,setM]=useState('')
  const go=async e=>{e.preventDefault();if(pw.length<6)return setM('Use at least 6 characters.')
    const {error}=await supabase.auth.updateUser({password:pw});setM(error?error.message:'Password changed. Reload the page.')}
  return <div className="center"><form className="card auth" onSubmit={go}><h2>Set a new password</h2><input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password"/><button className="btn">Save password</button><p className="msg">{m}</p></form></div>
}
export default function App(){
  const [session,setSession]=useState(undefined),[data,setData]=useState(null),[err,setErr]=useState(''),[recovery,setRecovery]=useState(false)
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data:l}=supabase.auth.onAuthStateChange((ev,s)=>{if(ev==='PASSWORD_RECOVERY')setRecovery(true);setSession(s)})
    return ()=>l.subscription.unsubscribe()},[])
  const reload=useCallback(async()=>{try{setData(await loadAll());setErr('')}catch(e){console.error('[StudyWise] loadAll error:',e);setErr(e.message||'We could not load your data. Check your connection and refresh.')}},[])
  useEffect(()=>{if(session)reload();else setData(null)},[session,reload])
  if(session===undefined)return <div className="center">Loading…</div>
  if(recovery)return <NewPassword/>
  if(!session)return <Auth/>
  if(!data)return <div className="center">{err||'Loading your plan…'}</div>
  const ctx={data,reload,uid:session.user.id,token:session.access_token}
  const setup=!data.profile||!data.tasks.length
  return <BrowserRouter>
    <header className="nav"><b className="logo">StudyWise <span>AI</span></b>
      <nav>{[['/','Dashboard'],['/today','Today'],['/plan','My Plan'],['/progress','Progress'],['/setup','Setup']].map(([to,l])=><NavLink key={to} to={to} end={to==='/'}>{l}</NavLink>)}</nav>
      <button className="btn ghost" onClick={()=>supabase.auth.signOut()}>Log out</button></header>
    <main>{err&&<p className="warn">{err}</p>}
      <Routes>
        <Route path="/setup" element={<Setup ctx={ctx}/>}/>
        <Route path="/" element={setup?<Navigate to="/setup"/>:<Dashboard ctx={ctx}/>}/>
        <Route path="/today" element={setup?<Navigate to="/setup"/>:<Today ctx={ctx}/>}/>
        <Route path="/plan" element={setup?<Navigate to="/setup"/>:<Plan ctx={ctx}/>}/>
        <Route path="/progress" element={setup?<Navigate to="/setup"/>:<Progress ctx={ctx}/>}/>
        <Route path="*" element={<Navigate to="/"/>}/></Routes></main></BrowserRouter>
}
