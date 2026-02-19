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

//WORKING TO NONG PRE-ORAL PA

// require('dotenv').config();

// const express = require("express");
// const cors = require("cors");
// const mysql = require("mysql");

// const path = require('path');


// const coursesRouter = require('./routes/courses');
// const subjectsRouter = require('./routes/subjects');

// const buildingsRouter = require('./routes/buildings');
// const roomsRouter = require('./routes/rooms');
// // const scheduleRouter = require('./routes/schedule');
// const schedulerRouter = require('./routes/scheduler');
// const InstructorAvailabilityRouter = require('./routes/InstructorAvailability');
// const dashboardRoutes = require("./routes/dashboard");
// const schedulesRoutes = require("./routes/schedules");
// const availabilityRoutes = require("./routes/availability");
// const profileRoutes = require("./routes/profile");
// const teacherAssignmentsRoutes = require('./routes/teacher-assignments');
// const roomAssignmentsRoutes = require('./routes/roomAssignments');







// // Initialize app
// const app = express();

// app.use(cors());
// app.use(express.json());



// // Use routes
// app.use("/api/buildings", require("./routes/buildings"));
// app.use("/api/rooms", require("./routes/rooms"));
// const instructorsRouter = require('./routes/instructors');
// app.use('/api/instructor-availability', InstructorAvailabilityRouter);

// app.use("/api/profile", profileRoutes);
// // Make uploads accessible
// app.use("/uploads", express.static("uploads"));

// app.use('/api/courses', coursesRouter);
// app.use('/api/subjects', subjectsRouter);
// app.use('/api/instructors', instructorsRouter);
// // app.use('/api/schedule', scheduleRouter);
// app.use('/api/scheduler', schedulerRouter);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/schedules", schedulesRoutes);
// app.use("/api/instructor-availability", availabilityRoutes);
// app.use('/api/teacher-assignments', teacherAssignmentsRoutes);
// app.use('/api/room-assignments', roomAssignmentsRoutes);
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/api/profile', profileRoutes);
// //✅ Connect to MySQL database
// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",            // change if you have a different MySQL user
//   password: "",            // put your MySQL password if you set one
//   database: "capstone_edusched_app"
// });

// db.connect((err) => {
//   if (err) {
//     console.error("❌ Database connection failed:", err);
//     return;
//   }
//   console.log("✅ Connected to MySQL Database: capstone_edusched_app");
// });

// // ✅ Signup API: insert new user
// // ✅ Signup API: insert new user
// app.post("/api/users", (req, res) => {
//   const { uid, full_name, email, role } = req.body;

//   if (!uid || !full_name || !email || !role) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   const sql = "INSERT INTO users (uid, full_name, email, role) VALUES (?, ?, ?, ?)";
//   db.query(sql, [uid, full_name, email, role], (err, result) => {
//     if (err) {
//       console.error("❌ Error inserting user:", err);
//       return res.status(500).json({ error: "Database insert failed" });
//     }
//     res.status(201).json({ message: "✅ User registered successfully!" });
//   });
// });


// // ✅ Login API: fetch user by email
// app.post("/api/login", (req, res) => {
//     const { email } = req.body;
  
//     if (!email) {
//       return res.status(400).json({ error: "Email is required" });
//     }
  
//     const sql = "SELECT * FROM users WHERE email = ?";
//     db.query(sql, [email], (err, results) => {
//       if (err) {
//         console.error("❌ Database query error:", err);
//         return res.status(500).json({ error: "Database query failed" });
//       }
  
//       if (results.length === 0) {
//         return res.status(404).json({ error: "User not found" });
//       }
  
//       const user = results[0];
//       res.json({ uid: user.uid, email: user.email, role: user.role });
//     });
//   });

// // ✅ Get all users (for Admin User Management)
// app.get("/api/users", (req, res) => {
//   const sql = "SELECT * FROM users";
//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching users:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     res.json(results); // send all users
//   });
// });

//   // ✅ Get user by UID
// // app.get("/api/users/:uid", (req, res) => {
// //     const { uid } = req.params;
// //     const sql = "SELECT * FROM users WHERE uid = ?";
// //     db.query(sql, [uid], (err, results) => {
// //       if (err) {
// //         console.error("❌ Error fetching user:", err);
// //         return res.status(500).json({ error: "Database query failed" });
// //       }
// //       if (results.length === 0) {
// //         return res.status(404).json({ error: "User not found" });
// //       }
// //       res.json(results[0]); // 👈 returns full user object including role
// //     });
// //   });
//   /// ✅ Get user by UID with instructor_id
// app.get("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     res.json(results[0]); // includes instructor_id if found
//   });
// });

