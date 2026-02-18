// // edusched-backend/routes/instructors.js
// const express = require('express');
// const router = express.Router();
// const db = require('../db'); // the pool we created

// // GET /api/instructors -> returns instructors with nested timeslots
// router.get('/', (req, res) => {
//   const sql = `
//     SELECT i.id, i.name, i.course_id, c.code AS course_code, c.name AS course_name
//     FROM instructors i
//     LEFT JOIN courses c ON i.course_id = c.id
//     ORDER BY i.id DESC
//   `;

//   db.query(sql, (err, instructors) => {
//     if (err) {
//       console.error('Error fetching instructors:', err);
//       return res.status(500).json({ error: 'Database error' });
//     }

//     const ids = instructors.map((i) => i.id);
//     if (!ids.length) return res.json([]); // no instructors yet

//     db.query(
//       'SELECT id, instructor_id AS instructorId, day, start_time AS start, end_time AS end FROM instructor_timeslots WHERE instructor_id IN (?)',
//       [ids],
//       (err2, slots) => {
//         if (err2) {
//           console.error('Error fetching timeslots:', err2);
//           return res.status(500).json({ error: 'Database error' });
//         }

//         // group timeslots by instructorId
//         const byInstructor = {};
//         slots.forEach((s) => {
//           byInstructor[s.instructorId] = byInstructor[s.instructorId] || [];
//           byInstructor[s.instructorId].push({
//             id: s.id,
//             day: s.day,
//             start: s.start,
//             end: s.end,
//           });
//         });

//         const result = instructors.map((ins) => ({
//           ...ins,
//           timeslots: byInstructor[ins.id] || [],
//         }));

//         res.json(result);
//       }
//     );
//   });
// });

// // POST /api/instructors -> create instructor, return inserted id
// router.post('/', (req, res) => {
//   const { name, courseId } = req.body;
//   if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

//   const sql = 'INSERT INTO instructors (name, course_id) VALUES (?, ?)';
//   db.query(sql, [name.trim(), courseId || null], (err, result) => {
//     if (err) {
//       console.error('Error inserting instructor:', err);
//       return res.status(500).json({ error: 'Database error' });
//     }
//     res.json({ success: true, instructorId: result.insertId, name: name.trim(), courseId: courseId || null });
//   });
// });

// // POST /api/instructors/:id/timeslots -> bulk insert timeslots for instructor
// router.post('/:id/timeslots', (req, res) => {
//   const instructorId = Number(req.params.id);
//   const { timeslots } = req.body; // expect array [{day,start,end}, ...]

//   if (!instructorId) return res.status(400).json({ error: 'Invalid instructor id' });
//   if (!Array.isArray(timeslots)) return res.status(400).json({ error: 'timeslots must be array' });

//   // filter timeslots to valid days or non-empty entries
//   const values = timeslots
//     .filter((t) => t && t.day)
//     .map((t) => [instructorId, t.day, t.start || null, t.end || null]);

//   if (!values.length) return res.json({ success: true, inserted: 0 });

//   const sql = 'INSERT INTO instructor_timeslots (instructor_id, day, start_time, end_time) VALUES ?';
//   db.query(sql, [values], (err, result) => {
//     if (err) {
//       console.error('Error inserting timeslots:', err);
//       return res.status(500).json({ error: 'Database error' });
//     }
//     res.json({ success: true, inserted: result.affectedRows });
//   });
// });

// // 🔹 Get schedule for a specific instructor
// router.get("/:id/schedule", async (req, res) => {
//   const { id } = req.params;
//   try {
//     const [rows] = await db.query(
//       `SELECT s.day, s.slot_index, sub.code AS subject_code, r.name AS room_name
//        FROM schedule s
//        JOIN subjects sub ON s.subject_id = sub.id
//        LEFT JOIN rooms r ON s.room_id = r.id
//        WHERE s.instructor_id = ?`,
//       [id]
//     );
//     res.json(rows);
//   } catch (err) {
//     console.error("Error fetching instructor schedule:", err);
//     res.status(500).json({ error: "Failed to fetch schedule" });
//   }
// });

// module.exports = router;

//FUNCTIONAL
//edusched-backend/routes/instructors.js
// const express = require('express');
// const router = express.Router();
// const db = require('../db'); // the pool we created

// // GET /api/instructors -> returns instructors with nested timeslots
// router.get('/', (req, res) => {
//   const sql = `
//     SELECT i.id, i.name, i.course_id, c.code AS course_code, c.name AS course_name
//     FROM instructors i
//     LEFT JOIN courses c ON i.course_id = c.id
//     ORDER BY i.id DESC
//   `;

//   db.query(sql, (err, instructors) => {
//     if (err) {
//       console.error('Error fetching instructors:', err);
//       return res.status(500).json({ error: 'Database error' });
//     }

//     const ids = instructors.map((i) => i.id);
//     if (!ids.length) return res.json([]); // no instructors yet

