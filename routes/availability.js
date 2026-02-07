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

//PRE-ORAL WORKING

// const express = require("express");
// const router = express.Router();
// const db = require("../db");
// const util = require("util");
// const query = util.promisify(db.query).bind(db);

// // ✅ GET /api/instructor-availability
// router.get("/", async (req, res) => {
//   try {
//     const rows = await query(`
//       SELECT 
//         ia.id,
//         ia.instructor_id,
//         ia.day,
//         ia.start_time,
//         ia.end_time,
//         i.name AS instructorName,
//         c.name AS course_name
//       FROM instructor_availability ia
//       JOIN instructors i ON ia.instructor_id = i.id
//       LEFT JOIN courses c ON i.course_id = c.id
//       ORDER BY i.name, ia.day, ia.start_time
//     `);

//     res.json(rows || []);
//   } catch (err) {
//     console.error("❌ Error fetching availability:", err);
//     res.status(500).json({ error: "Failed to fetch availability", detail: err.message });
//   }
// });

// // ✅ POST /api/instructor-availability
// router.post("/", async (req, res) => {
//   try {
//     const { instructorId, instructorEmail, day, start_time, end_time } = req.body;

//     if (!day || !start_time || !end_time) {
//       return res.status(400).json({
//         error: "Missing required fields: day, start_time, end_time",
//       });
//     }

//     let idToUse = instructorId || null;

//     if (!idToUse && instructorEmail) {
//       const users = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [instructorEmail]);
//       if (users.length > 0) {
//         const userId = users[0].id;
//         const instructors = await query("SELECT id FROM instructors WHERE user_id = ? LIMIT 1", [userId]);
//         if (instructors.length > 0) idToUse = instructors[0].id;
//       }
//     }

//     if (!idToUse) {
//       return res.status(400).json({
//         error:
//           "No instructor id supplied and could not resolve from email. Provide instructorId or instructorEmail.",
//       });
//     }

//     const result = await query(
//       "INSERT INTO instructor_availability (instructor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)",
//       [idToUse, day, start_time, end_time]
//     );

//     res.status(201).json({ id: result.insertId, message: "Availability saved" });
//   } catch (err) {
//     console.error("❌ SQL Error (POST /instructor-availability):", err);
//     res.status(500).json({ error: "Failed to save availability", detail: err.message });
//   }
// });



// module.exports = router;

//GINAMIT SA SURVEY

// const express = require("express");
// const router = express.Router();
// const db = require("../db");
// const util = require("util");
// const query = util.promisify(db.query).bind(db);

// // ✅ GET /api/instructor-availability
// router.get("/", async (req, res) => {
//   try {
//     const rows = await query(`
//       SELECT 
//         ia.id,
//         ia.instructor_id,
//         ia.day,
//         ia.start_time,
//         ia.end_time,
//         i.name AS instructorName,
//         c.name AS course_name
//       FROM instructor_availability ia
//       JOIN instructors i ON ia.instructor_id = i.id
//       LEFT JOIN courses c ON i.course_id = c.id
//       ORDER BY i.name, ia.day, ia.start_time
//     `);

//     res.json(rows || []);
//   } catch (err) {
//     console.error("❌ Error fetching availability:", err);
//     res.status(500).json({ error: "Failed to fetch availability", detail: err.message });
//   }
// });

// // ✅ GET /api/instructor-availability/:identifier
// router.get("/:identifier", async (req, res) => {
//   try {
//     const { identifier } = req.params;
    
//     let instructorId;

//     // Check if identifier looks like an email
//     if (identifier.includes('@')) {
//       // Step 1: Get user's full name from users table
//       const users = await query("SELECT full_name FROM users WHERE email = ? LIMIT 1", [identifier]);
      
//       if (users.length === 0) {
//         return res.status(404).json({ error: "User not found with this email" });
//       }

//       const fullName = users[0].full_name;

//       // Step 2: Find instructor by matching name
//       const instructors = await query("SELECT id FROM instructors WHERE name = ? LIMIT 1", [fullName]);
      
//       if (instructors.length === 0) {
//         return res.status(404).json({ error: "Instructor not found for this user" });
//       }

//       instructorId = instructors[0].id;
//     } else {
//       // Assume it's already an instructor ID
//       instructorId = identifier;
//     }

