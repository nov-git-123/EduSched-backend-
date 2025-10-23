// // backend/routes/availability.js
// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // your mysql/mysql2 connection (promise-style)

// //
// // GET /api/instructor-availability
// // Returns all availability rows with a reliable instructorName field
// //
// // routes/availability.js
// // GET /api/instructor-availability
// // router.get("/", async (req, res) => {
// //   try {
// //     const sql = `
// //       SELECT ia.id,
// //              ia.instructor_id,
// //              ia.day,
// //              ia.start_time,
// //              ia.end_time,
// //              i.name AS instructorName
// //       FROM instructor_availability ia
// //       JOIN instructors i ON ia.instructor_id = i.id
// //       ORDER BY i.name, ia.day, ia.start_time
// //     `;
    
// //     const [rows] = await db.query(sql);
// // console.log("Backend response: ", rows)
// //     // Ensure rows is always returned as an array
// //     res.json(Array.isArray(rows) ? rows : [rows]);  // Wrap in array if it's not already an array
// //   } catch (err) {
// //     res.status(500).json({ error: "Failed to fetch availability", detail: err.message });
// //   }
// // });

// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT ia.id,
//              ia.instructor_id,
//              ia.day,
//              ia.start_time,
//              ia.end_time,
//              i.name AS instructorName
//       FROM instructor_availability ia
//       JOIN instructors i ON ia.instructor_id = i.id
//       ORDER BY i.name, ia.day, ia.start_time
//     `;
//     const [rows] = await db.query(sql);
    
//     console.log("Fetched rows from DB:", rows);  // Log the rows to ensure multiple rows are returned
//     res.json(rows);  // Send the rows as a JSON response
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch availability", detail: err.message });
//   }
// });


// //
// // POST /api/instructor-availability
// // Accepts { instructorId?, instructorEmail?, day, start_time, end_time }
// // If instructorId missing, tries to resolve by instructorEmail (users -> instructors)
// //
// router.post("/", async (req, res) => {
//   try {
//     const { instructorId, instructorEmail, day, start_time, end_time } = req.body;

//     if (!day || !start_time || !end_time) {
//       return res.status(400).json({ error: "Missing required fields: day, start_time, end_time" });
//     }

//     let idToUse = instructorId || null;

//     // If ID not provided, try to resolve from instructorEmail
//     if (!idToUse && instructorEmail) {
//       // Try to find user by email
//       const [users] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [instructorEmail]);
//       if (users && users.length > 0) {
//         const userId = users[0].id;
//         // Try to find instructor linked to that user
//         const [instructors] = await db.query("SELECT id FROM instructors WHERE user_id = ? LIMIT 1", [userId]);
//         if (instructors && instructors.length > 0) {
//           idToUse = instructors[0].id;
//         }
//       }
//     }

//     if (!idToUse) {
//       return res.status(400).json({
//         error: "No instructor id supplied and could not resolve from email. Provide instructorId or instructorEmail."
//       });
//     }

//     const [result] = await db.query(
//       "INSERT INTO instructor_availability (instructor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)",
//       [idToUse, day, start_time, end_time]
//     );

//     res.status(201).json({ id: result.insertId, message: "Availability saved" });
//   } catch (err) {
//     console.error("SQL Error (POST /instructor-availability):", err);
//     res.status(500).json({ error: "Failed to save availability", detail: err.message });
//   }
// });

// module.exports = router;

//FUNCTIONAL LAST
// backend/routes/availability.js
// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // your MySQL/MySQL2 connection (promise-style)

// // GET /api/instructor-availability
// // Returns all availability rows with a reliable instructorName field
// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT ia.id,
//              ia.instructor_id,
//              ia.day,
//              ia.start_time,
//              ia.end_time,
//              i.name AS instructorName
//       FROM instructor_availability ia
//       JOIN instructors i ON ia.instructor_id = i.id
//       ORDER BY i.name, ia.day, ia.start_time
//     `;
//     const rows = await db.query(sql); // ✅ FIXED