//     db.query(
//       'SELECT id, instructor_id AS instructorId, day, start_time AS start, end_time AS end FROM instructor_timeslots WHERE instructor_id IN (?)',
//       [ids],
//       (err2, slots) => {
//         if (err2) {
//           console.error('Error fetching timeslots:', err2);
//           return res.status(500).json({ error: 'Database error' });
//         }

//         // group timeslots by instructorId
//         const byInstructor = {};
//         slots.forEach((s) => {
//           byInstructor[s.instructorId] = byInstructor[s.instructorId] || [];
//           byInstructor[s.instructorId].push({
//             id: s.id,
//             day: s.day,
//             start: s.start,
//             end: s.end,
//           });
//         });

//         const result = instructors.map((ins) => ({
//           ...ins,
//           timeslots: byInstructor[ins.id] || [],
//         }));

//         res.json(result);
//       }
//     );
//   });
// });

// // POST /api/instructors -> create instructor, return inserted id
// router.post('/', (req, res) => {
//   const { name, courseId } = req.body;
//   if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

//   const sql = 'INSERT INTO instructors (name, course_id) VALUES (?, ?)';
//   db.query(sql, [name.trim(), courseId || null], (err, result) => {
//     if (err) {
//       console.error('Error inserting instructor:', err);
//       return res.status(500).json({ error: 'Database error' });
//     }
//     res.json({ success: true, instructorId: result.insertId, name: name.trim(), courseId: courseId || null });
//   });
// });

// // POST /api/instructors/:id/timeslots -> bulk insert timeslots for instructor
// router.post('/:id/timeslots', (req, res) => {
//   const instructorId = Number(req.params.id);
//   const { timeslots } = req.body; // expect array [{day,start,end}, ...]

//   if (!instructorId) return res.status(400).json({ error: 'Invalid instructor id' });
//   if (!Array.isArray(timeslots)) return res.status(400).json({ error: 'timeslots must be array' });

//   // filter timeslots to valid days or non-empty entries
//   const values = timeslots
//     .filter((t) => t && t.day)
//     .map((t) => [instructorId, t.day, t.start || null, t.end || null]);

//   if (!values.length) return res.json({ success: true, inserted: 0 });

//   const sql = 'INSERT INTO instructor_timeslots (instructor_id, day, start_time, end_time) VALUES ?';
//   db.query(sql, [values], (err, result) => {
//     if (err) {
//       console.error('Error inserting timeslots:', err);
//       return res.status(500).json({ error: 'Database error' });
//     }
//     res.json({ success: true, inserted: result.affectedRows });
//   });
// });

// // 🔹 Get schedule for a specific instructor
// router.get("/:id/schedule", (req, res) => {
//   const { id } = req.params;
//   const sql = `
//     SELECT s.id, s.day, s.slot_index,
//            sub.subject_code, sub.description AS subject_name,
//            r.name AS room_name,
//            sec.name AS section_name
//     FROM schedule s
//     JOIN subjects sub ON s.subject_id = sub.id
//     LEFT JOIN rooms r ON s.room_id = r.id
//     LEFT JOIN sections sec ON s.section_id = sec.id
//     WHERE s.instructor_id = ?
//   `;
//   db.query(sql, [id], (err, rows) => {
//     if (err) {
//       console.error("Error fetching instructor schedule:", err);
//       return res.status(500).json({ error: "Failed to fetch schedule" });
//     }
//     res.json(rows);
//   });
// });

// //add
// // 🔹 Get instructor by email
// router.get("/by-email/:email", (req, res) => {
//   const { email } = req.params;

//   const sql = "SELECT * FROM instructors WHERE email = ?";
//   db.query(sql, [email], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching instructor by email:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     if (results.length === 0) {
//       return res.status(404).json({ error: "Instructor not found" });
//     }

//     res.json(results[0]); // ✅ return the first instructor found
//   });
// });

// module.exports = router;

//New FUNCTIONAL WITHOUT EDIT NAME OF INSTRUCTOR

//✅ edusched-backend/routes/instructors.js
// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // MySQL connection pool

// // 🔹 GET /api/instructors -> returns all instructors with nested timeslots
// router.get("/", (req, res) => {
//   const sql = `
//     SELECT i.id, i.name, i.course_id, c.code AS course_code, c.name AS course_name
//     FROM instructors i
//     LEFT JOIN courses c ON i.course_id = c.id
//     ORDER BY i.id DESC
//   `;

//   db.query(sql, (err, instructors) => {
//     if (err) {
//       console.error("Error fetching instructors:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     const ids = instructors.map((i) => i.id);
//     if (!ids.length) return res.json([]); // no instructors yet

//     db.query(
//       "SELECT id, instructor_id AS instructorId, day, start_time AS start, end_time AS end FROM instructor_timeslots WHERE instructor_id IN (?)",
//       [ids],
//       (err2, slots) => {
//         if (err2) {
//           console.error("Error fetching timeslots:", err2);
//           return res.status(500).json({ error: "Database error" });
//         }