//     // Fetch availability for this instructor
//     const rows = await query(
//       `SELECT 
//         ia.id,
//         ia.instructor_id,
//         ia.day,
//         ia.start_time,
//         ia.end_time
//       FROM instructor_availability ia
//       WHERE ia.instructor_id = ?
//       ORDER BY 
//         FIELD(ia.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
//         ia.start_time`,
//       [instructorId]
//     );

//     res.json(rows || []);
//   } catch (err) {
//     console.error("❌ Error fetching instructor availability:", err);
//     res.status(500).json({ error: "Failed to fetch availability", detail: err.message });
//   }
// });

// // ✅ POST /api/instructor-availability
// router.post("/", async (req, res) => {
//   try {
//     const { instructorId, instructorEmail, day, start_time, end_time } = req.body;

//     if (!day || !start_time || !end_time) {
//       return res.status(400).json({
//         error: "Missing required fields: day, start_time, end_time",
//       });
//     }

//     let idToUse = null;

//     // If instructorId looks like an email, resolve it
//     if (instructorId && instructorId.includes('@')) {
//       // Get user's full name
//       const users = await query("SELECT full_name FROM users WHERE email = ? LIMIT 1", [instructorId]);
      
//       if (users.length > 0) {
//         const fullName = users[0].full_name;
        
//         // Find instructor by name
//         const instructors = await query("SELECT id FROM instructors WHERE name = ? LIMIT 1", [fullName]);
        
//         if (instructors.length > 0) {
//           idToUse = instructors[0].id;
//         }
//       }
//     } else if (instructorId) {
//       idToUse = instructorId;
//     }

//     // Fallback to instructorEmail
//     if (!idToUse && instructorEmail) {
//       const users = await query("SELECT full_name FROM users WHERE email = ? LIMIT 1", [instructorEmail]);
      
//       if (users.length > 0) {
//         const fullName = users[0].full_name;
//         const instructors = await query("SELECT id FROM instructors WHERE name = ? LIMIT 1", [fullName]);
        
//         if (instructors.length > 0) {
//           idToUse = instructors[0].id;
//         }
//       }
//     }

//     if (!idToUse) {
//       return res.status(400).json({
//         error: "Could not find instructor. Make sure the user exists and has an instructor profile.",
//       });
//     }

//     // Check if availability already exists for this day
//     const existing = await query(
//       "SELECT id FROM instructor_availability WHERE instructor_id = ? AND day = ? LIMIT 1",
//       [idToUse, day]
//     );

//     if (existing.length > 0) {
//       // Update existing
//       await query(
//         "UPDATE instructor_availability SET start_time = ?, end_time = ? WHERE id = ?",
//         [start_time, end_time, existing[0].id]
//       );
//       res.json({ id: existing[0].id, message: "Availability updated" });
//     } else {
//       // Insert new
//       const result = await query(
//         "INSERT INTO instructor_availability (instructor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)",
//         [idToUse, day, start_time, end_time]
//       );
//       res.status(201).json({ id: result.insertId, message: "Availability saved" });
//     }
//   } catch (err) {
//     console.error("❌ SQL Error (POST /instructor-availability):", err);
//     res.status(500).json({ error: "Failed to save availability", detail: err.message });
//   }
// });

// module.exports = router;

//availability.js
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

// ✅ GET /api/instructor-availability/:identifier
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    let instructorId;

    // Check if identifier looks like an email
    if (identifier.includes('@')) {
      // Step 1: Get user's full name from users table
      const users = await query("SELECT full_name FROM users WHERE email = ? LIMIT 1", [identifier]);
      
      if (users.length === 0) {
        return res.status(404).json({ error: "User not found with this email" });
      }

      const fullName = users[0].full_name;

      // Step 2: Find instructor by matching name
      const instructors = await query("SELECT id FROM instructors WHERE name = ? LIMIT 1", [fullName]);
      
      if (instructors.length === 0) {
        return res.status(404).json({ error: "Instructor not found for this user" });
      }

      instructorId = instructors[0].id;
    } else {
      // Assume it's already an instructor ID
      instructorId = identifier;
    }

    // Fetch availability for this instructor
    const rows = await query(
      `SELECT 
        ia.id,
        ia.instructor_id,
        ia.day,
        ia.start_time,
        ia.end_time
      FROM instructor_availability ia
      WHERE ia.instructor_id = ?
      ORDER BY 
        FIELD(ia.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
        ia.start_time`,
      [instructorId]
    );

    res.json(rows || []);
  } catch (err) {
    console.error("❌ Error fetching instructor availability:", err);
    res.status(500).json({ error: "Failed to fetch availability", detail: err.message });
  }
});