//   // ✅ Get all users

// // ✅ Update user role
// app.put("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   const { role } = req.body;
//   db.query("UPDATE users SET role = ? WHERE uid = ?", [role, uid], (err) => {
//     if (err) return res.status(500).json({ error: "Database update failed" });
//     res.json({ message: "Role updated successfully" });
//   });
// });

// // ✅ Delete user
// app.delete("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   db.query("DELETE FROM users WHERE uid = ?", [uid], (err) => {
//     if (err) return res.status(500).json({ error: "Database delete failed" });
//     res.json({ message: "User deleted successfully" });
//   });
// });




// // ✅ Start server
// const PORT = 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

//REAL
// require('dotenv').config();

// const express = require("express");
// const cors = require("cors");
// const mysql = require("mysql");
// const path = require('path');

// // Import routes
// const coursesRouter = require('./routes/courses');
// const subjectsRouter = require('./routes/subjects');
// const buildingsRouter = require('./routes/buildings');
// const roomsRouter = require('./routes/rooms');
// const schedulerRouter = require('./routes/scheduler');
// const InstructorAvailabilityRouter = require('./routes/InstructorAvailability');
// const dashboardRoutes = require("./routes/dashboard");
// const schedulesRoutes = require("./routes/schedules");
// const availabilityRoutes = require("./routes/availability");
// const profileRoutes = require("./routes/profile");
// const teacherAssignmentsRoutes = require('./routes/teacher-assignments');
// const roomAssignmentsRoutes = require('./routes/roomAssignments');
// const instructorsRouter = require('./routes/instructors');

// // Initialize app
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // ✅ IMPORTANT: Serve static files BEFORE API routes
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // API Routes
// app.use("/api/buildings", buildingsRouter);
// app.use("/api/rooms", roomsRouter);
// app.use("/api/courses", coursesRouter);
// app.use("/api/subjects", subjectsRouter);
// app.use("/api/instructors", instructorsRouter);
// app.use("/api/scheduler", schedulerRouter);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/schedules", schedulesRoutes);
// app.use("/api/instructor-availability", availabilityRoutes);
// app.use("/api/teacher-assignments", teacherAssignmentsRoutes);
// app.use("/api/room-assignments", roomAssignmentsRoutes);
// app.use("/api/profile", profileRoutes);

// // ✅ Connect to MySQL database
// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "",
//   database: "capstone_edusched_app"
// });

// db.connect((err) => {
//   if (err) {
//     console.error("❌ Database connection failed:", err);
//     return;
//   }
//   console.log("✅ Connected to MySQL Database: capstone_edusched_app");
// });

// // ✅ Signup API: insert new user
// app.post("/api/users", (req, res) => {
//   const { uid, full_name, email, role } = req.body;

//   if (!uid || !full_name || !email || !role) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   const sql = "INSERT INTO users (uid, full_name, email, role) VALUES (?, ?, ?, ?)";
//   db.query(sql, [uid, full_name, email, role], (err, result) => {
//     if (err) {
//       console.error("❌ Error inserting user:", err);
//       return res.status(500).json({ error: "Database insert failed" });
//     }
//     res.status(201).json({ message: "✅ User registered successfully!" });
//   });
// });

// // ✅ Login API: fetch user by email
// app.post("/api/login", (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: "Email is required" });
//   }

//   // ✅ IMPORTANT: Also fetch profile_picture
//   const sql = "SELECT uid, full_name, email, role, profile_picture FROM users WHERE email = ?";
//   db.query(sql, [email], (err, results) => {
//     if (err) {
//       console.error("❌ Database query error:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const user = results[0];
//     res.json({ 
//       uid: user.uid, 
//       email: user.email, 
//       role: user.role,
//       displayName: user.full_name,
//       photoURL: user.profile_picture
//     });
//   });
// });

// // ✅ Get all users (for Admin User Management)
// app.get("/api/users", (req, res) => {
//   const sql = "SELECT * FROM users";
//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching users:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     res.json(results);
//   });
// });

// // ✅ Get user by UID with instructor_id
// app.get("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       u.profile_picture,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const user = results[0];
//     res.json({
//       uid: user.uid,
//       displayName: user.full_name,
//       email: user.email,
//       role: user.role,
//       photoURL: user.profile_picture,
//       instructor_id: user.instructor_id
//     });
//   });
// });

// // ✅ Get user profile (for AuthContext) - matches the endpoint your AuthContext is calling
// app.get("/api/users/:uid/profile", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       u.profile_picture,
//       u.created_at,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user profile:", err);
//       return res.status(500).json({ 
//         success: false,
//         error: "Database query failed" 
//       });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ 
//         success: false,
//         error: "User not found" 
//       });
//     }

