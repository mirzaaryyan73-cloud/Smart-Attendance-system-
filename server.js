const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const QRCode = require("qrcode");
const crypto = require("crypto");
const path = require("path");

const app = express();
const db = new Database("attendance.db");
const PORT = process.env.PORT || 3000;

// Change these before using the system in a real institution.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ADMIN";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "TEACHER";
const TZ = "Asia/Karachi";

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  program TEXT DEFAULT 'BSCS',
  semester TEXT DEFAULT 'Semester II',
  qr_token TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  attendance_date TEXT NOT NULL,
  lecture INTEGER NOT NULL CHECK(lecture BETWEEN 1 AND 4),
  status TEXT NOT NULL CHECK(status IN ('Present','Absent')),
  marked_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, attendance_date, lecture),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
`);

function datePartsInPakistan() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23"
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  let y = Number(p.year), m = Number(p.month), d = Number(p.day);
  // The attendance day changes at 08:00 Pakistan time.
  if (Number(p.hour) < 8) {
    const previous = new Date(Date.UTC(y, m - 1, d) - 86400000);
    y = previous.getUTCFullYear(); m = previous.getUTCMonth() + 1; d = previous.getUTCDate();
  }
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.role || !roles.includes(req.session.role)) {
      return res.status(401).json({ error: "Please login with the required account." });
    }
    next();
  };
}

app.post("/api/login", (req, res) => {
  const { role, password } = req.body || {};
  if (role === "admin" && password === ADMIN_PASSWORD) {
    req.session.role = "admin";
    return res.json({ ok: true, role: "admin" });
  }
  if (role === "teacher" && password === TEACHER_PASSWORD) {
    req.session.role = "teacher";
    return res.json({ ok: true, role: "teacher" });
  }
  res.status(401).json({ error: "Incorrect role or password." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/session", (req, res) => {
  res.json({ role: req.session.role || "student" });
});

app.get("/api/students", requireRole("admin", "teacher"), (req, res) => {
  const rows = db.prepare("SELECT id, roll_no, name, program, semester, qr_token FROM students ORDER BY roll_no").all();
  res.json(rows);
});

app.post("/api/students", requireRole("admin"), async (req, res) => {
  try {
    const { rollNo, name, program = "BSCS", semester = "Semester II" } = req.body || {};
    if (!rollNo || !name) return res.status(400).json({ error: "Roll number and name are required." });
    const token = crypto.randomBytes(18).toString("hex");
    const result = db.prepare(
      "INSERT INTO students (roll_no,name,program,semester,qr_token) VALUES (?,?,?,?,?)"
    ).run(String(rollNo).trim(), String(name).trim(), String(program).trim(), String(semester).trim(), token);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message.includes("UNIQUE") ? "This roll number already exists." : e.message });
  }
});

app.put("/api/students/:id", requireRole("admin"), (req, res) => {
  const { rollNo, name, program, semester } = req.body || {};
  if (!rollNo || !name) return res.status(400).json({ error: "Roll number and name are required." });
  try {
    const result = db.prepare(
      "UPDATE students SET roll_no=?, name=?, program=?, semester=? WHERE id=?"
    ).run(String(rollNo).trim(), String(name).trim(), String(program || "BSCS").trim(),
          String(semester || "Semester II").trim(), req.params.id);
    if (!result.changes) return res.status(404).json({ error: "Student not found." });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message.includes("UNIQUE") ? "This roll number already exists." : e.message });
  }
});

app.delete("/api/students/:id", requireRole("admin"), (req, res) => {
  const result = db.prepare("DELETE FROM students WHERE id=?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Student not found." });
  res.json({ ok: true });
});

app.get("/api/student/:token", (req, res) => {
  const student = db.prepare(
    "SELECT id,roll_no,name,program,semester FROM students WHERE qr_token=?"
  ).get(req.params.token);
  if (!student) return res.status(404).json({ error: "Invalid QR code." });
  const date = datePartsInPakistan();
  const attendance = db.prepare(
    "SELECT lecture,status,marked_at FROM attendance WHERE student_id=? AND attendance_date=? ORDER BY lecture"
  ).all(student.id, date);
  res.json({ ...student, attendanceDate: date, attendance });
});

app.post("/api/attendance", requireRole("admin", "teacher"), (req, res) => {
  const { token, lecture } = req.body || {};
  const lectureNo = Number(lecture);
  if (!token || !Number.isInteger(lectureNo) || lectureNo < 1 || lectureNo > 4) {
    return res.status(400).json({ error: "Valid QR token and lecture (1-4) are required." });
  }
  const student = db.prepare("SELECT id,name,roll_no FROM students WHERE qr_token=?").get(token);
  if (!student) return res.status(404).json({ error: "Student QR not found." });
  const date = datePartsInPakistan();
  try {
    db.prepare(
      "INSERT INTO attendance(student_id,attendance_date,lecture,status) VALUES (?,?,?,'Present')"
    ).run(student.id, date, lectureNo);
    res.json({ ok: true, message: `${student.name} marked present in lecture ${lectureNo}.`, date });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Attendance already marked for this lecture today." });
    res.status(500).json({ error: "Could not save attendance." });
  }
});

app.get("/api/report", requireRole("admin", "teacher"), (req, res) => {
  const date = req.query.date || datePartsInPakistan();
  const rows = db.prepare(`
    SELECT s.roll_no, s.name, s.program, s.semester,
      MAX(CASE WHEN a.lecture=1 THEN a.status ELSE '' END) AS lecture1,
      MAX(CASE WHEN a.lecture=2 THEN a.status ELSE '' END) AS lecture2,
      MAX(CASE WHEN a.lecture=3 THEN a.status ELSE '' END) AS lecture3,
      MAX(CASE WHEN a.lecture=4 THEN a.status ELSE '' END) AS lecture4,
      SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present_count
    FROM students s LEFT JOIN attendance a
      ON s.id=a.student_id AND a.attendance_date=?
    GROUP BY s.id ORDER BY s.roll_no
  `).all(date);
  res.json({ date, rows });
});

app.get("/api/history", requireRole("admin", "teacher"), (req, res) => {
  const rows = db.prepare(`
    SELECT a.attendance_date AS date, s.roll_no, s.name, a.lecture, a.status, a.marked_at
    FROM attendance a JOIN students s ON s.id=a.student_id
    ORDER BY a.attendance_date DESC, s.roll_no, a.lecture
    LIMIT 1000
  `).all();
  res.json(rows);
});

// First run: create three sample students if the database is empty.
if (db.prepare("SELECT COUNT(*) AS n FROM students").get().n === 0) {
  const add = db.prepare("INSERT INTO students(roll_no,name,program,semester,qr_token) VALUES(?,?,?,?,?)");
  add.run("25845", "Aryyan", "BSCS", "Semester II", crypto.randomBytes(18).toString("hex"));
  add.run("25831", "Ahmed", "BSCS", "Semester II", crypto.randomBytes(18).toString("hex"));
  add.run("25842", "Student 3", "BSCS", "Semester II", crypto.randomBytes(18).toString("hex"));
}

app.listen(PORT, () => console.log(`Smart Attendance running at http://localhost:${PORT}`));
