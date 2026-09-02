const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const PDFDocument = require("pdfkit");
const { Document, Packer, Paragraph, HeadingLevel } = require("docx");

const app = express();
const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || "hirehub-prismberry-secret";
const db = new Database("hirehub.db");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('candidate','recruiter')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  skills TEXT NOT NULL,
  salary TEXT,
  description TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(recruiter_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  resume_id INTEGER,
  status TEXT DEFAULT 'applied' CHECK(status IN ('applied','shortlisted','hired','rejected')),
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(candidate_id, job_id),
  FOREIGN KEY(candidate_id) REFERENCES users(id),
  FOREIGN KEY(job_id) REFERENCES jobs(id),
  FOREIGN KEY(resume_id) REFERENCES resumes(id)
);
`);

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function role(required) {
  return (req, res, next) => {
    if (req.user.role !== required) return res.status(403).json({ error: "Access denied for this role" });
    next();
  };
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role: userRole } = req.body;
    if (!name || !email || !password || !["candidate","recruiter"].includes(userRole))
      return res.status(400).json({ error: "Name, email, password and valid role are required" });
    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)")
      .run(name.trim(), email.toLowerCase().trim(), hash, userRole);
    const user = { id: info.lastInsertRowid, name, email, role: userRole };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user });
  } catch (e) {
    res.status(400).json({ error: e.code === "SQLITE_CONSTRAINT_UNIQUE" ? "Email already registered" : e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email=?").get((email || "").toLowerCase().trim());
  if (!user || !(await bcrypt.compare(password || "", user.password)))
    return res.status(401).json({ error: "Invalid email or password" });
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: jwt.sign(safeUser, JWT_SECRET, { expiresIn: "8h" }), user: safeUser });
});

app.get("/api/jobs", auth, (req, res) => {
  const { q = "", location = "", skill = "" } = req.query;
  const like = `%${q}%`, loc = `%${location}%`, sk = `%${skill}%`;
  const jobs = db.prepare(`
    SELECT j.*, u.name AS recruiter_name
    FROM jobs j JOIN users u ON u.id=j.recruiter_id
    WHERE (j.title LIKE ? OR j.company LIKE ? OR j.skills LIKE ?)
      AND j.location LIKE ? AND j.skills LIKE ?
    ORDER BY j.id DESC
  `).all(like, like, like, loc, sk);
  res.json(jobs);
});

app.get("/api/jobs/:id", auth, (req, res) => {
  const job = db.prepare(`
    SELECT j.*, u.name AS recruiter_name
    FROM jobs j JOIN users u ON u.id=j.recruiter_id WHERE j.id=?
  `).get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.post("/api/jobs", auth, role("recruiter"), (req, res) => {
  const { title, company, location, skills, salary, description } = req.body;
  if (!title || !company || !location || !skills || !description)
    return res.status(400).json({ error: "Please fill all required job fields" });
  const info = db.prepare(`
    INSERT INTO jobs(recruiter_id,title,company,location,skills,salary,description)
    VALUES(?,?,?,?,?,?,?)
  `).run(req.user.id, title, company, location, skills, salary || "", description);
  res.json(db.prepare("SELECT * FROM jobs WHERE id=?").get(info.lastInsertRowid));
});

app.get("/api/recruiter/jobs", auth, role("recruiter"), (req, res) => {
  res.json(db.prepare("SELECT * FROM jobs WHERE recruiter_id=? ORDER BY id DESC").all(req.user.id));
});

app.post("/api/resumes", auth, role("candidate"), upload.single("resume"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Upload a PDF, DOC or DOCX resume (max 5MB)" });
  const info = db.prepare(`
    INSERT INTO resumes(user_id,original_name,file_name,file_path) VALUES(?,?,?,?)
  `).run(req.user.id, req.file.originalname, req.file.filename, req.file.path);
  res.json(db.prepare("SELECT * FROM resumes WHERE id=?").get(info.lastInsertRowid));
});

app.get("/api/resumes/me", auth, role("candidate"), (req, res) => {
  res.json(db.prepare("SELECT * FROM resumes WHERE user_id=? ORDER BY id DESC").all(req.user.id));
});

app.get("/api/resumes/:id/download", auth, (req, res) => {

  const r = db.prepare(
    "SELECT * FROM resumes WHERE id=?"
  ).get(req.params.id);

  if (!r) {
    return res.status(404).json({
      error: "Resume not found"
    });
  }

  // Candidate can access their own resume
  if (
    req.user.role === "candidate" &&
    r.user_id !== req.user.id
  ) {
    return res.status(403).json({
      error: "Access denied"
    });
  }

  // Recruiter can access a resume only when
  // the candidate applied to the recruiter's job
  if (req.user.role === "recruiter") {

    const application = db.prepare(`
      SELECT a.id
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.resume_id = ?
      AND j.recruiter_id = ?
    `).get(req.params.id, req.user.id);

    if (!application) {
      return res.status(403).json({
        error: "Access denied"
      });
    }
  }

  const filePath = path.resolve(r.file_path);

  // Check whether the physical file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: "Resume file is missing from uploads folder"
    });
  }

  // Send the actual resume file
  res.download(
    filePath,
    r.original_name,
    (err) => {
      if (err) {
        console.error("Resume download error:", err);

        if (!res.headersSent) {
          res.status(500).json({
            error: "Unable to download resume"
          });
        }
      }
    }
  );
});

app.get("/api/resumes/:id/export/pdf", auth, role("candidate"), async (req, res) => {
  const r = db.prepare("SELECT r.*,u.name,u.email FROM resumes r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.user_id=?")
    .get(req.params.id, req.user.id);
  if (!r) return res.status(404).json({ error: "Resume not found" });
  const doc = new PDFDocument({ margin: 55 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${r.name}-resume.pdf"`);
  doc.pipe(res);
  doc.fontSize(24).text(r.name).moveDown(0.3);
  doc.fontSize(11).text(r.email).moveDown();
  doc.fontSize(16).text("Resume", { underline: true }).moveDown(0.5);
  doc.fontSize(12).text(`Original uploaded file: ${r.original_name}`);
  doc.text(`Uploaded: ${r.uploaded_at}`);
  doc.text("This export is a clean application copy of the uploaded resume record.");
  doc.end();
});

