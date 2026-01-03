//FUNCTIONAL WITHOUT MULTIPLE ROOM SUPPORT

// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // ==================== ROOM ASSIGNMENTS ROUTES ====================

// // ✅ GET all room assignments
// router.get("/", (req, res) => {
//   const sql = `
//     SELECT 
//       ra.*,
//       r.name as room_name,
//       r.building_id,
//       b.name as building_name,
//       c.code as course_code,
//       c.name as course_name
//     FROM room_assignments ra
//     LEFT JOIN rooms r ON ra.room_id = r.id
//     LEFT JOIN buildings b ON ra.building_id = b.id
//     LEFT JOIN courses c ON ra.course_id = c.id
//     ORDER BY ra.course_id, ra.year_level, ra.semester
//   `;
  
//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error('Error fetching room assignments:', err);
//       return res.status(500).json({ message: 'Failed to fetch room assignments' });
//     }
//     res.json(results);
//   });
// });

// // ✅ POST/UPDATE room assignment (upsert)
// router.post("/", (req, res) => {
//   const { courseId, yearLevel, semester, roomId, buildingId } = req.body;
  
//   // Validate input
//   if (!courseId || !yearLevel || !semester || !roomId || !buildingId) {
//     return res.status(400).json({ 
//       message: 'Missing required fields: courseId, yearLevel, semester, roomId, buildingId' 
//     });
//   }

//   // Check if assignment already exists for this specific building
//   const checkSql = `
//     SELECT id FROM room_assignments 
//     WHERE course_id = ? AND year_level = ? AND semester = ? AND building_id = ?
//   `;
  
//   db.query(checkSql, [courseId, yearLevel, semester, buildingId], (err, results) => {
//     if (err) {
//       console.error('Error checking room assignment:', err);
//       return res.status(500).json({ message: 'Database error' });
//     }

//     if (results.length > 0) {
//       // Update existing assignment
//       const updateSql = `
//         UPDATE room_assignments 
//         SET room_id = ?, updated_at = NOW()
//         WHERE course_id = ? AND year_level = ? AND semester = ? AND building_id = ?
//       `;
      
//       db.query(updateSql, [roomId, courseId, yearLevel, semester, buildingId], (err, result) => {
//         if (err) {
//           console.error('Error updating room assignment:', err);
//           return res.status(500).json({ message: 'Failed to update room assignment' });
//         }
        
//         res.json({ 
//           message: 'Room assignment updated successfully',
//           id: results[0].id,
//           course_id: courseId,
//           year_level: yearLevel,
//           semester: semester,
//           room_id: roomId,
//           building_id: buildingId
//         });
//       });
//     } else {
//       // Insert new assignment
//       const insertSql = `
//         INSERT INTO room_assignments (course_id, year_level, semester, room_id, building_id, created_at, updated_at)
//         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
//       `;
      
//       db.query(insertSql, [courseId, yearLevel, semester, roomId, buildingId], (err, result) => {
//         if (err) {
//           console.error('Error creating room assignment:', err);
//           return res.status(500).json({ message: 'Failed to create room assignment' });
//         }
        
//         res.status(201).json({
//           message: 'Room assignment created successfully',
//           id: result.insertId,
//           course_id: courseId,
//           year_level: yearLevel,
//           semester: semester,
//           room_id: roomId,
//           building_id: buildingId
//         });
//       });
//     }
//   });
// });

// // ✅ GET room assignment by course, year, semester, and building
// router.get("/:courseId/:yearLevel/:semester/:buildingId", (req, res) => {
//   const { courseId, yearLevel, semester, buildingId } = req.params;
  
//   const sql = `
//     SELECT 
//       ra.*,
//       r.name as room_name,
//       b.name as building_name
//     FROM room_assignments ra
//     LEFT JOIN rooms r ON ra.room_id = r.id
//     LEFT JOIN buildings b ON ra.building_id = b.id
//     WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ? AND ra.building_id = ?
//   `;
  
//   db.query(sql, [courseId, yearLevel, semester, buildingId], (err, results) => {
//     if (err) {
//       console.error('Error fetching room assignment:', err);
//       return res.status(500).json({ message: 'Failed to fetch room assignment' });
//     }
    
//     if (results.length === 0) {
//       return res.status(404).json({ message: 'Room assignment not found' });
//     }
    
//     res.json(results[0]);
//   });
// });

// // ✅ DELETE room assignment
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;
  
//   const sql = 'DELETE FROM room_assignments WHERE id = ?';
  
//   db.query(sql, [id], (err, result) => {
//     if (err) {
//       console.error('Error deleting room assignment:', err);
//       return res.status(500).json({ message: 'Failed to delete room assignment' });
//     }
    
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: 'Room assignment not found' });
//     }
    
//     res.json({ message: 'Room assignment deleted successfully' });
//   });
// });

// // ✅ DELETE room assignment by course/year/semester/building
// router.delete("/:courseId/:yearLevel/:semester/:buildingId", (req, res) => {
//   const { courseId, yearLevel, semester, buildingId } = req.params;
  