// ✅ POST /api/instructor-availability - FIXED TO SUPPORT MULTIPLE SLOTS PER DAY
router.post("/", async (req, res) => {
  try {
    const { instructorId, instructorEmail, day, start_time, end_time } = req.body;

    if (!day || !start_time || !end_time) {
      return res.status(400).json({
        error: "Missing required fields: day, start_time, end_time",
      });
    }

    let idToUse = null;

    // If instructorId looks like an email, resolve it
    if (instructorId && instructorId.includes('@')) {
      // Get user's full name
      const users = await query("SELECT full_name FROM users WHERE email = ? LIMIT 1", [instructorId]);
      
      if (users.length > 0) {
        const fullName = users[0].full_name;
        
        // Find instructor by name
        const instructors = await query("SELECT id FROM instructors WHERE name = ? LIMIT 1", [fullName]);
        
        if (instructors.length > 0) {
          idToUse = instructors[0].id;
        }
      }
    } else if (instructorId) {
      idToUse = instructorId;
    }

    // Fallback to instructorEmail
    if (!idToUse && instructorEmail) {
      const users = await query("SELECT full_name FROM users WHERE email = ? LIMIT 1", [instructorEmail]);
      
      if (users.length > 0) {
        const fullName = users[0].full_name;
        const instructors = await query("SELECT id FROM instructors WHERE name = ? LIMIT 1", [fullName]);
        
        if (instructors.length > 0) {
          idToUse = instructors[0].id;
        }
      }
    }

    if (!idToUse) {
      return res.status(400).json({
        error: "Could not find instructor. Make sure the user exists and has an instructor profile.",
      });
    }

    // ⭐ KEY FIX: Check if THIS EXACT time slot already exists (not just the day)
    const existing = await query(
      "SELECT id FROM instructor_availability WHERE instructor_id = ? AND day = ? AND start_time = ? AND end_time = ? LIMIT 1",
      [idToUse, day, start_time, end_time]
    );

    if (existing.length > 0) {
      // This exact slot already exists, just return success
      res.json({ id: existing[0].id, message: "Time slot already exists" });
    } else {
      // ⭐ Insert new slot (allow multiple slots per day)
      const result = await query(
        "INSERT INTO instructor_availability (instructor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)",
        [idToUse, day, start_time, end_time]
      );
      res.status(201).json({ id: result.insertId, message: "Availability saved" });
    }
  } catch (err) {
    console.error("❌ SQL Error (POST /instructor-availability):", err);
    res.status(500).json({ error: "Failed to save availability", detail: err.message });
  }
});

// ⭐ NEW: DELETE endpoint to clear all slots for a specific day
router.delete("/", async (req, res) => {
  try {
    const { instructorId, day } = req.body;

    if (!instructorId || !day) {
      return res.status(400).json({
        error: "Missing required fields: instructorId, day",
      });
    }

    let idToUse = null;

    // If instructorId looks like an email, resolve it
    if (instructorId.includes('@')) {
      const users = await query("SELECT full_name FROM users WHERE email = ? LIMIT 1", [instructorId]);
      
      if (users.length > 0) {
        const fullName = users[0].full_name;
        const instructors = await query("SELECT id FROM instructors WHERE name = ? LIMIT 1", [fullName]);
        
        if (instructors.length > 0) {
          idToUse = instructors[0].id;
        }
      }
    } else {
      idToUse = instructorId;
    }

    if (!idToUse) {
      return res.status(400).json({
        error: "Could not find instructor",
      });
    }

    // Delete all slots for this instructor on this day
    await query(
      "DELETE FROM instructor_availability WHERE instructor_id = ? AND day = ?",
      [idToUse, day]
    );

    res.json({ message: "All time slots cleared for this day" });
  } catch (err) {
    console.error("❌ SQL Error (DELETE /instructor-availability):", err);
    res.status(500).json({ error: "Failed to delete availability", detail: err.message });
  }
});

module.exports = router;