app.get("/api/resumes/:id/export/docx", auth, role("candidate"), async (req, res) => {
  const r = db.prepare("SELECT r.*,u.name,u.email FROM resumes r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.user_id=?")
    .get(req.params.id, req.user.id);
  if (!r) return res.status(404).json({ error: "Resume not found" });
  const doc = new Document({ sections: [{ children: [
    new Paragraph({ text: r.name, heading: HeadingLevel.TITLE }),
    new Paragraph(r.email),
    new Paragraph({ text: "Resume", heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Original uploaded file: ${r.original_name}`),
    new Paragraph(`Uploaded: ${r.uploaded_at}`)
  ]}]});
  const buffer = await Packer.toBuffer(doc);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${r.name}-resume.docx"`);
  res.send(buffer);
});

app.post("/api/applications", auth, role("candidate"), (req, res) => {
  const { jobId, resumeId } = req.body;
  const resume = db.prepare("SELECT id FROM resumes WHERE id=? AND user_id=?").get(resumeId, req.user.id);
  if (!resume) return res.status(400).json({ error: "Please select one of your resumes" });
  try {
    const info = db.prepare("INSERT INTO applications(candidate_id,job_id,resume_id) VALUES(?,?,?)")
      .run(req.user.id, jobId, resumeId);
    res.json(db.prepare(`
      SELECT a.*,j.title,j.company,j.location FROM applications a
      JOIN jobs j ON j.id=a.job_id WHERE a.id=?
    `).get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: e.code === "SQLITE_CONSTRAINT_UNIQUE" ? "You already applied to this job" : e.message });
  }
});

app.get("/api/applications/me", auth, role("candidate"), (req, res) => {
  res.json(db.prepare(`
    SELECT a.*,j.title,j.company,j.location,j.skills
    FROM applications a JOIN jobs j ON j.id=a.job_id
    WHERE a.candidate_id=? ORDER BY a.id DESC
  `).all(req.user.id));
});

app.get("/api/recruiter/applications", auth, role("recruiter"), (req, res) => {
  res.json(db.prepare(`
    SELECT a.*, j.title,j.company,
           u.name AS candidate_name,u.email AS candidate_email,
           r.id AS resume_id,r.original_name
    FROM applications a
    JOIN jobs j ON j.id=a.job_id
    JOIN users u ON u.id=a.candidate_id
    LEFT JOIN resumes r ON r.id=a.resume_id
    WHERE j.recruiter_id=? ORDER BY a.id DESC
  `).all(req.user.id));
});

app.patch("/api/applications/:id/status", auth, role("recruiter"), (req, res) => {
  const { status } = req.body;
  if (!["shortlisted","hired","rejected","applied"].includes(status))
    return res.status(400).json({ error: "Invalid status" });
  const owns = db.prepare(`
    SELECT a.id FROM applications a JOIN jobs j ON j.id=a.job_id
    WHERE a.id=? AND j.recruiter_id=?
  `).get(req.params.id, req.user.id);
  if (!owns) return res.status(404).json({ error: "Application not found" });
  db.prepare("UPDATE applications SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status, req.params.id);
  res.json({ success: true });
});

app.get("/api/health", (_, res) => res.json({ status: "ok", app: "HireHub" }));

app.listen(PORT, () => console.log(`HireHub running at http://localhost:${PORT}`));
