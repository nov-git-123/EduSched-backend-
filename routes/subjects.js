// edusched-backend/routes/subjects.js
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/subjects
 * Query params: courseId, yearLevel, semester
 */
router.get('/', (req, res) => {
  const { courseId, yearLevel, semester } = req.query;
  let sql = `SELECT s.*, c.code AS course_code, c.name AS course_name
             FROM subjects s
             JOIN courses c ON s.course_id = c.id
             WHERE 1=1`;
  const params = [];
  if (courseId) { sql += ' AND s.course_id = ?'; params.push(courseId); }
  if (yearLevel) { sql += ' AND s.year_level = ?'; params.push(yearLevel); }
  if (semester) { sql += ' AND s.semester = ?'; params.push(semester); }

  db.query(sql + ' ORDER BY s.subject_code', params, (err, rows) => {
    if (err) {
      console.error('Error fetching subjects:', err);
      return res.status(500).json({ error: 'Failed to fetch subjects' });
    }
    res.json(rows);
  });
});

/**
 * POST /api/subjects
 * body: { courseId, yearLevel, semester, subject_code, description, units }
 */
router.post('/', (req, res) => {
  const { courseId, yearLevel, semester, subject_code, description, units } = req.body;
  if (!courseId || !yearLevel || !semester || !subject_code || !description || !units) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sql = `INSERT INTO subjects
    (course_id, year_level, semester, subject_code, description, units)
    VALUES (?, ?, ?, ?, ?, ?)`;

  db.query(sql, [courseId, yearLevel, semester, subject_code.trim(), description.trim(), units], (err, result) => {
    if (err) {
      console.error('Error inserting subject:', err);
      return res.status(500).json({ error: 'Failed to insert subject' });
    }
    // return the inserted row id and payload (frontend will reload)
    res.json({ id: result.insertId, courseId, yearLevel, semester, subject_code, description, units });
  });
});

/** Optional: delete a subject */
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM subjects WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error deleting subject:', err);
      return res.status(500).json({ error: 'Failed to delete' });
    }
    res.json({ success: true });
  });
});

module.exports = router;
