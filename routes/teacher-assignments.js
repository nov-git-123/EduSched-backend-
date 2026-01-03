//WORKING WITHOUT BTLED MAJOR FILTER

// //✅ edusched-backend/routes/teacher-assignments.js
// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // MySQL connection pool

// // 🔹 GET /api/teacher-assignments -> get all assignments (with optional filters)
// router.get("/", (req, res) => {
//   const { courseId, yearLevel, semester } = req.query;

//   let sql = `
//     SELECT 
//       ta.id,
//       ta.teacher_id,
//       ta.subject_id,
//       ta.course_id,
//       ta.year_level,
//       ta.semester,
//       ta.duration,
//       ta.created_at,
//       i.name AS teacher_name,
//       s.subject_code,
//       s.description,
//       s.units,
//       c.code AS course_code,
//       c.name AS course_name
//     FROM teacher_assignments ta
//     LEFT JOIN instructors i ON ta.teacher_id = i.id
//     LEFT JOIN subjects s ON ta.subject_id = s.id
//     LEFT JOIN courses c ON ta.course_id = c.id
//     WHERE 1=1
//   `;

//   const params = [];

//   if (courseId) {
//     sql += " AND ta.course_id = ?";
//     params.push(courseId);
//   }

//   if (yearLevel) {
//     sql += " AND ta.year_level = ?";
//     params.push(yearLevel);
//   }

//   if (semester) {
//     sql += " AND ta.semester = ?";
//     params.push(semester);
//   }

//   sql += " ORDER BY ta.created_at DESC";

//   db.query(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Error fetching teacher assignments:", err);
//       return res.status(500).json({ message: "Failed to fetch assignments" });
//     }
//     res.json(rows);
//   });
// });

// // 🔹 GET /api/teacher-assignments/:teacherId -> get all assignments for a teacher
// router.get("/:teacherId", (req, res) => {
//   const { teacherId } = req.params;

//   const sql = `
//     SELECT 
//       ta.id,
//       ta.teacher_id,
//       ta.subject_id,
//       ta.course_id,
//       ta.year_level,
//       ta.semester,
//       ta.duration,
//       ta.created_at,
//       s.subject_code,
//       s.description,
//       s.units,
//       c.code AS course_code,
//       c.name AS course_name
//     FROM teacher_assignments ta
//     LEFT JOIN subjects s ON ta.subject_id = s.id
//     LEFT JOIN courses c ON ta.course_id = c.id
//     WHERE ta.teacher_id = ?
//     ORDER BY ta.created_at DESC
//   `;

//   db.query(sql, [teacherId], (err, rows) => {
//     if (err) {
//       console.error("Error fetching teacher assignments:", err);
//       return res.status(500).json({ message: "Failed to fetch assignments" });
//     }
//     res.json(rows);
//   });
// });

// // 🔹 POST /api/teacher-assignments -> create new assignment
// router.post("/", (req, res) => {
//   const { teacher_id, subject_id, course_id, year_level, semester, duration } = req.body;

//   // Validation
//   if (!teacher_id || !subject_id || !course_id || !year_level || !semester) {
//     return res.status(400).json({ 
//       message: "Missing required fields: teacher_id, subject_id, course_id, year_level, semester" 
//     });
//   }

//   // Check if assignment already exists
//   const checkSql = `
//     SELECT id FROM teacher_assignments 
//     WHERE teacher_id = ? AND subject_id = ? AND course_id = ? 
//     AND year_level = ? AND semester = ?
//   `;

//   db.query(checkSql, [teacher_id, subject_id, course_id, year_level, semester], (err, existing) => {
//     if (err) {
//       console.error("Error checking existing assignment:", err);
//       return res.status(500).json({ message: "Database error" });
//     }

//     if (existing && existing.length > 0) {
//       return res.status(409).json({ 
//         message: "Teacher is already assigned to this subject" 
//       });
//     }

//     // Insert new assignment
//     const insertSql = `
//       INSERT INTO teacher_assignments 
//       (teacher_id, subject_id, course_id, year_level, semester, duration)
//       VALUES (?, ?, ?, ?, ?, ?)
//     `;

