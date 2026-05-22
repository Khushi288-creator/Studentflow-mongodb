# StudentFlow — School Management System

A full-stack school management platform built for students, teachers, and admins.
Manage attendance, assignments, fees, results, timetables, and more — all in one place.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Features by Role](#features-by-role)
4. [Project Structure](#project-structure)
5. [Database Models](#database-models)
6. [API Routes](#api-routes)
7. [AI Assistant](#ai-assistant)
8. [Getting Started](#getting-started)
9. [Environment Variables](#environment-variables)
10. [Screenshots / Pages](#screenshots--pages)

---

## Project Overview

**StudentFlow** is a modern school management system with three user roles:

| Role    | Description                                      |
|---------|--------------------------------------------------|
| Student | View courses, submit assignments, track fees & attendance |
| Teacher | Manage courses, mark attendance via QR, grade submissions |
| Admin   | Full control — students, teachers, fees, salary, timetable |

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 + TypeScript | UI framework |
| Vite | Build tool & dev server |
| Tailwind CSS v4 | Styling |
| React Router v7 | Client-side routing |
| TanStack Query v5 | Server state & data fetching |
| Zustand | Global auth state |
| React Hook Form + Zod | Form handling & validation |
| Recharts | Charts & analytics |
| Axios | HTTP client |
| QRCode.react | QR code generation |
| Day.js | Date formatting |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express 5 | REST API server |
| TypeScript | Type safety |
| Prisma ORM | Database access layer |
| SQLite (better-sqlite3) | Local database |
| JWT (jsonwebtoken) | Authentication tokens |
| Bcrypt | Password hashing |
| Multer | File uploads |
| Zod | Request validation |
| Helmet | HTTP security headers |
| Morgan | Request logging |
| PDFKit | PDF report generation |
| OpenAI SDK | AI assistant (GPT-4o-mini) |

---

## Features by Role

### Student
- Dashboard with stats (attendance %, pending assignments, fee status)
- View enrolled courses
- Submit assignments (file upload)
- Track attendance records
- View results and grades
- Pay fees via QR code
- Register for school events
- View holidays and timetable
- Ask doubts to teachers
- AI-powered chat assistant
- Achievements & resume builder
- Notifications & announcements

### Teacher
- Dashboard with class overview
- Create and manage courses
- Post assignments with materials
- Mark attendance via QR code (time-limited tokens)
- Grade student submissions
- View student results
- Reply to student doubts
- View salary slips
- Manage profile with photo

### Admin
- Full dashboard with system-wide stats
- Manage all students (add, view, delete)
- Manage all teachers
- Manage subjects/courses
- Set fee structures and track payments
- Manage teacher salaries (HRA, bonus, deductions)
- Create and manage timetables (regular & exam)
- Post notices and announcements
- Manage school events
- Add holidays
- View contact messages and reply
- Generate PDF reports (results, resume)
- AI assistant with admin context

---

## Project Structure

```
studentflow/
├── backend/
│   ├── src/
│   │   ├── app.ts              # Express app setup, middleware, routes
│   │   ├── index.ts            # Server entry point
│   │   ├── seed.ts             # Database seeder
│   │   ├── config/
│   │   │   └── db.ts
│   │   ├── lib/
│   │   │   └── prisma.ts       # Prisma client instance
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT auth middleware
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── courseRoutes.ts
│   │   │   ├── assignmentRoutes.ts
│   │   │   ├── attendanceRoutes.ts
│   │   │   ├── dashboardRoutes.ts
│   │   │   ├── resultsRoutes.ts
│   │   │   ├── feeRoutes.ts
│   │   │   ├── eventRoutes.ts
│   │   │   ├── profileRoutes.ts
│   │   │   ├── notificationRoutes.ts
│   │   │   ├── contactRoutes.ts
│   │   │   ├── adminRoutes.ts
│   │   │   ├── reportRoutes.ts  # AI assistant + PDF reports
│   │   │   ├── timetableRoutes.ts
│   │   │   ├── holidayRoutes.ts
│   │   │   ├── achievementRoutes.ts
│   │   │   └── salaryRoutes.ts
│   │   ├── types/
│   │   └── utils/
│   │       ├── asyncHandler.ts
│   │       └── upload.ts       # Multer config
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── uploads/                # Uploaded files (materials, photos, submissions)
│   ├── .env                    # Environment variables
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.tsx             # Routes definition
    │   ├── api/
    │   │   └── http.ts         # Axios instance
    │   ├── components/
    │   │   ├── layout/         # AppLayout, DashboardLayout, Sidebar, Topbar
    │   │   ├── routing/        # RequireAuth, RequireRole guards
    │   │   ├── smart/
    │   │   │   └── ChatWidget.tsx  # AI chat floating widget
    │   │   └── ui/             # Card, Page, cn utility
    │   ├── pages/
    │   │   ├── Home.tsx
    │   │   ├── Login.tsx
    │   │   ├── Signup.tsx
    │   │   ├── admin/          # AdminDashboard, Students, Teachers, Fees, Salary, Timetable
    │   │   ├── teacher/        # TeacherDashboard, Profile, Salary
    │   │   ├── student/        # StudentDashboard
    │   │   └── shared/         # Courses, Assignments, Attendance, Result, Fee, Events, etc.
    │   ├── store/
    │   │   ├── authStore.ts    # Zustand auth store
    │   │   └── attendanceStore.ts
    │   └── lib/
    │       └── defaultSubjects.ts
    └── package.json
```

---

## Database Models

| Model | Description |
|---|---|
| User | Core user — student, teacher, or admin |
| Teacher | Teacher profile with subject and personal details |
| StudentProfile | Extended student info (father name, DOB, class, etc.) |
| StudentEnrollment | Links a student to a course |
| Course | Subject/course created by a teacher |
| Assignment | Assignment posted for a course |
| AssignmentMaterial | Files attached to an assignment |
| Submission | Student file submission for an assignment |
| Attendance | Daily attendance record per student per course |
| AttendanceQrToken | Time-limited QR token for marking attendance |
| Result | Marks and grade per student per course |
| Fee | Fee record per student (tuition, exam, transport) |
| FeeStructure | Admin-defined fee template per class |
| Event | School events with registration |
| EventRegistration | Student/teacher event sign-up |
| Notice | School announcements and notices |
| NoticeRead | Tracks which users have read a notice |
| Doubt | Student question with teacher reply |
| Resume | Student resume (headline, summary, skills) |
| StudyTask | Personal study to-do list |
| Timetable | Regular and exam schedule |
| Holiday | School holiday calendar |
| Achievement | Student awards and achievements |
| Salary | Teacher monthly salary with HRA, bonus, deductions |
| ContactMessage | Contact form messages with admin reply |
| PasswordResetToken | Secure password reset flow |

---

## API Routes

All routes are prefixed with `/api`.

| Method | Route | Description |
|---|---|---|
| POST | `/register` | Register new user |
| POST | `/login` | Login and get JWT |
| GET | `/me` | Get current user |
| GET | `/dashboard` | Role-based dashboard stats |
| GET/POST | `/courses` | List / create courses |
| GET/POST | `/assignments` | List / create assignments |
| POST | `/assignments/:id/submit` | Submit assignment file |
| GET/POST | `/attendance` | View / mark attendance |
| POST | `/attendance/qr/generate` | Generate QR token (teacher) |
| POST | `/attendance/qr/scan` | Scan QR to mark present (student) |
| GET/POST | `/results` | View / add results |
| GET/POST | `/fees` | View / manage fees |
| GET/POST | `/events` | View / create events |
| POST | `/events/:id/register` | Register for event |
| GET/POST | `/notifications` | View / post notices |
| GET/POST | `/contact` | Send / view contact messages |
| GET/PUT | `/profile` | View / update profile |
| GET/POST | `/achievements` | View / add achievements |
| GET/POST | `/timetable` | View / manage timetable |
| GET/POST | `/holidays` | View / add holidays |
| GET/POST | `/salary` | View / manage teacher salary |
| GET | `/admin/students` | List all students |
| GET | `/admin/teachers` | List all teachers |
| GET | `/reports/results.pdf` | Download results PDF |
| GET | `/reports/resume.pdf` | Download resume PDF |
| POST | `/assistant/chat` | AI chat assistant |
| GET | `/assistant/recommendations` | Personalized study tips |

---

## AI Assistant

StudentFlow includes a floating AI chat widget powered by **OpenAI GPT-4o-mini**.

**How it works:**
- Each role (student / teacher / admin) gets a custom system prompt
- If OpenAI API key is missing or quota is exceeded, smart keyword-based fallback replies are shown automatically
- No error messages are ever shown to the user — the experience stays clean

**Fallback keyword detection:**

| Keyword | Response |
|---|---|
| hello / hi | Hello! How can I help you today? |
| math | Math is the study of numbers, shapes, and patterns... |
| science | Science helps us understand the world around us... |
| attendance | You can check your attendance in the dashboard... |
| fees | You can check your fees status in the Fees section... |
| assignment | You can view your assignments in the Assignments section... |
| result / marks | Check the Results page for your subject-wise marks... |
| timetable | Your class timetable is available in the Timetable section... |
| notice / announcement | Check the Notifications section for latest notices... |
| event | View and register for upcoming events in the Events section... |
| default | I'm here to help! Please ask your question in detail. |

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm v9+

### 1. Clone the repository
```bash
git clone <repo-url>
cd studentflow
```

### 2. Setup Backend
```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in values (see below).

Run database migrations:
```bash
npx prisma migrate dev
```

Seed the database with sample data:
```bash
npm run seed
```

Start the backend server:
```bash
npm run dev
```

Backend runs on: `http://localhost:4000`

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

---

## Environment Variables

Create `backend/.env` with the following:

```env
# Server
PORT=4000
NODE_ENV=development

# JWT
JWT_ACCESS_SECRET=your_jwt_secret_here

# OpenAI (optional — smart fallbacks work without it)
OPENAI_API_KEY=your_openai_api_key_here
```

> If `OPENAI_API_KEY` is not set or is invalid, the AI assistant automatically uses smart keyword-based fallback responses. No setup required for basic usage.

---

## Screenshots / Pages

| Page | Route | Access |
|---|---|---|
| Home / Landing | `/` | Public |
| Login | `/login` | Public |
| Signup | `/signup` | Public |
| Dashboard | `/dashboard` | All roles |
| Courses | `/courses` | All roles |
| Assignments | `/assignments` | All roles |
| Attendance | `/attendance` | All roles |
| Results | `/results` | All roles |
| Fees | `/fees` | Student / Admin |
| Events | `/events` | All roles |
| Holidays | `/holidays` | All roles |
| Notifications | `/notifications` | All roles |
| Profile | `/profile` | All roles |
| Contact | `/contact` | All roles |
| Achievements | `/achievements` | Student |
| Salary | `/salary` | Teacher |
| Admin — Students | `/admin/students` | Admin |
| Admin — Teachers | `/admin/teachers` | Admin |
| Admin — Subjects | `/admin/subjects` | Admin |
| Admin — Salary | `/admin/salary` | Admin |
| Admin — Timetable | `/admin/timetable` | Admin |

---

## Author

Built with React, Node.js, Prisma, and TailwindCSS.
=======
# studentflow
>>>>>>> ae4f156b06a42dbb7252112bdf45f7d26c7bfeb6
## Recent Updates
