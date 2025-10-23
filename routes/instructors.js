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

//New
//✅ edusched-backend/routes/instructors.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // MySQL connection pool

// 🔹 GET /api/instructors -> returns all instructors with nested timeslots
router.get("/", (req, res) => {
  const sql = `
    SELECT i.id, i.name, i.course_id, c.code AS course_code, c.name AS course_name
    FROM instructors i
    LEFT JOIN courses c ON i.course_id = c.id
    ORDER BY i.id DESC
  `;

  db.query(sql, (err, instructors) => {
    if (err) {
      console.error("Error fetching instructors:", err);
      return res.status(500).json({ error: "Database error" });
    }

    const ids = instructors.map((i) => i.id);
    if (!ids.length) return res.json([]); // no instructors yet

    db.query(
      "SELECT id, instructor_id AS instructorId, day, start_time AS start, end_time AS end FROM instructor_timeslots WHERE instructor_id IN (?)",
      [ids],
      (err2, slots) => {
        if (err2) {
          console.error("Error fetching timeslots:", err2);
          return res.status(500).json({ error: "Database error" });
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

// 🔹 POST /api/instructors -> create instructor
router.post("/", (req, res) => {
  const { name, courseId } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "Name required" });

  const sql = "INSERT INTO instructors (name, course_id) VALUES (?, ?)";
  db.query(sql, [name.trim(), courseId || null], (err, result) => {
    if (err) {
      console.error("Error inserting instructor:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({
      success: true,
      instructorId: result.insertId,
      name: name.trim(),
      courseId: courseId || null,
    });
  });
});

// 🔹 POST /api/instructors/:id/timeslots -> bulk insert timeslots
router.post("/:id/timeslots", (req, res) => {
  const instructorId = Number(req.params.id);
  const { timeslots } = req.body; // expect array [{day,start,end}, ...]

  if (!instructorId)
    return res.status(400).json({ error: "Invalid instructor id" });
  if (!Array.isArray(timeslots))
    return res.status(400).json({ error: "timeslots must be array" });

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

// 🔹 GET /api/instructors/:id/schedule -> get schedule for specific instructor
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

// ✅ NEW: GET /api/instructors/:id -> get instructor details for profile
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
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
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error fetching instructor profile:", err);
    res
      .status(500)
      .json({ message: "Server error fetching instructor profile" });
  }
});
// ✅ GET instructors by course (consistent naming)
router.get("/byCourse/:courseId", async (req, res) => {
  const { courseId } = req.params;
  console.log("📥 Received request for instructors by course:", courseId);

  try {
    const [rows] = await db.query(
      `SELECT i.id, i.name AS instructor_name
       FROM instructors i
       WHERE i.course_id = ?`,
      [courseId]
    );

    console.log("✅ Found instructors:", rows);
    res.json(Array.isArray(rows) ? rows : [rows]);
 // always send an array
  } catch (error) {
    console.error("❌ Error fetching instructors by course:", error);
    res.status(500).json({ message: "Error fetching instructors for course." });
  }
});

router.get('/:instructorId/schedules', (req, res) => {
  const instructorId = req.params.instructorId;

  const sql = `
    SELECT 
      sch.id,
      c.name AS course_name,
      sec.name AS section_name,
      sch.year_level,
      subj.subject_code,
      
      r.name AS room_name,
      sch.day,
      sch.slot_index
    FROM schedule sch
    JOIN courses c ON sch.course_id = c.id
    LEFT JOIN sections sec ON sch.section_id = sec.id
    LEFT JOIN subjects subj ON sch.subject_id = subj.id
    LEFT JOIN rooms r ON sch.room_id = r.id
    WHERE sch.instructor_id = ?
  `;

  db.query(sql, [instructorId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching instructor schedules:", err);
      return res.status(500).json({ message: "Error fetching instructor schedules." });
    }

    console.log(`✅ Instructor ${instructorId} schedule results:`, results);
    res.json(results);
  });
});

// ✅ Assign course to instructor
router.post("/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({ message: "Course ID is required" });
  }

  try {
    // Check if instructor exists
    const [instructor] = await db.query("SELECT * FROM instructors WHERE id = ?", [id]);
    if (instructor.length === 0)
      return res.status(404).json({ message: "Instructor not found" });

    // Optional: Store assignment in a pivot table
    await db.query(
      "INSERT INTO instructor_courses (instructor_id, course_id) VALUES (?, ?)",
      [id, course_id]
    );

    res.json({ message: "Course assigned successfully" });
  } catch (err) {
    console.error("Error assigning course:", err);
    res.status(500).json({ message: "Failed to assign course" });
  }
});
// ✅ Assign course to instructor
router.post("/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({ message: "Course ID is required" });
  }

  try {
    // Check if instructor exists
    const [instructor] = await db.query("SELECT * FROM instructors WHERE id = ?", [id]);
    if (instructor.length === 0)
      return res.status(404).json({ message: "Instructor not found" });

    // Optional: Store assignment in a pivot table
    await db.query(
      "INSERT INTO instructor_courses (instructor_id, course_id) VALUES (?, ?)",
      [id, course_id]
    );

    res.json({ message: "Course assigned successfully" });
  } catch (err) {
    console.error("Error assigning course:", err);
    res.status(500).json({ message: "Failed to assign course" });
  }
});
// ✅ Delete instructor
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.query("DELETE FROM instructors WHERE id = ?", [id]);
    res.json({ message: "Instructor deleted successfully" });
  } catch (err) {
    console.error("Error deleting instructor:", err);
    res.status(500).json({ message: "Failed to delete instructor" });
  }
});



module.exports = router;
