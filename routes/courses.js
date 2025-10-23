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
const express = require("express");
const router = express.Router();
const db = require("../db"); // using mysql, not mysql2

// ✅ GET all courses
router.get("/", (req, res) => {
  const query = "SELECT id, code, name FROM courses ORDER BY name";

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
  const { code, name } = req.body;

  if (!code || !name) {
    return res.status(400).json({ message: "Course code and name are required" });
  }

  const query = "INSERT INTO courses (code, name) VALUES (?, ?)";
  db.query(query, [code, name], (err, result) => {
    if (err) {
      console.error("Error adding course:", err);
      return res.status(500).json({ message: "Error adding course" });
    }

    res.status(201).json({
      id: result.insertId,
      code,
      name,
      message: "Course added successfully"
    });
  });
});

// ✅ DELETE course by ID (with subjects)
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  // delete related subjects first, then the course
  db.query("DELETE FROM subjects WHERE course_id = ?", [id], (err) => {
    if (err) {
      console.error("Error deleting related subjects:", err);
      return res.status(500).json({ message: "Error deleting related subjects" });
    }

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

module.exports = router;