//     const user = results[0];
//     res.json({
//       success: true,
//       user: {
//         uid: user.uid,
//         full_name: user.full_name,
//         email: user.email,
//         role: user.role,
//         profile_picture: user.profile_picture,
//         created_at: user.created_at,
//         instructor_id: user.instructor_id
//       }
//     });
//   });
// });

// // ✅ Update user role
// app.put("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   const { role } = req.body;
//   db.query("UPDATE users SET role = ? WHERE uid = ?", [role, uid], (err) => {
//     if (err) return res.status(500).json({ error: "Database update failed" });
//     res.json({ message: "Role updated successfully" });
//   });
// });

// // ✅ Delete user
// app.delete("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   db.query("DELETE FROM users WHERE uid = ?", [uid], (err) => {
//     if (err) return res.status(500).json({ error: "Database delete failed" });
//     res.json({ message: "User deleted successfully" });
//   });
// });

// // ✅ Start server
// const PORT = 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

//TRYING

// require('dotenv').config();

// const express = require("express");
// const cors = require("cors");
// const mysql = require("mysql2");
// const path = require('path');

// // Import routes
// const coursesRouter = require('./routes/courses');
// const subjectsRouter = require('./routes/subjects');
// const buildingsRouter = require('./routes/buildings');
// const roomsRouter = require('./routes/rooms');
// const schedulerRouter = require('./routes/scheduler');
// const InstructorAvailabilityRouter = require('./routes/InstructorAvailability');
// const dashboardRoutes = require("./routes/dashboard");
// const schedulesRoutes = require("./routes/schedules");
// const availabilityRoutes = require("./routes/availability");
// const profileRoutes = require("./routes/profile");
// const teacherAssignmentsRoutes = require('./routes/teacher-assignments');
// const roomAssignmentsRoutes = require('./routes/roomAssignments');
// const instructorsRouter = require('./routes/instructors');

// // Initialize app
// const app = express();

// // Middleware
// app.use(cors({
//   origin: [
//     'https://edusched-frontend-new1.vercel.app',
//     'http://localhost:3000'
//   ],
//   credentials: true
// }));
// app.use(express.json());

// // ✅ IMPORTANT: Serve static files BEFORE API routes
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // API Routes
// app.use("/api/buildings", buildingsRouter);
// app.use("/api/rooms", roomsRouter);
// app.use("/api/courses", coursesRouter);
// app.use("/api/subjects", subjectsRouter);
// app.use("/api/instructors", instructorsRouter);
// app.use("/api/scheduler", schedulerRouter);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/schedules", schedulesRoutes);
// app.use("/api/instructor-availability", availabilityRoutes);
// app.use("/api/teacher-assignments", teacherAssignmentsRoutes);
// app.use("/api/room-assignments", roomAssignmentsRoutes);
// app.use("/api/profile", profileRoutes);

// // ✅ NEW - uses Railway environment variables
// const db = mysql.createConnection({
//   host: process.env.MYSQL_HOST || "localhost",
//   user: process.env.MYSQL_USER || "root",
//   password: process.env.MYSQL_PASSWORD || "",
//   database: process.env.MYSQL_DATABASE || "capstone_edusched_app"
// });

// db.connect((err) => {
//   if (err) {
//     console.error("❌ Database connection failed:", err);
//     return;
//   }
//   console.log("✅ Connected to MySQL Database:", process.env.MYSQL_DATABASE || "capstone_edusched_app");  // ✅ NEW
// });

// // ✅ Signup API: insert new user
// app.post("/api/users", (req, res) => {
//   const { uid, full_name, email, role } = req.body;

//   if (!uid || !full_name || !email || !role) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   const sql = "INSERT INTO users (uid, full_name, email, role) VALUES (?, ?, ?, ?)";
//   db.query(sql, [uid, full_name, email, role], (err, result) => {
//     if (err) {
//       console.error("❌ Error inserting user:", err);
//       return res.status(500).json({ error: "Database insert failed" });
//     }
//     res.status(201).json({ message: "✅ User registered successfully!" });
//   });
// });

// // ✅ Login API: fetch user by email
// app.post("/api/login", (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: "Email is required" });
//   }

//   // ✅ IMPORTANT: Also fetch profile_picture
//   const sql = "SELECT uid, full_name, email, role, profile_picture FROM users WHERE email = ?";
//   db.query(sql, [email], (err, results) => {
//     if (err) {
//       console.error("❌ Database query error:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const user = results[0];
//     res.json({ 
//       uid: user.uid, 
//       email: user.email, 
//       role: user.role,
//       displayName: user.full_name,
//       photoURL: user.profile_picture
//     });
//   });
// });