//         // group timeslots by instructorId
//         const byInstructor = {};
//         slots.forEach((s) => {
//           byInstructor[s.instructorId] = byInstructor[s.instructorId] || [];
//           byInstructor[s.instructorId].push({
//             id: s.id,
//             day: s.day,
//             start: s.start,
//             end: s.end,
//           });
//         });

//         const result = instructors.map((ins) => ({
//           ...ins,
//           timeslots: byInstructor[ins.id] || [],
//         }));

//         res.json(result);
//       }
//     );
//   });
// });

// // 🔹 POST /api/instructors -> create instructor
// router.post("/", (req, res) => {
//   const { name, courseId } = req.body;
//   if (!name || !name.trim())
//     return res.status(400).json({ error: "Name required" });

//   const sql = "INSERT INTO instructors (name, course_id) VALUES (?, ?)";
//   db.query(sql, [name.trim(), courseId || null], (err, result) => {
//     if (err) {
//       console.error("Error inserting instructor:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json({
//       success: true,
//       instructorId: result.insertId,
//       name: name.trim(),
//       courseId: courseId || null,
//     });
//   });
// });

// // 🔹 POST /api/instructors/:id/timeslots -> bulk insert timeslots
// router.post("/:id/timeslots", (req, res) => {
//   const instructorId = Number(req.params.id);
//   const { timeslots } = req.body; // expect array [{day,start,end}, ...]

//   if (!instructorId)
//     return res.status(400).json({ error: "Invalid instructor id" });
//   if (!Array.isArray(timeslots))
//     return res.status(400).json({ error: "timeslots must be array" });

//   const values = timeslots
//     .filter((t) => t && t.day)
//     .map((t) => [instructorId, t.day, t.start || null, t.end || null]);

//   if (!values.length) return res.json({ success: true, inserted: 0 });

//   const sql =
//     "INSERT INTO instructor_timeslots (instructor_id, day, start_time, end_time) VALUES ?";
//   db.query(sql, [values], (err, result) => {
//     if (err) {
//       console.error("Error inserting timeslots:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json({ success: true, inserted: result.affectedRows });
//   });
// });

// // 🔹 GET /api/instructors/:id/schedule -> get schedule for specific instructor
// router.get("/:id/schedule", (req, res) => {
//   const { id } = req.params;
//   const sql = `
//     SELECT s.id, s.day, s.slot_index,
//            sub.subject_code, sub.description AS subject_name,
//            r.name AS room_name,
//            sec.name AS section_name
//     FROM schedule s
//     JOIN subjects sub ON s.subject_id = sub.id
//     LEFT JOIN rooms r ON s.room_id = r.id
//     LEFT JOIN sections sec ON s.section_id = sec.id
//     WHERE s.instructor_id = ?
//   `;
//   db.query(sql, [id], (err, rows) => {
//     if (err) {
//       console.error("Error fetching instructor schedule:", err);
//       return res.status(500).json({ error: "Failed to fetch schedule" });
//     }
//     res.json(rows);
//   });
// });

// // ✅ NEW: GET /api/instructors/:id -> get instructor details for profile
// router.get("/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const [rows] = await db.query(
//       `SELECT 
//          i.id,
//          i.name AS full_name,
//          u.email,
//          u.role,
//          u.profile_pic,
//          u.photo_url
//        FROM instructors i
//        LEFT JOIN users u ON u.full_name = i.name
//        WHERE i.id = ?`,
//       [id]
//     );

//     if (!rows || rows.length === 0) {
//       return res.status(404).json({ message: "Instructor not found" });
//     }

//     res.json(rows[0]);
//   } catch (err) {
//     console.error("❌ Error fetching instructor profile:", err);
//     res
//       .status(500)
//       .json({ message: "Server error fetching instructor profile" });
//   }
// });
// // ✅ GET instructors by course (consistent naming)
// router.get("/byCourse/:courseId", async (req, res) => {
//   const { courseId } = req.params;
//   console.log("📥 Received request for instructors by course:", courseId);

//   try {
//     const [rows] = await db.query(
//       `SELECT i.id, i.name AS instructor_name
//        FROM instructors i
//        WHERE i.course_id = ?`,
//       [courseId]
//     );

//     console.log("✅ Found instructors:", rows);
//     res.json(Array.isArray(rows) ? rows : [rows]);
//  // always send an array
//   } catch (error) {
//     console.error("❌ Error fetching instructors by course:", error);
//     res.status(500).json({ message: "Error fetching instructors for course." });
//   }
// });

// router.get('/:instructorId/schedules', (req, res) => {
//   const instructorId = req.params.instructorId;

//   const sql = `
//     SELECT 
//       sch.id,
//       c.name AS course_name,
//       sec.name AS section_name,
//       sch.year_level,
//       subj.subject_code,
      
//       r.name AS room_name,
//       sch.day,
//       sch.slot_index
//     FROM schedule sch
//     JOIN courses c ON sch.course_id = c.id
//     LEFT JOIN sections sec ON sch.section_id = sec.id
//     LEFT JOIN subjects subj ON sch.subject_id = subj.id
//     LEFT JOIN rooms r ON sch.room_id = r.id
//     WHERE sch.instructor_id = ?
//   `;