//     db.query(
//       insertSql, 
//       [teacher_id, subject_id, course_id, year_level, semester, duration || 1],
//       (err, result) => {
//         if (err) {
//           console.error("Error creating assignment:", err);
//           return res.status(500).json({ message: "Failed to create assignment" });
//         }

//         res.status(201).json({
//           success: true,
//           id: result.insertId,
//           message: "Teacher assigned successfully"
//         });
//       }
//     );
//   });
// });

// // 🔹 DELETE /api/teacher-assignments/:id -> delete assignment
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;

//   const sql = "DELETE FROM teacher_assignments WHERE id = ?";

//   db.query(sql, [id], (err, result) => {
//     if (err) {
//       console.error("Error deleting assignment:", err);
//       return res.status(500).json({ message: "Failed to delete assignment" });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Assignment not found" });
//     }

//     res.json({ 
//       success: true, 
//       message: "Assignment deleted successfully" 
//     });
//   });
// });

// // 🔹 GET /api/teacher-assignments/subject/:subjectId -> get assignments for a subject
// router.get("/subject/:subjectId", (req, res) => {
//   const { subjectId } = req.params;

//   const sql = `
//     SELECT 
//       ta.id,
//       ta.teacher_id,
//       ta.duration,
//       i.name AS teacher_name
//     FROM teacher_assignments ta
//     LEFT JOIN instructors i ON ta.teacher_id = i.id
//     WHERE ta.subject_id = ?
//   `;

//   db.query(sql, [subjectId], (err, rows) => {
//     if (err) {
//       console.error("Error fetching subject assignments:", err);
//       return res.status(500).json({ message: "Failed to fetch assignments" });
//     }
//     res.json(rows);
//   });
// });

// // Add this route to your teacher-assignments.js file (after the POST route)

// // 🔹 PUT /api/teacher-assignments/:id -> update assignment
// router.put("/:id", (req, res) => {
//   const { id } = req.params;
//   const { teacher_id, duration } = req.body;

//   // Validation
//   if (!teacher_id) {
//     return res.status(400).json({ 
//       message: "Missing required field: teacher_id" 
//     });
//   }

//   // Update assignment
//   const sql = `
//     UPDATE teacher_assignments 
//     SET teacher_id = ?, duration = ?
//     WHERE id = ?
//   `;

//   db.query(sql, [teacher_id, duration || 1, id], (err, result) => {
//     if (err) {
//       console.error("Error updating assignment:", err);
//       return res.status(500).json({ message: "Failed to update assignment" });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Assignment not found" });
//     }

//     res.json({ 
//       success: true, 
//       message: "Assignment updated successfully" 
//     });
//   });
// });

// module.exports = router;

//✅ edusched-backend/routes/teacher-assignments.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // MySQL connection pool

// 🔹 GET /api/teacher-assignments -> get all assignments (with optional filters INCLUDING major)
router.get("/", (req, res) => {
  const { courseId, yearLevel, semester, major } = req.query;

  let sql = `
    SELECT 
      ta.id,
      ta.teacher_id,
      ta.subject_id,
      ta.course_id,
      ta.year_level,
      ta.semester,
      ta.duration,
      ta.created_at,
      i.name AS teacher_name,
      s.subject_code,
      s.description,
      s.units,
      c.code AS course_code,
      c.name AS course_name
    FROM teacher_assignments ta
    LEFT JOIN instructors i ON ta.teacher_id = i.id
    LEFT JOIN subjects s ON ta.subject_id = s.id
    LEFT JOIN courses c ON ta.course_id = c.id
    WHERE 1=1
  `;

  const params = [];

  if (courseId) {
    sql += " AND ta.course_id = ?";
    params.push(courseId);
  }

  if (yearLevel) {
    sql += " AND ta.year_level = ?";
    params.push(yearLevel);
  }

  if (semester) {
    sql += " AND ta.semester = ?";
    params.push(semester);
  }

  // 🔑 FIX: Filter by major (only when provided)
  // This ensures that in BTLED 3rd year, only assignments for the selected major (ICT/HE) + shared subjects are shown
  if (major) {
    sql += " AND (s.major = ? OR s.major IS NULL)";
    params.push(major);
  }

  sql += " ORDER BY ta.created_at DESC";

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Error fetching teacher assignments:", err);
      return res.status(500).json({ message: "Failed to fetch assignments" });
    }
    res.json(rows);
  });
});

