//functional
// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // Get schedule for logged-in instructor
// // Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   // Step 1: Find user by email
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err) return res.status(500).json({ error: "DB error (users)", detail: err.message });
//     if (users.length === 0) return res.status(404).json({ error: "User not found" });

//     const fullName = users[0].full_name;


//     // Step 2: Find instructor linked to this user
//     db.query("SELECT id FROM instructors WHERE name = ?", [fullName], (err, instructors) => {
//       if (err) return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
//       if (instructors.length === 0) return res.status(404).json({ error: "Instructor profile not found" });

//       const instructorId = instructors[0].id;

//       // Step 3: Fetch schedule
//       const sql = `
//         SELECT s.id, subj.description AS subject_description, c.name AS course_name, r.name AS room_name, 
//                s.day, s.slot_index AS time_slot
//         FROM schedule s
//         JOIN subjects subj ON s.subject_id = subj.id
//         JOIN courses c ON subj.course_id = c.id
//         JOIN rooms r ON s.room_id = r.id
//         WHERE s.instructor_id = ?`;

//       db.query(sql, [instructorId], (err, schedule) => {
//         if (err) return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
//         res.json(schedule);
//       });
//     });
//   });
// });


    

// module.exports = router;

// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // ✅ Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   // Step 1: Find user by email
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err) return res.status(500).json({ error: "DB error (users)", detail: err.message });
//     if (users.length === 0) return res.status(404).json({ error: "User not found" });

//     const fullName = users[0].full_name;

//     // Step 2: Find instructor linked to this user
//     db.query("SELECT id FROM instructors WHERE name = ?", [fullName], (err, instructors) => {
//       if (err) return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
//       if (instructors.length === 0) return res.status(404).json({ error: "Instructor profile not found" });

//       const instructorId = instructors[0].id;

//       // ✅ Step 3: Fetch full schedule with time and room info
//       const sql = `
//         SELECT 
//           s.id,
//           subj.description AS subject_description,
//           c.name AS course_name,
//           r.name AS room_name,
//           s.day,
//           s.start_time,
//           s.end_time,
//           s.slot_index AS time_slot
//         FROM schedule s
//         JOIN subjects subj ON s.subject_id = subj.id
//         JOIN courses c ON s.course_id = c.id
//         JOIN rooms r ON s.room_id = r.id
//         WHERE s.instructor_id = ?
//         ORDER BY 
//           FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//           s.start_time;
//       `;

//       db.query(sql, [instructorId], (err, schedule) => {
//         if (err) return res.status(500).json({ error: "DB error (schedule)", detail: err.message });

//         if (schedule.length === 0) {
//           return res.json({ error: "No schedule assigned yet." });
//         }

//         res.json(schedule);
//       });
//     });
//   });
// });

// module.exports = router;

//new add
const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ Get schedule for logged-in instructor
router.get("/instructor/:email", (req, res) => {
  const { email } = req.params;

  console.log("🔍 Looking up schedule for email:", email);

  // OPTION 1: Try linking via user_id first (if column exists)
  const sqlWithUserId = `
    SELECT 
      s.id,
      subj.description AS subject_description,
      c.name AS course_name,
      r.name AS room_name,
      s.day,
      s.start_time,
      s.end_time,
      s.slot_index AS time_slot
    FROM users u
    JOIN instructors i ON i.user_id = u.id
    JOIN schedule s ON s.instructor_id = i.id
    JOIN subjects subj ON s.subject_id = subj.id
    JOIN courses c ON s.course_id = c.id
    JOIN rooms r ON s.room_id = r.id
    WHERE u.email = ?
    ORDER BY 
      FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
      s.start_time;
  `;

  db.query(sqlWithUserId, [email], (err, schedule) => {
    // If user_id column doesn't exist, fall back to name matching
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      console.log("⚠️ user_id column not found, falling back to name matching");
      return fallbackNameMatching(email, res);
    }

    if (err) {
      console.error("❌ DB error:", err);
      return res.status(500).json({ error: "Database error", detail: err.message });
    }

    if (schedule.length === 0) {
      console.log("⚠️ No schedule found for email:", email);
      return res.json([]);
    }

    console.log(`✅ Found ${schedule.length} schedule entries`);
    res.json(schedule);
  });
});

// Fallback function for name-based matching
function fallbackNameMatching(email, res) {
  // Step 1: Find user by email
  db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
    if (err) {
      console.error("❌ DB error (users):", err);
      return res.status(500).json({ error: "DB error (users)", detail: err.message });
    }
    
    if (users.length === 0) {
      console.log("❌ User not found for email:", email);
      return res.status(404).json({ error: "User not found" });
    }

    const fullName = users[0].full_name;
    console.log("✅ Found user:", fullName);

    // Step 2: Find instructor linked to this user (case-insensitive)
    db.query(
      "SELECT id FROM instructors WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))",
      [fullName],
      (err, instructors) => {
        if (err) {
          console.error("❌ DB error (instructors):", err);
          return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
        }
        
        if (instructors.length === 0) {
          console.log("❌ Instructor profile not found for name:", fullName);
          
          // 🔍 Debug: Show all instructor names
          db.query("SELECT name FROM instructors LIMIT 10", (err, allInstructors) => {
            if (!err) {
              console.log("📋 Available instructors:", allInstructors.map(i => i.name));
            }
          });
          
          return res.status(404).json({ 
            error: "Instructor profile not found",
            detail: `No instructor record found for: ${fullName}. Please contact admin to create your instructor profile.`
          });
        }

        const instructorId = instructors[0].id;
        console.log("✅ Found instructor ID:", instructorId);

        // Step 3: Fetch schedule
        const sql = `
          SELECT 
            s.id,
            subj.description AS subject_description,
            c.name AS course_name,
            r.name AS room_name,
            s.day,
            s.start_time,
            s.end_time,
            s.slot_index AS time_slot
          FROM schedule s
          JOIN subjects subj ON s.subject_id = subj.id
          JOIN courses c ON s.course_id = c.id
          JOIN rooms r ON s.room_id = r.id
          WHERE s.instructor_id = ?
          ORDER BY 
            FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
            s.start_time;
        `;

        db.query(sql, [instructorId], (err, schedule) => {
          if (err) {
            console.error("❌ DB error (schedule):", err);
            return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
          }

          if (schedule.length === 0) {
            console.log("⚠️ No schedule assigned for instructor ID:", instructorId);
            return res.json([]);
          }

          console.log(`✅ Found ${schedule.length} schedule entries`);
          res.json(schedule);
        });
      }
    );
  });
}

module.exports = router;