//   db.query(sql, [instructorId], (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching instructor schedules:", err);
//       return res.status(500).json({ message: "Error fetching instructor schedules." });
//     }

//     console.log(`✅ Instructor ${instructorId} schedule results:`, results);
//     res.json(results);
//   });
// });

// // ✅ Assign course to instructor
// router.post("/:id/assign", async (req, res) => {
//   const { id } = req.params;
//   const { course_id } = req.body;

//   if (!course_id) {
//     return res.status(400).json({ message: "Course ID is required" });
//   }

//   try {
//     // Check if instructor exists
//     const [instructor] = await db.query("SELECT * FROM instructors WHERE id = ?", [id]);
//     if (instructor.length === 0)
//       return res.status(404).json({ message: "Instructor not found" });

//     // Optional: Store assignment in a pivot table
//     await db.query(
//       "INSERT INTO instructor_courses (instructor_id, course_id) VALUES (?, ?)",
//       [id, course_id]
//     );

//     res.json({ message: "Course assigned successfully" });
//   } catch (err) {
//     console.error("Error assigning course:", err);
//     res.status(500).json({ message: "Failed to assign course" });
//   }
// });
// // ✅ Assign course to instructor
// router.post("/:id/assign", async (req, res) => {
//   const { id } = req.params;
//   const { course_id } = req.body;

//   if (!course_id) {
//     return res.status(400).json({ message: "Course ID is required" });
//   }

//   try {
//     // Check if instructor exists
//     const [instructor] = await db.query("SELECT * FROM instructors WHERE id = ?", [id]);
//     if (instructor.length === 0)
//       return res.status(404).json({ message: "Instructor not found" });

//     // Optional: Store assignment in a pivot table
//     await db.query(
//       "INSERT INTO instructor_courses (instructor_id, course_id) VALUES (?, ?)",
//       [id, course_id]
//     );

//     res.json({ message: "Course assigned successfully" });
//   } catch (err) {
//     console.error("Error assigning course:", err);
//     res.status(500).json({ message: "Failed to assign course" });
//   }
// });
// // ✅ Delete instructor
// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     await db.query("DELETE FROM instructors WHERE id = ?", [id]);
//     res.json({ message: "Instructor deleted successfully" });
//   } catch (err) {
//     console.error("Error deleting instructor:", err);
//     res.status(500).json({ message: "Failed to delete instructor" });
//   }
// });

// // Replace your existing /:instructorId/schedules route with this improved version
// //add

// router.get('/:instructorId/schedules', (req, res) => {
//   const instructorId = req.params.instructorId;
//   const { courseId, yearLevel, semester } = req.query;

//   console.log(`📥 Fetching schedules for instructor ${instructorId}`, { courseId, yearLevel, semester });

//   let sql = `
//     SELECT 
//       sch.id,
//       sch.course_id,
//       c.name AS course_name,
//       c.code AS course_code,
//       sec.name AS section_name,
//       sch.year_level,
//       sch.semester,
//       sch.subject_id,
//       subj.subject_code,
//       subj.description AS subject_name,
//       r.name AS room_name,
//       sch.day,
//       sch.slot_index,
//       sch.start_time,
//       sch.end_time
//     FROM schedule sch
//     JOIN courses c ON sch.course_id = c.id
//     LEFT JOIN sections sec ON sch.section_id = sec.id
//     LEFT JOIN subjects subj ON sch.subject_id = subj.id
//     LEFT JOIN rooms r ON sch.room_id = r.id
//     WHERE sch.instructor_id = ?
//   `;

//   const params = [instructorId];

//   // Add optional filters
//   if (courseId) {
//     sql += ' AND sch.course_id = ?';
//     params.push(courseId);
//   }
//   if (yearLevel) {
//     sql += ' AND sch.year_level = ?';
//     params.push(yearLevel);
//   }
//   if (semester) {
//     sql += ' AND sch.semester = ?';
//     params.push(semester);
//   }

//   sql += ' ORDER BY FIELD(sch.day, "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"), sch.slot_index';

//   db.query(sql, params, (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching instructor schedules:", err);
//       return res.status(500).json({ message: "Error fetching instructor schedules." });
//     }

//     console.log(`✅ Instructor ${instructorId} schedule results:`, results?.length || 0, 'entries');
//     res.json(results || []);
//   });
// });

// module.exports = router;

// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // MySQL connection pool

// // 🔹 GET /api/instructors -> returns all instructors with course details
// router.get("/", (req, res) => {
//   const sql = `
//     SELECT i.id, i.name, i.course_id, c.code AS course_code, c.name AS course_name
//     FROM instructors i
//     LEFT JOIN courses c ON i.course_id = c.id
//     ORDER BY i.id DESC
//   `;

//   db.query(sql, (err, instructors) => {
//     if (err) {
//       console.error("Error fetching instructors:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     const ids = instructors.map((i) => i.id);
//     if (!ids.length) return res.json([]); // no instructors yet

