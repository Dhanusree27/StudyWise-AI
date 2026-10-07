import {useState} from 'react'
import {supabase} from './lib/supabase'
export default function Auth(){
  const [mode,setMode]=useState('signup'),[email,setEmail]=useState(''),[pw,setPw]=useState(''),[m,setM]=useState(''),[busy,setBusy]=useState(false)
  const go=async e=>{e.preventDefault();setM('');if(!email.includes('@'))return setM('Enter a valid email.')
    if(mode!=='forgot'&&pw.length<6)return setM('Password needs at least 6 characters.')
    setBusy(true)
    try{
      if(mode==='forgot'){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin});if(error)throw error;setM('Check your email for the reset link.')}
      else if(mode==='signup'){const {data,error}=await supabase.auth.signUp({email,password:pw});if(error)throw error;if(!data.session)setM('Account created. Check your email to confirm, then log in.')}
      else{const {error}=await supabase.auth.signInWithPassword({email,password:pw});if(error)throw new Error('Wrong email or password.')}
    }catch(x){setM(x.message)}setBusy(false)}
  const feats=['Plan your preparation','Organize your syllabus','Study in your real free time','Prioritize upcoming exams','Focus on weak subjects','Revise completed topics','Recover when you miss a session','Track your progress']
  return <div className="landing">
    <section className="hero"><div>
      <b className="logo">StudyWise <span>AI</span></b>
      <h1>Study Smarter.<br/>Plan Better.</h1><p className="lead">Your Personal AI Study Planner. Tell us your syllabus, exams and free time. We build a plan that fits your day.</p>
      <ul className="feats">{feats.map(f=><li key={f}>{f}</li>)}</ul></div>
      <div className="stack">
        <form className="card auth" onSubmit={go}>
          <h2>{mode==='signup'?'Create your account':mode==='login'?'Welcome back':'Reset password'}</h2>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/>
          {mode!=='forgot'&&<input type="password" placeholder="Password" value={pw} onChange={e=>setPw(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'}/>}
          <button className="btn" disabled={busy}>{mode==='signup'?'Sign up':mode==='login'?'Log in':'Send reset link'}</button>
          {m&&<p className="msg">{m}</p>}
          <p className="links">{mode!=='login'&&<a onClick={()=>setMode('login')}>I have an account</a>}{mode!=='signup'&&<a onClick={()=>setMode('signup')}>Create account</a>}{mode==='login'&&<a onClick={()=>setMode('forgot')}>Forgot password?</a>}</p></form>
        <div className="card preview"><small>Preview of your dashboard</small>
          <div className="row"><div className="big">42%</div><div>Day 17 / 80<br/><small>Next exam: Physics in 18 days</small></div></div>
          <ul><li>Mathematics – Trigonometry</li><li>Physics – Current Electricity</li><li>Chemistry – Chemical Bonding</li></ul></div>
      </div></section></div>
}