// // ✅ Get all users (for Admin User Management)
// app.get("/api/users", (req, res) => {
//   const sql = "SELECT * FROM users";
//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching users:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     res.json(results);
//   });
// });

// // ✅ Get user by UID with instructor_id
// app.get("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       u.profile_picture,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const user = results[0];
//     res.json({
//       uid: user.uid,
//       displayName: user.full_name,
//       email: user.email,
//       role: user.role,
//       photoURL: user.profile_picture,
//       instructor_id: user.instructor_id
//     });
//   });
// });

// // ✅ Get user profile (for AuthContext) - matches the endpoint your AuthContext is calling
// app.get("/api/users/:uid/profile", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       u.profile_picture,
//       u.created_at,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user profile:", err);
//       return res.status(500).json({ 
//         success: false,
//         error: "Database query failed" 
//       });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ 
//         success: false,
//         error: "User not found" 
//       });
//     }

//     const user = results[0];
//     res.json({
//       success: true,
//       user: {
//         uid: user.uid,
//         full_name: user.full_name,
//         email: user.email,
//         role: user.role,
//         profile_picture: user.profile_picture,
//         created_at: user.created_at,
//         instructor_id: user.instructor_id
//       }
//     });
//   });
// });

// // ✅ Update user role
// app.put("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   const { role } = req.body;
//   db.query("UPDATE users SET role = ? WHERE uid = ?", [role, uid], (err) => {
//     if (err) return res.status(500).json({ error: "Database update failed" });
//     res.json({ message: "Role updated successfully" });
//   });
// });

// // ✅ Delete user
// app.delete("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   db.query("DELETE FROM users WHERE uid = ?", [uid], (err) => {
//     if (err) return res.status(500).json({ error: "Database delete failed" });
//     res.json({ message: "User deleted successfully" });
//   });
// });

// // ✅ Start server
// const PORT = 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

//GINAMIT SA SURVEY

// require('dotenv').config();

// const express = require("express");
// const cors = require("cors");
// const mysql = require("mysql2");
// const path = require('path');

// // Import routes
// const coursesRouter = require('./routes/courses');
// const subjectsRouter = require('./routes/subjects');
// const buildingsRouter = require('./routes/buildings');
// const roomsRouter = require('./routes/rooms');
// const schedulerRouter = require('./routes/scheduler');
// const InstructorAvailabilityRouter = require('./routes/InstructorAvailability');
// const dashboardRoutes = require("./routes/dashboard");
// const schedulesRoutes = require("./routes/schedules");
// const availabilityRoutes = require("./routes/availability");
// const profileRoutes = require("./routes/profile");
// const teacherAssignmentsRoutes = require('./routes/teacher-assignments');
// const roomAssignmentsRoutes = require('./routes/roomAssignments');
// const instructorsRouter = require('./routes/instructors');

// // Initialize app
// const app = express();

// // Middleware - CORS configuration
// app.use(cors({
//   origin: [
//     'https://edusched-frontend-new1.vercel.app',
//     'http://localhost:3000'
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// app.use(express.json());

// // ✅ IMPORTANT: Serve static files BEFORE API routes
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // API Routes
// app.use("/api/buildings", buildingsRouter);
// app.use("/api/rooms", roomsRouter);
// app.use("/api/courses", coursesRouter);
// app.use("/api/subjects", subjectsRouter);
// app.use("/api/instructors", instructorsRouter);
// app.use("/api/scheduler", schedulerRouter);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/schedules", schedulesRoutes);
// app.use("/api/instructor-availability", availabilityRoutes);
// app.use("/api/teacher-assignments", teacherAssignmentsRoutes);
// app.use("/api/room-assignments", roomAssignmentsRoutes);
// app.use("/api/profile", profileRoutes);

// // Database connection
// const db = mysql.createConnection({
//   host: process.env.MYSQL_HOST || "localhost",
//   user: process.env.MYSQL_USER || "root",
//   password: process.env.MYSQL_PASSWORD || "",
//   database: process.env.MYSQL_DATABASE || "capstone_edusched_app"
// });

// db.connect((err) => {
//   if (err) {
//     console.error("❌ Database connection failed:", err.message);
//     return;
//   }
//   console.log("✅ Connected to MySQL Database:", process.env.MYSQL_DATABASE || "capstone_edusched_app");
// });

// // ✅ Signup API: insert new user
// app.post("/api/users", (req, res) => {
//   const { uid, full_name, email, role } = req.body;