//     db.query(
//       "SELECT id, instructor_id AS instructorId, day, start_time AS start, end_time AS end FROM instructor_timeslots WHERE instructor_id IN (?)",
//       [ids],
//       (err2, slots) => {
//         if (err2) {
//           console.error("Error fetching timeslots:", err2);
//           return res.status(500).json({ error: "Database error" });
//         }

//         // group timeslots by instructorId
//         const byInstructor = {};
//         slots.forEach((s) => {
//           byInstructor[s.instructorId] = byInstructor[s.instructorId] || [];
//           byInstructor[s.instructorId].push({
//             id: s.id,
//             day: s.day,
//             start: s.start,
//             end: s.end,
//           });
//         });

//         const result = instructors.map((ins) => ({
//           ...ins,
//           timeslots: byInstructor[ins.id] || [],
//         }));

//         res.json(result);
//       }
//     );
//   });
// });

// // 🔹 POST /api/instructors -> create new instructor
// router.post("/", (req, res) => {
//   const { name, course_id } = req.body; // frontend now sends course_id

//   if (!name || !name.trim()) {
//     return res.status(400).json({ error: "Name required" });
//   }

//   const sql = "INSERT INTO instructors (name, course_id) VALUES (?, ?)";
//   db.query(sql, [name.trim(), course_id || null], (err, result) => {
//     if (err) {
//       console.error("Error inserting instructor:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     res.json({
//       id: result.insertId,
//       name: name.trim(),
//       course_id: course_id || null,
//     });
//   });
// });

// // 🔹 PUT /api/instructors/:id -> UPDATE instructor (THIS WAS MISSING!)
// router.put("/:id", (req, res) => {
//   const { id } = req.params;
//   const { name, course_id } = req.body;

//   if (!name || !name.trim()) {
//     return res.status(400).json({ error: "Instructor name is required" });
//   }

//   const trimmedName = name.trim();
//   const courseId = course_id !== undefined ? course_id : null;

//   const sql = `
//     UPDATE instructors 
//     SET name = ?, course_id = ? 
//     WHERE id = ?
//   `;

//   db.query(sql, [trimmedName, courseId, id], (err, result) => {
//     if (err) {
//       console.error("Error updating instructor:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: "Instructor not found" });
//     }

//     res.json({
//       id: Number(id),
//       name: trimmedName,
//       course_id: courseId,
//     });
//   });
// });

// // 🔹 DELETE /api/instructors/:id -> delete instructor
// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await db.query("DELETE FROM instructors WHERE id = ?", [id]);
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Instructor not found" });
//     }
//     res.json({ message: "Instructor deleted successfully" });
//   } catch (err) {
//     console.error("Error deleting instructor:", err);
//     res.status(500).json({ message: "Failed to delete instructor" });
//   }
// });

// // 🔹 POST /api/instructors/:id/timeslots -> bulk insert timeslots
// router.post("/:id/timeslots", (req, res) => {
//   const instructorId = Number(req.params.id);
//   const { timeslots } = req.body;

//   if (!instructorId) {
//     return res.status(400).json({ error: "Invalid instructor id" });
//   }
//   if (!Array.isArray(timeslots)) {
//     return res.status(400).json({ error: "timeslots must be array" });
//   }

//   const values = timeslots
//     .filter((t) => t && t.day)
//     .map((t) => [instructorId, t.day, t.start || null, t.end || null]);

//   if (!values.length) return res.json({ success: true, inserted: 0 });

//   const sql =
//     "INSERT INTO instructor_timeslots (instructor_id, day, start_time, end_time) VALUES ?";
//   db.query(sql, [values], (err, result) => {
//     if (err) {
//       console.error("Error inserting timeslots:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json({ success: true, inserted: result.affectedRows });
//   });
// });

// // 🔹 GET /api/instructors/:id/schedule -> get assigned classes
// router.get("/:id/schedule", (req, res) => {
//   const { id } = req.params;
//   const sql = `
//     SELECT s.id, s.day, s.slot_index,
//            sub.subject_code, sub.description AS subject_name,
//            r.name AS room_name,
//            sec.name AS section_name
//     FROM schedule s
//     JOIN subjects sub ON s.subject_id = sub.id
//     LEFT JOIN rooms r ON s.room_id = r.id
//     LEFT JOIN sections sec ON s.section_id = sec.id
//     WHERE s.instructor_id = ?
//   `;
//   db.query(sql, [id], (err, rows) => {
//     if (err) {
//       console.error("Error fetching instructor schedule:", err);
//       return res.status(500).json({ error: "Failed to fetch schedule" });
//     }
//     res.json(rows);
//   });
// });

// // 🔹 GET /api/instructors/:id -> get single instructor profile
// router.get("/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const [rows] = await db.query(
//       `SELECT 
//          i.id,
//          i.name AS full_name,
//          u.email,
//          u.role,
//          u.profile_pic,
//          u.photo_url
//        FROM instructors i
//        LEFT JOIN users u ON u.full_name = i.name
//        WHERE i.id = ?`,
//       [id]
//     );

