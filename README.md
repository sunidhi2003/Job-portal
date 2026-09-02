# HireHub — Job Portal

A full-stack career platform built for the Prismberry Technologies Round 2 practical assessment.

## Requirements covered

- Candidate and recruiter sign-up/login
- JWT authentication + role-based authorization
- Candidate resume upload (PDF/DOC/DOCX)
- Candidate job browsing and application
- Candidate dashboard with application tracking
- Recruiter dashboard with job postings and applicants
- Recruiter approve/reject/shortlist/hire workflow
- REST APIs for auth, resumes, jobs and applications
- SQLite database persistence
- Search/filter jobs by title/company/skill/location
- Resume PDF and DOCX export
- Responsive UI

## Run locally

```bash
npm install
npm start
```

Open http://localhost:5000

The SQLite database (`hirehub.db`) is created automatically on first run.

## Demo flow

1. Register as **candidate**
2. Upload a resume from Candidate Dashboard
3. Browse jobs and apply
4. Log out
5. Register/login as **recruiter**
6. Post a job
7. Review applicants and update status
8. Log back in as candidate and show the updated status

## REST API

### Auth
- POST `/api/auth/register`
- POST `/api/auth/login`

### Jobs
- GET `/api/jobs`
- GET `/api/jobs/:id`
- POST `/api/jobs` (recruiter)
- GET `/api/recruiter/jobs` (recruiter)

### Resumes
- POST `/api/resumes` (candidate)
- GET `/api/resumes/me` (candidate)
- GET `/api/resumes/:id/download`
- GET `/api/resumes/:id/export/pdf` (candidate)
- GET `/api/resumes/:id/export/docx` (candidate)

### Applications
- POST `/api/applications` (candidate)
- GET `/api/applications/me` (candidate)
- GET `/api/recruiter/applications` (recruiter)
- PATCH `/api/applications/:id/status` (recruiter)

## Database

Four main tables are used:

- `users`
- `resumes`
- `jobs`
- `applications`

Foreign keys connect candidates/recruiters, resumes, jobs and applications.

## GitHub submission

Create a public repository and make regular commits during the assessment:

```bash
git init
git add .
git commit -m "chore: initialize HireHub"
git add .
git commit -m "feat: add authentication and roles"
git add .
git commit -m "feat: add jobs and applications"
git add .
git commit -m "feat: add recruiter dashboard and resume exports"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Do not commit real passwords, secret keys, or private resumes. The included JWT secret is only a development fallback; use `JWT_SECRET` as an environment variable for production.

## Features

- Candidate and recruiter authentication
- Role-based access control
- Resume upload and download
- Job posting and job browsing
- Job application management
- Recruiter application approval/rejection
- Candidate application tracking
- PDF and DOCX resume export
- Job search and filtering
- Application status pipeline

## Tech Stack

- Node.js
- Express.js
- JWT Authentication
- bcrypt
- HTML, CSS, JavaScript