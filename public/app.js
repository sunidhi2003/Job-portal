const $=s=>document.querySelector(s);
const app=$("#app");
let token=localStorage.getItem("token"), user=JSON.parse(localStorage.getItem("user")||"null");

async function api(url,opts={}){opts.headers=opts.headers||{};if(token)opts.headers.Authorization=`Bearer ${token}`;if(opts.body&&!(opts.body instanceof FormData)) {opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify(opts.body)}const r=await fetch(url,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d}
function nav(){return `<nav class="nav"><div class="brand">HireHub</div><div class="navlinks">${user?`<button class="btn ghost hide-sm" onclick="go('${user.role==="candidate"?"jobs":"recruiter"}')">${user.role==="candidate"?"Find Jobs":"Recruiter Dashboard"}</button><button class="btn secondary" onclick="go('${user.role==="candidate"?"candidate":"recruiter"}')">Dashboard</button><button class="btn danger" onclick="logout()">Logout</button>`:`<button class="btn ghost" onclick="go('login')">Login</button><button class="btn" onclick="go('register')">Get Started</button>`}</div></nav>`}
function layout(content){app.innerHTML=nav()+`<main class="container">${content}</main><div class="footer">HireHub • Prismberry Technical Assessment</div>`}
function go(p){location.hash=p;render()}
function logout(){localStorage.clear();token=null;user=null;go("login")}
function toast(msg,err=false){const x=document.createElement("div");x.className="notice "+(err?"error":"");x.textContent=msg;x.style.position="fixed";x.style.right="20px";x.style.bottom="20px";x.style.zIndex=20;document.body.appendChild(x);setTimeout(()=>x.remove(),2800)}
async function render(){const p=location.hash.slice(1)|| (user?(user.role==="candidate"?"jobs":"recruiter"):"home");try{
if(p==="home") home(); else if(p==="login") login(); else if(p==="register") register(); else if(p==="jobs") await jobs(); else if(p.startsWith("job-")) await jobDetails(p.split("-")[1]); else if(p==="candidate") await candidateDash(); else if(p==="recruiter") await recruiterDash(); else if(p==="post-job") postJob(); else home();
}catch(e){layout(`<div class="empty"><h2>Something went wrong</h2><p>${e.message}</p><button class="btn" onclick="go('home')">Go home</button></div>`)}}
function home(){layout(`<section class="hero gradient"><h1>Find work you’ll love.</h1><p>HireHub is a lightweight career platform connecting talented candidates with recruiters. Search roles, apply with your resume and track every application.</p><div class="row"><button class="btn" onclick="go('${user?"jobs":"register"}')">${user?"Browse Jobs":"Create Candidate Account"}</button>${!user?`<button class="btn secondary" onclick="go('login')">Sign in</button>`:""}</div></section><div class="stats"><div class="stat"><strong>2 Roles</strong><span class="muted">Candidate & Recruiter</span></div><div class="stat"><strong>REST API</strong><span class="muted">Express backend</span></div><div class="stat"><strong>SQLite</strong><span class="muted">Persistent database</span></div></div>`)}
function login(){layout(`<div class="form"><div class="authbox"><h2>Welcome back</h2><p class="muted">Sign in to continue to HireHub.</p><form onsubmit="doLogin(event)"><label>Email</label><input class="input" name="email" type="email" required><label>Password</label><input class="input" name="password" type="password" required><button class="btn">Login</button></form><p class="muted">New here? <a href="#register">Create account</a></p></div></div>`)}
function register(){layout(`<div class="form"><div class="authbox"><h2>Create your account</h2><form onsubmit="doRegister(event)"><label>Full name</label><input class="input" name="name" required><label>Email</label><input class="input" name="email" type="email" required><label>Password</label><input class="input" name="password" type="password" minlength="6" required><label>I am a</label><select class="select" name="role"><option value="candidate">Candidate</option><option value="recruiter">Recruiter</option></select><button class="btn">Create Account</button></form><p class="muted">Already registered? <a href="#login">Login</a></p></div></div>`)}
async function doLogin(e){e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/auth/login",{method:"POST",body:Object.fromEntries(f)});token=d.token;user=d.user;localStorage.token=token;localStorage.user=JSON.stringify(user);go(user.role==="candidate"?"jobs":"recruiter")}catch(x){toast(x.message,true)}}
async function doRegister(e){e.preventDefault();const f=new FormData(e.target);try{const d=await api("/api/auth/register",{method:"POST",body:Object.fromEntries(f)});token=d.token;user=d.user;localStorage.token=token;localStorage.user=JSON.stringify(user);go(user.role==="candidate"?"jobs":"recruiter")}catch(x){toast(x.message,true)}}
async function jobs(){if(!user)return go("login");layout(`<div class="row between"><div><h1>Explore Jobs</h1><p class="muted">Find your next opportunity.</p></div></div><form class="search" onsubmit="searchJobs(event)"><input class="input" name="q" placeholder="Search title, company, skill"><input class="input" name="location" placeholder="Location"><input class="input" name="skill" placeholder="Skill"><button class="btn">Search</button></form><div id="jobgrid" class="grid"></div>`);await loadJobs()}
async function loadJobs(params=""){const jobs=await api("/api/jobs"+params);$("#jobgrid").innerHTML=jobs.length?jobs.map(j=>`<article class="card"><div class="row between"><span class="tag">${j.location}</span><span class="muted">${new Date(j.created_at).toLocaleDateString()}</span></div><h3>${j.title}</h3><p><b>${j.company}</b> · ${j.recruiter_name}</p><div>${j.skills.split(",").map(s=>`<span class="tag">${s.trim()}</span>`).join("")}</div><p class="muted">${j.salary||"Competitive salary"}</p><button class="btn" onclick="go('job-${j.id}')">View & Apply</button></article>`).join(""):`<div class="empty" style="grid-column:1/-1">No jobs found. Try another search.</div>`}
async function searchJobs(e){e.preventDefault();const f=new FormData(e.target);const q=new URLSearchParams(Object.fromEntries(f));await loadJobs("?"+q)}
async function jobDetails(id){const j=await api("/api/jobs/"+id);const resumes=user?.role==="candidate"?await api("/api/resumes/me"):[];layout(`<div class="card"><button class="btn ghost" onclick="go('jobs')">← Back</button><div style="margin-top:20px"><span class="tag">${j.location}</span><h1>${j.title}</h1><h3>${j.company}</h3><p class="muted">${j.salary||"Competitive salary"} · Posted ${new Date(j.created_at).toLocaleDateString()}</p><h3>Skills</h3><div>${j.skills.split(",").map(s=>`<span class="tag">${s.trim()}</span>`).join("")}</div><h3>Description</h3><p style="white-space:pre-wrap">${j.description}</p>${user?.role==="candidate"?`<hr><h3>Apply with your resume</h3>${resumes.length?`<select id="applyResume" class="select">${resumes.map(r=>`<option value="${r.id}">${r.original_name}</option>`).join("")}</select><button class="btn" style="margin-top:12px" onclick="apply(${j.id})">Submit Application</button>`:`<div class="notice">Upload a resume from your dashboard before applying.</div>`}`:`<div class="notice">Login as a candidate to apply for this position.</div>`}</div></div>`)}
async function apply(jobId){try{await api("/api/applications",{method:"POST",body:{jobId,resumeId:Number($("#applyResume").value)}});toast("Application submitted successfully");go("candidate")}catch(e){toast(e.message,true)}}
async function candidateDash(){if(user?.role!=="candidate")return go("login");const [apps,resumes]=await Promise.all([api("/api/applications/me"),api("/api/resumes/me")]);layout(`<div class="row between"><div><h1>Candidate Dashboard</h1><p class="muted">Welcome, ${user.name}.</p></div><button class="btn" onclick="go('jobs')">Browse Jobs</button></div>
<div class="stats">
  <div class="stat">
    <strong>${apps.length}</strong>
    <span class="muted">Applications</span>
  </div>

  <div class="stat">
    <strong>${resumes.length}</strong>
    <span class="muted">Resumes</span>
  </div>

  <div class="stat">
    <strong>${apps.filter(a=>a.status==="shortlisted").length}</strong>
    <span class="muted">Shortlisted</span>
  </div>

  <div class="stat">
    <strong>${apps.filter(a=>a.status==="hired").length}</strong>
    <span class="muted">Hired</span>
  </div>
</div>
    <div class="grid two"><section class="card"><h2>My Resume</h2><form onsubmit="uploadResume(event)"><input class="input" type="file" name="resume" accept=".pdf,.doc,.docx" required><button class="btn">Upload Resume</button></form>${resumes.map(r=>`<div class="row between" style="margin-top:14px"><span>${r.original_name}</span><span class="row"><button class="btn secondary" onclick="downloadFile('/api/resumes/${r.id}/export/pdf')">PDF</button><button class="btn secondary" onclick="downloadFile('/api/resumes/${r.id}/export/docx')">DOCX</button></span></div>`).join("")}</section><section class="card"><h2>Application Tracker</h2>${apps.length?apps.map(a=>`<div style="padding:13px 0;border-bottom:1px solid var(--border)"><div class="row between"><b>${a.title}</b><span class="status ${a.status}">${a.status}</span></div><span class="muted">${a.company} · ${a.location}</span></div>`).join(""):`<div class="empty">No applications yet.</div>`}</section></div>`)}
async function uploadResume(e){e.preventDefault();const f=new FormData(e.target);try{await api("/api/resumes",{method:"POST",body:f});toast("Resume uploaded");candidateDash()}catch(x){toast(x.message,true)}}

async function downloadFile(url){

  try{

    const response = await fetch(url,{
      headers:{
        Authorization:`Bearer ${token}`
      }
    });

    if(!response.ok){
      throw new Error("Unable to open the resume");
    }

    const blob = await response.blob();

    const blobUrl = URL.createObjectURL(blob);

    const newWindow = window.open(blobUrl,"_blank");

    if(!newWindow){
      const a=document.createElement("a");
      a.href=blobUrl;
      a.download="resume";
      a.click();
    }

    setTimeout(()=>{
      URL.revokeObjectURL(blobUrl);
    },60000);

  }catch(e){

    toast(e.message,true);

  }
}
function postJob(){if(user?.role!=="recruiter")return go("login");layout(`<div class="form" style="max-width:700px"><div class="authbox"><h2>Post a New Job</h2><form onsubmit="createJob(event)"><label>Job title *</label><input class="input" name="title" placeholder="Frontend Developer" required><label>Company *</label><input class="input" name="company" placeholder="Acme Technologies" required><label>Location *</label><input class="input" name="location" placeholder="Bengaluru / Remote" required><label>Skills * <span class="muted">(comma separated)</span></label><input class="input" name="skills" placeholder="React, JavaScript, SQL" required><label>Salary</label><input class="input" name="salary" placeholder="₹6–10 LPA"><label>Job description *</label><textarea class="textarea" name="description" placeholder="Responsibilities, requirements..." required></textarea><button class="btn">Publish Job</button></form></div></div>`)}
async function createJob(e){e.preventDefault();try{const f=new FormData(e.target);await api("/api/jobs",{method:"POST",body:Object.fromEntries(f)});toast("Job published");go("recruiter")}catch(x){toast(x.message,true)}}

async function recruiterDash(){
  if(user?.role!=="recruiter") return go("login");

  const [jobs,apps]=await Promise.all([
    api("/api/recruiter/jobs"),
    api("/api/recruiter/applications")
  ]);

  layout(`
    <div class="row between">
      <div>
        <h1>Recruiter Dashboard</h1>
        <p class="muted">Manage your openings and candidates.</p>
      </div>

      <button class="btn" onclick="go('post-job')">
        + Post Job
      </button>
    </div>

    <div class="stats">
      <div class="stat">
        <strong>${jobs.length}</strong>
        <span class="muted">Job postings</span>
      </div>

      <div class="stat">
        <strong>${apps.length}</strong>
        <span class="muted">Applicants</span>
      </div>

      <div class="stat">
        <strong>${apps.filter(a=>a.status==="shortlisted").length}</strong>
        <span class="muted">Shortlisted</span>
      </div>
    </div>

    <section class="card">
      <h2>Job Postings</h2>

      ${
        jobs.length
        ?
        jobs.map(j=>`
          <div
            style="padding:15px 0;border-bottom:1px solid var(--border)"
            class="row between"
          >
            <div>
              <b>${j.title}</b>

              <div class="muted">
                ${j.company} · ${j.location}
              </div>
            </div>

            <span class="tag">
              ${apps.filter(a=>a.job_id===j.id).length} applicants
            </span>
          </div>
        `).join("")
        :
        `<div class="empty">No job postings yet.</div>`
      }
    </section>

    <section class="card" style="margin-top:18px">

      <h2>Applicants</h2>

      ${
        apps.length
        ?
        apps.map(a=>`

          <div
            style="padding:18px 0;border-bottom:1px solid var(--border)"
          >

            <div class="row between">

              <div>
                <b>${a.candidate_name}</b>

                <span class="muted">
                  (${a.candidate_email})
                </span>

                <div>
                  ${a.title} · ${a.original_name || "No resume"}
                </div>
              </div>

              <span class="status ${a.status}">
                ${a.status}
              </span>

            </div>

            <div class="row" style="margin-top:12px">

              <button
                class="btn"
                onclick="updateStatus(${a.id}, 'shortlisted')"
              >
                ✓ Shortlist
              </button>

              <button
                class="btn danger"
                onclick="updateStatus(${a.id}, 'rejected')"
              >
                ✕ Reject
              </button>

              <button
                class="btn secondary"
                onclick="updateStatus(${a.id}, 'hired')"
              >
                ✓ Hire
              </button>

              ${
                a.resume_id
                ?
                `
                <button
                  class="btn ghost"
                  onclick="downloadFile('/api/resumes/${a.resume_id}/download')"
                >
                  View Resume
                </button>
                `
                :
                ""
              }

            </div>

          </div>

        `).join("")
        :
        `<div class="empty">No applicants yet.</div>`
      }

    </section>
  `);
}
async function updateStatus(id,status){
  try{

    await api("/api/applications/"+id+"/status",{
      method:"PATCH",
      body:{status:status}
    });

    toast(
      status==="shortlisted"
      ? "Candidate shortlisted successfully"
      : status==="rejected"
      ? "Application rejected"
      : "Candidate marked as hired"
    );

    await recruiterDash();

  }catch(e){
    toast(e.message,true);
  }
}
window.addEventListener("hashchange",render);render();