//   const sql = 'DELETE FROM room_assignments WHERE course_id = ? AND year_level = ? AND semester = ? AND building_id = ?';
  
//   db.query(sql, [courseId, yearLevel, semester, buildingId], (err, result) => {
//     if (err) {
//       console.error('Error deleting room assignment:', err);
//       return res.status(500).json({ message: 'Failed to delete room assignment' });
//     }
    
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: 'Room assignment not found' });
//     }
    
//     res.json({ message: 'Room assignment deleted successfully' });
//   });
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../db");

// ==================== ROOM ASSIGNMENTS ROUTES ====================

// ✅ GET all room assignments
router.get("/", (req, res) => {
  const sql = `
    SELECT 
      ra.*,
      r.name as room_name,
      r.building_id,
      b.name as building_name,
      c.code as course_code,
      c.name as course_name
    FROM room_assignments ra
    LEFT JOIN rooms r ON ra.room_id = r.id
    LEFT JOIN buildings b ON ra.building_id = b.id
    LEFT JOIN courses c ON ra.course_id = c.id
    ORDER BY ra.course_id, ra.year_level, ra.semester, ra.building_id, ra.room_id
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching room assignments:', err);
      return res.status(500).json({ message: 'Failed to fetch room assignments' });
    }
    res.json(results);
  });
});

// ✅ POST - Add a new room assignment (allows multiple rooms)
router.post("/", (req, res) => {
  const { courseId, yearLevel, semester, roomId, buildingId } = req.body;
  
  // Validate input
  if (!courseId || !yearLevel || !semester || !roomId || !buildingId) {
    return res.status(400).json({ 
      message: 'Missing required fields: courseId, yearLevel, semester, roomId, buildingId' 
    });
  }

  // Check if this exact assignment already exists (same course, year, semester, building, AND room)
  const checkSql = `
    SELECT id FROM room_assignments 
    WHERE course_id = ? AND year_level = ? AND semester = ? AND building_id = ? AND room_id = ?
  `;
  
  db.query(checkSql, [courseId, yearLevel, semester, buildingId, roomId], (err, results) => {
    if (err) {
      console.error('Error checking room assignment:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length > 0) {
      // Assignment already exists
      return res.status(409).json({ 
        message: 'This room is already assigned to this course/year/semester/building combination',
        id: results[0].id
      });
    }

    // Insert new assignment (allows multiple rooms for same course/year/semester/building)
    const insertSql = `
      INSERT INTO room_assignments (course_id, year_level, semester, room_id, building_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    db.query(insertSql, [courseId, yearLevel, semester, roomId, buildingId], (err, result) => {
      if (err) {
        console.error('Error creating room assignment:', err);
        return res.status(500).json({ message: 'Failed to create room assignment' });
      }
      
      res.status(201).json({
        message: 'Room assignment created successfully',
        id: result.insertId,
        course_id: courseId,
        year_level: yearLevel,
        semester: semester,
        room_id: roomId,
        building_id: buildingId
      });
    });
  });
});

// ✅ GET all room assignments for a specific course/year/semester/building
router.get("/:courseId/:yearLevel/:semester/:buildingId", (req, res) => {
  const { courseId, yearLevel, semester, buildingId } = req.params;
  
  const sql = `
    SELECT 
      ra.*,
      r.name as room_name,
      b.name as building_name
    FROM room_assignments ra
    LEFT JOIN rooms r ON ra.room_id = r.id
    LEFT JOIN buildings b ON ra.building_id = b.id
    WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ? AND ra.building_id = ?
    ORDER BY r.name
  `;
  
  db.query(sql, [courseId, yearLevel, semester, buildingId], (err, results) => {
    if (err) {
      console.error('Error fetching room assignments:', err);
      return res.status(500).json({ message: 'Failed to fetch room assignments' });
    }
    
    res.json(results);
  });
});

// ✅ DELETE a specific room assignment by ID
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  
  const sql = 'DELETE FROM room_assignments WHERE id = ?';
  
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error deleting room assignment:', err);
      return res.status(500).json({ message: 'Failed to delete room assignment' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Room assignment not found' });
    }
    
    res.json({ message: 'Room assignment deleted successfully' });
  });
});

// ✅ DELETE all room assignments for a specific course/year/semester/building
router.delete("/bulk/:courseId/:yearLevel/:semester/:buildingId", (req, res) => {
  const { courseId, yearLevel, semester, buildingId } = req.params;
  
  const sql = 'DELETE FROM room_assignments WHERE course_id = ? AND year_level = ? AND semester = ? AND building_id = ?';
  
  db.query(sql, [courseId, yearLevel, semester, buildingId], (err, result) => {
    if (err) {
      console.error('Error deleting room assignments:', err);
      return res.status(500).json({ message: 'Failed to delete room assignments' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No room assignments found' });
    }
    
    res.json({ 
      message: 'Room assignments deleted successfully',
      deletedCount: result.affectedRows 
    });
  });
});

module.exports = router;