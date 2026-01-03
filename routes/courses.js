// // edusched-backend/routes/courses.js
// const express = require('express');
// const router = express.Router();
// const db = require('../db');

// // GET /api/courses
// router.get('/', (req, res) => {
//   db.query('SELECT id, code, name FROM courses ORDER BY name', (err, rows) => {
//     if (err) {
//       console.error('Error fetching courses:', err);
//       return res.status(500).json({ error: 'Failed to fetch courses' });
//     }
//     res.json(rows);
//   });
// });

// module.exports = router;

//Functional

// edusched-backend/routes/courses.js
// const express = require('express');
// const router = express.Router();
// const db = require('../db');

// // GET /api/courses
// router.get('/', (req, res) => {
//   db.query('SELECT id, code, name FROM courses ORDER BY name', (err, rows) => {
//     if (err) {
//       console.error('Error fetching courses:', err);
//       return res.status(500).json({ error: 'Failed to fetch courses' });
//     }
//     res.json(rows);
//   });
// });

// module.exports = router;

//PRE-ORAL WORKING 

// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // using mysql, not mysql2

// // ✅ GET all courses
// router.get("/", (req, res) => {
//   const query = "SELECT id, code, name FROM courses ORDER BY name";

//   db.query(query, (err, rows) => {
//     if (err) {
//       console.error("Error fetching courses:", err);
//       return res.status(500).json({ message: "Failed to fetch courses" });
//     }
//     res.json(rows);
//   });
// });

// // ✅ GET subjects by course ID
// router.get("/:id/subjects", (req, res) => {
//   const { id } = req.params;

//   db.query("SELECT * FROM subjects WHERE course_id = ?", [id], (err, rows) => {
//     if (err) {
//       console.error("Error fetching subjects:", err);
//       return res.status(500).json({ message: "Failed to fetch subjects" });
//     }
//     res.json(rows);
//   });
// });

// // ✅ ADD new course
// router.post("/", (req, res) => {
//   const { code, name } = req.body;

//   if (!code || !name) {
//     return res.status(400).json({ message: "Course code and name are required" });
//   }

//   const query = "INSERT INTO courses (code, name) VALUES (?, ?)";
//   db.query(query, [code, name], (err, result) => {
//     if (err) {
//       console.error("Error adding course:", err);
//       return res.status(500).json({ message: "Error adding course" });
//     }

//     res.status(201).json({
//       id: result.insertId,
//       code,
//       name,
//       message: "Course added successfully"
//     });
//   });
// });

// // ✅ DELETE course by ID (with subjects)
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;

//   // delete related subjects first, then the course
//   db.query("DELETE FROM subjects WHERE course_id = ?", [id], (err) => {
//     if (err) {
//       console.error("Error deleting related subjects:", err);
//       return res.status(500).json({ message: "Error deleting related subjects" });
//     }

//     db.query("DELETE FROM courses WHERE id = ?", [id], (err, result) => {
//       if (err) {
//         console.error("Error deleting course:", err);
//         return res.status(500).json({ message: "Error deleting course" });
//       }

//       if (result.affectedRows === 0) {
//         return res.status(404).json({ message: "Course not found" });
//       }

//       res.json({ message: "Course deleted successfully" });
//     });
//   });
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../db"); // using mysql, not mysql2

// ✅ GET all courses (including General Education if exists)
router.get("/", (req, res) => {
  const query = "SELECT id, code, name, is_general FROM courses ORDER BY is_general DESC, name";

  db.query(query, (err, rows) => {
    if (err) {
      console.error("Error fetching courses:", err);
      return res.status(500).json({ message: "Failed to fetch courses" });
    }
    res.json(rows);
  });
});

// ✅ GET subjects by course ID
router.get("/:id/subjects", (req, res) => {
  const { id } = req.params;

  db.query("SELECT * FROM subjects WHERE course_id = ?", [id], (err, rows) => {
    if (err) {
      console.error("Error fetching subjects:", err);
      return res.status(500).json({ message: "Failed to fetch subjects" });
    }
    res.json(rows);
  });
});

