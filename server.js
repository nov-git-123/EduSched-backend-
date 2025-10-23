// const express = require('express');
// const mysql = require('mysql');
// const cors = require('cors');

// const app = express();
// app.use(cors());
// app.use(express.json());

// // ✅ MySQL Connection
// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',      // change if you use another username
//   password: '',      // put your MySQL password if you set one
//   database: 'capstone_edusched_app' // this should match your SQL database name
// });

// // ✅ Test connection
// db.connect((err) => {
//   if (err) {
//     console.error('Database connection failed:', err);
//   } else {
//     console.log('✅ Connected to MySQL');
//   }
// });

// // ✅ Signup API
// app.post("/signup", (req, res) => {
//     const { uid, email, role } = req.body;
  
//     if (!uid || !email || !role) {
//       return res.status(400).json({ error: "Missing fields" });
//     }
  
//     const sql = "INSERT INTO users (uid, email, role) VALUES (?, ?, ?)";
//     db.query(sql, [uid, email, role], (err, result) => {
//       if (err) {
//         console.error("Error inserting user:", err);
//         return res.status(500).json({ error: "Database error" });
//       }
//       return res.json({ message: "User registered successfully" });
//     });
//   });
  
//   // ✅ Start server
//   app.listen(5000, () => {
//     console.log("🚀 Server running on http://localhost:5000");
//   });
  
// server.js



const express = require("express");
const cors = require("cors");
const mysql = require("mysql");

const coursesRouter = require('./routes/courses');
const subjectsRouter = require('./routes/subjects');

const buildingsRouter = require('./routes/buildings');
const roomsRouter = require('./routes/rooms');
// const scheduleRouter = require('./routes/schedule');
const schedulerRouter = require('./routes/scheduler');
const InstructorAvailabilityRouter = require('./routes/InstructorAvailability');
const dashboardRoutes = require("./routes/dashboard");
const schedulesRoutes = require("./routes/schedules");
const availabilityRoutes = require("./routes/availability");
const profileRoutes = require("./routes/profile");






// Initialize app
const app = express();

app.use(cors());
app.use(express.json());



// Use routes
app.use("/api/buildings", require("./routes/buildings"));
app.use("/api/rooms", require("./routes/rooms"));
const instructorsRouter = require('./routes/instructors');
app.use('/api/instructor-availability', InstructorAvailabilityRouter);

app.use("/api/profile", profileRoutes);
// Make uploads accessible
app.use("/uploads", express.static("uploads"));

app.use('/api/courses', coursesRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/instructors', instructorsRouter);
// app.use('/api/schedule', scheduleRouter);
app.use('/api/scheduler', schedulerRouter);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/instructor-availability", availabilityRoutes);

//✅ Connect to MySQL database
const db = mysql.createConnection({
  host: "localhost",
  user: "root",            // change if you have a different MySQL user
  password: "",            // put your MySQL password if you set one
  database: "capstone_edusched_app"
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    return;
  }
  console.log("✅ Connected to MySQL Database: capstone_edusched_app");
});

// ✅ Signup API: insert new user
// ✅ Signup API: insert new user
app.post("/api/users", (req, res) => {
  const { uid, full_name, email, role } = req.body;

  if (!uid || !full_name || !email || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = "INSERT INTO users (uid, full_name, email, role) VALUES (?, ?, ?, ?)";
  db.query(sql, [uid, full_name, email, role], (err, result) => {
    if (err) {
      console.error("❌ Error inserting user:", err);
      return res.status(500).json({ error: "Database insert failed" });
    }
    res.status(201).json({ message: "✅ User registered successfully!" });
  });
});


// ✅ Login API: fetch user by email
app.post("/api/login", (req, res) => {
    const { email } = req.body;
  
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
  
    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], (err, results) => {
      if (err) {
        console.error("❌ Database query error:", err);
        return res.status(500).json({ error: "Database query failed" });
      }
  
      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
  
      const user = results[0];
      res.json({ uid: user.uid, email: user.email, role: user.role });
    });
  });

// ✅ Get all users (for Admin User Management)
app.get("/api/users", (req, res) => {
  const sql = "SELECT * FROM users";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching users:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(results); // send all users
  });
});

  // ✅ Get user by UID
// app.get("/api/users/:uid", (req, res) => {
//     const { uid } = req.params;
//     const sql = "SELECT * FROM users WHERE uid = ?";
//     db.query(sql, [uid], (err, results) => {
//       if (err) {
//         console.error("❌ Error fetching user:", err);
//         return res.status(500).json({ error: "Database query failed" });
//       }
//       if (results.length === 0) {
//         return res.status(404).json({ error: "User not found" });
//       }
//       res.json(results[0]); // 👈 returns full user object including role
//     });
//   });
  /// ✅ Get user by UID with instructor_id
app.get("/api/users/:uid", (req, res) => {
  const { uid } = req.params;

  const sql = `
    SELECT 
      u.uid, 
      u.full_name, 
      u.email, 
      u.role,
      i.id AS instructor_id
    FROM users u
    LEFT JOIN instructors i ON u.full_name = i.name
    WHERE u.uid = ?
  `;

  db.query(sql, [uid], (err, results) => {
    if (err) {
      console.error("❌ Error fetching user:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(results[0]); // includes instructor_id if found
  });
});

  // ✅ Get all users

// ✅ Update user role
app.put("/api/users/:uid", (req, res) => {
  const { uid } = req.params;
  const { role } = req.body;
  db.query("UPDATE users SET role = ? WHERE uid = ?", [role, uid], (err) => {
    if (err) return res.status(500).json({ error: "Database update failed" });
    res.json({ message: "Role updated successfully" });
  });
});

// ✅ Delete user
app.delete("/api/users/:uid", (req, res) => {
  const { uid } = req.params;
  db.query("DELETE FROM users WHERE uid = ?", [uid], (err) => {
    if (err) return res.status(500).json({ error: "Database delete failed" });
    res.json({ message: "User deleted successfully" });
  });
});




// ✅ Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