//     console.log("SQL result:", rows); // should now show [ RowDataPacket {}, RowDataPacket {}, ... ]
//     res.json(rows);
//   } catch (err) {
//     console.error("Error fetching availability:", err);
//     res.status(500).json({ error: "Failed to fetch availability", detail: err.message });
//   }
// });


// // POST /api/instructor-availability
// // Accepts { instructorId?, instructorEmail?, day, start_time, end_time }
// // If instructorId missing, tries to resolve by instructorEmail (users -> instructors)
// router.post("/", async (req, res) => {
//   try {
//     const { instructorId, instructorEmail, day, start_time, end_time } = req.body;

//     // Validate required fields
//     if (!day || !start_time || !end_time) {
//       return res.status(400).json({ error: "Missing required fields: day, start_time, end_time" });
//     }

//     let idToUse = instructorId || null;

//     // If ID not provided, try to resolve from instructorEmail
//     if (!idToUse && instructorEmail) {
//       const [users] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [instructorEmail]);
//       if (users && users.length > 0) {
//         const userId = users[0].id;
//         const [instructors] = await db.query("SELECT id FROM instructors WHERE user_id = ? LIMIT 1", [userId]);
//         if (instructors && instructors.length > 0) {
//           idToUse = instructors[0].id;
//         }
//       }
//     }

//     if (!idToUse) {
//       return res.status(400).json({
//         error: "No instructor id supplied and could not resolve from email. Provide instructorId or instructorEmail."
//       });
//     }

//     const [result] = await db.query(
//       "INSERT INTO instructor_availability (instructor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)",
//       [idToUse, day, start_time, end_time]
//     );

//     res.status(201).json({ id: result.insertId, message: "Availability saved" });
//   } catch (err) {
//     console.error("SQL Error (POST /instructor-availability):", err);
//     res.status(500).json({ error: "Failed to save availability", detail: err.message });
//   }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../db");
const util = require("util");
const query = util.promisify(db.query).bind(db);

// ✅ GET /api/instructor-availability
router.get("/", async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        ia.id,
        ia.instructor_id,
        ia.day,
        ia.start_time,
        ia.end_time,
        i.name AS instructorName,
        c.name AS course_name
      FROM instructor_availability ia
      JOIN instructors i ON ia.instructor_id = i.id
      LEFT JOIN courses c ON i.course_id = c.id
      ORDER BY i.name, ia.day, ia.start_time
    `);

    res.json(rows || []);
  } catch (err) {
    console.error("❌ Error fetching availability:", err);
    res.status(500).json({ error: "Failed to fetch availability", detail: err.message });
  }
});

// ✅ POST /api/instructor-availability
router.post("/", async (req, res) => {
  try {
    const { instructorId, instructorEmail, day, start_time, end_time } = req.body;

    if (!day || !start_time || !end_time) {
      return res.status(400).json({
        error: "Missing required fields: day, start_time, end_time",
      });
    }

    let idToUse = instructorId || null;

    if (!idToUse && instructorEmail) {
      const users = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [instructorEmail]);
      if (users.length > 0) {
        const userId = users[0].id;
        const instructors = await query("SELECT id FROM instructors WHERE user_id = ? LIMIT 1", [userId]);
        if (instructors.length > 0) idToUse = instructors[0].id;
      }
    }

    if (!idToUse) {
      return res.status(400).json({
        error:
          "No instructor id supplied and could not resolve from email. Provide instructorId or instructorEmail.",
      });
    }

    const result = await query(
      "INSERT INTO instructor_availability (instructor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)",
      [idToUse, day, start_time, end_time]
    );

    res.status(201).json({ id: result.insertId, message: "Availability saved" });
  } catch (err) {
    console.error("❌ SQL Error (POST /instructor-availability):", err);
    res.status(500).json({ error: "Failed to save availability", detail: err.message });
  }
});



module.exports = router;