//   if (!uid || !full_name || !email || !role) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   const sql = "INSERT INTO users (uid, full_name, email, role) VALUES (?, ?, ?, ?)";
//   db.query(sql, [uid, full_name, email, role], (err, result) => {
//     if (err) {
//       console.error("❌ Error inserting user:", err);
//       return res.status(500).json({ error: "Database insert failed" });
//     }
//     res.status(201).json({ message: "✅ User registered successfully!" });
//   });
// });

// // ✅ Login API: fetch user by email
// app.post("/api/login", (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: "Email is required" });
//   }

//   const sql = "SELECT uid, full_name, email, role, profile_picture FROM users WHERE email = ?";
//   db.query(sql, [email], (err, results) => {
//     if (err) {
//       console.error("❌ Database query error:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const user = results[0];
//     res.json({ 
//       uid: user.uid, 
//       email: user.email, 
//       role: user.role,
//       displayName: user.full_name,
//       photoURL: user.profile_picture
//     });
//   });
// });

// // ✅ Get all users (for Admin User Management)
// app.get("/api/users", (req, res) => {
//   const sql = "SELECT * FROM users";
//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching users:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     res.json(results);
//   });
// });

// // ✅ Get user by UID with instructor_id
// app.get("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       u.profile_picture,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const user = results[0];
//     res.json({
//       uid: user.uid,
//       displayName: user.full_name,
//       email: user.email,
//       role: user.role,
//       photoURL: user.profile_picture,
//       instructor_id: user.instructor_id
//     });
//   });
// });

// // ✅ Get user profile (for AuthContext)
// app.get("/api/users/:uid/profile", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       u.profile_picture,
//       u.created_at,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user profile:", err);
//       return res.status(500).json({ 
//         success: false,
//         error: "Database query failed" 
//       });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ 
//         success: false,
//         error: "User not found" 
//       });
//     }

//     const user = results[0];
//     res.json({
//       success: true,
//       user: {
//         uid: user.uid,
//         full_name: user.full_name,
//         email: user.email,
//         role: user.role,
//         profile_picture: user.profile_picture,
//         created_at: user.created_at,
//         instructor_id: user.instructor_id
//       }
//     });
//   });
// });

// // ✅ Update user role
// app.put("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   const { role } = req.body;
//   db.query("UPDATE users SET role = ? WHERE uid = ?", [role, uid], (err) => {
//     if (err) return res.status(500).json({ error: "Database update failed" });
//     res.json({ message: "Role updated successfully" });
//   });
// });

// // ✅ Delete user
// app.delete("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   db.query("DELETE FROM users WHERE uid = ?", [uid], (err) => {
//     if (err) return res.status(500).json({ error: "Database delete failed" });
//     res.json({ message: "User deleted successfully" });
//   });
// });

// // ✅ Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

//FUNCTIONAL NA UPLOAD NA
// require('dotenv').config();

// const express = require("express");
// const cors = require("cors");
// const mysql = require("mysql2");
// const path = require('path');

// // Import routes
// const coursesRouter = require('./routes/courses');
// const subjectsRouter = require('./routes/subjects');
// const buildingsRouter = require('./routes/buildings');
// const roomsRouter = require('./routes/rooms');
// const schedulerRouter = require('./routes/scheduler');
// const InstructorAvailabilityRouter = require('./routes/InstructorAvailability');
// const dashboardRoutes = require("./routes/dashboard");
// const schedulesRoutes = require("./routes/schedules");
// const availabilityRoutes = require("./routes/availability");
// const profileRoutes = require("./routes/profile");
// const teacherAssignmentsRoutes = require('./routes/teacher-assignments');
// const roomAssignmentsRoutes = require('./routes/roomAssignments');
// const instructorsRouter = require('./routes/instructors');
// const activityRoutes = require('./routes/activityRoutes');

// // Initialize app
// const app = express();

// // Middleware - CORS configuration
// app.use(cors({
//   origin: [
//     'https://edusched-frontend-new1.vercel.app',
//     'http://localhost:3000'
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// app.use(express.json());

// // ✅ IMPORTANT: Serve static files BEFORE API routes
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// // API Routes
// app.use("/api/buildings", buildingsRouter);
// app.use("/api/rooms", roomsRouter);
// app.use("/api/courses", coursesRouter);
// app.use("/api/subjects", subjectsRouter);
// app.use("/api/instructors", instructorsRouter);
// app.use("/api/scheduler", schedulerRouter);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/schedules", schedulesRoutes);
// app.use("/api/instructor-availability", availabilityRoutes);
// app.use("/api/teacher-assignments", teacherAssignmentsRoutes);
// app.use("/api/room-assignments", roomAssignmentsRoutes);
// app.use("/api/profile", profileRoutes);
// app.use(activityRoutes);