//     if (!rows || rows.length === 0) {
//       return res.status(404).json({ message: "Instructor not found" });
//     }

//     res.json(rows[0]);
//   } catch (err) {
//     console.error("Error fetching instructor profile:", err);
//     res.status(500).json({ message: "Server error fetching instructor profile" });
//   }
// });

// // 🔹 GET /api/instructors/byCourse/:courseId -> get instructors by course
// router.get("/byCourse/:courseId", async (req, res) => {
//   const { courseId } = req.params;

//   try {
//     const [rows] = await db.query(
//       `SELECT i.id, i.name AS instructor_name
//        FROM instructors i
//        WHERE i.course_id = ?`,
//       [courseId]
//     );

//     res.json(rows || []);
//   } catch (error) {
//     console.error("Error fetching instructors by course:", error);
//     res.status(500).json({ message: "Error fetching instructors for course." });
//   }
// });

// // 🔹 GET /api/instructors/:instructorId/schedules -> detailed schedules
// router.get('/:instructorId/schedules', (req, res) => {
//   const instructorId = req.params.instructorId;
//   const { courseId, yearLevel, semester } = req.query;

//   let sql = `
//     SELECT 
//       sch.id,
//       sch.course_id,
//       c.name AS course_name,
//       c.code AS course_code,
//       sec.name AS section_name,
//       sch.year_level,
//       sch.semester,
//       sch.subject_id,
//       subj.subject_code,
//       subj.description AS subject_name,
//       r.name AS room_name,
//       sch.day,
//       sch.slot_index,
//       sch.start_time,
//       sch.end_time
//     FROM schedule sch
//     JOIN courses c ON sch.course_id = c.id
//     LEFT JOIN sections sec ON sch.section_id = sec.id
//     LEFT JOIN subjects subj ON sch.subject_id = subj.id
//     LEFT JOIN rooms r ON sch.room_id = r.id
//     WHERE sch.instructor_id = ?
//   `;

//   const params = [instructorId];

//   if (courseId) {
//     sql += ' AND sch.course_id = ?';
//     params.push(courseId);
//   }
//   if (yearLevel) {
//     sql += ' AND sch.year_level = ?';
//     params.push(yearLevel);
//   }
//   if (semester) {
//     sql += ' AND sch.semester = ?';
//     params.push(semester);
//   }

//   sql += ' ORDER BY FIELD(sch.day, "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"), sch.slot_index';

//   db.query(sql, params, (err, results) => {
//     if (err) {
//       console.error("Error fetching instructor schedules:", err);
//       return res.status(500).json({ message: "Error fetching instructor schedules." });
//     }
//     res.json(results || []);
//   });
// });

const express = require("express");
const router = express.Router();
const db = require("../db"); // MySQL connection pool

// 🔹 GET /api/instructors -> returns all instructors with course details AND EMAIL
router.get("/", (req, res) => {
  const sql = `
    SELECT 
      i.id, 
      i.name,
      i.course_id, 
      c.code AS course_code, 
      c.name AS course_name,
      u.email,
      u.full_name
    FROM instructors i
    LEFT JOIN courses c ON i.course_id = c.id
    LEFT JOIN users u ON u.full_name = i.name
    ORDER BY i.id DESC
  `;

  db.query(sql, (err, instructors) => {
    if (err) {
      console.error("Error fetching instructors:", err);
      console.error("SQL Error Code:", err.code);
      console.error("SQL Error Message:", err.sqlMessage);
      return res.status(500).json({ error: "Database error", details: err.sqlMessage });
    }

    const ids = instructors.map((i) => i.id);
    if (!ids.length) return res.json([]); // no instructors yet

    db.query(
      "SELECT id, instructor_id AS instructorId, day, start_time AS start, end_time AS end FROM instructor_timeslots WHERE instructor_id IN (?)",
      [ids],
      (err2, slots) => {
        if (err2) {
          console.error("Error fetching timeslots:", err2);
          // Don't fail completely if timeslots fail, just return without them
          return res.json(instructors.map(ins => ({ ...ins, timeslots: [] })));
        }

        // group timeslots by instructorId
        const byInstructor = {};
        slots.forEach((s) => {
          byInstructor[s.instructorId] = byInstructor[s.instructorId] || [];
          byInstructor[s.instructorId].push({
            id: s.id,
            day: s.day,
            start: s.start,
            end: s.end,
          });
        });

        const result = instructors.map((ins) => ({
          ...ins,
          timeslots: byInstructor[ins.id] || [],
        }));

        res.json(result);
      }
    );
  });
});