// 🔹 GET /api/teacher-assignments/:teacherId -> get all assignments for a specific teacher
router.get("/:teacherId", (req, res) => {
  const { teacherId } = req.params;

  const sql = `
    SELECT 
      ta.id,
      ta.teacher_id,
      ta.subject_id,
      ta.course_id,
      ta.year_level,
      ta.semester,
      ta.duration,
      ta.created_at,
      s.subject_code,
      s.description,
      s.units,
      c.code AS course_code,
      c.name AS course_name
    FROM teacher_assignments ta
    LEFT JOIN subjects s ON ta.subject_id = s.id
    LEFT JOIN courses c ON ta.course_id = c.id
    WHERE ta.teacher_id = ?
    ORDER BY ta.created_at DESC
  `;

  db.query(sql, [teacherId], (err, rows) => {
    if (err) {
      console.error("Error fetching teacher assignments:", err);
      return res.status(500).json({ message: "Failed to fetch assignments" });
    }
    res.json(rows);
  });
});

// 🔹 POST /api/teacher-assignments -> create new assignment
router.post("/", (req, res) => {
  const { teacher_id, subject_id, course_id, year_level, semester, duration } = req.body;

  // Validation
  if (!teacher_id || !subject_id || !course_id || !year_level || !semester) {
    return res.status(400).json({ 
      message: "Missing required fields: teacher_id, subject_id, course_id, year_level, semester" 
    });
  }

  // Check if assignment already exists
  const checkSql = `
    SELECT id FROM teacher_assignments 
    WHERE teacher_id = ? AND subject_id = ? AND course_id = ? 
    AND year_level = ? AND semester = ?
  `;

  db.query(checkSql, [teacher_id, subject_id, course_id, year_level, semester], (err, existing) => {
    if (err) {
      console.error("Error checking existing assignment:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({ 
        message: "Teacher is already assigned to this subject" 
      });
    }

    // Insert new assignment
    const insertSql = `
      INSERT INTO teacher_assignments 
      (teacher_id, subject_id, course_id, year_level, semester, duration)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertSql, 
      [teacher_id, subject_id, course_id, year_level, semester, duration || 1],
      (err, result) => {
        if (err) {
          console.error("Error creating assignment:", err);
          return res.status(500).json({ message: "Failed to create assignment" });
        }

        res.status(201).json({
          success: true,
          id: result.insertId,
          message: "Teacher assigned successfully"
        });
      }
    );
  });
});

// 🔹 PUT /api/teacher-assignments/:id -> update assignment (teacher and/or duration)
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { teacher_id, duration } = req.body;

  // Validation
  if (!teacher_id) {
    return res.status(400).json({ 
      message: "Missing required field: teacher_id" 
    });
  }

  const sql = `
    UPDATE teacher_assignments 
    SET teacher_id = ?, duration = ?
    WHERE id = ?
  `;

  db.query(sql, [teacher_id, duration || 1, id], (err, result) => {
    if (err) {
      console.error("Error updating assignment:", err);
      return res.status(500).json({ message: "Failed to update assignment" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json({ 
      success: true, 
      message: "Assignment updated successfully" 
    });
  });
});

// 🔹 DELETE /api/teacher-assignments/:id -> delete assignment
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM teacher_assignments WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error deleting assignment:", err);
      return res.status(500).json({ message: "Failed to delete assignment" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json({ 
      success: true, 
      message: "Assignment deleted successfully" 
    });
  });
});

// 🔹 GET /api/teacher-assignments/subject/:subjectId -> get assignments for a subject
router.get("/subject/:subjectId", (req, res) => {
  const { subjectId } = req.params;

  const sql = `
    SELECT 
      ta.id,
      ta.teacher_id,
      ta.duration,
      i.name AS teacher_name
    FROM teacher_assignments ta
    LEFT JOIN instructors i ON ta.teacher_id = i.id
    WHERE ta.subject_id = ?
  `;

  db.query(sql, [subjectId], (err, rows) => {
    if (err) {
      console.error("Error fetching subject assignments:", err);
      return res.status(500).json({ message: "Failed to fetch assignments" });
    }
    res.json(rows);
  });
});

module.exports = router;