// // ✅ Connect to MySQL database
// const db = mysql.createConnection({
//   host: process.env.MYSQL_HOST || "localhost",
//   user: process.env.MYSQL_USER || "root",
//   password: process.env.MYSQL_PASSWORD || "",
//   database: process.env.MYSQL_DATABASE || "capstone_edusched_app"
// });

// db.connect((err) => {
//   if (err) {
//     console.error("❌ Database connection failed:", err.message);
//     return;
//   }
//   console.log("✅ Connected to MySQL Database:", process.env.MYSQL_DATABASE || "capstone_edusched_app");
// });

// // ✅ Signup API: insert new user
// app.post("/api/users", (req, res) => {
//   const { uid, full_name, email, role } = req.body;

//   if (!uid || !full_name || !email || !role) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   const sql = "INSERT INTO users (uid, full_name, email, role) VALUES (?, ?, ?, ?)";
//   db.query(sql, [uid, full_name, email, role], (err, result) => {
//     if (err) {
//       console.error("❌ Error inserting user:", err);
//       return res.status(500).json({ error: "Database insert failed" });
//     }
//     res.status(201).json({ message: "✅ User registered successfully!" });
//   });
// });

// // ✅ FIXED: Login API - Returns complete user data with both field name variations
// app.post("/api/login", (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: "Email is required" });
//   }

//   // Fetch ALL user data including profile_picture
//   const sql = "SELECT uid, full_name, email, role, profile_picture FROM users WHERE email = ?";
  
//   db.query(sql, [email], (err, results) => {
//     if (err) {
//       console.error("❌ Database query error:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const user = results[0];
    
//     // ✅ Log what we're fetching from database
//     console.log('✅ Login successful for:', user.email);
//     console.log('✅ Database record:', {
//       uid: user.uid,
//       full_name: user.full_name,
//       email: user.email,
//       role: user.role,
//       profile_picture: user.profile_picture
//     });

//     // ✅ CRITICAL FIX: Return BOTH field name variations for compatibility
//     // This ensures frontend gets data regardless of which field name it uses
//     const userData = {
//       uid: user.uid,              // Primary identifier
//       id: user.uid,               // Alternative identifier (for compatibility)
//       email: user.email,
//       role: user.role,
//       displayName: user.full_name,    // Frontend expects this
//       full_name: user.full_name,      // Keep original field name too
//       photoURL: user.profile_picture  // Frontend expects this
//     };

//     console.log('✅ Returning to frontend:', userData);

//     res.json(userData);
//   });
// });

// // ✅ Get all users (for Admin User Management)
// app.get("/api/users", (req, res) => {
//   const sql = "SELECT * FROM users";
//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching users:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     res.json(results);
//   });
// });

// // ✅ FIXED: Get user by UID with complete data structure
// app.get("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       u.profile_picture,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user:", err);
//       return res.status(500).json({ error: "Database query failed" });
//     }
//     if (results.length === 0) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const user = results[0];
    
//     // ✅ Return both field name variations
//     res.json({
//       uid: user.uid,
//       id: user.uid,
//       displayName: user.full_name,
//       full_name: user.full_name,
//       email: user.email,
//       role: user.role,
//       photoURL: user.profile_picture,
//       instructor_id: user.instructor_id
//     });
//   });
// });

// // ✅ FIXED: Get user profile with complete data structure
// app.get("/api/users/:uid/profile", (req, res) => {
//   const { uid } = req.params;

//   const sql = `
//     SELECT 
//       u.uid, 
//       u.full_name, 
//       u.email, 
//       u.role,
//       u.profile_picture,
//       u.created_at,
//       i.id AS instructor_id
//     FROM users u
//     LEFT JOIN instructors i ON u.full_name = i.name
//     WHERE u.uid = ?
//   `;

//   db.query(sql, [uid], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching user profile:", err);
//       return res.status(500).json({ 
//         success: false,
//         error: "Database query failed" 
//       });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ 
//         success: false,
//         error: "User not found" 
//       });
//     }

//     const user = results[0];
    
//     // ✅ Return both field name variations
//     res.json({
//       success: true,
//       user: {
//         uid: user.uid,
//         id: user.uid,
//         full_name: user.full_name,
//         displayName: user.full_name,
//         email: user.email,
//         role: user.role,
//         profile_picture: user.profile_picture,
//         photoURL: user.profile_picture,
//         created_at: user.created_at,
//         instructor_id: user.instructor_id
//       }
//     });
//   });
// });

// // ✅ Update user role
// app.put("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
//   const { role } = req.body;
  
//   console.log('Updating role for user:', uid, 'to:', role);
  