// ✅ ADD new course
router.post("/", (req, res) => {
  const { code, name, is_general } = req.body;

  if (!code || !name) {
    return res.status(400).json({ message: "Course code and name are required" });
  }

  // Check if General Education already exists
  if (is_general) {
    db.query("SELECT id FROM courses WHERE is_general = 1", (err, existing) => {
      if (err) {
        console.error("Error checking general education:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (existing && existing.length > 0) {
        return res.status(409).json({ 
          message: "General Education course already exists" 
        });
      }

      // Insert General Education course
      insertCourse(code, name, is_general, res);
    });
  } else {
    // Insert regular course
    insertCourse(code, name, is_general, res);
  }
});

// Helper function to insert course
function insertCourse(code, name, is_general, res) {
  const query = "INSERT INTO courses (code, name, is_general) VALUES (?, ?, ?)";
  db.query(query, [code, name, is_general ? 1 : 0], (err, result) => {
    if (err) {
      console.error("Error adding course:", err);
      return res.status(500).json({ message: "Error adding course" });
    }

    res.status(201).json({
      id: result.insertId,
      code,
      name,
      is_general: is_general ? 1 : 0,
      message: "Course added successfully"
    });
  });
}

// ✅ UPDATE course
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { code, name, is_general } = req.body;

  if (!code || !name) {
    return res.status(400).json({ message: "Course code and name are required" });
  }

  // If trying to set as general education, check if another one exists
  if (is_general) {
    db.query("SELECT id FROM courses WHERE is_general = 1 AND id != ?", [id], (err, existing) => {
      if (err) {
        console.error("Error checking general education:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (existing && existing.length > 0) {
        return res.status(409).json({ 
          message: "Another General Education course already exists" 
        });
      }

      updateCourse(id, code, name, is_general, res);
    });
  } else {
    updateCourse(id, code, name, is_general, res);
  }
});

// Helper function to update course
function updateCourse(id, code, name, is_general, res) {
  const query = "UPDATE courses SET code = ?, name = ?, is_general = ? WHERE id = ?";
  db.query(query, [code, name, is_general ? 1 : 0, id], (err, result) => {
    if (err) {
      console.error("Error updating course:", err);
      return res.status(500).json({ message: "Error updating course" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({
      id,
      code,
      name,
      is_general: is_general ? 1 : 0,
      message: "Course updated successfully"
    });
  });
}

// ✅ DELETE course by ID (with subjects and assignments)
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  // Delete related teacher assignments first
  db.query("DELETE FROM teacher_assignments WHERE course_id = ?", [id], (err) => {
    if (err) {
      console.error("Error deleting related teacher assignments:", err);
      return res.status(500).json({ message: "Error deleting related assignments" });
    }

    // Delete related subjects
    db.query("DELETE FROM subjects WHERE course_id = ?", [id], (err) => {
      if (err) {
        console.error("Error deleting related subjects:", err);
        return res.status(500).json({ message: "Error deleting related subjects" });
      }

      // Delete the course
      db.query("DELETE FROM courses WHERE id = ?", [id], (err, result) => {
        if (err) {
          console.error("Error deleting course:", err);
          return res.status(500).json({ message: "Error deleting course" });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Course not found" });
        }

        res.json({ message: "Course deleted successfully" });
      });
    });
  });
});

// ✅ Initialize General Education course (run once)
router.post("/init-general", (req, res) => {
  // Check if General Education already exists
  db.query("SELECT id FROM courses WHERE is_general = 1", (err, existing) => {
    if (err) {
      console.error("Error checking general education:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (existing && existing.length > 0) {
      return res.status(200).json({ 
        message: "General Education course already exists",
        id: existing[0].id
      });
    }

    // Create General Education course
    const query = "INSERT INTO courses (code, name, is_general) VALUES (?, ?, ?)";
    db.query(query, ["GEN-ED", "General Education", 1], (err, result) => {
      if (err) {
        console.error("Error creating general education:", err);
        return res.status(500).json({ message: "Error creating general education" });
      }

      res.status(201).json({
        id: result.insertId,
        code: "GEN-ED",
        name: "General Education",
        is_general: 1,
        message: "General Education course created successfully"
      });
    });
  });
});

module.exports = router;