// 🔹 POST /api/instructors -> create new instructor AND user record
router.post("/", async (req, res) => {
  const { name, email, course_id } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name required" });
  }

  try {
    // First, check if a user with this email already exists
    if (email && email.trim()) {
      const checkUserSql = "SELECT uid FROM users WHERE email = ?";
      const existingUsers = await new Promise((resolve, reject) => {
        db.query(checkUserSql, [email.trim()], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      // If no user exists with this email, create one
      if (existingUsers.length === 0) {
        const insertUserSql = "INSERT INTO users (full_name, email, role) VALUES (?, ?, ?)";
        await new Promise((resolve, reject) => {
          db.query(insertUserSql, [name.trim(), email.trim(), 'instructor'], (err, result) => {
            if (err) {
              console.error("Error creating user record:", err);
              // Don't fail the whole operation if user creation fails
              resolve(null);
            } else {
              console.log("Created user record for instructor:", name.trim());
              resolve(result);
            }
          });
        });
      }
    }

    // Now insert the instructor
    const sql = "INSERT INTO instructors (name, course_id) VALUES (?, ?)";
    db.query(sql, [name.trim(), course_id || null], (err, result) => {
      if (err) {
        console.error("Error inserting instructor:", err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json({
        id: result.insertId,
        name: name.trim(),
        email: email || null,
        course_id: course_id || null
      });
    });
  } catch (error) {
    console.error("Error in POST /api/instructors:", error);
    return res.status(500).json({ error: "Database error" });
  }
});

// 🔹 PUT /api/instructors/:id -> UPDATE instructor AND user email
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, course_id } = req.body;

  console.log("PUT /api/instructors/:id received:", { id, name, email, course_id });

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Instructor name is required" });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const courseId = course_id !== undefined ? course_id : null;

  try {
    // First, get the current instructor details
    const getCurrentInstructor = () => {
      return new Promise((resolve, reject) => {
        db.query("SELECT name FROM instructors WHERE id = ?", [id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
    };

    const currentInstructor = await getCurrentInstructor();
    
    if (!currentInstructor || currentInstructor.length === 0) {
      return res.status(404).json({ error: "Instructor not found" });
    }

    const oldName = currentInstructor[0].name;
    console.log("Old instructor name:", oldName);
    console.log("New instructor name:", trimmedName);

    // Check if a user already exists with the OLD name
    const checkOldUserSql = "SELECT uid, email FROM users WHERE full_name = ?";
    const oldUserResults = await new Promise((resolve, reject) => {
      db.query(checkOldUserSql, [oldName], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    console.log("Found user with old name:", oldUserResults);

    // Check if the new email is already used by someone else
    const checkEmailSql = "SELECT uid, full_name FROM users WHERE email = ? AND full_name != ?";
    const emailExists = await new Promise((resolve, reject) => {
      db.query(checkEmailSql, [trimmedEmail, oldName], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (emailExists && emailExists.length > 0) {
      return res.status(400).json({ 
        error: "Email already exists", 
        details: `Email ${trimmedEmail} is already used by another user` 
      });
    }

    // Update the instructor table
    const updateInstructorSql = `
      UPDATE instructors 
      SET name = ?, course_id = ? 
      WHERE id = ?
    `;

    await new Promise((resolve, reject) => {
      db.query(updateInstructorSql, [trimmedName, courseId, id], (err, result) => {
        if (err) {
          console.error("Error updating instructor:", err);
          reject(err);
        } else {
          console.log("Updated instructor table successfully");
          resolve(result);
        }
      });
    });

    // Now handle the user table update
    if (oldUserResults && oldUserResults.length > 0) {
      // User exists - update it
      console.log("Updating existing user record");
      const updateUserSql = "UPDATE users SET full_name = ?, email = ? WHERE full_name = ?";
      await new Promise((resolve, reject) => {
        db.query(updateUserSql, [trimmedName, trimmedEmail, oldName], (err, result) => {
          if (err) {
            console.error("Error updating user record:", err);
            // Don't fail the whole operation
            resolve(null);
          } else {
            console.log("Updated user record successfully:", result);
            resolve(result);
          }
        });
      });
    } else {
      // User doesn't exist - create new one
      console.log("Creating new user record");
      const insertUserSql = "INSERT INTO users (full_name, email, role) VALUES (?, ?, ?)";
      await new Promise((resolve, reject) => {
        db.query(insertUserSql, [trimmedName, trimmedEmail, 'instructor'], (err, result) => {
          if (err) {
            console.error("Error creating user record:", err);
            // Don't fail the whole operation
            resolve(null);
          } else {
            console.log("Created new user record successfully");
            resolve(result);
          }
        });
      });
    }

    res.json({
      id: Number(id),
      name: trimmedName,
      email: trimmedEmail,
      course_id: courseId,
      message: "Instructor updated successfully"
    });

  } catch (error) {
    console.error("Error in PUT /api/instructors/:id:", error);
    return res.status(500).json({ error: "Database error", details: error.message });
  }
});

// 🔹 POST /api/instructors/:id/assign -> Assign course to instructor
router.post("/:id/assign", (req, res) => {
  const { id } = req.params;
  const { course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({ error: "course_id is required" });
  }

  const sql = "UPDATE instructors SET course_id = ? WHERE id = ?";
  
  db.query(sql, [course_id, id], (err, result) => {
    if (err) {
      console.error("Error assigning course:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Instructor not found" });
    }

    res.json({
      message: "Course assigned successfully",
      instructor_id: Number(id),
      course_id: course_id
    });
  });
});

// 🔹 DELETE /api/instructors/:id -> delete instructor
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM instructors WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Error deleting instructor:", err);
      return res.status(500).json({ message: "Failed to delete instructor" });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Instructor not found" });
    }
    
    res.json({ message: "Instructor deleted successfully" });
  });
});

// 🔹 POST /api/instructors/:id/timeslots -> bulk insert timeslots
router.post("/:id/timeslots", (req, res) => {
  const instructorId = Number(req.params.id);
  const { timeslots } = req.body;

  if (!instructorId) {
    return res.status(400).json({ error: "Invalid instructor id" });
  }
  if (!Array.isArray(timeslots)) {
    return res.status(400).json({ error: "timeslots must be array" });
  }

  const values = timeslots
    .filter((t) => t && t.day)
    .map((t) => [instructorId, t.day, t.start || null, t.end || null]);

  if (!values.length) return res.json({ success: true, inserted: 0 });

  const sql =
    "INSERT INTO instructor_timeslots (instructor_id, day, start_time, end_time) VALUES ?";
  db.query(sql, [values], (err, result) => {
    if (err) {
      console.error("Error inserting timeslots:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ success: true, inserted: result.affectedRows });
  });
});

// 🔹 GET /api/instructors/:id/schedule -> get assigned classes
router.get("/:id/schedule", (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT s.id, s.day, s.slot_index,
           sub.subject_code, sub.description AS subject_name,
           r.name AS room_name,
           sec.name AS section_name
    FROM schedule s
    JOIN subjects sub ON s.subject_id = sub.id
    LEFT JOIN rooms r ON s.room_id = r.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE s.instructor_id = ?
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) {
      console.error("Error fetching instructor schedule:", err);
      return res.status(500).json({ error: "Failed to fetch schedule" });
    }
    res.json(rows);
  });
});

// 🔹 GET /api/instructors/:id -> get single instructor profile
router.get("/:id", (req, res) => {
  const { id } = req.params;
  
  db.query(
    `SELECT 
       i.id,
       i.name AS full_name,
       u.email,
       u.role,
       u.profile_pic,
       u.photo_url
     FROM instructors i
     LEFT JOIN users u ON u.full_name = i.name
     WHERE i.id = ?`,
    [id],
    (err, rows) => {
      if (err) {
        console.error("Error fetching instructor profile:", err);
        return res.status(500).json({ message: "Server error fetching instructor profile" });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Instructor not found" });
      }

      res.json(rows[0]);
    }
  );
});

// 🔹 GET /api/instructors/byCourse/:courseId -> get instructors by course
router.get("/byCourse/:courseId", (req, res) => {
  const { courseId } = req.params;

  db.query(
    `SELECT i.id, i.name AS instructor_name
     FROM instructors i
     WHERE i.course_id = ?`,
    [courseId],
    (err, rows) => {
      if (err) {
        console.error("Error fetching instructors by course:", err);
        return res.status(500).json({ message: "Error fetching instructors for course." });
      }
      res.json(rows || []);
    }
  );
});

// 🔹 GET /api/instructors/:instructorId/schedules -> detailed schedules
router.get('/:instructorId/schedules', (req, res) => {
  const instructorId = req.params.instructorId;
  const { courseId, yearLevel, semester } = req.query;

  let sql = `
    SELECT 
      sch.id,
      sch.course_id,
      c.name AS course_name,
      c.code AS course_code,
      sec.name AS section_name,
      sch.year_level,
      sch.semester,
      sch.subject_id,
      subj.subject_code,
      subj.description AS subject_name,
      r.name AS room_name,
      sch.day,
      sch.slot_index,
      sch.start_time,
      sch.end_time
    FROM schedule sch
    JOIN courses c ON sch.course_id = c.id
    LEFT JOIN sections sec ON sch.section_id = sec.id
    LEFT JOIN subjects subj ON sch.subject_id = subj.id
    LEFT JOIN rooms r ON sch.room_id = r.id
    WHERE sch.instructor_id = ?
  `;

  const params = [instructorId];

  if (courseId) {
    sql += ' AND sch.course_id = ?';
    params.push(courseId);
  }
  if (yearLevel) {
    sql += ' AND sch.year_level = ?';
    params.push(yearLevel);
  }
  if (semester) {
    sql += ' AND sch.semester = ?';
    params.push(semester);
  }

  sql += ' ORDER BY FIELD(sch.day, "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"), sch.slot_index';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Error fetching instructor schedules:", err);
      return res.status(500).json({ message: "Error fetching instructor schedules." });
    }
    res.json(results || []);
  });
});

module.exports = router;

// // Optional: Assign course via pivot table (if you use many-to-many)
// // Remove if not needed — you had duplicate routes
// // router.post("/:id/assign", async (req, res) => { ... });

module.exports = router;