//   db.query("UPDATE users SET role = ? WHERE uid = ?", [role, uid], (err, result) => {
//     if (err) {
//       console.error("❌ Error updating role:", err);
//       return res.status(500).json({ error: "Database update failed" });
//     }
    
//     console.log('✅ Role updated, rows affected:', result.affectedRows);
//     res.json({ message: "Role updated successfully" });
//   });
// });

// // ✅ Delete user
// app.delete("/api/users/:uid", (req, res) => {
//   const { uid } = req.params;
  
//   console.log('Deleting user:', uid);
  
//   db.query("DELETE FROM users WHERE uid = ?", [uid], (err, result) => {
//     if (err) {
//       console.error("❌ Error deleting user:", err);
//       return res.status(500).json({ error: "Database delete failed" });
//     }
    
//     console.log('✅ User deleted, rows affected:', result.affectedRows);
//     res.json({ message: "User deleted successfully" });
//   });
// });

// // ✅ Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

require('dotenv').config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const path = require('path');
const admin = require('firebase-admin');

// Import routes
const coursesRouter = require('./routes/courses');
const subjectsRouter = require('./routes/subjects');
const buildingsRouter = require('./routes/buildings');
const roomsRouter = require('./routes/rooms');
const schedulerRouter = require('./routes/scheduler');
const InstructorAvailabilityRouter = require('./routes/InstructorAvailability');
const dashboardRoutes = require("./routes/dashboard");
const schedulesRoutes = require("./routes/schedules");
const availabilityRoutes = require("./routes/availability");
const profileRoutes = require("./routes/profile");
const teacherAssignmentsRoutes = require('./routes/teacher-assignments');
const roomAssignmentsRoutes = require('./routes/roomAssignments');
const instructorsRouter = require('./routes/instructors');
const activityRoutes = require('./routes/activityRoutes');

// ============================================================
// Initialize Firebase Admin SDK
// Uses FIREBASE_SERVICE_ACCOUNT env variable on Railway,
// falls back to serviceAccountKey.json for local development.
// ============================================================
let firebaseAdmin = null;
try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./serviceAccountKey.json');

  firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized');
} catch (err) {
  console.warn('⚠️  Firebase Admin SDK not initialized (serviceAccountKey.json missing or FIREBASE_SERVICE_ACCOUNT not set)');
  console.warn('   Token verification will be SKIPPED — set up service account for production');
}

// Middleware to verify Firebase ID token server-side
const verifyFirebaseToken = async (idToken) => {
  if (!firebaseAdmin) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return null;
  }
};

// Initialize app
const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'https://edusched-frontend-new1.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use("/api/buildings", buildingsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/subjects", subjectsRouter);
app.use("/api/instructors", instructorsRouter);
app.use("/api/scheduler", schedulerRouter);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/instructor-availability", availabilityRoutes);
app.use("/api/teacher-assignments", teacherAssignmentsRoutes);
app.use("/api/room-assignments", roomAssignmentsRoutes);
app.use("/api/profile", profileRoutes);
app.use(activityRoutes);

// Connect to MySQL
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "capstone_edusched_app"
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    return;
  }
  console.log("✅ Connected to MySQL Database:", process.env.MYSQL_DATABASE || "capstone_edusched_app");
});

// ============================================================
// POST /api/users — Create new user
// Verifies Firebase ID token before inserting into MySQL.
// Checks emailVerified, role limits, and duplicate accounts.
// ============================================================
app.post("/api/users", async (req, res) => {
  const { uid, full_name, email, role } = req.body;

  // Basic field validation
  if (!uid || !full_name || !email || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Role whitelist
  const VALID_ROLES = ['dean', 'staff', 'instructor'];
  if (!VALID_ROLES.includes(role)) {
    console.warn(`❌ Invalid role attempted: "${role}" for ${email}`);
    return res.status(400).json({ error: "Invalid role" });
  }

  // Server-side email verification check
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && firebaseAdmin) {
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await verifyFirebaseToken(idToken);

    if (!decoded) {
      console.warn(`❌ Invalid token for signup attempt: ${email}`);
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    // Token UID must match request body UID
    if (decoded.uid !== uid) {
      console.warn(`❌ UID mismatch: token=${decoded.uid} body=${uid}`);
      return res.status(403).json({ error: "Token UID mismatch" });
    }

    // Email must be verified in Firebase
    if (!decoded.email_verified) {
      console.warn(`❌ Blocked unverified email signup attempt: ${email}`);
      return res.status(403).json({
        error: "Email not verified",
        message: "You must verify your email before your account can be saved."
      });
    }

    console.log(`✅ Token verified — email is verified for: ${email}`);
  } else {
    console.warn(`⚠️  No token provided for POST /api/users — ${email}`);
  }

  try {
    // Check dean limit (only 1 allowed)
    if (role === 'dean') {
      const [deanRows] = await db.promise().query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'dean'"
      );
      if (deanRows[0].count >= 1) {
        return res.status(400).json({ error: "A Dean account already exists" });
      }
    }

    // Check staff limit (max 4)
    if (role === 'staff') {
      const [staffRows] = await db.promise().query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'staff'"
      );
      if (staffRows[0].count >= 4) {
        return res.status(400).json({ error: "Maximum of 4 Staff accounts reached" });
      }
    }

    // Check for duplicate uid or email
    const [existing] = await db.promise().query(
      "SELECT uid FROM users WHERE uid = ? OR email = ?",
      [uid, email]
    );
    if (existing.length > 0) {
      console.log(`ℹ️  User already exists in DB: ${email}`);
      return res.status(200).json({ message: "User already registered" });
    }

    // Insert into MySQL
    await db.promise().query(
      "INSERT INTO users (uid, full_name, email, role) VALUES (?, ?, ?, ?)",
      [uid, full_name, email, role]
    );
    console.log(`✅ User saved to MySQL: ${email} (${role})`);
    res.status(201).json({ message: "User registered successfully!" });

  } catch (err) {
    console.error("❌ Error inserting user:", err);
    res.status(500).json({ error: "Database insert failed" });
  }
});

// POST /api/login
app.post("/api/login", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const sql = "SELECT uid, full_name, email, role, profile_picture FROM users WHERE email = ?";

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("❌ Database query error:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = results[0];
    console.log('✅ Login successful for:', user.email);

    res.json({
      uid: user.uid,
      id: user.uid,
      email: user.email,
      role: user.role,
      displayName: user.full_name,
      full_name: user.full_name,
      photoURL: user.profile_picture
    });
  });
});

// GET /api/users
app.get("/api/users", (req, res) => {
  db.query("SELECT * FROM users", (err, results) => {
    if (err) {
      console.error("❌ Error fetching users:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(results);
  });
});

// GET /api/users/:uid
app.get("/api/users/:uid", (req, res) => {
  const { uid } = req.params;

  const sql = `
    SELECT 
      u.uid, 
      u.full_name, 
      u.email, 
      u.role,
      u.profile_picture,
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

    const user = results[0];
    res.json({
      uid: user.uid,
      id: user.uid,
      displayName: user.full_name,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      photoURL: user.profile_picture,
      instructor_id: user.instructor_id
    });
  });
});

// GET /api/users/:uid/profile
app.get("/api/users/:uid/profile", (req, res) => {
  const { uid } = req.params;

  const sql = `
    SELECT 
      u.uid, 
      u.full_name, 
      u.email, 
      u.role,
      u.profile_picture,
      u.created_at,
      i.id AS instructor_id
    FROM users u
    LEFT JOIN instructors i ON u.full_name = i.name
    WHERE u.uid = ?
  `;

  db.query(sql, [uid], (err, results) => {
    if (err) {
      console.error("❌ Error fetching user profile:", err);
      return res.status(500).json({ success: false, error: "Database query failed" });
    }
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = results[0];
    res.json({
      success: true,
      user: {
        uid: user.uid,
        id: user.uid,
        full_name: user.full_name,
        displayName: user.full_name,
        email: user.email,
        role: user.role,
        profile_picture: user.profile_picture,
        photoURL: user.profile_picture,
        created_at: user.created_at,
        instructor_id: user.instructor_id
      }
    });
  });
});

// PUT /api/users/:uid
app.put("/api/users/:uid", (req, res) => {
  const { uid } = req.params;
  const { role } = req.body;

  console.log('Updating role for user:', uid, 'to:', role);

  db.query("UPDATE users SET role = ? WHERE uid = ?", [role, uid], (err, result) => {
    if (err) {
      console.error("❌ Error updating role:", err);
      return res.status(500).json({ error: "Database update failed" });
    }
    console.log('✅ Role updated, rows affected:', result.affectedRows);
    res.json({ message: "Role updated successfully" });
  });
});

// DELETE /api/users/:uid
app.delete("/api/users/:uid", (req, res) => {
  const { uid } = req.params;

  console.log('Deleting user:', uid);

  db.query("DELETE FROM users WHERE uid = ?", [uid], (err, result) => {
    if (err) {
      console.error("❌ Error deleting user:", err);
      return res.status(500).json({ error: "Database delete failed" });
    }
    console.log('✅ User deleted, rows affected:', result.affectedRows);
    res.json({ message: "User deleted successfully" });
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
