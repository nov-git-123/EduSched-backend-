//OLD FUNCTIONAL

// // edusched-backend/routes/scheduler.js
// const express = require('express');
// const router = express.Router();
// const db = require('../db'); // your db connection created via mysql.createConnection
// const util = require('util');
// // const fetch = require('node-fetch'); // npm i node-fetch@2  (if Node < 18). If Node >=18, global fetch exists.
// const query = util.promisify(db.query).bind(db);

// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// router.post('/generate', async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester, studentsCount, sectionCount, subjects } = req.body;

//     if (!courseId || !yearLevel || !semester || !sectionCount || !Array.isArray(subjects) || subjects.length === 0) {
//       return res.status(400).json({ error: 'Missing params' });
//     }

//     // 1) fetch subject details
//     const subjRows = await query('SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)', [subjects]);

//     // 2) fetch instructors -- choose only active ones (adjust your column names)
//     const instructors = await query('SELECT id, name FROM instructors WHERE 1'); // add filters as needed

//     // 3) fetch rooms
//     const rooms = await query('SELECT id, name FROM rooms WHERE 1');

//     // Build payload for Python scheduler
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester,
//       studentsCount: Number(studentsCount || 30),
//       sectionCount: Number(sectionCount),
//       subjects: subjRows.map(s => ({ id: s.id, code: s.subject_code, units: Number(s.units) || 3 })),
//       instructors: instructors.map(i => ({ id: i.id })),
//       rooms: rooms.map(r => ({ id: r.id })),
//       days: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
//       slotsPerDay: 8
//     };

//     // 4) Call Python microservice (OR-Tools)
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//       // optional: set timeout via AbortController if you want
//     });

//     if (!schedulerRes.ok) {
//       const txt = await schedulerRes.text();
//       return res.status(500).json({ error: 'Scheduler failed', detail: txt });
//     }

//     const schedulerJson = await schedulerRes.json();
//     const assignments = schedulerJson.assignments || [];

//     // 5) Persist: create sections, then insert schedules
//     await query('START TRANSACTION');

//     const sectionIds = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       const name = `Section ${String.fromCharCode(65 + i)}`; // A, B, C...
//       const result = await query(
//         'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//         [payload.courseId, payload.yearLevel, payload.semester, name, payload.studentsCount]
//       );
//       // result.insertId should exist
//       sectionIds.push(result.insertId);
//     }

//     // Insert schedules
//     for (const a of assignments) {
//       const sectionId = sectionIds[a.section_index] || null;
//       await query(
//         'INSERT INTO schedule (section_id, subject_id, instructor_id, room_id, day, slot_index) VALUES (?,?,?,?,?,?)',
//         [sectionId, a.subject_id, a.instructor_id || null, a.room_id || null, a.day, a.slot_index]
//       );
//     }


//     await query('COMMIT');

//     return res.json({ ok: true, sections: sectionIds, assignments });
//   } catch (err) {
//     console.error('Error generating schedule:', err);
//     try { await query('ROLLBACK'); } catch(e){ /* ignore */ }
//     return res.status(500).json({ error: 'Server error', detail: err.message });
//   }
  
// });
// // Get schedules (optionally filter by course, year, or section)
// router.get('/', async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;

//     let sql = `
//       SELECT s.id, s.section_id, s.subject_id, s.instructor_id, s.room_id, s.day, s.slot_index,
//              subj.subject_code, subj.description,
//              i.name AS instructor_name,
//              r.name AS room_name,
//              sec.name AS section_name
//       FROM schedule s
//       JOIN subjects subj ON s.subject_id = subj.id
//       JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       WHERE 1
//     `;

//     const params = [];
//     if (courseId) { sql += " AND sec.course_id = ?"; params.push(courseId); }
//     if (yearLevel) { sql += " AND sec.year_level = ?"; params.push(yearLevel); }
//     if (semester) { sql += " AND sec.semester = ?"; params.push(semester); }

//     const rows = await query(sql, params);
//     res.json(rows);

//   } catch (err) {
//     console.error("Error fetching schedules:", err);
//     res.status(500).json({ error: 'Server error', detail: err.message });
//   }
// });


// module.exports = router;

//OLD FUNCTIONAL
// routes/scheduler.js
// const express = require('express');
// const router = express.Router();
// const db = require('../db'); // your mysql connection module
// const util = require('util');
// // If you use Node < 18, keep node-fetch; else you can remove and use global fetch
// const fetch = require('node-fetch');
// const query = util.promisify(db.query).bind(db);

// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }

// router.post('/generate', async (req, res) => {
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload // optional: array of ids or objects
//     } = req.body;

//     // Basic validation
//     if (!courseId || !yearLevel || !semester || !sectionCount || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({ error: 'Missing params: courseId, yearLevel, semester, sectionCount, subjects are required' });
//     }

//     // Normalize subject ids (frontend may send ids or objects)
//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject ids provided' });
//     }

//     // Fetch subject details from DB
//     const subjRows = await query('SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)', [subjectIds]);
//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in DB' });
//     }

//     // Determine instructors to use
//     let instructorRows = [];
//     const instructorIdsFromBody = ensureArrayIds(instructorsPayload);

//     if (instructorIdsFromBody.length > 0) {
//       instructorRows = await query('SELECT id, name FROM instructors WHERE id IN (?)', [instructorIdsFromBody]);
//     } else {
//       instructorRows = await query('SELECT id, name FROM instructors WHERE course_id = ?', [courseId]);
//       if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//         instructorRows = await query('SELECT id, name FROM instructors WHERE 1');
//       }
//     }

//     // Fetch rooms (NO capacity anymore)
//     const rooms = await query('SELECT id, name FROM rooms WHERE 1');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({ error: 'No rooms available in DB. Scheduler requires rooms' });
//     }

//     // Build payload for python scheduler
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester,
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({ id: s.id, code: s.subject_code, units: Number(s.units) || 3 })),
//       instructors: instructorRows.map(i => ({ id: i.id })),
//       rooms: rooms.map(r => ({ id: r.id })), // removed capacity
//       days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
//       slotsPerDay: 8
//     };

//     // Call Python microservice (OR-Tools)
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });

//     if (!schedulerRes.ok) {
//       const txt = await schedulerRes.text();
//       console.error('Scheduler microservice error:', txt);
//       return res.status(500).json({ error: 'Scheduler failed', detail: txt });
//     }

//     const schedulerJson = await schedulerRes.json();
//     const assignments = schedulerJson.assignments || [];

//     // Persist: create sections, then insert schedules
//     await query('START TRANSACTION');

//     // create sections
//     const sectionIds = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       const name = `Section ${String.fromCharCode(65 + i)}`; // A, B, C...
//       const result = await query(
//         'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//         [payload.courseId, payload.yearLevel, payload.semester, name, payload.studentsCount]
//       );
//       sectionIds.push(result.insertId);
//     }

//     // // Insert schedules into "schedules" table
//     // for (const a of assignments) {
//     //   const sectionId = sectionIds[a.section_index] || null;
//     //   await query(
//     //     'INSERT INTO schedule (section_id, subject_id, instructor_id, room_id, day, slot_index) VALUES (?,?,?,?,?,?)',
//     //     [sectionId, a.subject_id, a.instructor_id || null, a.room_id || null, a.day, a.slot_index]
//     //   );
//     // }

//     for (const a of assignments) {
//   const sectionId = sectionIds[a.section_index] || null;
//   await query(
//     `INSERT INTO schedule (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//     [
//       payload.courseId,
//       payload.yearLevel,
//       payload.semester,
//       sectionId,
//       a.subject_id,
//       a.instructor_id || null,
//       a.room_id || null,
//       a.day,
//       a.slot_index,
//       a.section_index
//     ]
//   );
// }


//     await query('COMMIT');

//     return res.json({ ok: true, sections: sectionIds, assignments });
//   } catch (err) {
//     console.error('Error generating schedule:', err);
//     try { await query('ROLLBACK'); } catch (e) { /* ignore */ }
//     return res.status(500).json({ error: 'Server error', detail: err.message });
//   }
// });

// router.get('/', async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;

//     let sql = `
//       SELECT s.id, s.section_id, s.subject_id, s.instructor_id, s.room_id, s.day, s.slot_index,
//              subj.subject_code, subj.description,
//              i.name AS instructor_name,
//              r.name AS room_name,
//              sec.name AS section_name
//       FROM schedule s
//       JOIN subjects subj ON s.subject_id = subj.id
//       JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       WHERE 1
//     `;

//     const params = [];
//     if (courseId) { sql += " AND sec.course_id = ?"; params.push(courseId); }
//     if (yearLevel) { sql += " AND sec.year_level = ?"; params.push(yearLevel); }
//     if (semester) { sql += " AND sec.semester = ?"; params.push(semester); }

//     const rows = await query(sql, params);
//     res.json(rows);
//   } catch (err) {
//     console.error("Error fetching schedules:", err);
//     res.status(500).json({ error: 'Server error', detail: err.message });
//   }
// });

// module.exports = router;

// routes/scheduler.js

//FUNCTIONAL

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const fetch = require('node-fetch');
// const query = util.promisify(db.query).bind(db);

// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }

// router.post('/generate', async (req, res) => {
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload
//     } = req.body;

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({ error: 'Missing params: courseId, yearLevel, semester, subjects are required' });
//     }

//     // Normalize subject ids
//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject ids provided' });
//     }

//     // Subjects
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectIds]
//     );
//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in DB' });
//     }

//     // Instructors
//     let instructorRows = [];
//     const instructorIdsFromBody = ensureArrayIds(instructorsPayload);
//     if (instructorIdsFromBody.length > 0) {
//       instructorRows = await query('SELECT id, name FROM instructors WHERE id IN (?)', [instructorIdsFromBody]);
//     } else {
//       instructorRows = await query('SELECT id, name FROM instructors WHERE course_id = ?', [courseId]);
//       if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//         instructorRows = await query('SELECT id, name FROM instructors');
//       }
//     }

//     // Rooms
//     const rooms = await query('SELECT id, name FROM rooms');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({ error: 'No rooms available in DB. Scheduler requires rooms' });
//     }

//     // Payload for Python
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester,
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3
//       })),
//       instructors: instructorRows.map(i => ({ id: i.id })),
//       rooms: rooms.map(r => ({ id: r.id })),
//       days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
//       slotsPerDay: 8
//     };

//     // Call Python microservice
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });

//     if (!schedulerRes.ok) {
//       const txt = await schedulerRes.text();
//       console.error('Scheduler microservice error:', txt);
//       return res.status(500).json({ error: 'Scheduler failed', detail: txt });
//     }

//     const schedulerJson = await schedulerRes.json();
//     const assignments = schedulerJson.assignments || [];

//     // Persist
//     await query('START TRANSACTION');
//     const sectionIds = [];

//     for (let i = 0; i < payload.sectionCount; i++) {
//       const name = `Section ${String.fromCharCode(65 + i)}`;
//       const result = await query(
//         'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//         [payload.courseId, payload.yearLevel, payload.semester, name, payload.studentsCount]
//       );
//       sectionIds.push(result.insertId);
//     }

//     for (const a of assignments) {
//       const sectionId = sectionIds[a.section_index] || null;
//       await query(
//         `INSERT INTO schedule
//           (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index)
//          VALUES (?,?,?,?,?,?,?,?,?,?)`,
//         [
//           payload.courseId,
//           payload.yearLevel,
//           payload.semester,
//           sectionId,
//           a.subject_id,
//           a.instructor_id || null,
//           a.room_id || null,
//           a.day,
//           a.slot_index,
//           a.section_index
//         ]
//       );
//     }
//     //
// for (const a of assignments) {
//   const subj = subjRows.find(s => s.id === a.subject_id);
//   const instr = instructorRows.find(i => i.id === a.instructor_id);
//   const room = rooms.find(r => r.id === a.room_id);

//   a.subject_code = subj ? subj.subject_code : null;
//   a.instructor_name = instr ? instr.name : null;
//   a.room_name = room ? room.name : null;
// }
//     await query('COMMIT');
//     return res.json({ ok: true, sections: sectionIds, assignments });
//   } catch (err) {
//     console.error('Error generating schedule:', err);
//     try { await query('ROLLBACK'); } catch {}
//     return res.status(500).json({ error: 'Server error', detail: err.message });
//   }
// });

// // GET schedules
// router.get('/', async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;
//     let sql = `
//       SELECT s.id, s.section_id, s.subject_id, s.instructor_id, s.room_id, s.day, s.slot_index,
//              subj.subject_code, subj.description,
//              i.name AS instructor_name,
//              r.name AS room_name,
//              sec.name AS section_name
//       FROM schedule s
//       JOIN subjects subj ON s.subject_id = subj.id
//       JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       WHERE 1
//     `;
//     const params = [];
//     if (courseId) { sql += ' AND sec.course_id = ?'; params.push(courseId); }
//     if (yearLevel) { sql += ' AND sec.year_level = ?'; params.push(yearLevel); }
//     if (semester) { sql += ' AND sec.semester = ?'; params.push(semester); }
//     const rows = await query(sql, params);
//     res.json(rows);
//   } catch (err) {
//     console.error('Error fetching schedules:', err);
//     res.status(500).json({ error: 'Server error', detail: err.message });
//   }
// });

// // ✅ scheduler.js
// router.get("/check", (req, res) => {
//   const { day, slot_index } = req.query;

//   if (!day || !slot_index) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   const sql = `
//     SELECT room_id 
//     FROM schedule 
//     WHERE day = ? AND slot_index = ?
//   `;

//   db.query(sql, [day, Number(slot_index)], (err, results) => {
//     if (err) {
//       console.error("Error checking used rooms:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     const usedRoomIds = results.map((row) => row.room_id);
//     res.json({ usedRoomIds });
//   });
// });



// module.exports = router;

//FUNCTIONAL
//edusched-backend/routes/scheduler.js
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const fetch = require('node-fetch');
// const query = util.promisify(db.query).bind(db);

// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }


// // Predefined times for slots (7:00 AM – 7:00 PM)
// const startTimes = [
//   "07:00:00", "08:00:00", "09:00:00", "10:00:00",
//   "11:00:00", "12:00:00", "13:00:00", "14:00:00",
//   "15:00:00", "16:00:00", "17:00:00", "18:00:00"
// ];
// const endTimes = [
//   "08:00:00", "09:00:00", "10:00:00", "11:00:00",
//   "12:00:00", "13:00:00", "14:00:00", "15:00:00",
//   "16:00:00", "17:00:00", "18:00:00", "19:00:00"
// ];


// // ------------------- GENERATE -------------------
// router.post('/generate', async (req, res) => {
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload
//     } = req.body;

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({ error: 'Missing params: courseId, yearLevel, semester, subjects are required' });
//     }

//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject ids provided' });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectIds]
//     );
//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in DB' });
//     }
// let instructorRows = [];
// const instructorIdsFromBody = ensureArrayIds(instructorsPayload);
    
// if (instructorIdsFromBody.length > 0) {
//   instructorRows = await query('SELECT id, name FROM instructors WHERE id IN (?)', [instructorIdsFromBody]);
// } else {
//   instructorRows = await query('SELECT id, name FROM instructors WHERE course_id = ?', [courseId]);
//   if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//     instructorRows = await query('SELECT id, name FROM instructors');
//   }
// }



//     const rooms = await query('SELECT id, name FROM rooms');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({ error: 'No rooms available in DB. Scheduler requires rooms' });
//     }

//     // Payload for Python microservice
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester,
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3
//       })),
//       instructors: instructorRows.map(i => ({ id: i.id })),
//       rooms: rooms.map(r => ({ id: r.id })),
//       days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
//       slotsPerDay: 12

//     };

//     // Call Python microservice
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });

//     if (!schedulerRes.ok) {
//       const txt = await schedulerRes.text();
//       console.error('Scheduler microservice error:', txt);
//       return res.status(500).json({ error: 'Scheduler failed', detail: txt });
//     }

//     const schedulerJson = await schedulerRes.json();
//     const assignments = schedulerJson.assignments || [];

//     await query('START TRANSACTION');
//     const sectionIds = [];

//     // Create sections
//     for (let i = 0; i < payload.sectionCount; i++) {
//       const name = `Section ${String.fromCharCode(65 + i)}`;
//       const result = await query(
//         'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//         [payload.courseId, payload.yearLevel, payload.semester, name, payload.studentsCount]
//       );
//       sectionIds.push(result.insertId);
//     }

//     // Save schedules with start/end times
//     for (const a of assignments) {
//       const sectionId = sectionIds[a.section_index] || null;
//       const startTime = startTimes[a.slot_index] || "00:00:00";
//       const endTime = endTimes[a.slot_index] || "00:00:00";

//       await query(
//         `INSERT INTO schedule
//           (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time)
//          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//         [
//           payload.courseId,
//           payload.yearLevel,
//           payload.semester,
//           sectionId,
//           a.subject_id,
//           a.instructor_id || null,
//           a.room_id || null,
//           a.day,
//           a.slot_index,
//           a.section_index,
//           startTime,
//           endTime
//         ]
//       );
//     }

//     await query('COMMIT');
//     res.json({ ok: true, sections: sectionIds, assignments });
//   } catch (err) {
//     console.error('Error generating schedule:', err);
//     try { await query('ROLLBACK'); } catch {}
//     res.status(500).json({ error: 'Server error', detail: err.message });
//   }
// });

// // ------------------- CHECK USED ROOMS -------------------
// router.get("/check", (req, res) => {
//   const { day, slot_index } = req.query;

//   if (!day || !slot_index) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   const sql = `
//     SELECT room_id 
//     FROM schedule 
//     WHERE day = ? AND slot_index = ?
//   `;

//   db.query(sql, [day, Number(slot_index)], (err, results) => {
//     if (err) {
//       console.error("Error checking used rooms:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     const usedRoomIds = results.map((row) => row.room_id);
//     res.json({ usedRoomIds });
//   });
// });

// //functional in dean when generate schedule
// // // GET schedules
// // router.get('/', async (req, res) => {
// //   try {
// //     const { courseId, yearLevel, semester } = req.query;
// //     let sql = `
// //       SELECT s.id, s.section_id, s.subject_id, s.instructor_id, s.room_id, s.day, s.slot_index,
// //              subj.subject_code, subj.description,
// //              i.name AS instructor_name,
// //              r.name AS room_name,
// //              sec.name AS section_name
// //       FROM schedule s
// //       JOIN subjects subj ON s.subject_id = subj.id
// //       JOIN sections sec ON s.section_id = sec.id
// //       LEFT JOIN instructors i ON s.instructor_id = i.id
// //       LEFT JOIN rooms r ON s.room_id = r.id
// //       WHERE 1
// //     `;
// //     const params = [];
// //     if (courseId) { sql += ' AND sec.course_id = ?'; params.push(courseId); }
// //     if (yearLevel) { sql += ' AND sec.year_level = ?'; params.push(yearLevel); }
// //     if (semester) { sql += ' AND sec.semester = ?'; params.push(semester); }
// //     const rows = await query(sql, params);
// //     res.json(rows);
// //   } catch (err) {
// //     console.error('Error fetching schedules:', err);
// //     res.status(500).json({ error: 'Server error', detail: err.message });
// //   }
// // });

// //ADD

// // 📁 routes/scheduler.js
// // ✅ GET all schedules (joined properly)
// // ✅ Unified GET schedules route (works for both Dean & Admin)
// // ✅ GET all schedules (with course, year level, semester)
// router.get("/", (req, res) => {
//   const sql = `
//     SELECT 
//       s.id,
//       s.course_id,
//       c.name AS course_name,
//       CASE s.year_level
//         WHEN 1 THEN '1st Year'
//         WHEN 2 THEN '2nd Year'
//         WHEN 3 THEN '3rd Year'
//         WHEN 4 THEN '4th Year'
//         ELSE 'Unspecified Year'
//       END AS year_level,
//       CASE s.semester
//         WHEN 1 THEN '1st Semester'
//         WHEN 2 THEN '2nd Semester'
//         ELSE 'Unspecified Semester'
//       END AS semester,
//       s.section_id,
//       s.subject_id,
//       subj.description AS subject_name,
//       s.instructor_id,
//       i.name AS instructor_name,
//       s.room_id,
//       r.name AS room_name,
//       s.day,
//       s.slot_index,
//       s.start_time,
//       s.end_time
//     FROM schedule s
//     LEFT JOIN courses c ON s.course_id = c.id
//     LEFT JOIN subjects subj ON s.subject_id = subj.id
//     LEFT JOIN instructors i ON s.instructor_id = i.id
//     LEFT JOIN rooms r ON s.room_id = r.id
//   `;

//   db.query(sql, (err, result) => {
//     if (err) {
//       console.error("❌ Error fetching schedules:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     console.log("✅ Fetched schedules:", result.length);
//     res.json(result);
//   });
// });

// // DELETE schedule
// // DELETE a schedule by ID
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;
//   console.log("🗑️ Attempting to delete schedule with ID:", id);

//   const sql = "DELETE FROM schedule WHERE id = ?";
//   db.query(sql, [id], (err, result) => {
//     if (err) {
//       console.error("Error deleting schedule:", err);
//       return res.status(500).json({ error: "Database error", detail: err.message });
//     }

//     console.log("Delete result:", result);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     res.json({ success: true, message: "Schedule deleted successfully" });
//   });
// });



// module.exports = router;

//FUNCTIONAL-okay to
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const fetch = require('node-fetch');
// const query = util.promisify(db.query).bind(db);

// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }

// // Predefined times for slots
// const startTimes = [
//   "08:00:00", "09:00:00", "10:00:00", "11:00:00",
//   "12:00:00", "13:00:00", "14:00:00", "15:00:00"
// ];
// const endTimes = [
//   "09:00:00", "10:00:00", "11:00:00", "12:00:00",
//   "13:00:00", "14:00:00", "15:00:00", "16:00:00"
// ];

// // ------------------- GENERATE -------------------
// router.post('/generate', async (req, res) => {
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload
//     } = req.body;

//     if (
//       !courseId || !yearLevel || !semester ||
//       !Array.isArray(subjectsPayload) || subjectsPayload.length === 0
//     ) {
//       return res.status(400).json({ error: 'Missing params: courseId, yearLevel, semester, subjects are required' });
//     }

//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject ids provided' });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectIds]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in DB' });
//     }

//     let instructorRows = [];
//     const instructorIdsFromBody = ensureArrayIds(instructorsPayload);

//     if (instructorIdsFromBody.length > 0) {
//       instructorRows = await query('SELECT id, name FROM instructors WHERE id IN (?)', [instructorIdsFromBody]);
//     } else {
//       instructorRows = await query('SELECT id, name FROM instructors WHERE course_id = ?', [courseId]);
//       if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//         instructorRows = await query('SELECT id, name FROM instructors');
//       }
//     }

//     const rooms = await query('SELECT id, name FROM rooms');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({ error: 'No rooms available in DB. Scheduler requires rooms' });
//     }

//     // Payload for Python microservice
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester,
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3
//       })),
//       instructors: instructorRows.map(i => ({ id: i.id })),
//       rooms: rooms.map(r => ({ id: r.id })),
//       days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
//       slotsPerDay: 8
//     };

//     // Call Python microservice
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });

//     if (!schedulerRes.ok) {
//       const txt = await schedulerRes.text();
//       console.error('Scheduler microservice error:', txt);
//       return res.status(500).json({ error: 'Scheduler failed', detail: txt });
//     }

//     const schedulerJson = await schedulerRes.json();
//     const assignments = schedulerJson.assignments || [];

//     await query('START TRANSACTION');
//     const sectionIds = [];

//     // Create sections
//     for (let i = 0; i < payload.sectionCount; i++) {
//       const name = `Section ${String.fromCharCode(65 + i)}`;
//       const result = await query(
//         'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//         [payload.courseId, payload.yearLevel, payload.semester, name, payload.studentsCount]
//       );
//       sectionIds.push(result.insertId);
//     }

//     // Save schedules with start/end times
//     for (const a of assignments) {
//       const sectionId = sectionIds[a.section_index] || null;
//       const startTime = startTimes[a.slot_index] || "00:00:00";
//       const endTime = endTimes[a.slot_index] || "00:00:00";

//       await query(
//         'INSERT INTO schedule (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
//         [
//           payload.courseId,
//           payload.yearLevel,
//           payload.semester,
//           sectionId,
//           a.subject_id,
//           a.instructor_id || null,
//           a.room_id || null,
//           a.day,
//           a.slot_index,
//           a.section_index,
//           startTime,
//           endTime
//         ]
//       );
//     }

//     await query('COMMIT');
//     res.json({ ok: true, sections: sectionIds, assignments });

//   } catch (err) {
//     console.error('Error generating schedule:', err);
//     try { await query('ROLLBACK'); } catch { }
//     res.status(500).json({ error: 'Server error', detail: err.message });
//   }
// });

// // ------------------- CHECK USED ROOMS -------------------
// router.get("/check", (req, res) => {
//   const { day, slot_index } = req.query;
//   if (!day || !slot_index) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   const sql = "SELECT room_id FROM schedule WHERE day = ? AND slot_index = ?";
//   db.query(sql, [day, Number(slot_index)], (err, results) => {
//     if (err) {
//       console.error("Error checking used rooms:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     const usedRoomIds = results.map((row) => row.room_id);
//     res.json({ usedRoomIds });
//   });
// });

// // ------------------- GET SCHEDULES (Dean/Admin) -------------------
// router.get("/", (req, res) => {
//   const sql = `
//     SELECT 
//       s.id, 
//       s.course_id, 
//       c.name AS course_name,
//       CASE s.year_level
//         WHEN 1 THEN '1st Year'
//         WHEN 2 THEN '2nd Year'
//         WHEN 3 THEN '3rd Year'
//         WHEN 4 THEN '4th Year'
//         ELSE 'Unspecified Year'
//       END AS year_level,
//       CASE s.semester
//         WHEN 1 THEN '1st Semester'
//         WHEN 2 THEN '2nd Semester'
//         ELSE 'Unspecified Semester'
//       END AS semester,
//       s.section_id,
//       s.subject_id,
//       subj.description AS subject_name,
//       s.instructor_id,
//       i.name AS instructor_name,
//       s.room_id,
//       r.name AS room_name,
//       s.day,
//       s.slot_index,
//       s.start_time,
//       s.end_time
//     FROM schedule s
//     LEFT JOIN courses c ON s.course_id = c.id
//     LEFT JOIN subjects subj ON s.subject_id = subj.id
//     LEFT JOIN instructors i ON s.instructor_id = i.id
//     LEFT JOIN rooms r ON s.room_id = r.id
//   `;

//   db.query(sql, (err, result) => {
//     if (err) {
//       console.error("❌ Error fetching schedules:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     console.log("✅ Fetched schedules:", result.length);
//     res.json(result);
//   });
// });

// // ------------------- DELETE SCHEDULE -------------------
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;
//   console.log("🗑️ Attempting to delete schedule with ID:", id);

//   const sql = "DELETE FROM schedule WHERE id = ?";
//   db.query(sql, [id], (err, result) => {
//     if (err) {
//       console.error("Error deleting schedule:", err);
//       return res.status(500).json({ error: "Database error", detail: err.message });
//     }

//     console.log("Delete result:", result);
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     res.json({ success: true, message: "Schedule deleted successfully" });
//   });
// });

// module.exports = router;
//new 
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const fetch = require('node-fetch');

// const query = util.promisify(db.query).bind(db);
// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// // ✅ UPDATED: 7 AM to 7 PM = 12 one-hour slots
// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }

// /**
//  * Check for existing conflicts in database before generating
//  */
// async function checkExistingConflicts(courseId, yearLevel, semester) {
//   try {
//     // Check if there's already a schedule for this course/year/semester
//     const existing = await query(
//       'SELECT COUNT(*) as count FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?',
//       [courseId, yearLevel, semester]
//     );
    
//     return existing[0].count > 0;
//   } catch (err) {
//     console.error('Error checking conflicts:', err);
//     return false;
//   }
// }

// /**
//  * Validate assignments for conflicts before saving
//  */
// function validateAssignments(assignments) {
//   const errors = [];
  
//   // Check room conflicts
//   const roomUsage = new Map();
//   // Check instructor conflicts
//   const instructorUsage = new Map();
//   // Check section conflicts
//   const sectionUsage = new Map();
  
//   assignments.forEach((a, idx) => {
//     // Room conflict check
//     const roomKey = `${a.room_id}-${a.day}-${a.slot_index}`;
//     if (roomUsage.has(roomKey)) {
//       errors.push(`Room conflict: Room ${a.room_id} on ${a.day} slot ${a.slot_index}`);
//     }
//     roomUsage.set(roomKey, idx);
    
//     // Instructor conflict check
//     const instrKey = `${a.instructor_id}-${a.day}-${a.slot_index}`;
//     if (instructorUsage.has(instrKey)) {
//       errors.push(`Instructor conflict: Instructor ${a.instructor_id} on ${a.day} slot ${a.slot_index}`);
//     }
//     instructorUsage.set(instrKey, idx);
    
//     // Section conflict check
//     const sectionKey = `${a.section_index}-${a.day}-${a.slot_index}`;
//     if (sectionUsage.has(sectionKey)) {
//       errors.push(`Section conflict: Section ${a.section_index} on ${a.day} slot ${a.slot_index}`);
//     }
//     sectionUsage.set(sectionKey, idx);
//   });
  
//   return { valid: errors.length === 0, errors };
// }

// // ==================== GENERATE SCHEDULE ====================
// router.post('/generate', async (req, res) => {
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload
//     } = req.body;

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject IDs provided' });
//     }

//     // Check for existing schedules
//     const hasConflicts = await checkExistingConflicts(courseId, yearLevel, semester);
//     if (hasConflicts) {
//       console.log('⚠️ Warning: Existing schedule found for this course/year/semester');
//       // You can choose to delete old schedules or return error
//       // For now, we'll allow it but log a warning
//     }

//     // Fetch subjects from database
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectIds]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // ✅ IMPORTANT: Only use instructors from the payload (course-specific)
//     let instructorRows = [];
//     const instructorIdsFromBody = ensureArrayIds(instructorsPayload);
    
//     if (instructorIdsFromBody.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors selected',
//         detail: 'Please select at least one instructor for this course'
//       });
//     }

//     instructorRows = await query(
//       'SELECT id, name FROM instructors WHERE id IN (?)',
//       [instructorIdsFromBody]
//     );

//     if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//       return res.status(400).json({
//         error: 'Selected instructors not found',
//         detail: 'The instructors you selected do not exist in the database'
//       });
//     }

//     // Fetch all available rooms
//     const rooms = await query('SELECT id, name FROM rooms');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({
//         error: 'No rooms available',
//         detail: 'Please add rooms to the system before generating schedules'
//       });
//     }

//     console.log(`📊 Generating schedule for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
//     console.log(`   Subjects: ${subjRows.length}, Instructors: ${instructorRows.length}, Rooms: ${rooms.length}, Sections: ${sectionCount}`);

//     // Prepare payload for Python microservice
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3
//       })),
//       instructors: instructorRows.map(i => ({ id: i.id, name: i.name })),
//       rooms: rooms.map(r => ({ id: r.id, name: r.name })),
//       days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
//       slotsPerDay: 12  // ✅ 7 AM to 7 PM
//     };

//     // Call Python scheduler microservice
//     console.log('🔧 Calling Python scheduler...');
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//       timeout: 60000  // 60 second timeout
//     });

//     if (!schedulerRes.ok) {
//       const errorText = await schedulerRes.text();
//       console.error('❌ Scheduler microservice error:', errorText);
//       return res.status(500).json({
//         error: 'Schedule generation failed',
//         detail: errorText
//       });
//     }

//     const schedulerJson = await schedulerRes.json();
//     const assignments = schedulerJson.assignments || [];

//     if (assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'The scheduler could not create any valid assignments'
//       });
//     }

//     console.log(`✅ Scheduler returned ${assignments.length} assignments`);

//     // ✅ Validate assignments for conflicts
//     const validation = validateAssignments(assignments);
//     if (!validation.valid) {
//       console.error('❌ Validation failed:', validation.errors);
//       return res.status(400).json({
//         error: 'Schedule validation failed',
//         conflicts: validation.errors
//       });
//     }

//     console.log('✅ Validation passed - no conflicts detected');

//     // Start database transaction
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries with proper time slots
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index] || null;
        
//         // Get time slot
//         const timeSlot = TIME_SLOTS[a.slot_index];
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.instructor_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
//       console.log(`✅ Successfully saved ${savedCount} schedule entries`);

//       res.json({
//         success: true,
//         message: 'Schedule generated successfully',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjRows.length,
//           instructors: instructorRows.length,
//           rooms: rooms.length,
//           sections: sectionCount
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ==================== CHECK ROOM AVAILABILITY ====================
// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = "SELECT room_id, instructor_id FROM schedule WHERE day = ? AND slot_index = ?";
//     let params = [day, Number(slot_index)];

//     // Optionally filter by course/year/semester
//     if (courseId && yearLevel && semester) {
//       sql += " AND course_id = ? AND year_level = ? AND semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
    
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// // ==================== GET ALL SCHEDULES ====================
// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT 
//         s.id,
//         s.course_id,
//         c.name AS course_name,
//         c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id,
//         sec.name AS section_name,
//         s.subject_id,
//         subj.subject_code,
//         subj.description AS subject_name,
//         s.instructor_id,
//         i.name AS instructor_name,
//         s.room_id,
//         r.name AS room_name,
//         s.day,
//         s.slot_index,
//         s.start_time,
//         s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index
//     `;

//     const results = await query(sql);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// // ==================== DELETE SCHEDULE ====================
// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
    
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// // ==================== DELETE ALL SCHEDULES FOR COURSE/YEAR/SEM ====================
// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//withavailability
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const fetch = require('node-fetch');

// const query = util.promisify(db.query).bind(db);
// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }

// async function checkExistingConflicts(courseId, yearLevel, semester) {
//   try {
//     const existing = await query(
//       'SELECT COUNT(*) as count FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?',
//       [courseId, yearLevel, semester]
//     );
//     return existing[0].count > 0;
//   } catch (err) {
//     console.error('Error checking conflicts:', err);
//     return false;
//   }
// }

// function validateAssignments(assignments) {
//   const errors = [];
//   const roomUsage = new Map();
//   const instructorUsage = new Map();
//   const sectionUsage = new Map();
  
//   assignments.forEach((a, idx) => {
//     const roomKey = `${a.room_id}-${a.day}-${a.slot_index}`;
//     if (roomUsage.has(roomKey)) {
//       errors.push(`Room conflict: Room ${a.room_id} on ${a.day} slot ${a.slot_index}`);
//     }
//     roomUsage.set(roomKey, idx);
    
//     const instrKey = `${a.instructor_id}-${a.day}-${a.slot_index}`;
//     if (instructorUsage.has(instrKey)) {
//       errors.push(`Instructor conflict: Instructor ${a.instructor_id} on ${a.day} slot ${a.slot_index}`);
//     }
//     instructorUsage.set(instrKey, idx);
    
//     const sectionKey = `${a.section_index}-${a.day}-${a.slot_index}`;
//     if (sectionUsage.has(sectionKey)) {
//       errors.push(`Section conflict: Section ${a.section_index} on ${a.day} slot ${a.slot_index}`);
//     }
//     sectionUsage.set(sectionKey, idx);
//   });
  
//   return { valid: errors.length === 0, errors };
// }

// // Fetch instructor availability from database
// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     // Group by instructor_id
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_id]) {
//         availMap[row.instructor_id] = {
//           name: row.instructor_name,
//           slots: []
//         };
//       }
//       availMap[row.instructor_id].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// // Convert time string (HH:MM:SS) to slot index (0-11 for 7AM-7PM)
// function timeToSlotIndex(timeStr) {
//   const [hours] = timeStr.split(':').map(Number);
//   if (hours < 7 || hours >= 19) return -1;
//   return hours - 7;
// }

// // Check if a time slot falls within availability window
// function isSlotWithinAvailability(slotIndex, day, availabilitySlots) {
//   const slotStart = 7 + slotIndex; // e.g., slot 0 = 7 AM
//   const slotEnd = slotStart + 1;   // e.g., slot 0 = 7-8 AM
  
//   return availabilitySlots.some(slot => {
//     if (slot.day !== day) return false;
    
//     const availStart = parseInt(slot.start_time.split(':')[0]);
//     const availEnd = parseInt(slot.end_time.split(':')[0]);
    
//     // Check if slot falls completely within availability window
//     return slotStart >= availStart && slotEnd <= availEnd;
//   });
// }

// router.post('/generate', async (req, res) => {
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload,
//       considerInstructorAvailability = true
//     } = req.body;

//     console.log('📥 Generate request received');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject IDs provided' });
//     }

//     // Check for existing schedules
//     const hasConflicts = await checkExistingConflicts(courseId, yearLevel, semester);
//     if (hasConflicts) {
//       console.log('⚠️ Warning: Existing schedule found for this course/year/semester');
//     }

//     // Fetch subjects
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectIds]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Process instructors payload
//     let instructorIdsFromBody = [];
//     let availabilityStatusMap = {}; // Maps instructor ID to availability status from frontend
    
//     if (Array.isArray(instructorsPayload)) {
//       instructorsPayload.forEach(item => {
//         const id = typeof item === 'object' ? item.id : item;
//         instructorIdsFromBody.push(id);
//         if (typeof item === 'object') {
//           availabilityStatusMap[id] = item.available !== false;
//         } else {
//           availabilityStatusMap[id] = true;
//         }
//       });
//     }
    
//     if (instructorIdsFromBody.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors selected',
//         detail: 'Please select at least one instructor for this course'
//       });
//     }

//     // Fetch instructor details
//     const instructorRows = await query(
//       'SELECT id, name FROM instructors WHERE id IN (?)',
//       [instructorIdsFromBody]
//     );

//     if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//       return res.status(400).json({
//         error: 'Selected instructors not found',
//         detail: 'The instructors you selected do not exist in the database'
//       });
//     }

//     // Fetch rooms
//     const rooms = await query('SELECT id, name FROM rooms');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({
//         error: 'No rooms available',
//         detail: 'Please add rooms to the system before generating schedules'
//       });
//     }

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjRows.length}, Instructors: ${instructorRows.length}, Rooms: ${rooms.length}, Sections: ${sectionCount}`);

//     // Fetch availability data from database
//     let instructorAvailData = {};
//     let availableInstructorIds = instructorIdsFromBody;
    
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
      
//       // Filter to only instructors marked as available AND have availability data
//       availableInstructorIds = instructorIdsFromBody.filter(id => {
//         const markedAvailable = availabilityStatusMap[id] === true;
//         const hasAvailabilityData = instructorAvailData[id] !== undefined;
//         return markedAvailable && hasAvailabilityData;
//       });
      
//       if (availableInstructorIds.length === 0) {
//         return res.status(400).json({
//           error: 'No available instructors',
//           detail: 'None of the selected instructors have availability data. Please add availability records or disable availability constraints.'
//         });
//       }
      
//       console.log(`✅ Filtered to ${availableInstructorIds.length} available instructors with data`);
//     }

//     // Build payload for Python scheduler with availability constraints
//     const instructorsForScheduler = instructorRows
//       .filter(i => availableInstructorIds.includes(i.id))
//       .map(i => {
//         const availData = instructorAvailData[i.id];
//         return {
//           id: i.id,
//           name: i.name,
//           available: availabilityStatusMap[i.id] !== false,
//           availability: availData ? availData.slots : []
//         };
//       });

//     if (instructorsForScheduler.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors available after filtering',
//         detail: 'All selected instructors were filtered out based on availability constraints.'
//       });
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3
//       })),
//       instructors: instructorsForScheduler,
//       rooms: rooms.map(r => ({ id: r.id, name: r.name })),
//       days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     console.log('🚀 Calling Python scheduler microservice...');
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//       timeout: 60000
//     });

//     if (!schedulerRes.ok) {
//       const errorText = await schedulerRes.text();
//       console.error('❌ Scheduler microservice error:', errorText);
//       return res.status(500).json({
//         error: 'Schedule generation failed',
//         detail: errorText
//       });
//     }

//     const schedulerJson = await schedulerRes.json();
//     let assignments = schedulerJson.assignments || [];

//     if (assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'The scheduler could not create any valid assignments. Try adjusting constraints.'
//       });
//     }

//     console.log(`✅ Scheduler returned ${assignments.length} assignments`);

//     // Validate assignments
//     const validation = validateAssignments(assignments);
//     if (!validation.valid) {
//       console.error('❌ Validation failed:', validation.errors);
//       return res.status(400).json({
//         error: 'Schedule validation failed',
//         conflicts: validation.errors
//       });
//     }

//     console.log('✅ Validation passed - no conflicts detected');

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index] || null;
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.instructor_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
//       console.log(`✅ Successfully saved ${savedCount} schedule entries`);

//       res.json({
//         success: true,
//         message: 'Schedule generated successfully',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjRows.length,
//           instructors: instructorsForScheduler.length,
//           rooms: rooms.length,
//           sections: sectionCount,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = "SELECT room_id, instructor_id FROM schedule WHERE day = ? AND slot_index = ?";
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND course_id = ? AND year_level = ? AND semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index
//     `;

//     const results = await query(sql);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//WITH INSTRUCTOR AVAILABILITY
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const fetch = require('node-fetch');

// const query = util.promisify(db.query).bind(db);
// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }

// async function checkExistingConflicts(courseId, yearLevel, semester) {
//   try {
//     const existing = await query(
//       'SELECT COUNT(*) as count FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?',
//       [courseId, yearLevel, semester]
//     );
//     return existing[0].count > 0;
//   } catch (err) {
//     console.error('Error checking conflicts:', err);
//     return false;
//   }
// }

// async function validateAssignmentsWithDetails(assignments) {
//   const errors = [];
//   const roomUsage = new Map();
//   const instructorUsage = new Map();
//   const sectionUsage = new Map();
  
//   // Fetch room and instructor names for better error messages
//   const roomIds = [...new Set(assignments.map(a => a.room_id))];
//   const instructorIds = [...new Set(assignments.map(a => a.instructor_id))];
//   const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
  
//   let roomNames = {};
//   let instructorNames = {};
//   let subjectNames = {};
  
//   try {
//     if (roomIds.length > 0) {
//       const rooms = await query('SELECT id, name FROM rooms WHERE id IN (?)', [roomIds]);
//       rooms.forEach(r => { roomNames[r.id] = r.name; });
//     }
    
//     if (instructorIds.length > 0) {
//       const instructors = await query('SELECT id, name FROM instructors WHERE id IN (?)', [instructorIds]);
//       instructors.forEach(i => { instructorNames[i.id] = i.name; });
//     }
    
//     if (subjectIds.length > 0) {
//       const subjects = await query('SELECT id, subject_code FROM subjects WHERE id IN (?)', [subjectIds]);
//       subjects.forEach(s => { subjectNames[s.id] = s.subject_code; });
//     }
//   } catch (err) {
//     console.error('Error fetching validation details:', err);
//   }
  
//   assignments.forEach((a, idx) => {
//     const roomName = roomNames[a.room_id] || `Room-${a.room_id}`;
//     const instructorName = instructorNames[a.instructor_id] || `Instructor-${a.instructor_id}`;
//     const subjectName = subjectNames[a.subject_id] || `Subject-${a.subject_id}`;
//     const timeSlot = TIME_SLOTS[a.slot_index];
//     const timeStr = timeSlot ? `${timeSlot.start.substring(0,5)}-${timeSlot.end.substring(0,5)}` : `Slot ${a.slot_index}`;
    
//     // Check room conflicts
//     const roomKey = `${a.room_id}-${a.day}-${a.slot_index}`;
//     if (roomUsage.has(roomKey)) {
//       const existing = roomUsage.get(roomKey);
//       errors.push({
//         type: 'room',
//         message: `Room "${roomName}" is double-booked on ${a.day} at ${timeStr}`,
//         details: `Conflict: ${existing.subjectName} (Section ${String.fromCharCode(65 + existing.section_index)}) vs ${subjectName} (Section ${String.fromCharCode(65 + a.section_index)})`
//       });
//     }
//     roomUsage.set(roomKey, { ...a, roomName, subjectName });
    
//     // Check instructor conflicts
//     const instrKey = `${a.instructor_id}-${a.day}-${a.slot_index}`;
//     if (instructorUsage.has(instrKey)) {
//       const existing = instructorUsage.get(instrKey);
//       errors.push({
//         type: 'instructor',
//         message: `Instructor "${instructorName}" is scheduled twice on ${a.day} at ${timeStr}`,
//         details: `Teaching: ${existing.subjectName} (Section ${String.fromCharCode(65 + existing.section_index)}) and ${subjectName} (Section ${String.fromCharCode(65 + a.section_index)})`
//       });
//     }
//     instructorUsage.set(instrKey, { ...a, instructorName, subjectName });
    
//     // Check section conflicts
//     const sectionKey = `${a.section_index}-${a.day}-${a.slot_index}`;
//     if (sectionUsage.has(sectionKey)) {
//       const existing = sectionUsage.get(sectionKey);
//       const sectionName = String.fromCharCode(65 + a.section_index);
//       errors.push({
//         type: 'section',
//         message: `Section ${sectionName} has overlapping classes on ${a.day} at ${timeStr}`,
//         details: `Both: ${existing.subjectName} (${existing.instructorName}) and ${subjectName} (${instructorName})`
//       });
//     }
//     sectionUsage.set(sectionKey, { ...a, subjectName, instructorName });
//   });
  
//   return { valid: errors.length === 0, errors };
// }

// // Fetch instructor availability from database
// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     // Group by instructor_id
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_id]) {
//         availMap[row.instructor_id] = {
//           name: row.instructor_name,
//           slots: []
//         };
//       }
//       availMap[row.instructor_id].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// router.post('/generate', async (req, res) => {
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload,
//       considerInstructorAvailability = true
//     } = req.body;

//     console.log('📥 Generate request received');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject IDs provided' });
//     }

//     // Check for existing schedules
//     const hasConflicts = await checkExistingConflicts(courseId, yearLevel, semester);
//     if (hasConflicts) {
//       console.log('⚠️ Warning: Existing schedule found for this course/year/semester');
//     }

//     // Fetch subjects with room names
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectIds]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Process instructors payload
//     let instructorIdsFromBody = [];
//     let availabilityStatusMap = {};
    
//     if (Array.isArray(instructorsPayload)) {
//       instructorsPayload.forEach(item => {
//         const id = typeof item === 'object' ? item.id : item;
//         instructorIdsFromBody.push(id);
//         if (typeof item === 'object') {
//           availabilityStatusMap[id] = item.available !== false;
//         } else {
//           availabilityStatusMap[id] = true;
//         }
//       });
//     }
    
//     if (instructorIdsFromBody.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors selected',
//         detail: 'Please select at least one instructor for this course'
//       });
//     }

//     // Fetch instructor details
//     const instructorRows = await query(
//       'SELECT id, name FROM instructors WHERE id IN (?)',
//       [instructorIdsFromBody]
//     );

//     if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//       return res.status(400).json({
//         error: 'Selected instructors not found',
//         detail: 'The instructors you selected do not exist in the database'
//       });
//     }

//     // Fetch rooms with names
//     const rooms = await query('SELECT id, name FROM rooms');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({
//         error: 'No rooms available',
//         detail: 'Please add rooms to the system before generating schedules'
//       });
//     }

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjRows.length}, Instructors: ${instructorRows.length}, Rooms: ${rooms.length}, Sections: ${sectionCount}`);
//     console.log(`   Room names: ${rooms.map(r => r.name).join(', ')}`);

//     // Fetch availability data from database
//     let instructorAvailData = {};
//     let availableInstructorIds = instructorIdsFromBody;
    
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
      
//       // Filter to only instructors marked as available AND have availability data
//       availableInstructorIds = instructorIdsFromBody.filter(id => {
//         const markedAvailable = availabilityStatusMap[id] === true;
//         const hasAvailabilityData = instructorAvailData[id] !== undefined;
//         return markedAvailable && hasAvailabilityData;
//       });
      
//       if (availableInstructorIds.length === 0) {
//         return res.status(400).json({
//           error: 'No available instructors',
//           detail: 'None of the selected instructors have availability data. Please add availability records or disable availability constraints.'
//         });
//       }
      
//       console.log(`✅ Filtered to ${availableInstructorIds.length} available instructors with data`);
//     }

//     // Build payload for Python scheduler with availability constraints
//     const instructorsForScheduler = instructorRows
//       .filter(i => availableInstructorIds.includes(i.id))
//       .map(i => {
//         const availData = instructorAvailData[i.id];
//         return {
//           id: i.id,
//           name: i.name,
//           available: availabilityStatusMap[i.id] !== false,
//           availability: availData ? availData.slots : []
//         };
//       });

//     if (instructorsForScheduler.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors available after filtering',
//         detail: 'All selected instructors were filtered out based on availability constraints.'
//       });
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3
//       })),
//       instructors: instructorsForScheduler,
//       rooms: rooms.map(r => ({ id: r.id, name: r.name })),
//       days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     console.log('🚀 Calling Python scheduler microservice...');
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//       timeout: 60000
//     });

//     if (!schedulerRes.ok) {
//       const errorText = await schedulerRes.text();
//       console.error('❌ Scheduler microservice error:', errorText);
//       return res.status(500).json({
//         error: 'Schedule generation failed',
//         detail: errorText
//       });
//     }

//     const schedulerJson = await schedulerRes.json();
//     let assignments = schedulerJson.assignments || [];

//     if (assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'The scheduler could not create any valid assignments. Try adjusting constraints.'
//       });
//     }

//     console.log(`✅ Scheduler returned ${assignments.length} assignments`);

//     // Validate assignments with detailed conflict information
//     const validation = await validateAssignmentsWithDetails(assignments);
//     if (!validation.valid) {
//       console.error('❌ Validation failed - conflicts detected:');
//       validation.errors.forEach((err, idx) => {
//         console.error(`   ${idx + 1}. [${err.type.toUpperCase()}] ${err.message}`);
//         console.error(`      ${err.details}`);
//       });
      
//       return res.status(400).json({
//         error: 'Schedule validation failed - conflicts detected',
//         conflicts: validation.errors,
//         conflictCount: validation.errors.length
//       });
//     }

//     console.log('✅ Validation passed - no conflicts detected');

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index] || null;
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.instructor_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
//       console.log(`✅ Successfully saved ${savedCount} schedule entries with room names`);

//       res.json({
//         success: true,
//         message: 'Schedule generated successfully with no conflicts',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjRows.length,
//           instructors: instructorsForScheduler.length,
//           rooms: rooms.length,
//           sections: sectionCount,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: 0
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index
//     `;

//     const results = await query(sql);
//     console.log(`✅ Fetched ${results.length} schedule entries with room names`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//WITH OR-TOOLS

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const fetch = require('node-fetch');

// const query = util.promisify(db.query).bind(db);
// const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }

// async function checkExistingConflicts(courseId, yearLevel, semester) {
//   try {
//     const existing = await query(
//       'SELECT COUNT(*) as count FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?',
//       [courseId, yearLevel, semester]
//     );
//     return existing[0].count > 0;
//   } catch (err) {
//     console.error('Error checking conflicts:', err);
//     return false;
//   }
// }

// async function validateAssignmentsWithDetails(assignments) {
//   const errors = [];
//   const roomUsage = new Map();
//   const instructorUsage = new Map();
//   const sectionUsage = new Map();
  
//   // Fetch room and instructor names for better error messages
//   const roomIds = [...new Set(assignments.map(a => a.room_id))];
//   const instructorIds = [...new Set(assignments.map(a => a.instructor_id))];
//   const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
  
//   let roomNames = {};
//   let instructorNames = {};
//   let subjectNames = {};
  
//   try {
//     if (roomIds.length > 0) {
//       const rooms = await query('SELECT id, name FROM rooms WHERE id IN (?)', [roomIds]);
//       rooms.forEach(r => { roomNames[r.id] = r.name; });
//     }
    
//     if (instructorIds.length > 0) {
//       const instructors = await query('SELECT id, name FROM instructors WHERE id IN (?)', [instructorIds]);
//       instructors.forEach(i => { instructorNames[i.id] = i.name; });
//     }
    
//     if (subjectIds.length > 0) {
//       const subjects = await query('SELECT id, subject_code FROM subjects WHERE id IN (?)', [subjectIds]);
//       subjects.forEach(s => { subjectNames[s.id] = s.subject_code; });
//     }
//   } catch (err) {
//     console.error('Error fetching validation details:', err);
//   }
  
//   assignments.forEach((a, idx) => {
//     const roomName = roomNames[a.room_id] || `Room-${a.room_id}`;
//     const instructorName = instructorNames[a.instructor_id] || `Instructor-${a.instructor_id}`;
//     const subjectName = subjectNames[a.subject_id] || `Subject-${a.subject_id}`;
//     const timeSlot = TIME_SLOTS[a.slot_index];
//     const timeStr = timeSlot ? `${timeSlot.start.substring(0,5)}-${timeSlot.end.substring(0,5)}` : `Slot ${a.slot_index}`;
    
//     // Check room conflicts
//     const roomKey = `${a.room_id}-${a.day}-${a.slot_index}`;
//     if (roomUsage.has(roomKey)) {
//       const existing = roomUsage.get(roomKey);
//       errors.push({
//         type: 'room',
//         message: `Room "${roomName}" is double-booked on ${a.day} at ${timeStr}`,
//         details: `Conflict: ${existing.subjectName} (Section ${String.fromCharCode(65 + existing.section_index)}) vs ${subjectName} (Section ${String.fromCharCode(65 + a.section_index)})`
//       });
//     }
//     roomUsage.set(roomKey, { ...a, roomName, subjectName });
    
//     // Check instructor conflicts
//     const instrKey = `${a.instructor_id}-${a.day}-${a.slot_index}`;
//     if (instructorUsage.has(instrKey)) {
//       const existing = instructorUsage.get(instrKey);
//       errors.push({
//         type: 'instructor',
//         message: `Instructor "${instructorName}" is scheduled twice on ${a.day} at ${timeStr}`,
//         details: `Teaching: ${existing.subjectName} (Section ${String.fromCharCode(65 + existing.section_index)}) and ${subjectName} (Section ${String.fromCharCode(65 + a.section_index)})`
//       });
//     }
//     instructorUsage.set(instrKey, { ...a, instructorName, subjectName });
    
//     // Check section conflicts
//     const sectionKey = `${a.section_index}-${a.day}-${a.slot_index}`;
//     if (sectionUsage.has(sectionKey)) {
//       const existing = sectionUsage.get(sectionKey);
//       const sectionName = String.fromCharCode(65 + a.section_index);
//       errors.push({
//         type: 'section',
//         message: `Section ${sectionName} has overlapping classes on ${a.day} at ${timeStr}`,
//         details: `Both: ${existing.subjectName} (${existing.instructorName}) and ${subjectName} (${instructorName})`
//       });
//     }
//     sectionUsage.set(sectionKey, { ...a, subjectName, instructorName });
//   });
  
//   return { valid: errors.length === 0, errors };
// }

// // Fetch instructor availability from database
// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     // Group by instructor_id
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_id]) {
//         availMap[row.instructor_id] = {
//           name: row.instructor_name,
//           slots: []
//         };
//       }
//       availMap[row.instructor_id].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// router.post('/generate', async (req, res) => {
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload,
//       considerInstructorAvailability = true
//     } = req.body;

//     console.log('📥 Generate request received');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject IDs provided' });
//     }

//     // Check for existing schedules
//     const hasConflicts = await checkExistingConflicts(courseId, yearLevel, semester);
//     if (hasConflicts) {
//       console.log('⚠️ Warning: Existing schedule found for this course/year/semester');
//     }

//     // Fetch subjects with room names
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectIds]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Process instructors payload
//     let instructorIdsFromBody = [];
//     let availabilityStatusMap = {};
    
//     if (Array.isArray(instructorsPayload)) {
//       instructorsPayload.forEach(item => {
//         const id = typeof item === 'object' ? item.id : item;
//         instructorIdsFromBody.push(id);
//         if (typeof item === 'object') {
//           availabilityStatusMap[id] = item.available !== false;
//         } else {
//           availabilityStatusMap[id] = true;
//         }
//       });
//     }
    
//     if (instructorIdsFromBody.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors selected',
//         detail: 'Please select at least one instructor for this course'
//       });
//     }

//     // Fetch instructor details
//     const instructorRows = await query(
//       'SELECT id, name FROM instructors WHERE id IN (?)',
//       [instructorIdsFromBody]
//     );

//     if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//       return res.status(400).json({
//         error: 'Selected instructors not found',
//         detail: 'The instructors you selected do not exist in the database'
//       });
//     }

//     // Fetch rooms with names
//     const rooms = await query('SELECT id, name FROM rooms');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({
//         error: 'No rooms available',
//         detail: 'Please add rooms to the system before generating schedules'
//       });
//     }

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjRows.length}, Instructors: ${instructorRows.length}, Rooms: ${rooms.length}, Sections: ${sectionCount}`);
//     console.log(`   Room names: ${rooms.map(r => r.name).join(', ')}`);

//     // Fetch availability data from database
//     let instructorAvailData = {};
//     let availableInstructorIds = instructorIdsFromBody;
    
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
      
//       // Filter to only instructors marked as available AND have availability data
//       availableInstructorIds = instructorIdsFromBody.filter(id => {
//         const markedAvailable = availabilityStatusMap[id] === true;
//         const hasAvailabilityData = instructorAvailData[id] !== undefined;
//         return markedAvailable && hasAvailabilityData;
//       });
      
//       if (availableInstructorIds.length === 0) {
//         return res.status(400).json({
//           error: 'No available instructors',
//           detail: 'None of the selected instructors have availability data. Please add availability records or disable availability constraints.'
//         });
//       }
      
//       console.log(`✅ Filtered to ${availableInstructorIds.length} available instructors with data`);
//     }

//     // Build payload for Python scheduler with availability constraints
//     const instructorsForScheduler = instructorRows
//       .filter(i => availableInstructorIds.includes(i.id))
//       .map(i => {
//         const availData = instructorAvailData[i.id];
//         return {
//           id: i.id,
//           name: i.name,
//           available: availabilityStatusMap[i.id] !== false,
//           availability: availData ? availData.slots : []
//         };
//       });

//     if (instructorsForScheduler.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors available after filtering',
//         detail: 'All selected instructors were filtered out based on availability constraints.'
//       });
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3
//       })),
//       instructors: instructorsForScheduler,
//       rooms: rooms.map(r => ({ id: r.id, name: r.name })),
//       days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     console.log('🚀 Calling Python scheduler microservice...');
//     const schedulerRes = await fetch(SCHEDULER_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//       timeout: 60000
//     });

//     if (!schedulerRes.ok) {
//       const errorText = await schedulerRes.text();
//       console.error('❌ Scheduler microservice error:', errorText);
//       return res.status(500).json({
//         error: 'Schedule generation failed',
//         detail: errorText
//       });
//     }

//     const schedulerJson = await schedulerRes.json();
//     let assignments = schedulerJson.assignments || [];

//     if (assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'The scheduler could not create any valid assignments. Try adjusting constraints.'
//       });
//     }

//     console.log(`✅ Scheduler returned ${assignments.length} assignments`);

//     // Validate assignments with detailed conflict information
//     const validation = await validateAssignmentsWithDetails(assignments);
//     if (!validation.valid) {
//       console.error('❌ Validation failed - conflicts detected:');
//       validation.errors.forEach((err, idx) => {
//         console.error(`   ${idx + 1}. [${err.type.toUpperCase()}] ${err.message}`);
//         console.error(`      ${err.details}`);
//       });
      
//       return res.status(400).json({
//         error: 'Schedule validation failed - conflicts detected',
//         conflicts: validation.errors,
//         conflictCount: validation.errors.length
//       });
//     }

//     console.log('✅ Validation passed - no conflicts detected');

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index] || null;
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.instructor_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
//       console.log(`✅ Successfully saved ${savedCount} schedule entries with room names`);

//       res.json({
//         success: true,
//         message: 'Schedule generated successfully with no conflicts',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjRows.length,
//           instructors: instructorsForScheduler.length,
//           rooms: rooms.length,
//           sections: sectionCount,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: 0
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index
//     `;

//     const results = await query(sql);
//     console.log(`✅ Fetched ${results.length} schedule entries with room names`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//WITH OPEN AI
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI with error handling
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// // Verify API key is loaded
// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// function ensureArrayIds(input) {
//   if (!input) return [];
//   if (!Array.isArray(input)) return [];
//   return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
// }

// async function checkExistingConflicts(courseId, yearLevel, semester) {
//   try {
//     const existing = await query(
//       'SELECT COUNT(*) as count FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?',
//       [courseId, yearLevel, semester]
//     );
//     return existing[0].count > 0;
//   } catch (err) {
//     console.error('Error checking conflicts:', err);
//     return false;
//   }
// }

// async function validateAssignmentsWithDetails(assignments) {
//   const errors = [];
//   const roomUsage = new Map();
//   const instructorUsage = new Map();
//   const sectionUsage = new Map();
  
//   const roomIds = [...new Set(assignments.map(a => a.room_id))];
//   const instructorIds = [...new Set(assignments.map(a => a.instructor_id))];
//   const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
  
//   let roomNames = {};
//   let instructorNames = {};
//   let subjectNames = {};
  
//   try {
//     if (roomIds.length > 0) {
//       const rooms = await query('SELECT id, name FROM rooms WHERE id IN (?)', [roomIds]);
//       rooms.forEach(r => { roomNames[r.id] = r.name; });
//     }
    
//     if (instructorIds.length > 0) {
//       const instructors = await query('SELECT id, name FROM instructors WHERE id IN (?)', [instructorIds]);
//       instructors.forEach(i => { instructorNames[i.id] = i.name; });
//     }
    
//     if (subjectIds.length > 0) {
//       const subjects = await query('SELECT id, subject_code FROM subjects WHERE id IN (?)', [subjectIds]);
//       subjects.forEach(s => { subjectNames[s.id] = s.subject_code; });
//     }
//   } catch (err) {
//     console.error('Error fetching validation details:', err);
//   }
  
//   assignments.forEach((a, idx) => {
//     const roomName = roomNames[a.room_id] || `Room-${a.room_id}`;
//     const instructorName = instructorNames[a.instructor_id] || `Instructor-${a.instructor_id}`;
//     const subjectName = subjectNames[a.subject_id] || `Subject-${a.subject_id}`;
//     const timeSlot = TIME_SLOTS[a.slot_index];
//     const timeStr = timeSlot ? `${timeSlot.start.substring(0,5)}-${timeSlot.end.substring(0,5)}` : `Slot ${a.slot_index}`;
    
//     // Check room conflicts
//     const roomKey = `${a.room_id}-${a.day}-${a.slot_index}`;
//     if (roomUsage.has(roomKey)) {
//       const existing = roomUsage.get(roomKey);
//       errors.push({
//         type: 'room',
//         message: `Room "${roomName}" is double-booked on ${a.day} at ${timeStr}`,
//         details: `Conflict: ${existing.subjectName} (Section ${String.fromCharCode(65 + existing.section_index)}) vs ${subjectName} (Section ${String.fromCharCode(65 + a.section_index)})`
//       });
//     }
//     roomUsage.set(roomKey, { ...a, roomName, subjectName });
    
//     // Check instructor conflicts
//     const instrKey = `${a.instructor_id}-${a.day}-${a.slot_index}`;
//     if (instructorUsage.has(instrKey)) {
//       const existing = instructorUsage.get(instrKey);
//       errors.push({
//         type: 'instructor',
//         message: `Instructor "${instructorName}" is scheduled twice on ${a.day} at ${timeStr}`,
//         details: `Teaching: ${existing.subjectName} (Section ${String.fromCharCode(65 + existing.section_index)}) and ${subjectName} (Section ${String.fromCharCode(65 + a.section_index)})`
//       });
//     }
//     instructorUsage.set(instrKey, { ...a, instructorName, subjectName });
    
//     // Check section conflicts
//     const sectionKey = `${a.section_index}-${a.day}-${a.slot_index}`;
//     if (sectionUsage.has(sectionKey)) {
//       const existing = sectionUsage.get(sectionKey);
//       const sectionName = String.fromCharCode(65 + a.section_index);
//       errors.push({
//         type: 'section',
//         message: `Section ${sectionName} has overlapping classes on ${a.day} at ${timeStr}`,
//         details: `Both: ${existing.subjectName} (${existing.instructorName}) and ${subjectName} (${instructorName})`
//       });
//     }
//     sectionUsage.set(sectionKey, { ...a, subjectName, instructorName });
//   });
  
//   return { valid: errors.length === 0, errors };
// }

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_id]) {
//         availMap[row.instructor_id] = {
//           name: row.instructor_name,
//           slots: []
//         };
//       }
//       availMap[row.instructor_id].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// // ============= GPT SCHEDULING FUNCTIONS =============

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Instructors:', payload.instructors.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Timeout: 60 seconds');
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. No room can be used by multiple classes at the same time (same day, same slot_index)
// 2. No instructor can teach multiple classes at the same time (same day, same slot_index)
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Distribute classes across different days (avoid putting all sessions on one day)
// 6. Maximum 2 sessions per day for the same subject in the same section
// 7. Same subject in the same section should have the same instructor (consistency)
// 8. Respect instructor availability windows if provided
// 9. Balance instructor workload across all instructors
// 10. Avoid scheduling the same instructor at the same time slot on multiple days

// OPTIMIZATION GOALS:
// - Spread classes evenly across the week
// - Prefer morning slots (earlier times are better for students)
// - Balance workload among instructors fairly
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0-based, e.g., 0 for Section A, 1 for Section B),
//   "instructor_id": number,
//   "room_id": number,
//   "day": string (one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }`;

//   // Build availability description
//   let availabilityText = '';
//   if (payload.considerInstructorAvailability) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.instructors.forEach(instr => {
//       if (instr.availability && instr.availability.length > 0) {
//         availabilityText += `\n- ${instr.name} (ID: ${instr.id}): `;
//         availabilityText += instr.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule with these requirements:

// SUBJECTS (each needs to be scheduled exactly this many times):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}) → Schedule ${s.units} times per section`).join('\n')}

// INSTRUCTORS:
// ${payload.instructors.map(i => `- ${i.name} (ID: ${i.id})`).join('\n')}
// ${availabilityText}

// ROOMS:
// ${payload.rooms.map(r => `- ${r.name} (ID: ${r.id})`).join('\n')}

// SECTIONS: ${payload.sectionCount} (0=Section A, 1=Section B, 2=Section C, etc.)
// DAYS: ${payload.days.join(', ')}
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY ${payload.subjects[0]?.units || 3} assignments per section
// - Balance workload: Try to distribute fairly among all ${payload.instructors.length} instructors
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     // Wrap the API call with a timeout promise
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 2000  // Reduced for faster response
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     // Parse the response
//     let parsed = JSON.parse(responseText);
    
//     // Handle different response formats
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       return parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       return parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       return parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     // Handle timeout errors
//     const isTimeout = error.message.includes('timed out');
    
//     // Retry logic for timeout errors
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     // Provide helpful error messages
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. The AI service is taking too long. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// async function refineScheduleWithGPT(assignments, conflicts, payload) {
//   console.log('🔧 Asking GPT to fix conflicts...');
  
//   const systemPrompt = `You are fixing conflicts in a university class schedule. Analyze the conflicts carefully and provide a corrected schedule that resolves ALL issues while maintaining other constraints.`;
  
//   const conflictSummary = conflicts.slice(0, 10).map((c, i) => 
//     `${i+1}. [${c.type.toUpperCase()}] ${c.message}\n   Details: ${c.details}`
//   ).join('\n\n');

//   const userPrompt = `The current schedule has ${conflicts.length} conflicts that MUST be fixed:

// ${conflictSummary}
// ${conflicts.length > 10 ? `\n... and ${conflicts.length - 10} more conflicts` : ''}

// Current problematic assignments (${assignments.length} total):
// ${JSON.stringify(assignments.slice(0, 15), null, 2)}
// ${assignments.length > 15 ? `\n... and ${assignments.length - 15} more assignments` : ''}

// Available resources to resolve conflicts:
// - Rooms: ${payload.rooms.map(r => `${r.name} (ID: ${r.id})`).join(', ')}
// - Instructors: ${payload.instructors.map(i => `${i.name} (ID: ${i.id})`).join(', ')}
// - Days: ${payload.days.join(', ')}
// - Time slots: 0-11 (7AM-7PM)

// Fix ALL conflicts while:
// 1. Maintaining all hard constraints (no double-bookings)
// 2. Keeping the same number of assignments
// 3. Respecting instructor availability
// 4. Balancing workload

// Return the COMPLETE corrected schedule as a JSON object with "assignments" array. Include ALL assignments, not just the fixed ones.`;

//   try {
//     // Wrap the API call with a timeout promise
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.3,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 120 seconds')), 120000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const responseText = completion.choices[0].message.content;
//     const parsed = JSON.parse(responseText);
    
//     return parsed.assignments || parsed.schedule || parsed;

//   } catch (error) {
//     console.error('❌ Error refining schedule:', error.message);
//     throw error;
//   }
// }

// // ============= MAIN ROUTE =============

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       instructors: instructorsPayload,
//       considerInstructorAvailability = false  // Default to false for easier testing
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     const subjectIds = ensureArrayIds(subjectsPayload);
//     if (subjectIds.length === 0) {
//       return res.status(400).json({ error: 'No valid subject IDs provided' });
//     }

//     // Check for existing schedules
//     const hasConflicts = await checkExistingConflicts(courseId, yearLevel, semester);
//     if (hasConflicts) {
//       console.log('⚠️ Warning: Existing schedule found for this course/year/semester');
//     }

//     // Fetch subjects
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectIds]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Process instructors payload
//     let instructorIdsFromBody = [];
//     let availabilityStatusMap = {};
    
//     if (Array.isArray(instructorsPayload)) {
//       instructorsPayload.forEach(item => {
//         const id = typeof item === 'object' ? item.id : item;
//         instructorIdsFromBody.push(id);
//         if (typeof item === 'object') {
//           availabilityStatusMap[id] = item.available !== false;
//         } else {
//           availabilityStatusMap[id] = true;
//         }
//       });
//     }
    
//     if (instructorIdsFromBody.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors selected',
//         detail: 'Please select at least one instructor for this course'
//       });
//     }

//     // Fetch instructor details
//     const instructorRows = await query(
//       'SELECT id, name FROM instructors WHERE id IN (?)',
//       [instructorIdsFromBody]
//     );

//     if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
//       return res.status(400).json({
//         error: 'Selected instructors not found',
//         detail: 'The instructors you selected do not exist in the database'
//       });
//     }

//     // Fetch rooms
//     const rooms = await query('SELECT id, name FROM rooms');
//     if (!Array.isArray(rooms) || rooms.length === 0) {
//       return res.status(400).json({
//         error: 'No rooms available',
//         detail: 'Please add rooms to the system before generating schedules'
//       });
//     }

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjRows.length}, Instructors: ${instructorRows.length}, Rooms: ${rooms.length}, Sections: ${sectionCount}`);

//     // Fetch availability data
//     let instructorAvailData = {};
//     let availableInstructorIds = instructorIdsFromBody;
    
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
      
//       availableInstructorIds = instructorIdsFromBody.filter(id => {
//         const markedAvailable = availabilityStatusMap[id] === true;
//         const hasAvailabilityData = instructorAvailData[id] !== undefined;
//         return markedAvailable && hasAvailabilityData;
//       });
      
//       if (availableInstructorIds.length === 0) {
//         console.log('⚠️ No instructors with availability data, using all instructors');
//         availableInstructorIds = instructorIdsFromBody;
//       } else {
//         console.log(`✅ Filtered to ${availableInstructorIds.length} available instructors with data`);
//       }
//     }

//     // Build payload for GPT
//     const instructorsForScheduler = instructorRows
//       .filter(i => availableInstructorIds.includes(i.id))
//       .map(i => {
//         const availData = instructorAvailData[i.id];
//         return {
//           id: i.id,
//           name: i.name,
//           available: availabilityStatusMap[i.id] !== false,
//           availability: availData ? availData.slots : []
//         };
//       });

//     if (instructorsForScheduler.length === 0) {
//       return res.status(400).json({
//         error: 'No instructors available after filtering',
//         detail: 'All selected instructors were filtered out based on availability constraints.'
//       });
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjRows.map(s => ({
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3
//       })),
//       instructors: instructorsForScheduler,
//       rooms: rooms.map(r => ({ id: r.id, name: r.name })),
//       days: DAYS,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // Validate section indices are within bounds
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.error(`❌ GPT generated invalid section indices:`);
//       invalidSections.forEach(a => {
//         console.error(`   Assignment has section_index ${a.section_index}, but only ${payload.sectionCount} sections (0-${payload.sectionCount - 1}) exist`);
//       });
      
//       // Fix the section indices
//       console.log(`🔧 Automatically fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Validate and refine if needed
//     let attempts = 0;
//     const maxAttempts = 3;
//     let validation = await validateAssignmentsWithDetails(assignments);
    
//     while (!validation.valid && attempts < maxAttempts) {
//       attempts++;
//       console.log(`🔄 Attempt ${attempts}/${maxAttempts}: Asking GPT to fix ${validation.errors.length} conflicts...`);
      
//       try {
//         assignments = await refineScheduleWithGPT(assignments, validation.errors, payload);
//         validation = await validateAssignmentsWithDetails(assignments);
        
//         if (validation.valid) {
//           console.log(`✅ GPT successfully fixed all conflicts on attempt ${attempts}`);
//           break;
//         }
//       } catch (refineErr) {
//         console.error(`❌ Refinement attempt ${attempts} failed:`, refineErr.message);
//         if (attempts >= maxAttempts) {
//           break;
//         }
//       }
//     }

//     if (!validation.valid) {
//       console.error('❌ Validation failed after refinement attempts:');
//       validation.errors.slice(0, 5).forEach((err, idx) => {
//         console.error(`   ${idx + 1}. [${err.type.toUpperCase()}] ${err.message}`);
//         console.error(`      ${err.details}`);
//       });
      
//       return res.status(400).json({
//         error: 'Schedule validation failed - conflicts remain after refinement',
//         conflicts: validation.errors,
//         conflictCount: validation.errors.length,
//         detail: 'Try: 1) Adding more rooms, 2) Adding more instructors, 3) Reducing subjects/sections, or 4) Disabling availability constraints.'
//       });
//     }

//     console.log('✅ Validation passed - no conflicts detected');

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index} (only ${sectionIds.length} sections created)`);
//           console.error(`   Assignment details:`, JSON.stringify(a));
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.instructor_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//       console.log(`✅ Successfully saved ${savedCount} schedule entries (GPT-generated in ${totalTime}s)`);

//       res.json({
//         success: true,
//         message: 'Schedule generated successfully with AI (no conflicts)',
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjRows.length,
//           instructors: instructorsForScheduler.length,
//           rooms: rooms.length,
//           sections: sectionCount,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: 0,
//           refinementAttempts: attempts,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============= OTHER ROUTES (UNCHANGED) =============

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index
//     `;

//     const results = await query(sql);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   // Determine which days to use based on pattern
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTH;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. No room can be used by multiple classes at the same time (same day, same slot_index)
// 2. No instructor can teach multiple classes at the same time (same day, same slot_index)
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Use ONLY the provided rooms for this course/year level
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of 1 hour each
// - For 3-unit courses on TTH: Schedule 2 sessions of 1.5 hours each (use consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section

// OPTIMIZATION GOALS:
// - Spread classes evenly across allowed days
// - Prefer morning slots (7-11 AM) when possible
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0-based, e.g., 0 for Section A, 1 for Section B),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number,
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }`;

//   // Build availability description
//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h) → Teacher: "${s.teacher_name}"`).join('\n')}

// ROOMS (assigned to this course/year):
// ${payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (0=Section A, 1=Section B, 2=Section C, etc.)
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY ${payload.subjects[0]?.units || 3} time slots per section
// - MUST use the exact teacher assigned to each subject
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 3000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       return parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       return parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       return parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     // Fetch teacher assignments
//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     // Fetch room assignments
//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     // Fetch subjects with details
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Fetch availability data if needed
//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     // Build subjects with teacher info
//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignment.duration || 1,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     // Build teachers list with availability
//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     // Build payload for GPT
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // Validate section indices
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Map teacher names to IDs
//     assignments = assignments.map(a => {
//       const teacher = teachersForScheduler.find(t => t.name === a.teacher_name);
//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name
//       };
//     });

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ No teacher ID for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//       console.log(`✅ Successfully saved ${savedCount} schedule entries (GPT-generated in ${totalTime}s)`);

//       res.json({
//         success: true,
//         message: 'Schedule generated successfully with AI (no conflicts)',
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: 0,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index
//     `;

//     const results = await query(sql);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     // First delete sections
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     // Then delete schedule entries
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;



// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection with timeout
//   (async () => {
//     try {
//       const controller = new AbortController();
//       const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       }, {
//         signal: controller.signal
//       });
      
//       clearTimeout(timeoutId);
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       if (testErr.name === 'AbortError' || testErr.message.includes('aborted')) {
//         console.log('⏳ OpenAI API test timed out (this is normal on slow connections)');
//         console.log('   API will still work when you generate schedules');
//       } else if (testErr.message.includes('Incorrect API key') || testErr.message.includes('invalid_api_key')) {
//         console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota') || testErr.message.includes('insufficient_quota')) {
//         console.error('⚠️ OpenAI API quota exceeded:', testErr.message);
//         console.error('   Check your billing: https://platform.openai.com/account/billing');
//       } else {
//         console.log('⏳ OpenAI API test warning:', testErr.message);
//         console.log('   This is usually fine - the API will work when generating schedules');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   // Determine which days to use based on pattern
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTHS') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTHS Pattern: Classes meet 2-3 times per week (Tuesday, Thursday, Saturday) - typically 1-1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Auto-determine best pattern (MWF or TTHS) based on subject requirements';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. No room can be used by multiple classes at the same time (same day, same slot_index)
// 2. No instructor can teach multiple classes at the same time (same day, same slot_index)
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Use ONLY the provided rooms for this course/year level
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of 1 hour each
// - For 3-unit courses on TTHS: Schedule 2-3 sessions (can be 1.5 hours each using consecutive slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section

// OPTIMIZATION GOALS:
// - Spread classes evenly across allowed days
// - Prefer morning slots (7-11 AM) when possible
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0-based, e.g., 0 for Section A, 1 for Section B),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number,
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }`;

//   // Build availability description
//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h) → Teacher: "${s.teacher_name}"`).join('\n')}

// ROOMS (assigned to this course/year):
// ${payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ${payload.schedulePattern === 'MWF' ? 'ALLOWED DAYS: Monday, Wednesday, Friday ONLY' : ''}
// ${payload.schedulePattern === 'TTHS' ? 'ALLOWED DAYS: Tuesday, Thursday, Saturday ONLY' : ''}
// ${payload.schedulePattern === 'BOTH' ? 'ALLOWED DAYS: Any day - auto-determine best pattern per subject' : ''}
// SECTIONS: ${payload.sectionCount} (0=Section A, 1=Section B, 2=Section C, etc.)
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY ${payload.subjects.length > 0 ? payload.subjects[0].units : 3} time slots per section
// - MUST use the exact teacher assigned to each subject
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTHS' ? '- TTHS ONLY: Use Tuesday, Thursday, Saturday only. Can use longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- BOTH: Choose MWF or TTHS pattern per subject based on units and duration.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class: Use consecutive slots (e.g., slot 0 and 1)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0, 1, and possibly 2)

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       return parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       return parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       return parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     // Fetch teacher assignments
//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     // Fetch room assignments
//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     // Fetch subjects with details
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Fetch availability data if needed
//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     // Build subjects with teacher info
//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignment.duration || 1,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     // Build teachers list with availability
//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     // Build payload for GPT
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // Validate and normalize assignments
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Map teacher names to IDs and ensure all fields are present
//     assignments = assignments.map(a => {
//       const teacher = teachersForScheduler.find(t => t.name === a.teacher_name);
//       return {
//         subject_id: a.subject_id,
//         section_index: a.section_index,
//         teacher_id: teacher ? teacher.id : null,
//         teacher_name: a.teacher_name,
//         instructor_name: a.teacher_name, // Frontend expects this field
//         room_id: a.room_id,
//         day: a.day,
//         slot_index: a.slot_index
//       };
//     });

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ No teacher ID for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//       console.log(`✅ Successfully saved ${savedCount} schedule entries (GPT-generated in ${totalTime}s)`);

//       res.json({
//         success: true,
//         message: 'Schedule generated successfully with AI',
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index
//     `;

//     const results = await query(sql);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     // First delete sections
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     // Then delete schedule entries
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//WORKING WITHOUT COURSE FILTERING

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   // Determine which days to use based on pattern
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 2. No instructor can teach multiple classes at the same time (same day, same slot_index) - even if it's different sections
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Use ONLY the provided rooms for this course/year level
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers
// 11. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})

// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of 1 hour each
// - For 3-unit courses on TTH: Schedule 2 sessions of 1.5 hours each (use consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section

// OPTIMIZATION GOALS:
// - Spread classes evenly across allowed days
// - Prefer morning slots (7-11 AM) when possible
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete schedules

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number,
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }`;

//   // Build availability description
//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h) → Teacher: "${s.teacher_name}"`).join('\n')}

// ROOMS (assigned to this course/year):
// ${payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY ${payload.subjects[0]?.units || 3} time slots per section
// - MUST use the exact teacher assigned to each subject
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)

// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     // Validate that all sections are represented
//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });

//     console.log('📊 Section distribution:', sectionCounts);
    
//     // Check if any sections are missing
//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }

//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     return assignments;

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Sections:', sectionCount);
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     // Validate section count
//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     // Fetch teacher assignments
//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     // Fetch room assignments
//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     // Fetch subjects with details
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Fetch availability data if needed
//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     // Build subjects with teacher info
//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignment.duration || 1,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     // Build teachers list with availability
//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     // Build payload for GPT
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // Validate section indices
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Map teacher names to IDs
//     assignments = assignments.map(a => {
//       const teacher = teachersForScheduler.find(t => t.name === a.teacher_name);
//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name
//       };
//     });

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ No teacher ID for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s) with no conflicts`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: 0,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//       ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index
//     `;

//     const results = await query(sql);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     // First delete sections
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     // Then delete schedule entries
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//FUNCTIONAL WITHOU BTLED MAJOR FILTERING

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   // Determine which days to use based on pattern
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 2. No instructor can teach multiple classes at the same time (same day, same slot_index) - even if it's different sections
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Use ONLY the provided rooms for this course/year level
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers
// 11. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})

// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of 1 hour each
// - For 3-unit courses on TTH: Schedule 2 sessions of 1.5 hours each (use consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section

// OPTIMIZATION GOALS:
// - Spread classes evenly across allowed days
// - Prefer morning slots (7-11 AM) when possible
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete schedules

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number,
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }`;

//   // Build availability description
//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h) → Teacher: "${s.teacher_name}"`).join('\n')}

// ROOMS (assigned to this course/year):
// ${payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY ${payload.subjects[0]?.units || 3} time slots per section
// - MUST use the exact teacher assigned to each subject
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)

// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     // Validate that all sections are represented
//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });

//     console.log('📊 Section distribution:', sectionCounts);
    
//     // Check if any sections are missing
//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }

//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     return assignments;

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Sections:', sectionCount);
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     // Validate section count
//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     // Fetch teacher assignments
//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     // Fetch room assignments
//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     // Fetch subjects with details
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Fetch availability data if needed
//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     // Build subjects with teacher info
//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignment.duration || 1,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     // Build teachers list with availability
//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     // Build payload for GPT
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // Validate section indices
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Map teacher names to IDs
//     assignments = assignments.map(a => {
//       const teacher = teachersForScheduler.find(t => t.name === a.teacher_name);
//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name
//       };
//     });

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ No teacher ID for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s) with no conflicts`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: 0,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;
    
//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     // Add WHERE clause if filters are provided
//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries with filters:`, { courseId, yearLevel, semester });
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     // First delete sections
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     // Then delete schedule entries
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });




// module.exports = router;

//FUNCTIONAL WITHOUT ROOM ASSIGN ON EACH YEAR

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// // FIXED: Accepts optional major parameter for BTLED 3rd year filtering
// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;

//     const params = [courseId, yearLevel, semester];

//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }

//     const results = await query(sql, params);
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   // Determine which days to use based on pattern
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 2. No instructor can teach multiple classes at the same time (same day, same slot_index) - even if it's different sections
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Use ONLY the provided rooms for this course/year level
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers
// 11. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})

// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of 1 hour each
// - For 3-unit courses on TTH: Schedule 2 sessions of 1.5 hours each (use consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section

// OPTIMIZATION GOALS:
// - Spread classes evenly across allowed days
// - Prefer morning slots (7-11 AM) when possible
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete schedules

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number,
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }`;

//   // Build availability description
//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h) → Teacher: "${s.teacher_name}"`).join('\n')}

// ROOMS (assigned to this course/year):
// ${payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY ${payload.subjects[0]?.units || 3} time slots per section
// - MUST use the exact teacher assigned to each subject
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)

// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     // Validate that all sections are represented
//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });

//     console.log('📊 Section distribution:', sectionCounts);
    
//     // Check if any sections are missing
//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }

//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     return assignments;

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major // ← NEW: Receive major from frontend
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Sections:', sectionCount);
//     console.log('   Major (BTLED 3rd year):', major || 'N/A');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     // FIXED: Pass major to fetchTeacherAssignments
//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     // Fetch room assignments (unchanged)
//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     // Fetch subjects with details
//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     // Fetch availability data if needed
//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     // Build subjects with teacher info
//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignment.duration || 1,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     // Build teachers list with availability
//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     // Build payload for GPT
//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // Validate section indices
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Map teacher names to IDs
//     assignments = assignments.map(a => {
//       const teacher = teachersForScheduler.find(t => t.name === a.teacher_name);
//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name
//       };
//     });

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       // Create sections
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       // Save schedule entries
//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ No teacher ID for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s) with no conflicts`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: 0,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES (unchanged)
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;
    
//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries with filters:`, { courseId, yearLevel, semester });
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//NEW

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;

//     const params = [courseId, yearLevel, semester];

//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }

//     const results = await query(sql, params);
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 2. No instructor can teach multiple classes at the same time (same day, same slot_index) - even if it's different sections
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Use ONLY the provided rooms for this course/year level
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers
// 11. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})

// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of 1 hour each
// - For 3-unit courses on TTH: Schedule 2 sessions of 1.5 hours each (use consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section

// OPTIMIZATION GOALS:
// - Spread classes evenly across allowed days
// - Prefer morning slots (7-11 AM) when possible
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete schedules

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number,
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h) → Teacher: "${s.teacher_name}"`).join('\n')}

// ROOMS (assigned to this course/year):
// ${payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY its units time slots per section
// - MUST use the exact teacher assigned to each subject
// - Use the exact teacher_name string as shown above (case-sensitive, exact match, no extra spaces)
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)

// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     // Validate that all sections are represented
//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });

//     console.log('📊 Section distribution:', sectionCounts);
    
//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }

//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     return assignments;

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE (FIXED VERSION)
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Sections:', sectionCount);
//     console.log('   Major (BTLED 3rd year):', major || 'N/A');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     // Validation
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignment.duration || 1,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // ============================================
//     // FIXED: Simplified Teacher Name Matching (Like Old Code)
//     // ============================================
//     console.log('📋 Available teachers:', teachersForScheduler.map(t => `"${t.name}" (ID: ${t.id})`).join(', '));

//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();
      
//       // Try exact match first
//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);
      
//       // Try case-insensitive match
//       if (!teacher) {
//         teacher = teachersForScheduler.find(t => 
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }
      
//       // Try to match by subject assignment (most reliable)
//       if (!teacher && a.subject_id) {
//         const subjectAssignment = teacherAssignments[a.subject_id];
//         if (subjectAssignment && subjectAssignment.teacher_id) {
//           teacher = teachersForScheduler.find(t => t.id === subjectAssignment.teacher_id);
//           if (teacher) {
//             console.log(`✅ Matched "${gptName}" to "${teacher.name}" via subject assignment`);
//           }
//         }
//       }
      
//       // Log if not found
//       if (!teacher) {
//         console.warn(`⚠️ Could not match teacher: "${gptName}" for subject ${a.subject_id}`);
//       } else {
//         console.log(`✅ Matched "${gptName}" to teacher ID ${teacher.id}`);
//       }
      
//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name
//       };
//     });

//     // Log warnings for assignments without teacher_id
//     const assignmentsWithoutTeacher = assignments.filter(a => !a.teacher_id);
//     if (assignmentsWithoutTeacher.length > 0) {
//       console.warn(`⚠️ Warning: ${assignmentsWithoutTeacher.length} assignments have no teacher_id`);
//       assignmentsWithoutTeacher.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Section ${a.section_index}, Teacher: "${a.teacher_name}"`);
//       });
//     }
//     // ============================================

//     // Validate section indices
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ Missing teacher_id for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s) with no conflicts`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: 0,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;
    
//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries with filters:`, { courseId, yearLevel, semester });
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//NEW FIX 

//WORKING WITHOUT ASSIGN CLASS DURATION

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;

//     const params = [courseId, yearLevel, semester];

//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }

//     const results = await query(sql, params);
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. **INSTRUCTOR CONFLICTS ARE FORBIDDEN**: No instructor can teach multiple classes at the same time (same day, same slot_index) - even if it's different sections or different subjects. This is the MOST IMPORTANT rule.
// 2. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Each section uses ONE dedicated room for ALL its subjects (see room assignments below)
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers
// 11. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})

// AVOIDING INSTRUCTOR CONFLICTS (CRITICAL):
// - Before assigning an instructor to a time slot, CHECK if they are already teaching at that day/time
// - If an instructor teaches Section A at Monday 7:00 AM, they CANNOT teach Section B at Monday 7:00 AM
// - Stagger section schedules to avoid instructor conflicts
// - Example: If Professor Smith teaches Math for Section A at Mon 8-9AM, schedule Math for Section B at a DIFFERENT time
// - Track each instructor's schedule as you build the timetable

// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts

// ROOM ASSIGNMENT PER SECTION (CRITICAL):
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (${String.fromCharCode(65 + parseInt(secIdx))}) MUST use Room ID ${room.room_id} (${room.room_name}) for ALL subjects`;
// }).join('\n') : ''}
// - Each section is assigned ONE dedicated room
// - ALL subjects in a section MUST use the same room_id assigned to that section
// - Do NOT use different rooms for different subjects within the same section

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of the assigned duration each
// - For 3-unit courses on TTH: Schedule 2 sessions (may use longer durations or consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section
// - **IMPORTANT**: Each subject has an assigned class duration (e.g., 1h, 1.5h, 2h, etc.) that you MUST respect
// - If a class duration is 1.5 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-8:30)
// - If a class duration is 2 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-9:00)
// - If a class duration is 3 hours, it occupies 3 consecutive time slots (e.g., slots 0-2 for 7:00-10:00)

// OPTIMIZATION GOALS:
// - Spread classes evenly across allowed days
// - Prefer morning slots (7-11 AM) when possible
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete schedules

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number (MUST use the room_id assigned to this section_index),
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }

// REMEMBER: All subjects in Section 0 use the SAME room_id. All subjects in Section 1 use a DIFFERENT room_id, etc.`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h per session) → Teacher: "${s.teacher_name}"`).join('\n')}

// **CRITICAL - CLASS DURATION RULES**:
// - Each subject above has a specific "Duration" (e.g., 1h, 1.5h, 2h, 3h, etc.)
// - This duration represents how long EACH teaching session lasts
// - You MUST respect these durations when scheduling:
//   * 1 hour duration = Use 1 time slot (e.g., slot 0 = 7:00-8:00 AM)
//   * 1.5 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-8:30 AM, but report only slot 0)
//   * 2 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-9:00 AM, but report only slot 0)
//   * 3 hours duration = Use 3 consecutive slots (e.g., slots 0-2 = 7:00-10:00 AM, but report only slot 0)
//   * 4 hours duration = Use 4 consecutive slots (e.g., slots 0-3 = 7:00-11:00 AM, but report only slot 0)
// - When reporting the schedule, only include the STARTING slot_index
// - Example: If Math has 2-hour duration and starts at slot 0 (7 AM), report slot_index: 0 (not 0 and 1)
// - The system will automatically block out the consecutive slots based on duration

// ROOM ASSIGNMENTS BY SECTION:
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`;
// }).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY its units time slots per section
// - MUST use the exact teacher assigned to each subject
// - Use the exact teacher_name string as shown above (case-sensitive, exact match, no extra spaces)
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)

// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });

//     console.log('📊 Section distribution:', sectionCounts);
    
//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }

//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     return assignments;

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE (WITH FIXED TEACHER MATCHING)
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Sections:', sectionCount);
//     console.log('   Major (BTLED 3rd year):', major || 'N/A');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       // Use the assigned duration from teacher assignments (this is the teaching hours per session)
//       const assignedDuration = Number(assignment.duration) || 1;
      
//       console.log(`   Subject ${s.subject_code}: Assigned duration = ${assignedDuration}h per session`);
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignedDuration, // This is how long each teaching session lasts
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     // ============================================
//     // ASSIGN ONE ROOM PER SECTION
//     // ============================================
//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({
//         error: 'Not enough rooms',
//         detail: `You need at least ${sectionCount} rooms for ${sectionCount} section(s). Currently only ${roomAssignments.length} room(s) assigned.`
//       });
//     }

//     // Assign one room per section (Section A gets first room, Section B gets second, etc.)
//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//       console.log(`📍 Section ${String.fromCharCode(65 + i)} → Room ${roomAssignments[i].room_name}`);
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap: sectionRoomMap, // Add this mapping
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // ============================================
//     // FIXED: Improved Teacher Name Matching + Room Assignment
//     // ============================================
//     console.log('📋 Available teachers:', teachersForScheduler.map(t => `"${t.name}" (ID: ${t.id})`).join(', '));

//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();
      
//       // Try exact match first
//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);
      
//       // Try case-insensitive match
//       if (!teacher) {
//         teacher = teachersForScheduler.find(t => 
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }
      
//       // Try to match by subject assignment (most reliable)
//       if (!teacher && a.subject_id) {
//         const subjectAssignment = teacherAssignments[a.subject_id];
//         if (subjectAssignment && subjectAssignment.teacher_id) {
//           teacher = teachersForScheduler.find(t => t.id === subjectAssignment.teacher_id);
//           if (teacher) {
//             console.log(`✅ Matched "${gptName}" to "${teacher.name}" via subject assignment`);
//           }
//         }
//       }
      
//       // FORCE CORRECT ROOM based on section_index
//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         console.log(`🔧 Fixed room for Section ${a.section_index}: ${a.room_id} → ${correctRoom.room_id} (${correctRoom.room_name})`);
//         a.room_id = correctRoom.room_id;
//       }
      
//       // Log if not found
//       if (!teacher) {
//         console.warn(`⚠️ Could not match teacher: "${gptName}" for subject ${a.subject_id}`);
//       } else {
//         console.log(`✅ Matched "${gptName}" to teacher ID ${teacher.id}`);
//       }
      
//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name
//       };
//     });

//     // Log warnings for assignments without teacher_id
//     const assignmentsWithoutTeacher = assignments.filter(a => !a.teacher_id);
//     if (assignmentsWithoutTeacher.length > 0) {
//       console.warn(`⚠️ Warning: ${assignmentsWithoutTeacher.length} assignments have no teacher_id`);
//       assignmentsWithoutTeacher.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Section ${a.section_index}, Teacher: "${a.teacher_name}"`);
//       });
//     }
    
//     // Verify room assignments per section
//     console.log('📍 Verifying room assignments per section:');
//     for (let i = 0; i < sectionCount; i++) {
//       const sectionAssignments = assignments.filter(a => a.section_index === i);
//       const uniqueRooms = [...new Set(sectionAssignments.map(a => a.room_id))];
//       const expectedRoom = sectionRoomMap[i];
//       console.log(`   Section ${String.fromCharCode(65 + i)}: ${uniqueRooms.length === 1 ? '✅' : '⚠️'} ${uniqueRooms.length} room(s) used - Expected: ${expectedRoom.room_name} (ID: ${expectedRoom.room_id})`);
//       if (uniqueRooms.length > 1) {
//         console.warn(`      Rooms found: ${uniqueRooms.join(', ')}`);
//       }
//     }

//     // ============================================
//     // DETECT AND FIX INSTRUCTOR CONFLICTS (WITH DURATION AWARENESS)
//     // ============================================
//     console.log('🔍 Checking for instructor conflicts (considering class durations)...');
    
//     // Build instructor schedule map considering duration: "instructor_id-day-slot" -> assignment
//     const instructorScheduleMap = {};
//     const conflicts = [];
    
//     assignments.forEach((a, index) => {
//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? subject.duration : 1;
//       const slotsNeeded = Math.ceil(duration);
      
//       // Mark all slots occupied by this class
//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = a.slot_index + i;
//         if (slotIndex < 12) { // Make sure we don't exceed max slots
//           const key = `${a.teacher_id}-${a.day}-${slotIndex}`;
          
//           if (instructorScheduleMap[key]) {
//             // Conflict detected
//             conflicts.push({
//               existing: instructorScheduleMap[key],
//               conflicting: { ...a, affectedSlot: slotIndex },
//               index: index
//             });
//           } else {
//             instructorScheduleMap[key] = { ...a, originalSlot: a.slot_index, duration: duration };
//           }
//         }
//       }
//     });

//     if (conflicts.length > 0) {
//       console.warn(`⚠️ Found ${conflicts.length} instructor conflicts. Attempting to fix...`);
      
//       // Try to reschedule conflicting assignments
//       conflicts.forEach(conflict => {
//         const assignment = conflict.conflicting;
//         const subject = subjectsWithTeachers.find(s => s.id === assignment.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);
//         const originalDay = assignment.day;
//         const originalSlot = assignment.slot_index;
        
//         console.log(`   Fixing conflict: ${assignment.instructor_name} on ${originalDay} slot ${originalSlot} (${duration}h class, needs ${slotsNeeded} slots)`);
        
//         // Try to find an alternative slot
//         let fixed = false;
//         const allowedDays = payload.schedulePattern === 'MWF' ? DAYS_MWF : 
//                            payload.schedulePattern === 'TTH' ? DAYS_TTHS : DAYS_ALL;
        
//         for (const day of allowedDays) {
//           if (fixed) break;
          
//           for (let slot = 0; slot <= 12 - slotsNeeded; slot++) { // Make sure we have enough consecutive slots
//             // Check if all required consecutive slots are free
//             let allSlotsFree = true;
            
//             // Check instructor availability for all needed slots
//             for (let i = 0; i < slotsNeeded; i++) {
//               const testKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//               if (instructorScheduleMap[testKey]) {
//                 allSlotsFree = false;
//                 break;
//               }
//             }
            
//             // Check section availability for all needed slots
//             if (allSlotsFree) {
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const sectionBusy = assignments.some(a => 
//                   a.section_index === assignment.section_index && 
//                   a.day === day && 
//                   a.slot_index === (slot + i) &&
//                   a !== assignment
//                 );
//                 if (sectionBusy) {
//                   allSlotsFree = false;
//                   break;
//                 }
//               }
//             }
            
//             if (allSlotsFree) {
//               // Update the assignment and block out all slots
//               console.log(`      ✅ Rescheduled to ${day} slots ${slot}-${slot + slotsNeeded - 1}`);
              
//               // Remove old slot mappings
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const oldKey = `${assignment.teacher_id}-${assignment.day}-${assignment.slot_index + i}`;
//                 delete instructorScheduleMap[oldKey];
//               }
              
//               // Update assignment
//               assignment.day = day;
//               assignment.slot_index = slot;
              
//               // Add new slot mappings
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const newKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//                 instructorScheduleMap[newKey] = { ...assignment, originalSlot: slot, duration: duration };
//               }
              
//               fixed = true;
//               break;
//             }
//           }
//         }
        
//         if (!fixed) {
//           console.error(`      ❌ Could not find alternative slot for ${assignment.instructor_name} (needs ${slotsNeeded} consecutive slots)`);
//         }
//       });
      
//       console.log('✅ Conflict resolution completed');
//     } else {
//       console.log('✅ No instructor conflicts detected');
//     }
//     // ============================================

//     // Validate section indices
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ Missing teacher_id for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
//       // Final conflict check for reporting (considering durations)
//       const finalConflicts = [];
//       const finalInstructorMap = {};
      
//       for (const a of assignments) {
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);
        
//         // Check all slots occupied by this class
//         for (let i = 0; i < slotsNeeded; i++) {
//           const slotIndex = a.slot_index + i;
//           if (slotIndex < 12) {
//             const key = `${a.teacher_id}-${a.day}-${slotIndex}`;
//             if (finalInstructorMap[key]) {
//               finalConflicts.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex,
//                 subject: subject?.code,
//                 duration: duration
//               });
//             } else {
//               finalInstructorMap[key] = true;
//             }
//           }
//         }
//       }
      
//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);
//       if (finalConflicts.length > 0) {
//         console.warn(`⚠️ Warning: ${finalConflicts.length} unresolved conflicts remain`);
//         finalConflicts.forEach(c => {
//           console.warn(`   - ${c.instructor} on ${c.day} slot ${c.slot} (${c.subject}, ${c.duration}h)`);
//         });
//       } else {
//         console.log('✅ Zero conflicts - schedule is clean!');
//       }

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s)${finalConflicts.length > 0 ? ' with some conflicts' : ' with no conflicts'}`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: finalConflicts.length,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;
    
//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries with filters:`, { courseId, yearLevel, semester });
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//OLD WITH DURATION and only morning slots

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;

//     const params = [courseId, yearLevel, semester];

//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }

//     const results = await query(sql, params);
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. **INSTRUCTOR CONFLICTS ARE FORBIDDEN**: No instructor can teach multiple classes at the same time (same day, same slot_index) - even if it's different sections or different subjects. This is the MOST IMPORTANT rule.
// 2. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Each section uses ONE dedicated room for ALL its subjects (see room assignments below)
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers
// 11. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})

// AVOIDING INSTRUCTOR CONFLICTS (CRITICAL):
// - Before assigning an instructor to a time slot, CHECK if they are already teaching at that day/time
// - If an instructor teaches Section A at Monday 7:00 AM, they CANNOT teach Section B at Monday 7:00 AM
// - Stagger section schedules to avoid instructor conflicts
// - Example: If Professor Smith teaches Math for Section A at Mon 8-9AM, schedule Math for Section B at a DIFFERENT time
// - Track each instructor's schedule as you build the timetable

// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts

// ROOM ASSIGNMENT PER SECTION (CRITICAL):
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (${String.fromCharCode(65 + parseInt(secIdx))}) MUST use Room ID ${room.room_id} (${room.room_name}) for ALL subjects`;
// }).join('\n') : ''}
// - Each section is assigned ONE dedicated room
// - ALL subjects in a section MUST use the same room_id assigned to that section
// - Do NOT use different rooms for different subjects within the same section

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of the assigned duration each
// - For 3-unit courses on TTH: Schedule 2 sessions (may use longer durations or consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section
// - **IMPORTANT**: Each subject has an assigned class duration (e.g., 1h, 1.5h, 2h, etc.) that you MUST respect
// - If a class duration is 1.5 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-8:30)
// - If a class duration is 2 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-9:00)
// - If a class duration is 3 hours, it occupies 3 consecutive time slots (e.g., slots 0-2 for 7:00-10:00)

// OPTIMIZATION GOALS:
// - Spread classes evenly across allowed days
// - Prefer morning slots (7-11 AM) when possible
// - Minimize gaps in student schedules
// - Keep instructor schedules reasonable
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete schedules

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number (MUST use the room_id assigned to this section_index),
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }

// REMEMBER: All subjects in Section 0 use the SAME room_id. All subjects in Section 1 use a DIFFERENT room_id, etc.`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h per session) → Teacher: "${s.teacher_name}"`).join('\n')}

// **CRITICAL - CLASS DURATION RULES**:
// - Each subject above has a specific "Duration" (e.g., 1h, 1.5h, 2h, 3h, etc.)
// - This duration represents how long EACH teaching session lasts
// - You MUST respect these durations when scheduling:
//   * 1 hour duration = Use 1 time slot (e.g., slot 0 = 7:00-8:00 AM)
//   * 1.5 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-8:30 AM, but report only slot 0)
//   * 2 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-9:00 AM, but report only slot 0)
//   * 3 hours duration = Use 3 consecutive slots (e.g., slots 0-2 = 7:00-10:00 AM, but report only slot 0)
//   * 4 hours duration = Use 4 consecutive slots (e.g., slots 0-3 = 7:00-11:00 AM, but report only slot 0)
// - When reporting the schedule, only include the STARTING slot_index
// - Example: If Math has 2-hour duration and starts at slot 0 (7 AM), report slot_index: 0 (not 0 and 1)
// - The system will automatically block out the consecutive slots based on duration

// ROOM ASSIGNMENTS BY SECTION:
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`;
// }).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY its units time slots per section
// - MUST use the exact teacher assigned to each subject
// - Use the exact teacher_name string as shown above (case-sensitive, exact match, no extra spaces)
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)

// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });

//     console.log('📊 Section distribution:', sectionCounts);
    
//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }

//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     return assignments;

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE (WITH FIXED TEACHER MATCHING)
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Sections:', sectionCount);
//     console.log('   Major (BTLED 3rd year):', major || 'N/A');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       // Use the assigned duration from teacher assignments (this is the teaching hours per session)
//       const assignedDuration = Number(assignment.duration) || 1;
      
//       console.log(`   Subject ${s.subject_code}: Assigned duration = ${assignedDuration}h per session`);
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignedDuration, // This is how long each teaching session lasts
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     // ============================================
//     // ASSIGN ONE ROOM PER SECTION
//     // ============================================
//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({
//         error: 'Not enough rooms',
//         detail: `You need at least ${sectionCount} rooms for ${sectionCount} section(s). Currently only ${roomAssignments.length} room(s) assigned.`
//       });
//     }

//     // Assign one room per section (Section A gets first room, Section B gets second, etc.)
//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//       console.log(`📍 Section ${String.fromCharCode(65 + i)} → Room ${roomAssignments[i].room_name}`);
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap: sectionRoomMap, // Add this mapping
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // ============================================
//     // FIXED: Improved Teacher Name Matching + Room Assignment
//     // ============================================
//     console.log('📋 Available teachers:', teachersForScheduler.map(t => `"${t.name}" (ID: ${t.id})`).join(', '));

//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();
      
//       // Try exact match first
//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);
      
//       // Try case-insensitive match
//       if (!teacher) {
//         teacher = teachersForScheduler.find(t => 
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }
      
//       // Try to match by subject assignment (most reliable)
//       if (!teacher && a.subject_id) {
//         const subjectAssignment = teacherAssignments[a.subject_id];
//         if (subjectAssignment && subjectAssignment.teacher_id) {
//           teacher = teachersForScheduler.find(t => t.id === subjectAssignment.teacher_id);
//           if (teacher) {
//             console.log(`✅ Matched "${gptName}" to "${teacher.name}" via subject assignment`);
//           }
//         }
//       }
      
//       // FORCE CORRECT ROOM based on section_index
//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         console.log(`🔧 Fixed room for Section ${a.section_index}: ${a.room_id} → ${correctRoom.room_id} (${correctRoom.room_name})`);
//         a.room_id = correctRoom.room_id;
//       }
      
//       // Log if not found
//       if (!teacher) {
//         console.warn(`⚠️ Could not match teacher: "${gptName}" for subject ${a.subject_id}`);
//       } else {
//         console.log(`✅ Matched "${gptName}" to teacher ID ${teacher.id}`);
//       }
      
//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name
//       };
//     });

//     // Log warnings for assignments without teacher_id
//     const assignmentsWithoutTeacher = assignments.filter(a => !a.teacher_id);
//     if (assignmentsWithoutTeacher.length > 0) {
//       console.warn(`⚠️ Warning: ${assignmentsWithoutTeacher.length} assignments have no teacher_id`);
//       assignmentsWithoutTeacher.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Section ${a.section_index}, Teacher: "${a.teacher_name}"`);
//       });
//     }
    
//     // Verify room assignments per section
//     console.log('📍 Verifying room assignments per section:');
//     for (let i = 0; i < sectionCount; i++) {
//       const sectionAssignments = assignments.filter(a => a.section_index === i);
//       const uniqueRooms = [...new Set(sectionAssignments.map(a => a.room_id))];
//       const expectedRoom = sectionRoomMap[i];
//       console.log(`   Section ${String.fromCharCode(65 + i)}: ${uniqueRooms.length === 1 ? '✅' : '⚠️'} ${uniqueRooms.length} room(s) used - Expected: ${expectedRoom.room_name} (ID: ${expectedRoom.room_id})`);
//       if (uniqueRooms.length > 1) {
//         console.warn(`      Rooms found: ${uniqueRooms.join(', ')}`);
//       }
//     }

//     // ============================================
//     // DETECT AND FIX INSTRUCTOR CONFLICTS (WITH DURATION AWARENESS)
//     // ============================================
//     console.log('🔍 Checking for instructor conflicts (considering class durations)...');
    
//     // Build instructor schedule map considering duration: "instructor_id-day-slot" -> assignment
//     const instructorScheduleMap = {};
//     const conflicts = [];
    
//     assignments.forEach((a, index) => {
//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? subject.duration : 1;
//       const slotsNeeded = Math.ceil(duration);
      
//       // Mark all slots occupied by this class
//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = a.slot_index + i;
//         if (slotIndex < 12) { // Make sure we don't exceed max slots
//           const key = `${a.teacher_id}-${a.day}-${slotIndex}`;
          
//           if (instructorScheduleMap[key]) {
//             // Conflict detected
//             conflicts.push({
//               existing: instructorScheduleMap[key],
//               conflicting: { ...a, affectedSlot: slotIndex },
//               index: index
//             });
//           } else {
//             instructorScheduleMap[key] = { ...a, originalSlot: a.slot_index, duration: duration };
//           }
//         }
//       }
//     });

//     if (conflicts.length > 0) {
//       console.warn(`⚠️ Found ${conflicts.length} instructor conflicts. Attempting to fix...`);
      
//       // Try to reschedule conflicting assignments
//       conflicts.forEach(conflict => {
//         const assignment = conflict.conflicting;
//         const subject = subjectsWithTeachers.find(s => s.id === assignment.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);
//         const originalDay = assignment.day;
//         const originalSlot = assignment.slot_index;
        
//         console.log(`   Fixing conflict: ${assignment.instructor_name} on ${originalDay} slot ${originalSlot} (${duration}h class, needs ${slotsNeeded} slots)`);
        
//         // Try to find an alternative slot
//         let fixed = false;
//         const allowedDays = payload.schedulePattern === 'MWF' ? DAYS_MWF : 
//                            payload.schedulePattern === 'TTH' ? DAYS_TTHS : DAYS_ALL;
        
//         for (const day of allowedDays) {
//           if (fixed) break;
          
//           for (let slot = 0; slot <= 12 - slotsNeeded; slot++) { // Make sure we have enough consecutive slots
//             // Check if all required consecutive slots are free
//             let allSlotsFree = true;
            
//             // Check instructor availability for all needed slots
//             for (let i = 0; i < slotsNeeded; i++) {
//               const testKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//               if (instructorScheduleMap[testKey]) {
//                 allSlotsFree = false;
//                 break;
//               }
//             }
            
//             // Check section availability for all needed slots
//             if (allSlotsFree) {
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const sectionBusy = assignments.some(a => 
//                   a.section_index === assignment.section_index && 
//                   a.day === day && 
//                   a.slot_index === (slot + i) &&
//                   a !== assignment
//                 );
//                 if (sectionBusy) {
//                   allSlotsFree = false;
//                   break;
//                 }
//               }
//             }
            
//             if (allSlotsFree) {
//               // Update the assignment and block out all slots
//               console.log(`      ✅ Rescheduled to ${day} slots ${slot}-${slot + slotsNeeded - 1}`);
              
//               // Remove old slot mappings
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const oldKey = `${assignment.teacher_id}-${assignment.day}-${assignment.slot_index + i}`;
//                 delete instructorScheduleMap[oldKey];
//               }
              
//               // Update assignment
//               assignment.day = day;
//               assignment.slot_index = slot;
              
//               // Add new slot mappings
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const newKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//                 instructorScheduleMap[newKey] = { ...assignment, originalSlot: slot, duration: duration };
//               }
              
//               fixed = true;
//               break;
//             }
//           }
//         }
        
//         if (!fixed) {
//           console.error(`      ❌ Could not find alternative slot for ${assignment.instructor_name} (needs ${slotsNeeded} consecutive slots)`);
//         }
//       });
      
//       console.log('✅ Conflict resolution completed');
//     } else {
//       console.log('✅ No instructor conflicts detected');
//     }
//     // ============================================

//     // Validate section indices
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ Missing teacher_id for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
//       // Final conflict check for reporting (considering durations)
//       const finalConflicts = [];
//       const finalInstructorMap = {};
      
//       for (const a of assignments) {
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);
        
//         // Check all slots occupied by this class
//         for (let i = 0; i < slotsNeeded; i++) {
//           const slotIndex = a.slot_index + i;
//           if (slotIndex < 12) {
//             const key = `${a.teacher_id}-${a.day}-${slotIndex}`;
//             if (finalInstructorMap[key]) {
//               finalConflicts.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex,
//                 subject: subject?.code,
//                 duration: duration
//               });
//             } else {
//               finalInstructorMap[key] = true;
//             }
//           }
//         }
//       }
      
//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);
//       if (finalConflicts.length > 0) {
//         console.warn(`⚠️ Warning: ${finalConflicts.length} unresolved conflicts remain`);
//         finalConflicts.forEach(c => {
//           console.warn(`   - ${c.instructor} on ${c.day} slot ${c.slot} (${c.subject}, ${c.duration}h)`);
//         });
//       } else {
//         console.log('✅ Zero conflicts - schedule is clean!');
//       }

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s)${finalConflicts.length > 0 ? ' with some conflicts' : ' with no conflicts'}`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: finalConflicts.length,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;
    
//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries with filters:`, { courseId, yearLevel, semester });
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//WORKING WITHOUT FIXING THE SCHEDULING PATTERN

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');

// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error('   Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
  
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error('   Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error('   Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
    
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
    
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT 
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;

//     const params = [courseId, yearLevel, semester];

//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }

//     const results = await query(sql, params);
    
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
    
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT 
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
    
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
  
//   if (retryCount > 0) {
//     console.log(`   Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log('   Subjects:', payload.subjects.length);
//   console.log('   Teachers:', payload.teachers.length);
//   console.log('   Rooms:', payload.rooms.length);
//   console.log('   Sections:', payload.sectionCount);
//   console.log('   Pattern:', payload.schedulePattern);
//   console.log('   Timeout: 60 seconds');
  
//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
  
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }
  
//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. **INSTRUCTOR CONFLICTS ARE FORBIDDEN**: No instructor can teach multiple classes at the same time (same day, same slot_index) - even if it's different sections or different subjects. This is the MOST IMPORTANT rule.
// 2. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Each section uses ONE dedicated room for ALL its subjects (see room assignments below)
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers
// 11. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})

// AVOIDING INSTRUCTOR CONFLICTS (CRITICAL):
// - Before assigning an instructor to a time slot, CHECK if they are already teaching at that day/time
// - If an instructor teaches Section A at Monday 7:00 AM, they CANNOT teach Section B at Monday 7:00 AM
// - Stagger section schedules to avoid instructor conflicts
// - Example: If Professor Smith teaches Math for Section A at Mon 8-9AM, schedule Math for Section B at a DIFFERENT time
// - Track each instructor's schedule as you build the timetable

// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts

// ROOM ASSIGNMENT PER SECTION (CRITICAL):
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (${String.fromCharCode(65 + parseInt(secIdx))}) MUST use Room ID ${room.room_id} (${room.room_name}) for ALL subjects`;
// }).join('\n') : ''}
// - Each section is assigned ONE dedicated room
// - ALL subjects in a section MUST use the same room_id assigned to that section
// - Do NOT use different rooms for different subjects within the same section

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of the assigned duration each
// - For 3-unit courses on TTH: Schedule 2 sessions (may use longer durations or consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section
// - **IMPORTANT**: Each subject has an assigned class duration (e.g., 1h, 1.5h, 2h, etc.) that you MUST respect
// - If a class duration is 1.5 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-8:30)
// - If a class duration is 2 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-9:00)
// - If a class duration is 3 hours, it occupies 3 consecutive time slots (e.g., slots 0-2 for 7:00-10:00)

// OPTIMIZATION GOALS (VERY IMPORTANT):
// - Distribute classes EVENLY across the FULL DAY: from 7:00 AM to 7:00 PM
// - Actively use BOTH morning (7 AM–12 PM) and afternoon (12 PM–7 PM) slots
// - Avoid overloading morning hours — do NOT put all classes in the morning
// - Aim for balance: roughly 50–60% of classes in morning, 40–50% in afternoon
// - No section or instructor should have all their classes crammed into the morning
// - Spread classes to create reasonable gaps and realistic university schedules
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete and balanced schedules

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number (MUST use the room_id assigned to this section_index),
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }

// REMEMBER: All subjects in Section 0 use the SAME room_id. All subjects in Section 1 use a DIFFERENT room_id, etc.`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a => 
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h per session) → Teacher: "${s.teacher_name}"`).join('\n')}

// **CRITICAL - CLASS DURATION RULES**:
// - Each subject above has a specific "Duration" (e.g., 1h, 1.5h, 2h, 3h, etc.)
// - This duration represents how long EACH teaching session lasts
// - You MUST respect these durations when scheduling:
//   * 1 hour duration = Use 1 time slot (e.g., slot 0 = 7:00-8:00 AM)
//   * 1.5 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-8:30 AM, but report only slot 0)
//   * 2 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-9:00 AM, but report only slot 0)
//   * 3 hours duration = Use 3 consecutive slots (e.g., slots 0-2 = 7:00-10:00 AM, but report only slot 0)
//   * 4 hours duration = Use 4 consecutive slots (e.g., slots 0-3 = 7:00-11:00 AM, but report only slot 0)
// - When reporting the schedule, only include the STARTING slot_index
// - Example: If Math has 2-hour duration and starts at slot 0 (7 AM), report slot_index: 0 (not 0 and 1)
// - The system will automatically block out the consecutive slots based on duration

// ROOM ASSIGNMENTS BY SECTION:
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`;
// }).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY its units time slots per section
// - MUST use the exact teacher assigned to each subject
// - Use the exact teacher_name string as shown above (case-sensitive, exact match, no extra spaces)
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// - CRITICAL: Distribute classes across the entire day — use afternoon slots (12 PM onward) actively
// - Do NOT schedule everything in the morning
// - Aim for a realistic university schedule with classes in both morning and afternoon
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)

// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();
    
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.8,  // Slightly higher for more diverse slot choices
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
    
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️  GPT responded in ${elapsedTime}s`);
    
//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');
    
//     let parsed = JSON.parse(responseText);
    
//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });

//     console.log('📊 Section distribution:', sectionCounts);
    
//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }

//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     return assignments;

//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
    
//     const isTimeout = error.message.includes('timed out');
    
//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
    
//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE (WITH FIXED TEACHER MATCHING)
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
  
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log('   Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log('   Pattern:', schedulePattern);
//     console.log('   Sections:', sectionCount);
//     console.log('   Major (BTLED 3rd year):', major || 'N/A');
//     console.log('   Consider Availability:', considerInstructorAvailability);

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);
    
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
    
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }
      
//       // Use the assigned duration from teacher assignments (this is the teaching hours per session)
//       const assignedDuration = Number(assignment.duration) || 1;
      
//       console.log(`   Subject ${s.subject_code}: Assigned duration = ${assignedDuration}h per session`);
      
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignedDuration, // This is how long each teaching session lasts
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(`   Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     // ============================================
//     // ASSIGN ONE ROOM PER SECTION
//     // ============================================
//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({
//         error: 'Not enough rooms',
//         detail: `You need at least ${sectionCount} rooms for ${sectionCount} section(s). Currently only ${roomAssignments.length} room(s) assigned.`
//       });
//     }

//     // Assign one room per section (Section A gets first room, Section B gets second, etc.)
//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//       console.log(`📍 Section ${String.fromCharCode(65 + i)} → Room ${roomAssignments[i].room_name}`);
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap: sectionRoomMap, // Add this mapping
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);

//     // ============================================
//     // FIXED: Improved Teacher Name Matching + Room Assignment
//     // ============================================
//     console.log('📋 Available teachers:', teachersForScheduler.map(t => `"${t.name}" (ID: ${t.id})`).join(', '));

//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();
      
//       // Try exact match first
//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);
      
//       // Try case-insensitive match
//       if (!teacher) {
//         teacher = teachersForScheduler.find(t => 
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }
      
//       // Try to match by subject assignment (most reliable)
//       if (!teacher && a.subject_id) {
//         const subjectAssignment = teacherAssignments[a.subject_id];
//         if (subjectAssignment && subjectAssignment.teacher_id) {
//           teacher = teachersForScheduler.find(t => t.id === subjectAssignment.teacher_id);
//           if (teacher) {
//             console.log(`✅ Matched "${gptName}" to "${teacher.name}" via subject assignment`);
//           }
//         }
//       }
      
//       // FORCE CORRECT ROOM based on section_index
//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         console.log(`🔧 Fixed room for Section ${a.section_index}: ${a.room_id} → ${correctRoom.room_id} (${correctRoom.room_name})`);
//         a.room_id = correctRoom.room_id;
//       }
      
//       // Log if not found
//       if (!teacher) {
//         console.warn(`⚠️ Could not match teacher: "${gptName}" for subject ${a.subject_id}`);
//       } else {
//         console.log(`✅ Matched "${gptName}" to teacher ID ${teacher.id}`);
//       }
      
//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name
//       };
//     });

//     // Log warnings for assignments without teacher_id
//     const assignmentsWithoutTeacher = assignments.filter(a => !a.teacher_id);
//     if (assignmentsWithoutTeacher.length > 0) {
//       console.warn(`⚠️ Warning: ${assignmentsWithoutTeacher.length} assignments have no teacher_id`);
//       assignmentsWithoutTeacher.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Section ${a.section_index}, Teacher: "${a.teacher_name}"`);
//       });
//     }
    
//     // Verify room assignments per section
//     console.log('📍 Verifying room assignments per section:');
//     for (let i = 0; i < sectionCount; i++) {
//       const sectionAssignments = assignments.filter(a => a.section_index === i);
//       const uniqueRooms = [...new Set(sectionAssignments.map(a => a.room_id))];
//       const expectedRoom = sectionRoomMap[i];
//       console.log(`   Section ${String.fromCharCode(65 + i)}: ${uniqueRooms.length === 1 ? '✅' : '⚠️'} ${uniqueRooms.length} room(s) used - Expected: ${expectedRoom.room_name} (ID: ${expectedRoom.room_id})`);
//       if (uniqueRooms.length > 1) {
//         console.warn(`      Rooms found: ${uniqueRooms.join(', ')}`);
//       }
//     }

//     // ============================================
//     // DETECT AND FIX INSTRUCTOR CONFLICTS (WITH DURATION AWARENESS)
//     // ============================================
//     console.log('🔍 Checking for instructor conflicts (considering class durations)...');
    
//     // Build instructor schedule map considering duration: "instructor_id-day-slot" -> assignment
//     const instructorScheduleMap = {};
//     const conflicts = [];
    
//     assignments.forEach((a, index) => {
//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? subject.duration : 1;
//       const slotsNeeded = Math.ceil(duration);
      
//       // Mark all slots occupied by this class
//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = a.slot_index + i;
//         if (slotIndex < 12) { // Make sure we don't exceed max slots
//           const key = `${a.teacher_id}-${a.day}-${slotIndex}`;
          
//           if (instructorScheduleMap[key]) {
//             // Conflict detected
//             conflicts.push({
//               existing: instructorScheduleMap[key],
//               conflicting: { ...a, affectedSlot: slotIndex },
//               index: index
//             });
//           } else {
//             instructorScheduleMap[key] = { ...a, originalSlot: a.slot_index, duration: duration };
//           }
//         }
//       }
//     });

//     if (conflicts.length > 0) {
//       console.warn(`⚠️ Found ${conflicts.length} instructor conflicts. Attempting to fix...`);
      
//       // Try to reschedule conflicting assignments
//       conflicts.forEach(conflict => {
//         const assignment = conflict.conflicting;
//         const subject = subjectsWithTeachers.find(s => s.id === assignment.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);
//         const originalDay = assignment.day;
//         const originalSlot = assignment.slot_index;
        
//         console.log(`   Fixing conflict: ${assignment.instructor_name} on ${originalDay} slot ${originalSlot} (${duration}h class, needs ${slotsNeeded} slots)`);
        
//         // Try to find an alternative slot
//         let fixed = false;
//         const allowedDays = payload.schedulePattern === 'MWF' ? DAYS_MWF : 
//                            payload.schedulePattern === 'TTH' ? DAYS_TTHS : DAYS_ALL;
        
//         for (const day of allowedDays) {
//           if (fixed) break;
          
//           for (let slot = 0; slot <= 12 - slotsNeeded; slot++) { // Make sure we have enough consecutive slots
//             // Check if all required consecutive slots are free
//             let allSlotsFree = true;
            
//             // Check instructor availability for all needed slots
//             for (let i = 0; i < slotsNeeded; i++) {
//               const testKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//               if (instructorScheduleMap[testKey]) {
//                 allSlotsFree = false;
//                 break;
//               }
//             }
            
//             // Check section availability for all needed slots
//             if (allSlotsFree) {
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const sectionBusy = assignments.some(a => 
//                   a.section_index === assignment.section_index && 
//                   a.day === day && 
//                   a.slot_index === (slot + i) &&
//                   a !== assignment
//                 );
//                 if (sectionBusy) {
//                   allSlotsFree = false;
//                   break;
//                 }
//               }
//             }
            
//             if (allSlotsFree) {
//               // Update the assignment and block out all slots
//               console.log(`      ✅ Rescheduled to ${day} slots ${slot}-${slot + slotsNeeded - 1}`);
              
//               // Remove old slot mappings
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const oldKey = `${assignment.teacher_id}-${assignment.day}-${assignment.slot_index + i}`;
//                 delete instructorScheduleMap[oldKey];
//               }
              
//               // Update assignment
//               assignment.day = day;
//               assignment.slot_index = slot;
              
//               // Add new slot mappings
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const newKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//                 instructorScheduleMap[newKey] = { ...assignment, originalSlot: slot, duration: duration };
//               }
              
//               fixed = true;
//               break;
//             }
//           }
//         }
        
//         if (!fixed) {
//           console.error(`      ❌ Could not find alternative slot for ${assignment.instructor_name} (needs ${slotsNeeded} consecutive slots)`);
//         }
//       });
      
//       console.log('✅ Conflict resolution completed');
//     } else {
//       console.log('✅ No instructor conflicts detected');
//     }
//     // ============================================

//     // Validate section indices
//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
        
//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ Missing teacher_id for: ${a.teacher_name}`);
//           continue;
//         }

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             timeSlot.start,
//             timeSlot.end
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');
      
//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
//       // Final conflict check for reporting (considering durations)
//       const finalConflicts = [];
//       const finalInstructorMap = {};
      
//       for (const a of assignments) {
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);
        
//         // Check all slots occupied by this class
//         for (let i = 0; i < slotsNeeded; i++) {
//           const slotIndex = a.slot_index + i;
//           if (slotIndex < 12) {
//             const key = `${a.teacher_id}-${a.day}-${slotIndex}`;
//             if (finalInstructorMap[key]) {
//               finalConflicts.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex,
//                 subject: subject?.code,
//                 duration: duration
//               });
//             } else {
//               finalInstructorMap[key] = true;
//             }
//           }
//         }
//       }
      
//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);
//       if (finalConflicts.length > 0) {
//         console.warn(`⚠️ Warning: ${finalConflicts.length} unresolved conflicts remain`);
//         finalConflicts.forEach(c => {
//           console.warn(`   - ${c.instructor} on ${c.day} slot ${c.slot} (${c.subject}, ${c.duration}h)`);
//         });
//       } else {
//         console.log('✅ Zero conflicts - schedule is clean!');
//       }

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s)${finalConflicts.length > 0 ? ' with some conflicts' : ' with no conflicts'}`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: finalConflicts.length,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try {
//       await query('ROLLBACK');
//     } catch (rollbackErr) {
//       console.error('❌ Rollback error:', rollbackErr);
//     }
    
//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
//                FROM schedule s
//                LEFT JOIN rooms r ON s.room_id = r.id
//                LEFT JOIN instructors i ON s.instructor_id = i.id
//                WHERE s.day = ? AND s.slot_index = ?`;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);
//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;
    
//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries with filters:`, { courseId, yearLevel, semester });
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;

//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    
//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );
    
//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//WORKING WITHOUT THE DURATION/ SCHEDULE PATTERN

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');
// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error(' Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');

//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error(' Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error(' Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );

//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });

//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;
//     const params = [courseId, yearLevel, semester];
//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }
//     const results = await query(sql, params);

//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });

//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );

//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');

//   if (retryCount > 0) {
//     console.log(` Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log(' Subjects:', payload.subjects.length);
//   console.log(' Teachers:', payload.teachers.length);
//   console.log(' Rooms:', payload.rooms.length);
//   console.log(' Sections:', payload.sectionCount);
//   console.log(' Pattern:', payload.schedulePattern);
//   console.log(' Timeout: 60 seconds');

//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';

//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2 times per week (Tuesday, Thursday) - typically 1.5 hours per session';
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but prefer grouping classes into MWF or TTH patterns';
//   }

//   const facultyPatternNote = `
// ADDITIONAL REAL-WORLD FACULTY LOADING PATTERN (MUST FOLLOW):
// - The institution has a stable core faculty: most instructors teach in BOTH semesters (continuity is prioritized).
// - Only a minority are semester-specific (part-time or temporary).
// - Therefore, when scheduling, PRIORITIZE REUSING THE SAME INSTRUCTORS across multiple subjects/sections if possible.
// - Avoid introducing "new" instructors unnecessarily — stick strictly to the provided teacher list.
// - Core instructors should have balanced but consistent loads across sections.
// - This creates realistic, sustainable yearly schedules with minimal turnover.`;

//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.
// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. **INSTRUCTOR CONFLICTS ARE FORBIDDEN**: No instructor can teach multiple classes at the same time (same day, same slot_index) - even if it's different sections or different subjects. This is the MOST IMPORTANT rule.
// 2. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 3. No section can have multiple classes at the same time (same day, same slot_index)
// 4. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 5. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 6. Each section uses ONE dedicated room for ALL its subjects (see room assignments below)
// 7. Follow the schedule pattern: ${payload.schedulePattern}
// 8. Consider class duration (some classes may be 1.5-3 hours long)
// 9. Respect instructor availability windows if provided
// 10. Balance instructor workload across all teachers — but prioritize continuity and reuse of the same instructors
// 11. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})${facultyPatternNote}
// AVOIDING INSTRUCTOR CONFLICTS (CRITICAL):
// - Before assigning an instructor to a time slot, CHECK if they are already teaching at that day/time
// - If an instructor teaches Section A at Monday 7:00 AM, they CANNOT teach Section B at Monday 7:00 AM
// - Stagger section schedules to avoid instructor conflicts
// - Example: If Professor Smith teaches Math for Section A at Mon 8-9AM, schedule Math for Section B at a DIFFERENT time
// - Track each instructor's schedule as you build the timetable
// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts
// ROOM ASSIGNMENT PER SECTION (CRITICAL):
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (${String.fromCharCode(65 + parseInt(secIdx))}) MUST use Room ID ${room.room_id} (${room.room_name}) for ALL subjects`;
// }).join('\n') : ''}
// - Each section is assigned ONE dedicated room
// - ALL subjects in a section MUST use the same room_id assigned to that section
// - Do NOT use different rooms for different subjects within the same section
// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of the assigned duration each
// - For 3-unit courses on TTH: Schedule 2 sessions (may use longer durations or consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section
// - **IMPORTANT**: Each subject has an assigned class duration (e.g., 1h, 1.5h, 2h, etc.) that you MUST respect
// - If a class duration is 1.5 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-8:30)
// - If a class duration is 2 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-9:00)
// - If a class duration is 3 hours, it occupies 3 consecutive time slots (e.g., slots 0-2 for 7:00-10:00)
// OPTIMIZATION GOALS (VERY IMPORTANT):
// - Distribute classes EVENLY across the FULL DAY: from 7:00 AM to 7:00 PM
// - Actively use BOTH morning (7 AM–12 PM) and afternoon (12 PM–7 PM) slots
// - Avoid overloading morning hours — do NOT put all classes in the morning
// - Aim for balance: roughly 50–60% of classes in morning, 40–50% in afternoon
// - No section or instructor should have all their classes crammed into the morning
// - Spread classes to create reasonable gaps and realistic university schedules
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete and balanced schedules
// - Prioritize instructor continuity: reuse the same teachers across sections/subjects to mimic real faculty loading stability
// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number (MUST use the room_id assigned to this section_index),
//   "day": string (one of the allowed days),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }
// REMEMBER: All subjects in Section 0 use the SAME room_id. All subjects in Section 1 use a DIFFERENT room_id, etc.`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a =>
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:
// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h per session) → Teacher: "${s.teacher_name}"`).join('\n')}
// **CRITICAL - CLASS DURATION RULES**:
// - Each subject above has a specific "Duration" (e.g., 1h, 1.5h, 2h, 3h, etc.)
// - This duration represents how long EACH teaching session lasts
// - You MUST respect these durations when scheduling:
//   * 1 hour duration = Use 1 time slot (e.g., slot 0 = 7:00-8:00 AM)
//   * 1.5 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-8:30 AM, but report only slot 0)
//   * 2 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-9:00 AM, but report only slot 0)
//   * 3 hours duration = Use 3 consecutive slots (e.g., slots 0-2 = 7:00-10:00 AM, but report only slot 0)
//   * 4 hours duration = Use 4 consecutive slots (e.g., slots 0-3 = 7:00-11:00 AM, but report only slot 0)
// - When reporting the schedule, only include the STARTING slot_index
// - Example: If Math has 2-hour duration and starts at slot 0 (7 AM), report slot_index: 0 (not 0 and 1)
// - The system will automatically block out the consecutive slots based on duration
// ROOM ASSIGNMENTS BY SECTION:
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`;
// }).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}
// ${availabilityText}
// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...
// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)
// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY its units time slots per section
// - MUST use the exact teacher assigned to each subject
// - Use the exact teacher_name string as shown above (case-sensitive, exact match, no extra spaces)
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers, but favor continuity/reuse
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// - CRITICAL: Distribute classes across the entire day — use afternoon slots (12 PM onward) actively
// - Do NOT schedule everything in the morning
// - Aim for a realistic university schedule with classes in both morning and afternoon
// ${payload.schedulePattern === 'MWF' ? '- MWF ONLY: Use Monday, Wednesday, Friday only. Schedule 1-hour sessions.' : ''}
// ${payload.schedulePattern === 'TTH' ? '- TTH ONLY: Use Tuesday, Thursday only. Schedule longer sessions (1.5-2 hours using consecutive slots).' : ''}
// ${payload.schedulePattern === 'BOTH' ? '- Use any day, but group subjects into either MWF or TTH patterns for consistency.' : ''}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots
// - For a 1.5-hour class on TTH: Use one slot (will be extended in implementation)
// - For a 2-hour class: Use consecutive slots (e.g., slot 0 then slot 1)
// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).
// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();

//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.7,
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);

//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️ GPT responded in ${elapsedTime}s`);

//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');

//     let parsed = JSON.parse(responseText);

//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });
//     console.log('📊 Section distribution:', sectionCounts);

//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }
//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     return assignments;
//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);

//     const isTimeout = error.message.includes('timed out');

//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }

//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log(' Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log(' Pattern:', schedulePattern);
//     console.log(' Sections:', sectionCount);
//     console.log(' Major (BTLED 3rd year):', major || 'N/A');
//     console.log(' Consider Availability:', considerInstructorAvailability);

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);

//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);

//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }

//       const assignedDuration = Number(assignment.duration) || 1;

//       console.log(` Subject ${s.subject_code}: Assigned duration = ${assignedDuration}h per session`);

//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignedDuration,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(` Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({
//         error: 'Not enough rooms',
//         detail: `You need at least ${sectionCount} rooms for ${sectionCount} section(s). Currently only ${roomAssignments.length} room(s) assigned.`
//       });
//     }

//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//       console.log(`📍 Section ${String.fromCharCode(65 + i)} → Room ${roomAssignments[i].room_name}`);
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap: sectionRoomMap,
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability
//     };

//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);
//     console.log('📋 Available teachers:', teachersForScheduler.map(t => `"${t.name}" (ID: ${t.id})`).join(', '));

//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();

//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);

//       if (!teacher) {
//         teacher = teachersForScheduler.find(t =>
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }

//       if (!teacher && a.subject_id) {
//         const subjectAssignment = teacherAssignments[a.subject_id];
//         if (subjectAssignment && subjectAssignment.teacher_id) {
//           teacher = teachersForScheduler.find(t => t.id === subjectAssignment.teacher_id);
//           if (teacher) {
//             console.log(`✅ Matched "${gptName}" to "${teacher.name}" via subject assignment`);
//           }
//         }
//       }

//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         console.log(`🔧 Fixed room for Section ${a.section_index}: ${a.room_id} → ${correctRoom.room_id} (${correctRoom.room_name})`);
//         a.room_id = correctRoom.room_id;
//       }

//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? Number(subject.duration) : 1;

//       if (!teacher) {
//         console.warn(`⚠️ Could not match teacher: "${gptName}" for subject ${a.subject_id}`);
//       } else {
//         console.log(`✅ Matched "${gptName}" to teacher ID ${teacher.id}`);
//       }

//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name,
//         duration: duration
//       };
//     });

//     const assignmentsWithoutTeacher = assignments.filter(a => !a.teacher_id);
//     if (assignmentsWithoutTeacher.length > 0) {
//       console.warn(`⚠️ Warning: ${assignmentsWithoutTeacher.length} assignments have no teacher_id`);
//       assignmentsWithoutTeacher.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Section ${a.section_index}, Teacher: "${a.teacher_name}"`);
//       });
//     }

//     console.log('📍 Verifying room assignments per section:');
//     for (let i = 0; i < sectionCount; i++) {
//       const sectionAssignments = assignments.filter(a => a.section_index === i);
//       const uniqueRooms = [...new Set(sectionAssignments.map(a => a.room_id))];
//       const expectedRoom = sectionRoomMap[i];
//       console.log(`   Section ${String.fromCharCode(65 + i)}: ${uniqueRooms.length === 1 ? '✅' : '⚠️'} ${uniqueRooms.length} room(s) used - Expected: ${expectedRoom.room_name} (ID: ${expectedRoom.room_id})`);
//       if (uniqueRooms.length > 1) {
//         console.warn(`      Rooms found: ${uniqueRooms.join(', ')}`);
//       }
//     }

//     console.log('🔍 Checking for instructor conflicts (considering class durations)...');

//     const instructorScheduleMap = {};
//     const roomScheduleMap = {}; // ✅ ADDED: Track room usage too
//     const conflicts = [];

//     assignments.forEach((a, index) => {
//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? subject.duration : 1;
//       const slotsNeeded = Math.ceil(duration);

//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = a.slot_index + i;
//         if (slotIndex < 12) {
//           // Check instructor conflicts
//           const instrKey = `${a.teacher_id}-${a.day}-${slotIndex}`;
//           if (instructorScheduleMap[instrKey]) {
//             conflicts.push({
//               type: 'instructor',
//               existing: instructorScheduleMap[instrKey],
//               conflicting: { ...a, affectedSlot: slotIndex },
//               index: index
//             });
//           } else {
//             instructorScheduleMap[instrKey] = { ...a, originalSlot: a.slot_index, duration: duration };
//           }

//           // ✅ ADDED: Check room conflicts
//           const roomKey = `${a.room_id}-${a.day}-${slotIndex}`;
//           if (roomScheduleMap[roomKey]) {
//             conflicts.push({
//               type: 'room',
//               existing: roomScheduleMap[roomKey],
//               conflicting: { ...a, affectedSlot: slotIndex },
//               index: index
//             });
//           } else {
//             roomScheduleMap[roomKey] = { ...a, originalSlot: a.slot_index, duration: duration };
//           }
//         }
//       }
//     });

//     if (conflicts.length > 0) {
//       console.warn(`⚠️ Found ${conflicts.length} conflicts. Attempting to fix...`);

//       conflicts.forEach(conflict => {
//         const assignment = conflict.conflicting;
//         const subject = subjectsWithTeachers.find(s => s.id === assignment.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);
//         const originalDay = assignment.day;
//         const originalSlot = assignment.slot_index;

//         console.log(`   Fixing ${conflict.type} conflict: ${assignment.instructor_name} on ${originalDay} slot ${originalSlot} (${duration}h class, needs ${slotsNeeded} slots)`);

//         let fixed = false;
//         const allowedDays = payload.schedulePattern === 'MWF' ? DAYS_MWF :
//                            payload.schedulePattern === 'TTH' ? DAYS_TTHS : DAYS_ALL;

//         for (const day of allowedDays) {
//           if (fixed) break;

//           for (let slot = 0; slot <= 12 - slotsNeeded; slot++) {
//             let allSlotsFree = true;

//             // Check if all needed slots are free for BOTH instructor AND room
//             for (let i = 0; i < slotsNeeded; i++) {
//               const instrKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//               const roomKey = `${assignment.room_id}-${day}-${slot + i}`;
              
//               if (instructorScheduleMap[instrKey] || roomScheduleMap[roomKey]) {
//                 allSlotsFree = false;
//                 break;
//               }
//             }

//             // Also check section availability
//             if (allSlotsFree) {
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const sectionBusy = assignments.some(a =>
//                   a.section_index === assignment.section_index &&
//                   a.day === day &&
//                   a.slot_index === (slot + i) &&
//                   a !== assignment
//                 );
//                 if (sectionBusy) {
//                   allSlotsFree = false;
//                   break;
//                 }
//               }
//             }

//             if (allSlotsFree) {
//               console.log(`      ✅ Rescheduled to ${day} slots ${slot}-${slot + slotsNeeded - 1}`);

//               // Remove old entries
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const oldInstrKey = `${assignment.teacher_id}-${assignment.day}-${assignment.slot_index + i}`;
//                 const oldRoomKey = `${assignment.room_id}-${assignment.day}-${assignment.slot_index + i}`;
//                 delete instructorScheduleMap[oldInstrKey];
//                 delete roomScheduleMap[oldRoomKey];
//               }

//               // Update assignment
//               assignment.day = day;
//               assignment.slot_index = slot;

//               // Add new entries
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const newInstrKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//                 const newRoomKey = `${assignment.room_id}-${day}-${slot + i}`;
//                 instructorScheduleMap[newInstrKey] = { ...assignment, originalSlot: slot, duration: duration };
//                 roomScheduleMap[newRoomKey] = { ...assignment, originalSlot: slot, duration: duration };
//               }

//               fixed = true;
//               break;
//             }
//           }
//         }

//         if (!fixed) {
//           console.error(`      ❌ Could not find alternative slot for ${assignment.instructor_name} (needs ${slotsNeeded} consecutive slots, ${conflict.type} conflict)`);
//         }
//       });

//       console.log('✅ Conflict resolution completed');
//     } else {
//       console.log('✅ No conflicts detected');
//     }

//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];

//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? Number(subject.duration) : 1;

//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ Missing teacher_id for: ${a.teacher_name}`);
//           continue;
//         }

//         // ✅ CRITICAL FIX: Calculate correct end_time based on duration
//         const startTime = timeSlot.start;
//         const startHour = parseInt(startTime.split(':')[0]);
//         const endHour = startHour + duration;
//         const endTime = `${String(endHour).padStart(2, '0')}:00:00`;

//         console.log(`📝 Saving: ${subject?.code} - ${a.day} ${startTime}-${endTime} (${duration}h)`);

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time, duration) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             startTime,
//             endTime,      // ✅ Now correctly calculated based on duration
//             duration      // ✅ Now saved to database
//           ]
//         );

//         a.duration = duration;
//         savedCount++;
//       }

//       await query('COMMIT');

//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

//       const finalConflicts = [];
//       const finalInstructorMap = {};
//       const finalRoomMap = {}; // ✅ ADDED: Track room conflicts in final check

//       for (const a of assignments) {
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);

//         for (let i = 0; i < slotsNeeded; i++) {
//           const slotIndex = a.slot_index + i;
//           if (slotIndex < 12) {
//             // Check instructor conflicts
//             const instrKey = `${a.teacher_id}-${a.day}-${slotIndex}`;
//             if (finalInstructorMap[instrKey]) {
//               finalConflicts.push({
//                 type: 'instructor',
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex,
//                 subject: subject?.code,
//                 duration: duration
//               });
//             } else {
//               finalInstructorMap[instrKey] = true;
//             }

//             // ✅ ADDED: Check room conflicts
//             const roomKey = `${a.room_id}-${a.day}-${slotIndex}`;
//             if (finalRoomMap[roomKey]) {
//               const room = roomAssignments.find(r => r.room_id === a.room_id);
//               finalConflicts.push({
//                 type: 'room',
//                 room: room?.room_name || a.room_id,
//                 day: a.day,
//                 slot: slotIndex,
//                 subject: subject?.code,
//                 duration: duration
//               });
//             } else {
//               finalRoomMap[roomKey] = true;
//             }
//           }
//         }
//       }

//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);
//       if (finalConflicts.length > 0) {
//         console.warn(`⚠️ Warning: ${finalConflicts.length} unresolved conflicts remain`);
//         finalConflicts.forEach(c => {
//           if (c.type === 'instructor') {
//             console.warn(`   - INSTRUCTOR: ${c.instructor} on ${c.day} slot ${c.slot} (${c.subject}, ${c.duration}h)`);
//           } else {
//             console.warn(`   - ROOM: ${c.room} on ${c.day} slot ${c.slot} (${c.subject}, ${c.duration}h)`);
//           }
//         });
//       } else {
//         console.log('✅ Zero conflicts - schedule is clean!');
//       }

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s)${finalConflicts.length > 0 ? ' with some conflicts' : ' with no conflicts'}`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: finalConflicts.length,
//           generationTimeSeconds: parseFloat(totalTime)
//         }
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try { await query('ROLLBACK'); } catch (rollbackErr) { console.error('❌ Rollback error:', rollbackErr); }

//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `
//       SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name
//       FROM schedule s
//       LEFT JOIN rooms r ON s.room_id = r.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       WHERE s.day = ? AND s.slot_index = ?
//     `;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);

//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;

//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time, s.duration
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries with filters:`, { courseId, yearLevel, semester });
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;
//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);

//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//WORKING BUT WITHOUT SCHEDULING CONLFLICT CHOOSE TO SAVE OR NOT 

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');
// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error(' Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');

//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error(' Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error(' Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );

//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });

//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// // NEW: Fetch ALL existing instructor schedules across ALL courses
// async function fetchExistingInstructorSchedules() {
//   try {
//     const results = await query(
//       `SELECT 
//         s.instructor_id,
//         i.name as instructor_name,
//         s.day,
//         s.slot_index,
//         s.start_time,
//         s.end_time,
//         s.duration,
//         s.course_id,
//         c.name as course_name,
//         c.code as course_code,
//         s.year_level,
//         s.semester,
//         subj.subject_code,
//         subj.description as subject_name
//        FROM schedule s
//        LEFT JOIN instructors i ON s.instructor_id = i.id
//        LEFT JOIN courses c ON s.course_id = c.id
//        LEFT JOIN subjects subj ON s.subject_id = subj.id
//        WHERE s.instructor_id IS NOT NULL`
//     );

//     const scheduleMap = {};
//     results.forEach(row => {
//       const instructorId = row.instructor_id;
//       if (!scheduleMap[instructorId]) {
//         scheduleMap[instructorId] = {
//           instructor_name: row.instructor_name,
//           occupied_slots: []
//         };
//       }

//       const duration = row.duration || 1;
//       const slotsNeeded = Math.ceil(duration);

//       // Block all slots this class occupies
//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = row.slot_index + i;
//         scheduleMap[instructorId].occupied_slots.push({
//           day: row.day,
//           slot_index: slotIndex,
//           course_code: row.course_code,
//           course_name: row.course_name,
//           year_level: row.year_level,
//           semester: row.semester,
//           subject_code: row.subject_code,
//           subject_name: row.subject_name,
//           time: `${row.start_time.substring(0, 5)}-${row.end_time.substring(0, 5)}`
//         });
//       }
//     });

//     return scheduleMap;
//   } catch (err) {
//     console.error('Error fetching existing instructor schedules:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;
//     const params = [courseId, yearLevel, semester];
//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }
//     const results = await query(sql, params);

//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });

//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );

//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // PATTERN VALIDATION AND ENFORCEMENT
// // ============================================

// function validateAndEnforcePattern(assignments, schedulePattern, sectionCount) {
//   console.log(`🔍 Validating schedule pattern: ${schedulePattern}`);
  
//   const allowedDays = schedulePattern === 'MWF' ? DAYS_MWF :
//                      schedulePattern === 'TTH' ? DAYS_TTHS : DAYS_ALL;
  
//   let invalidCount = 0;
//   let fixedAssignments = [];
  
//   // Track usage by subject and section
//   const subjectSectionMap = {};
  
//   assignments.forEach(a => {
//     const key = `${a.subject_id}-${a.section_index}`;
//     if (!subjectSectionMap[key]) {
//       subjectSectionMap[key] = [];
//     }
//     subjectSectionMap[key].push(a);
//   });
  
//   // Validate each subject-section group
//   for (const [key, group] of Object.entries(subjectSectionMap)) {
//     const invalidDays = group.filter(a => !allowedDays.includes(a.day));
    
//     if (invalidDays.length > 0) {
//       invalidCount += invalidDays.length;
//       console.warn(`⚠️ Found ${invalidDays.length} assignments violating ${schedulePattern} pattern for ${key}`);
      
//       // Fix invalid assignments
//       group.forEach(assignment => {
//         if (!allowedDays.includes(assignment.day)) {
//           // Find a valid day
//           const validDay = allowedDays[Math.floor(Math.random() * allowedDays.length)];
//           console.log(`   🔧 Fixing: ${assignment.day} → ${validDay}`);
//           assignment.day = validDay;
//         }
//       });
//     }
    
//     // Ensure consistent pattern within group
//     const uniqueDays = [...new Set(group.map(a => a.day))];
//     const allMWF = uniqueDays.every(d => DAYS_MWF.includes(d));
//     const allTTH = uniqueDays.every(d => DAYS_TTHS.includes(d));
    
//     if (schedulePattern === 'BOTH' && uniqueDays.length > 0 && !allMWF && !allTTH) {
//       // Enforce either MWF or TTH pattern for this subject
//       const useMWF = uniqueDays.some(d => DAYS_MWF.includes(d));
//       const targetDays = useMWF ? DAYS_MWF : DAYS_TTHS;
      
//       group.forEach(assignment => {
//         if (!targetDays.includes(assignment.day)) {
//           const validDay = targetDays[Math.floor(Math.random() * targetDays.length)];
//           console.log(`   🔧 Enforcing pattern consistency: ${assignment.day} → ${validDay}`);
//           assignment.day = validDay;
//           invalidCount++;
//         }
//       });
//     }
    
//     fixedAssignments.push(...group);
//   }
  
//   if (invalidCount > 0) {
//     console.log(`✅ Fixed ${invalidCount} pattern violations`);
//   } else {
//     console.log(`✅ All assignments follow ${schedulePattern} pattern correctly`);
//   }
  
//   return fixedAssignments;
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');

//   if (retryCount > 0) {
//     console.log(` Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Sending to GPT:');
//   console.log(' Subjects:', payload.subjects.length);
//   console.log(' Teachers:', payload.teachers.length);
//   console.log(' Rooms:', payload.rooms.length);
//   console.log(' Sections:', payload.sectionCount);
//   console.log(' Pattern:', payload.schedulePattern);
//   console.log(' Timeout: 60 seconds');

//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
//   let patternRules = '';

//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//     patternRules = `
// **CRITICAL MWF PATTERN RULES (ABSOLUTE REQUIREMENT):**
// - YOU MUST USE ONLY: Monday, Wednesday, Friday
// - FORBIDDEN DAYS: Tuesday, Thursday, Saturday, Sunday
// - If you include ANY class on Tuesday, Thursday, or Saturday, the schedule is INVALID
// - Every single assignment MUST have day = "Monday" OR "Wednesday" OR "Friday"
// - For 3-unit courses: Schedule on 3 different days (Mon + Wed + Fri)
// - Double-check every assignment before returning - NO exceptions to this rule`;
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2-3 times per week (Tuesday, Thursday, Saturday) - typically 1.5 hours per session';
//     patternRules = `
// **CRITICAL TTH PATTERN RULES (ABSOLUTE REQUIREMENT):**
// - YOU MUST USE ONLY: Tuesday, Thursday, Saturday
// - FORBIDDEN DAYS: Monday, Wednesday, Friday, Sunday
// - If you include ANY class on Monday, Wednesday, or Friday, the schedule is INVALID
// - Every single assignment MUST have day = "Tuesday" OR "Thursday" OR "Saturday"
// - For 3-unit courses: Use 2-3 sessions across these days with appropriate durations
// - Double-check every assignment before returning - NO exceptions to this rule`;
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but MUST group each subject into EITHER MWF OR TTH pattern';
//     patternRules = `
// **CRITICAL BOTH PATTERN RULES (ABSOLUTE REQUIREMENT):**
// - Each subject MUST follow EITHER MWF pattern OR TTH pattern - NEVER mix them
// - If you schedule Math on Monday, ALL Math sessions must be on Mon/Wed/Fri ONLY
// - If you schedule English on Tuesday, ALL English sessions must be on Tue/Thu/Sat ONLY
// - FORBIDDEN: Math on Monday + Math on Tuesday (this mixes patterns)
// - Choose pattern per subject, then stick to it consistently
// - Double-check each subject - all sessions must use the same pattern`;
//   }

//   const facultyPatternNote = `
// ADDITIONAL REAL-WORLD FACULTY LOADING PATTERN (MUST FOLLOW):
// - The institution has a stable core faculty: most instructors teach in BOTH semesters (continuity is prioritized).
// - Only a minority are semester-specific (part-time or temporary).
// - Therefore, when scheduling, PRIORITIZE REUSING THE SAME INSTRUCTORS across multiple subjects/sections if possible.
// - Avoid introducing "new" instructors unnecessarily — stick strictly to the provided teacher list.
// - Core instructors should have balanced but consistent loads across sections.
// - This creates realistic, sustainable yearly schedules with minimal turnover.`;

//   // NEW: Build instructor busy slots text
//   let instructorBusySlotsText = '';
//   if (payload.existingInstructorSchedules && Object.keys(payload.existingInstructorSchedules).length > 0) {
//     instructorBusySlotsText = '\n\n**CRITICAL: EXISTING INSTRUCTOR SCHEDULES ACROSS ALL COURSES (MUST NOT CONFLICT):**';
//     instructorBusySlotsText += '\nThese instructors are ALREADY teaching at these times in OTHER courses. DO NOT schedule them during these occupied slots:';
    
//     for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
//       const teacher = payload.teachers.find(t => t.id === parseInt(instructorId));
//       if (teacher) {
//         instructorBusySlotsText += `\n\n- **${data.instructor_name}** (ID: ${instructorId}) - OCCUPIED SLOTS:`;
        
//         // Group by day for better readability
//         const slotsByDay = {};
//         data.occupied_slots.forEach(slot => {
//           if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
//           slotsByDay[slot.day].push(slot);
//         });
        
//         for (const [day, slots] of Object.entries(slotsByDay)) {
//           instructorBusySlotsText += `\n  ${day}: `;
//           const uniqueSlots = [...new Map(slots.map(s => [s.slot_index, s])).values()];
//           instructorBusySlotsText += uniqueSlots
//             .sort((a, b) => a.slot_index - b.slot_index)
//             .map(s => `slot ${s.slot_index} (${s.time}, ${s.course_code} - ${s.subject_code})`)
//             .join(', ');
//         }
//       }
//     }
    
//     instructorBusySlotsText += '\n\n**IMPORTANT**: Before assigning any instructor to a time slot, CHECK if they are already occupied in another course!';
//   }

//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.

// ${patternRules}

// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. **SCHEDULE PATTERN IS MANDATORY**: Follow the pattern rules above with ZERO violations
// 2. **CROSS-COURSE INSTRUCTOR CONFLICTS ARE ABSOLUTELY FORBIDDEN**: An instructor CANNOT teach in multiple courses at the same time
//    - Example: If Instructor A teaches BSIT at Monday 7-8 AM, they CANNOT teach BSAIS at Monday 7-8 AM
//    - Check the existing instructor schedules provided below - these slots are BLOCKED
// 3. **WITHIN-COURSE INSTRUCTOR CONFLICTS ARE FORBIDDEN**: No instructor can teach multiple sections at the same time
// 4. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 5. No section can have multiple classes at the same time (same day, same slot_index)
// 6. Each subject must be scheduled exactly 'units' times per section (e.g., 3-unit course = 3 time slots)
// 7. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 8. Each section uses ONE dedicated room for ALL its subjects (see room assignments below)
// 9. Consider class duration (some classes may be 1.5-3 hours long)
// 10. Respect instructor availability windows if provided
// 11. Balance instructor workload across all teachers — but prioritize continuity and reuse of the same instructors
// 12. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})
// ${facultyPatternNote}
// ${instructorBusySlotsText}

// AVOIDING INSTRUCTOR CONFLICTS (CRITICAL):
// - Before assigning an instructor to a time slot, CHECK THREE THINGS:
//   1. Are they already teaching in ANOTHER COURSE at that day/time? (see existing schedules above)
//   2. Are they already teaching a different section in THIS COURSE at that day/time?
//   3. Do they have availability restrictions?
// - If an instructor teaches Section A at Monday 7:00 AM, they CANNOT teach Section B at Monday 7:00 AM
// - If an instructor teaches BSIT at Monday 7:00 AM, they CANNOT teach BSAIS at Monday 7:00 AM
// - Stagger section schedules to avoid instructor conflicts
// - Track each instructor's schedule as you build the timetable

// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, 2 = Section C, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// - Example: If there are 2 sections, Subject "Math 101" needs to be scheduled for both Section 0 and Section 1
// - Make sure to distribute sections evenly to avoid conflicts

// ROOM ASSIGNMENT PER SECTION (CRITICAL):
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (${String.fromCharCode(65 + parseInt(secIdx))}) MUST use Room ID ${room.room_id} (${room.room_name}) for ALL subjects`;
// }).join('\n') : ''}
// - Each section is assigned ONE dedicated room
// - ALL subjects in a section MUST use the same room_id assigned to that section
// - Do NOT use different rooms for different subjects within the same section

// SCHEDULE PATTERN RULES:
// ${patternDescription}
// - For 3-unit courses on MWF: Schedule 3 sessions of the assigned duration each
// - For 3-unit courses on TTH: Schedule 2 sessions (may use longer durations or consecutive time slots)
// - Distribute classes evenly across the week
// - Maximum 2 sessions per day for the same subject in the same section
// - **IMPORTANT**: Each subject has an assigned class duration (e.g., 1h, 1.5h, 2h, etc.) that you MUST respect
// - If a class duration is 1.5 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-8:30)
// - If a class duration is 2 hours, it occupies 2 consecutive time slots (e.g., slots 0-1 for 7:00-9:00)
// - If a class duration is 3 hours, it occupies 3 consecutive time slots (e.g., slots 0-2 for 7:00-10:00)

// OPTIMIZATION GOALS (VERY IMPORTANT):
// - Distribute classes EVENLY across the FULL DAY: from 7:00 AM to 7:00 PM
// - Actively use BOTH morning (7 AM–12 PM) and afternoon (12 PM–7 PM) slots
// - Avoid overloading morning hours — do NOT put all classes in the morning
// - Aim for balance: roughly 50–60% of classes in morning, 40–50% in afternoon
// - No section or instructor should have all their classes crammed into the morning
// - Spread classes to create reasonable gaps and realistic university schedules
// - For longer durations, use consecutive time slots (e.g., slot 0 and 1 for a 2-hour class)
// - Ensure all ${payload.sectionCount} section(s) have complete and balanced schedules
// - Prioritize instructor continuity: reuse the same teachers across sections/subjects to mimic real faculty loading stability

// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}, where 0=Section A, 1=Section B, etc.),
//   "teacher_name": string (MUST match exactly from the teacher list),
//   "room_id": number (MUST use the room_id assigned to this section_index),
//   "day": string (MUST be one of the allowed days: ${allowedDays.join(', ')}),
//   "slot_index": number (0-11, where 0=7-8AM, 1=8-9AM, ..., 11=6-7PM)
// }

// FINAL VALIDATION BEFORE RETURNING:
// 1. Check EVERY assignment's "day" field - confirm it's in the allowed list: ${allowedDays.join(', ')}
// 2. For each subject, verify ALL sessions use consistent pattern (all MWF or all TTH, never mixed)
// 3. Verify NO instructor is scheduled during their occupied slots from other courses
// 4. Count invalid days - if ANY exist, fix them before returning
// 5. This is your LAST CHANCE to ensure pattern compliance and avoid cross-course conflicts

// REMEMBER: All subjects in Section 0 use the SAME room_id. All subjects in Section 1 use a DIFFERENT room_id, etc.`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a =>
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:

// SUBJECTS WITH ASSIGNED TEACHERS (MUST USE THESE EXACT PAIRINGS):
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h per session) → Teacher: "${s.teacher_name}"`).join('\n')}

// **CRITICAL - CLASS DURATION RULES**:
// - Each subject above has a specific "Duration" (e.g., 1h, 1.5h, 2h, 3h, etc.)
// - This duration represents how long EACH teaching session lasts
// - You MUST respect these durations when scheduling:
//   * 1 hour duration = Use 1 time slot (e.g., slot 0 = 7:00-8:00 AM)
//   * 1.5 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-8:30 AM, but report only slot 0)
//   * 2 hours duration = Use 2 consecutive slots (e.g., slots 0-1 = 7:00-9:00 AM, but report only slot 0)
//   * 3 hours duration = Use 3 consecutive slots (e.g., slots 0-2 = 7:00-10:00 AM, but report only slot 0)
//   * 4 hours duration = Use 4 consecutive slots (e.g., slots 0-3 = 7:00-11:00 AM, but report only slot 0)
// - When reporting the schedule, only include the STARTING slot_index
// - Example: If Math has 2-hour duration and starts at slot 0 (7 AM), report slot_index: 0 (not 0 and 1)
// - The system will automatically block out the consecutive slots based on duration

// ROOM ASSIGNMENTS BY SECTION:
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`;
// }).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id}, Building: ${r.building_name})`).join('\n')}

// ${availabilityText}

// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS (USE ONLY THESE): ${allowedDays.join(', ')}
// FORBIDDEN DAYS (NEVER USE): ${DAYS_ALL.filter(d => !allowedDays.includes(d)).join(', ')}

// SECTIONS: ${payload.sectionCount} (section_index from 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B
//   - Section 2 = Section C
//   - And so on...

// TIME SLOTS: 0-11 (representing 7AM to 7PM in one-hour blocks)

// IMPORTANT REMINDERS:
// - Consider availability: ${payload.considerInstructorAvailability ? 'YES - Only schedule instructors during their available times' : 'NO - Any time is fine'}
// - Each subject needs EXACTLY its units time slots per section
// - MUST use the exact teacher assigned to each subject
// - Use the exact teacher_name string as shown above (case-sensitive, exact match, no extra spaces)
// - Balance workload: Try to distribute fairly among all ${payload.teachers.length} teachers, but favor continuity/reuse
// - NO conflicts allowed: Check room, instructor, and section availability for each time slot
// - GENERATE COMPLETE SCHEDULES FOR ALL ${payload.sectionCount} SECTION(S)
// - CRITICAL: Distribute classes across the entire day — use afternoon slots (12 PM onward) actively
// - Do NOT schedule everything in the morning
// - Aim for a realistic university schedule with classes in both morning and afternoon
// - **ABSOLUTE REQUIREMENT**: Every "day" field must be from the allowed list: ${allowedDays.join(', ')}
// - Respect class duration: Classes with duration > 1 hour need consecutive time slots

// CRITICAL: You MUST generate assignments for ALL ${payload.sectionCount} section(s). Each subject must appear ${payload.sectionCount} time(s) in your output (once per section).

// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No markdown, no explanations, just pure JSON.`;

//   try {
//     const startTime = Date.now();

//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.3, // Lower temperature for more consistent pattern following
//       max_tokens: 4000
//     });

//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });

//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);

//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️ GPT responded in ${elapsedTime}s`);

//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received');

//     let parsed = JSON.parse(responseText);

//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });
//     console.log('📊 Section distribution:', sectionCounts);

//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }
//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     // ✅ ENFORCE PATTERN VALIDATION
//     assignments = validateAndEnforcePattern(assignments, payload.schedulePattern, payload.sectionCount);

//     return assignments;
//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);

//     const isTimeout = error.message.includes('timed out');

//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }

//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts. Try: 1) Reducing subjects/sections, 2) Using fewer constraints, or 3) Try again in a few minutes.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check your billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Please check your OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log(' Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log(' Pattern:', schedulePattern);
//     console.log(' Sections:', sectionCount);
//     console.log(' Major (BTLED 3rd year):', major || 'N/A');
//     console.log(' Consider Availability:', considerInstructorAvailability);

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);

//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     // NEW: Fetch existing instructor schedules from ALL courses
//     console.log('🔍 Fetching existing instructor schedules across all courses...');
//     const existingInstructorSchedules = await fetchExistingInstructorSchedules();
    
//     if (Object.keys(existingInstructorSchedules).length > 0) {
//       console.log(`📊 Found ${Object.keys(existingInstructorSchedules).length} instructors with existing schedules`);
//       for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//         console.log(`   - ${data.instructor_name} (ID: ${instructorId}): ${data.occupied_slots.length} occupied time slots`);
//       }
//     } else {
//       console.log('📊 No existing instructor schedules found (this might be the first course being scheduled)');
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);

//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms for this course/year/semester in the Rooms page'
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!Array.isArray(subjRows) || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found in database' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability data...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }

//       const assignedDuration = Number(assignment.duration) || 1;

//       console.log(` Subject ${s.subject_code}: Assigned duration = ${assignedDuration}h per session`);

//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: assignedDuration,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
//     console.log(` Subjects: ${subjectsWithTeachers.length}, Teachers: ${teachersForScheduler.length}, Rooms: ${roomAssignments.length}, Sections: ${sectionCount}`);

//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({
//         error: 'Not enough rooms',
//         detail: `You need at least ${sectionCount} rooms for ${sectionCount} section(s). Currently only ${roomAssignments.length} room(s) assigned.`
//       });
//     }

//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//       console.log(`📍 Section ${String.fromCharCode(65 + i)} → Room ${roomAssignments[i].room_name}`);
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount) || 30,
//       sectionCount: Number(sectionCount) || 1,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap: sectionRoomMap,
//       schedulePattern: schedulePattern,
//       slotsPerDay: 12,
//       considerInstructorAvailability: considerInstructorAvailability,
//       existingInstructorSchedules: existingInstructorSchedules // NEW: Pass existing schedules
//     };

//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create any valid assignments. Try adjusting constraints or adding more instructors/rooms.'
//       });
//     }

//     console.log(`✅ GPT returned ${assignments.length} assignments`);
//     console.log('📋 Available teachers:', teachersForScheduler.map(t => `"${t.name}" (ID: ${t.id})`).join(', '));

//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();

//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);

//       if (!teacher) {
//         teacher = teachersForScheduler.find(t =>
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }

//       if (!teacher && a.subject_id) {
//         const subjectAssignment = teacherAssignments[a.subject_id];
//         if (subjectAssignment && subjectAssignment.teacher_id) {
//           teacher = teachersForScheduler.find(t => t.id === subjectAssignment.teacher_id);
//           if (teacher) {
//             console.log(`✅ Matched "${gptName}" to "${teacher.name}" via subject assignment`);
//           }
//         }
//       }

//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         console.log(`🔧 Fixed room for Section ${a.section_index}: ${a.room_id} → ${correctRoom.room_id} (${correctRoom.room_name})`);
//         a.room_id = correctRoom.room_id;
//       }

//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? Number(subject.duration) : 1;

//       if (!teacher) {
//         console.warn(`⚠️ Could not match teacher: "${gptName}" for subject ${a.subject_id}`);
//       } else {
//         console.log(`✅ Matched "${gptName}" to teacher ID ${teacher.id}`);
//       }

//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name,
//         duration: duration
//       };
//     });

//     const assignmentsWithoutTeacher = assignments.filter(a => !a.teacher_id);
//     if (assignmentsWithoutTeacher.length > 0) {
//       console.warn(`⚠️ Warning: ${assignmentsWithoutTeacher.length} assignments have no teacher_id`);
//       assignmentsWithoutTeacher.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Section ${a.section_index}, Teacher: "${a.teacher_name}"`);
//       });
//     }

//     console.log('📍 Verifying room assignments per section:');
//     for (let i = 0; i < sectionCount; i++) {
//       const sectionAssignments = assignments.filter(a => a.section_index === i);
//       const uniqueRooms = [...new Set(sectionAssignments.map(a => a.room_id))];
//       const expectedRoom = sectionRoomMap[i];
//       console.log(`   Section ${String.fromCharCode(65 + i)}: ${uniqueRooms.length === 1 ? '✅' : '⚠️'} ${uniqueRooms.length} room(s) used - Expected: ${expectedRoom.room_name} (ID: ${expectedRoom.room_id})`);
//       if (uniqueRooms.length > 1) {
//         console.warn(`      Rooms found: ${uniqueRooms.join(', ')}`);
//       }
//     }

//     console.log('🔍 Checking for instructor conflicts (considering class durations)...');

//     const instructorScheduleMap = {};
//     const roomScheduleMap = {};
//     const conflicts = [];

//     // NEW: Pre-populate with existing schedules from other courses
//     if (existingInstructorSchedules) {
//       for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//         data.occupied_slots.forEach(slot => {
//           const instrKey = `${instructorId}-${slot.day}-${slot.slot_index}`;
//           instructorScheduleMap[instrKey] = {
//             isExisting: true,
//             course: slot.course_code,
//             subject: slot.subject_code,
//             time: slot.time
//           };
//         });
//       }
//       console.log(`📌 Pre-loaded ${Object.keys(instructorScheduleMap).length} occupied slots from existing schedules`);
//     }

//     assignments.forEach((a, index) => {
//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? subject.duration : 1;
//       const slotsNeeded = Math.ceil(duration);

//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = a.slot_index + i;
//         if (slotIndex < 12) {
//           // Check instructor conflicts (including cross-course)
//           const instrKey = `${a.teacher_id}-${a.day}-${slotIndex}`;
//           const existing = instructorScheduleMap[instrKey];
          
//           if (existing) {
//             if (existing.isExisting) {
//               // Conflict with another course
//               conflicts.push({
//                 type: 'instructor_cross_course',
//                 existing: existing,
//                 conflicting: { ...a, affectedSlot: slotIndex },
//                 index: index
//               });
//               console.warn(`⚠️ CROSS-COURSE CONFLICT: ${a.instructor_name} already teaching ${existing.course} - ${existing.subject} at ${a.day} slot ${slotIndex}`);
//             } else {
//               // Conflict within current course
//               conflicts.push({
//                 type: 'instructor',
//                 existing: existing,
//                 conflicting: { ...a, affectedSlot: slotIndex },
//                 index: index
//               });
//             }
//           } else {
//             instructorScheduleMap[instrKey] = { ...a, originalSlot: a.slot_index, duration: duration, isExisting: false };
//           }

//           // Check room conflicts
//           const roomKey = `${a.room_id}-${a.day}-${slotIndex}`;
//           if (roomScheduleMap[roomKey]) {
//             conflicts.push({
//               type: 'room',
//               existing: roomScheduleMap[roomKey],
//               conflicting: { ...a, affectedSlot: slotIndex },
//               index: index
//             });
//           } else {
//             roomScheduleMap[roomKey] = { ...a, originalSlot: a.slot_index, duration: duration };
//           }
//         }
//       }
//     });

//     if (conflicts.length > 0) {
//       console.warn(`⚠️ Found ${conflicts.length} conflicts. Attempting to fix...`);

//       conflicts.forEach(conflict => {
//         const assignment = conflict.conflicting;
//         const subject = subjectsWithTeachers.find(s => s.id === assignment.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);
//         const originalDay = assignment.day;
//         const originalSlot = assignment.slot_index;

//         if (conflict.type === 'instructor_cross_course') {
//           console.log(`   Fixing CROSS-COURSE conflict: ${assignment.instructor_name} on ${originalDay} slot ${originalSlot}`);
//           console.log(`      Already teaching: ${conflict.existing.course} - ${conflict.existing.subject} at ${conflict.existing.time}`);
//         } else {
//           console.log(`   Fixing ${conflict.type} conflict: ${assignment.instructor_name} on ${originalDay} slot ${originalSlot} (${duration}h class, needs ${slotsNeeded} slots)`);
//         }

//         let fixed = false;
//         const allowedDays = payload.schedulePattern === 'MWF' ? DAYS_MWF :
//                            payload.schedulePattern === 'TTH' ? DAYS_TTHS : DAYS_ALL;

//         for (const day of allowedDays) {
//           if (fixed) break;

//           for (let slot = 0; slot <= 12 - slotsNeeded; slot++) {
//             let allSlotsFree = true;

//             // Check if all needed slots are free for BOTH instructor AND room
//             for (let i = 0; i < slotsNeeded; i++) {
//               const instrKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//               const roomKey = `${assignment.room_id}-${day}-${slot + i}`;
              
//               // Check both current course conflicts AND cross-course conflicts
//               if (instructorScheduleMap[instrKey] || roomScheduleMap[roomKey]) {
//                 allSlotsFree = false;
//                 break;
//               }
//             }

//             // Also check section availability
//             if (allSlotsFree) {
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const sectionBusy = assignments.some(a =>
//                   a.section_index === assignment.section_index &&
//                   a.day === day &&
//                   a.slot_index === (slot + i) &&
//                   a !== assignment
//                 );
//                 if (sectionBusy) {
//                   allSlotsFree = false;
//                   break;
//                 }
//               }
//             }

//             if (allSlotsFree) {
//               console.log(`      ✅ Rescheduled to ${day} slots ${slot}-${slot + slotsNeeded - 1}`);

//               // Remove old entries (only if not existing schedule)
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const oldInstrKey = `${assignment.teacher_id}-${assignment.day}-${assignment.slot_index + i}`;
//                 const oldRoomKey = `${assignment.room_id}-${assignment.day}-${assignment.slot_index + i}`;
                
//                 // Don't delete existing schedules from other courses
//                 if (instructorScheduleMap[oldInstrKey] && !instructorScheduleMap[oldInstrKey].isExisting) {
//                   delete instructorScheduleMap[oldInstrKey];
//                 }
//                 delete roomScheduleMap[oldRoomKey];
//               }

//               // Update assignment
//               assignment.day = day;
//               assignment.slot_index = slot;

//               // Add new entries
//               for (let i = 0; i < slotsNeeded; i++) {
//                 const newInstrKey = `${assignment.teacher_id}-${day}-${slot + i}`;
//                 const newRoomKey = `${assignment.room_id}-${day}-${slot + i}`;
//                 instructorScheduleMap[newInstrKey] = { ...assignment, originalSlot: slot, duration: duration, isExisting: false };
//                 roomScheduleMap[newRoomKey] = { ...assignment, originalSlot: slot, duration: duration };
//               }

//               fixed = true;
//               break;
//             }
//           }
//         }

//         if (!fixed) {
//           console.error(`      ❌ Could not find alternative slot for ${assignment.instructor_name} (needs ${slotsNeeded} consecutive slots, ${conflict.type} conflict)`);
//           if (conflict.type === 'instructor_cross_course') {
//             console.error(`      The instructor is busy teaching ${conflict.existing.course} - ${conflict.existing.subject}`);
//           }
//         }
//       });

//       console.log('✅ Conflict resolution completed');
//     } else {
//       console.log('✅ No conflicts detected');
//     }

//     const invalidSections = assignments.filter(a => a.section_index < 0 || a.section_index >= payload.sectionCount);
//     if (invalidSections.length > 0) {
//       console.log(`🔧 Fixing ${invalidSections.length} invalid section indices...`);
//       assignments = assignments.map(a => ({
//         ...a,
//         section_index: Math.max(0, Math.min(a.section_index, payload.sectionCount - 1))
//       }));
//     }

//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];

//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? Number(subject.duration) : 1;

//         if (!timeSlot) {
//           console.error(`❌ Invalid slot_index: ${a.slot_index}`);
//           continue;
//         }

//         if (!sectionId) {
//           console.error(`❌ Invalid section_index: ${a.section_index}`);
//           continue;
//         }

//         if (!a.teacher_id) {
//           console.error(`❌ Missing teacher_id for: ${a.teacher_name}`);
//           continue;
//         }

//         // Calculate correct end_time based on duration
//         const startTime = timeSlot.start;
//         const startHour = parseInt(startTime.split(':')[0]);
//         const endHour = startHour + duration;
//         const endTime = `${String(endHour).padStart(2, '0')}:00:00`;

//         console.log(`📝 Saving: ${subject?.code} - ${a.day} ${startTime}-${endTime} (${duration}h)`);

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time, duration) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             startTime,
//             endTime,
//             duration
//           ]
//         );

//         a.duration = duration;
//         savedCount++;
//       }

//       await query('COMMIT');

//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

//       const finalConflicts = [];
//       const finalInstructorMap = {};
//       const finalRoomMap = {};
//       const crossCourseConflicts = [];

//       // Re-populate with existing schedules for final check
//       if (existingInstructorSchedules) {
//         for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//           data.occupied_slots.forEach(slot => {
//             const instrKey = `${instructorId}-${slot.day}-${slot.slot_index}`;
//             finalInstructorMap[instrKey] = {
//               isExisting: true,
//               course: slot.course_code,
//               subject: slot.subject_code,
//               instructor: data.instructor_name
//             };
//           });
//         }
//       }

//       for (const a of assignments) {
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? subject.duration : 1;
//         const slotsNeeded = Math.ceil(duration);

//         for (let i = 0; i < slotsNeeded; i++) {
//           const slotIndex = a.slot_index + i;
//           if (slotIndex < 12) {
//             // Check instructor conflicts (including cross-course)
//             const instrKey = `${a.teacher_id}-${a.day}-${slotIndex}`;
//             const existing = finalInstructorMap[instrKey];
            
//             if (existing) {
//               if (existing.isExisting) {
//                 // Cross-course conflict detected
//                 crossCourseConflicts.push({
//                   type: 'instructor_cross_course',
//                   instructor: a.instructor_name,
//                   day: a.day,
//                   slot: slotIndex,
//                   newCourse: `Course ${courseId}`,
//                   newSubject: subject?.code,
//                   existingCourse: existing.course,
//                   existingSubject: existing.subject,
//                   duration: duration
//                 });
//               } else {
//                 // Within-course conflict
//                 finalConflicts.push({
//                   type: 'instructor',
//                   instructor: a.instructor_name,
//                   day: a.day,
//                   slot: slotIndex,
//                   subject: subject?.code,
//                   duration: duration
//                 });
//               }
//             } else {
//               finalInstructorMap[instrKey] = { ...a, isExisting: false };
//             }

//             // Check room conflicts
//             const roomKey = `${a.room_id}-${a.day}-${slotIndex}`;
//             if (finalRoomMap[roomKey]) {
//               const room = roomAssignments.find(r => r.room_id === a.room_id);
//               finalConflicts.push({
//                 type: 'room',
//                 room: room?.room_name || a.room_id,
//                 day: a.day,
//                 slot: slotIndex,
//                 subject: subject?.code,
//                 duration: duration
//               });
//             } else {
//               finalRoomMap[roomKey] = true;
//             }
//           }
//         }
//       }

//       console.log(`✅ Successfully saved ${savedCount} schedule entries across ${payload.sectionCount} section(s) (GPT-generated in ${totalTime}s)`);
      
//       if (crossCourseConflicts.length > 0) {
//         console.error(`❌ CRITICAL: ${crossCourseConflicts.length} CROSS-COURSE CONFLICTS detected!`);
//         crossCourseConflicts.forEach(c => {
//           console.error(`   - ${c.instructor} teaching BOTH:`);
//           console.error(`     • ${c.newCourse} - ${c.newSubject} on ${c.day} slot ${c.slot}`);
//           console.error(`     • ${c.existingCourse} - ${c.existingSubject} (already scheduled)`);
//         });
//       }
      
//       if (finalConflicts.length > 0) {
//         console.warn(`⚠️ Warning: ${finalConflicts.length} within-course conflicts remain`);
//         finalConflicts.forEach(c => {
//           if (c.type === 'instructor') {
//             console.warn(`   - INSTRUCTOR: ${c.instructor} on ${c.day} slot ${c.slot} (${c.subject}, ${c.duration}h)`);
//           } else {
//             console.warn(`   - ROOM: ${c.room} on ${c.day} slot ${c.slot} (${c.subject}, ${c.duration}h)`);
//           }
//         });
//       }
      
//       if (crossCourseConflicts.length === 0 && finalConflicts.length === 0) {
//         console.log('✅ Zero conflicts - schedule is clean!');
//       }

//       const totalConflicts = crossCourseConflicts.length + finalConflicts.length;

//       res.json({
//         success: true,
//         message: `Schedule generated successfully for ${payload.sectionCount} section(s)${totalConflicts > 0 ? ' with some conflicts' : ' with no conflicts'}`,
//         method: 'OpenAI GPT-3.5-Turbo',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           considerInstructorAvailability: considerInstructorAvailability,
//           availabilityEnforced: considerInstructorAvailability,
//           conflictsDetected: totalConflicts,
//           crossCourseConflicts: crossCourseConflicts.length,
//           withinCourseConflicts: finalConflicts.length,
//           generationTimeSeconds: parseFloat(totalTime)
//         },
//         warnings: crossCourseConflicts.length > 0 ? {
//           crossCourseConflicts: crossCourseConflicts.map(c => 
//             `${c.instructor}: ${c.newCourse} (${c.newSubject}) conflicts with ${c.existingCourse} (${c.existingSubject}) on ${c.day} slot ${c.slot}`
//           )
//         } : undefined
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try { await query('ROLLBACK'); } catch (rollbackErr) { console.error('❌ Rollback error:', rollbackErr); }

//     res.status(500).json({
//       error: 'Server error during schedule generation',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `
//       SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name
//       FROM schedule s
//       LEFT JOIN rooms r ON s.room_id = r.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       WHERE s.day = ? AND s.slot_index = ?
//     `;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);

//     const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
//     const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
//     const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       usedRoomNames,
//       usedInstructorNames,
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;

//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time, s.duration
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries with filters:`, { courseId, yearLevel, semester });
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted successfully`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;
//   try {
//     console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);

//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//FUNCTIONAL BUT OPEANAI TIMEOUT

// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');
// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error(' Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');
//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error(' Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error(' Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );
//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });
//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchExistingInstructorSchedules() {
//   try {
//     const results = await query(
//       `SELECT
//         s.instructor_id,
//         i.name as instructor_name,
//         s.day,
//         s.slot_index,
//         s.start_time,
//         s.end_time,
//         s.duration,
//         s.course_id,
//         c.name as course_name,
//         c.code as course_code,
//         s.year_level,
//         s.semester,
//         subj.subject_code,
//         subj.description as subject_name
//        FROM schedule s
//        LEFT JOIN instructors i ON s.instructor_id = i.id
//        LEFT JOIN courses c ON s.course_id = c.id
//        LEFT JOIN subjects subj ON s.subject_id = subj.id
//        WHERE s.instructor_id IS NOT NULL`
//     );
//     const scheduleMap = {};
//     results.forEach(row => {
//       const instructorId = row.instructor_id;
//       if (!scheduleMap[instructorId]) {
//         scheduleMap[instructorId] = {
//           instructor_name: row.instructor_name,
//           occupied_slots: []
//         };
//       }
//       const duration = row.duration || 1;
//       const slotsNeeded = Math.ceil(duration);
//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = row.slot_index + i;
//         scheduleMap[instructorId].occupied_slots.push({
//           day: row.day,
//           slot_index: slotIndex,
//           course_code: row.course_code,
//           course_name: row.course_name,
//           year_level: row.year_level,
//           semester: row.semester,
//           subject_code: row.subject_code,
//           subject_name: row.subject_name,
//           time: `${row.start_time.substring(0, 5)}-${row.end_time.substring(0, 5)}`
//         });
//       }
//     });
//     return scheduleMap;
//   } catch (err) {
//     console.error('Error fetching existing instructor schedules:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;
//     const params = [courseId, yearLevel, semester];
//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }
//     const results = await query(sql, params);
//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });
//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );
//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // PATTERN VALIDATION AND ENFORCEMENT
// // ============================================

// function validateAndEnforcePattern(assignments, schedulePattern, sectionCount) {
//   console.log(`🔍 Validating schedule pattern: ${schedulePattern}`);

//   const allowedDays = schedulePattern === 'MWF' ? DAYS_MWF :
//                      schedulePattern === 'TTH' ? DAYS_TTHS : DAYS_ALL;

//   let invalidCount = 0;
//   let fixedAssignments = [];

//   const subjectSectionMap = {};

//   assignments.forEach(a => {
//     const key = `${a.subject_id}-${a.section_index}`;
//     if (!subjectSectionMap[key]) {
//       subjectSectionMap[key] = [];
//     }
//     subjectSectionMap[key].push(a);
//   });

//   for (const [key, group] of Object.entries(subjectSectionMap)) {
//     const invalidDays = group.filter(a => !allowedDays.includes(a.day));

//     if (invalidDays.length > 0) {
//       invalidCount += invalidDays.length;
//       console.warn(`⚠️ Found ${invalidDays.length} assignments violating ${schedulePattern} pattern for ${key}`);

//       group.forEach(assignment => {
//         if (!allowedDays.includes(assignment.day)) {
//           const validDay = allowedDays[Math.floor(Math.random() * allowedDays.length)];
//           console.log(` 🔧 Fixing: ${assignment.day} → ${validDay}`);
//           assignment.day = validDay;
//         }
//       });
//     }

//     const uniqueDays = [...new Set(group.map(a => a.day))];
//     const allMWF = uniqueDays.every(d => DAYS_MWF.includes(d));
//     const allTTH = uniqueDays.every(d => DAYS_TTHS.includes(d));

//     if (schedulePattern === 'BOTH' && uniqueDays.length > 0 && !allMWF && !allTTH) {
//       const useMWF = uniqueDays.some(d => DAYS_MWF.includes(d));
//       const targetDays = useMWF ? DAYS_MWF : DAYS_TTHS;

//       group.forEach(assignment => {
//         if (!targetDays.includes(assignment.day)) {
//           const validDay = targetDays[Math.floor(Math.random() * targetDays.length)];
//           console.log(` 🔧 Enforcing pattern consistency: ${assignment.day} → ${validDay}`);
//           assignment.day = validDay;
//           invalidCount++;
//         }
//       });
//     }

//     fixedAssignments.push(...group);
//   }

//   if (invalidCount > 0) {
//     console.log(`✅ Fixed ${invalidCount} pattern violations`);
//   } else {
//     console.log(`✅ All assignments follow ${schedulePattern} pattern correctly`);
//   }

//   return fixedAssignments;
// }

// // ============================================
// // GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');
//   if (retryCount > 0) {
//     console.log(` Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
//   let patternRules = '';

//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet 3 times per week (Monday, Wednesday, Friday) - typically 1 hour per session';
//     patternRules = `
// **CRITICAL MWF PATTERN RULES (ABSOLUTE REQUIREMENT):**
// - YOU MUST USE ONLY: Monday, Wednesday, Friday
// - FORBIDDEN DAYS: Tuesday, Thursday, Saturday, Sunday
// - If you include ANY class on Tuesday, Thursday, or Saturday, the schedule is INVALID
// - Every single assignment MUST have day = "Monday" OR "Wednesday" OR "Friday"
// - For 3-unit courses: Schedule on 3 different days (Mon + Wed + Fri)
// - Double-check every assignment before returning - NO exceptions to this rule`;
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet 2-3 times per week (Tuesday, Thursday, Saturday) - typically 1.5 hours per session';
//     patternRules = `
// **CRITICAL TTH PATTERN RULES (ABSOLUTE REQUIREMENT):**
// - YOU MUST USE ONLY: Tuesday, Thursday, Saturday
// - FORBIDDEN DAYS: Monday, Wednesday, Friday, Sunday
// - If you include ANY class on Monday, Wednesday, or Friday, the schedule is INVALID
// - Every single assignment MUST have day = "Tuesday" OR "Thursday" OR "Saturday"
// - For 3-unit courses: Use 2-3 sessions across these days with appropriate durations
// - Double-check every assignment before returning - NO exceptions to this rule`;
//   } else {
//     patternDescription = 'BOTH Pattern: Can use any day, but MUST group each subject into EITHER MWF OR TTH pattern';
//     patternRules = `
// **CRITICAL BOTH PATTERN RULES (ABSOLUTE REQUIREMENT):**
// - Each subject MUST follow EITHER MWF pattern OR TTH pattern - NEVER mix them
// - If you schedule Math on Monday, ALL Math sessions must be on Mon/Wed/Fri ONLY
// - If you schedule English on Tuesday, ALL English sessions must be on Tue/Thu/Sat ONLY
// - FORBIDDEN: Math on Monday + Math on Tuesday (this mixes patterns)
// - Choose pattern per subject, then stick to it consistently
// - Double-check each subject - all sessions must use the same pattern`;
//   }

//   const facultyPatternNote = `
// ADDITIONAL REAL-WORLD FACULTY LOADING PATTERN (MUST FOLLOW):
// - The institution has a stable core faculty: most instructors teach in BOTH semesters (continuity is prioritized).
// - Only a minority are semester-specific (part-time or temporary).
// - Therefore, when scheduling, PRIORITIZE REUSING THE SAME INSTRUCTORS across multiple subjects/sections if possible.
// - Avoid introducing "new" instructors unnecessarily — stick strictly to the provided teacher list.
// - Core instructors should have balanced but consistent loads across sections.
// - This creates realistic, sustainable yearly schedules with minimal turnover.`;

//   let instructorBusySlotsText = '';
//   if (payload.existingInstructorSchedules && Object.keys(payload.existingInstructorSchedules).length > 0) {
//     instructorBusySlotsText = '\n\n**CRITICAL: EXISTING INSTRUCTOR SCHEDULES ACROSS ALL COURSES (MUST NOT CONFLICT):**';
//     instructorBusySlotsText += '\nThese instructors are ALREADY teaching at these times in OTHER courses. DO NOT schedule them during these occupied slots:';

//     for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
//       const teacher = payload.teachers.find(t => t.id === parseInt(instructorId));
//       if (teacher) {
//         instructorBusySlotsText += `\n\n- **${data.instructor_name}** (ID: ${instructorId}) - OCCUPIED SLOTS:`;

//         const slotsByDay = {};
//         data.occupied_slots.forEach(slot => {
//           if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
//           slotsByDay[slot.day].push(slot);
//         });

//         for (const [day, slots] of Object.entries(slotsByDay)) {
//           instructorBusySlotsText += `\n ${day}: `;
//           const uniqueSlots = [...new Map(slots.map(s => [s.slot_index, s])).values()];
//           instructorBusySlotsText += uniqueSlots
//             .sort((a, b) => a.slot_index - b.slot_index)
//             .map(s => `slot ${s.slot_index} (${s.time}, ${s.course_code} - ${s.subject_code})`)
//             .join(', ');
//         }
//       }
//     }

//     instructorBusySlotsText += '\n\n**IMPORTANT**: Before assigning any instructor to a time slot, CHECK if they are already occupied in another course!';
//   }

//   const systemPrompt = `You are an expert university course scheduler. Your task is to create a conflict-free class schedule for MULTIPLE SECTIONS.
// ${patternRules}
// CRITICAL CONSTRAINTS YOU MUST FOLLOW:
// 1. **SCHEDULE PATTERN IS MANDATORY**: Follow the pattern rules above with ZERO violations
// 2. **CROSS-COURSE INSTRUCTOR CONFLICTS ARE ABSOLUTELY FORBIDDEN**: An instructor CANNOT teach in multiple courses at the same time
// 3. **WITHIN-COURSE INSTRUCTOR CONFLICTS ARE FORBIDDEN**: No instructor can teach multiple sections at the same time
// 4. No room can be used by multiple classes at the same time (same day, same slot_index) - even across different sections
// 5. No section can have multiple classes at the same time (same day, same slot_index)
// 6. Each subject must be scheduled exactly 'units' times per section
// 7. Use ONLY the specific teacher assigned to each subject (do not switch teachers)
// 8. Each section uses ONE dedicated room for ALL its subjects
// 9. Consider class duration (some classes may be 1.5-3 hours long)
// 10. Respect instructor availability windows if provided
// 11. Balance instructor workload across all teachers — but prioritize continuity and reuse
// 12. IMPORTANT: Generate schedules for ALL sections (section_index 0 to ${payload.sectionCount - 1})
// ${facultyPatternNote}
// ${instructorBusySlotsText}
// SECTION HANDLING:
// - You must create schedules for ${payload.sectionCount} section(s)
// - Section indices are 0-based: 0 = Section A, 1 = Section B, etc.
// - Each section needs the SAME subjects but at DIFFERENT time slots
// ROOM ASSIGNMENT PER SECTION (CRITICAL):
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (${String.fromCharCode(65 + parseInt(secIdx))}) MUST use Room ID ${room.room_id} (${room.room_name}) for ALL subjects`;
// }).join('\n') : ''}
// SCHEDULE PATTERN RULES:
// ${patternDescription}
// OPTIMIZATION GOALS (VERY IMPORTANT):
// - Distribute classes EVENLY across the FULL DAY: from 7:00 AM to 7:00 PM
// - Actively use BOTH morning and afternoon slots
// - Avoid overloading morning hours
// Return your schedule as a JSON array called "assignments". Each assignment must have exactly these fields:
// {
//   "subject_id": number,
//   "section_index": number,
//   "teacher_name": string,
//   "room_id": number,
//   "day": string,
//   "slot_index": number
// }
// FINAL VALIDATION BEFORE RETURNING:
// 1. Check EVERY "day" is allowed
// 2. Verify consistent pattern per subject
// 3. Verify NO cross-course instructor conflicts
// REMEMBER: All subjects in a section use the SAME room_id.`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\nINSTRUCTOR AVAILABILITY (MUST RESPECT):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a =>
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Create a complete schedule for ${payload.sectionCount} section(s) with these requirements:
// SUBJECTS WITH ASSIGNED TEACHERS:
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, Units: ${s.units}, Duration: ${s.duration}h per session) → Teacher: "${s.teacher_name}"`).join('\n')}
// **CLASS DURATION RULES**:
// - 1h → 1 slot
// - 1.5h / 2h / 3h → consecutive slots (report only starting slot_index)
// ROOM ASSIGNMENTS BY SECTION:
// ${payload.sectionRoomMap ? Object.keys(payload.sectionRoomMap).map(secIdx => {
//   const room = payload.sectionRoomMap[secIdx];
//   return `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): Room ID ${room.room_id} - ${room.room_name}`;
// }).join('\n') : ''}
// ${availabilityText}
// SCHEDULE PATTERN: ${payload.schedulePattern}
// ALLOWED DAYS: ${allowedDays.join(', ')}
// Generate the complete schedule now. Return ONLY a valid JSON object with an "assignments" array. No explanations.`;

//   try {
//     const startTime = Date.now();
//     const apiCallPromise = openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.3,
//       max_tokens: 4000
//     });
//     const timeoutPromise = new Promise((_, reject) => {
//       setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60000);
//     });
//     const completion = await Promise.race([apiCallPromise, timeoutPromise]);
//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️ GPT responded in ${elapsedTime}s`);

//     const responseText = completion.choices[0].message.content;
//     let parsed = JSON.parse(responseText);
//     let assignments = parsed.assignments || parsed.schedule || parsed || [];

//     assignments = validateAndEnforcePattern(assignments, payload.schedulePattern, payload.sectionCount);

//     return assignments;
//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);
//     const isTimeout = error.message.includes('timed out');
//     if (isTimeout && retryCount < maxRetries) {
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }
//     throw error;
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();
//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major,
//       forceGenerate = false
//     } = req.body;

//     console.log('📥 Generate request received (GPT Mode)');
//     console.log(' Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log(' Pattern:', schedulePattern);
//     console.log(' Sections:', sectionCount);
//     console.log(' Force Generate:', forceGenerate);

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({ error: 'Missing required parameters' });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({ error: 'Invalid section count' });
//     }

//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);
//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({ error: 'No teacher assignments found' });
//     }

//     const existingInstructorSchedules = await fetchExistingInstructorSchedules();

//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);
//     if (roomAssignments.length === 0) {
//       return res.status(400).json({ error: 'No room assignments found' });
//     }

//     const subjRows = await query('SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)', [subjectsPayload]);
//     if (subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) throw new Error(`No teacher for ${s.subject_code}`);
//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: Number(assignment.duration) || 1,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });
//     const teachersForScheduler = Object.values(uniqueTeachers);

//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({ error: 'Not enough rooms' });
//     }

//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester,
//       studentsCount,
//       sectionCount,
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap,
//       schedulePattern,
//       considerInstructorAvailability,
//       existingInstructorSchedules
//     };

//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({ error: 'No assignments generated' });
//     }

//     // Map teacher names → IDs, fix rooms, add duration
//     assignments = assignments.map(a => {
//       let teacher = teachersForScheduler.find(t => t.name.trim() === (a.teacher_name || '').trim()) ||
//                    teachersForScheduler.find(t => t.name.trim().toLowerCase() === (a.teacher_name || '').trim().toLowerCase());

//       if (!teacher && a.subject_id) {
//         const subjAssign = teacherAssignments[a.subject_id];
//         if (subjAssign?.teacher_id) {
//           teacher = teachersForScheduler.find(t => t.id === subjAssign.teacher_id);
//         }
//       }

//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         a.room_id = correctRoom.room_id;
//       }

//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? subject.duration : 1;

//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name,
//         duration
//       };
//     });

//     // Conflict detection (instructor & room, including cross-course)
//     const instructorScheduleMap = {};
//     const roomScheduleMap = {};
//     const conflicts = [];

//     if (existingInstructorSchedules) {
//       for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//         data.occupied_slots.forEach(slot => {
//           const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
//           instructorScheduleMap[key] = { isExisting: true, ...slot };
//         });
//       }
//     }

//     assignments.forEach((a, idx) => {
//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? subject.duration : 1;
//       const slotsNeeded = Math.ceil(duration);

//       for (let i = 0; i < slotsNeeded; i++) {
//         const slot = a.slot_index + i;
//         if (slot >= 12) continue;

//         const instrKey = `${a.teacher_id}-${a.day}-${slot}`;
//         if (instructorScheduleMap[instrKey]) {
//           conflicts.push({ type: instructorScheduleMap[instrKey].isExisting ? 'instructor_cross_course' : 'instructor', index: idx });
//         } else {
//           instructorScheduleMap[instrKey] = a;
//         }

//         const roomKey = `${a.room_id}-${a.day}-${slot}`;
//         if (roomScheduleMap[roomKey]) {
//           conflicts.push({ type: 'room', index: idx });
//         } else {
//           roomScheduleMap[roomKey] = a;
//         }
//       }
//     });

//     // If conflicts and not forcing, return preview
//     if (conflicts.length > 0 && !forceGenerate) {
//       return res.status(409).json({
//         hasConflicts: true,
//         conflictCount: conflicts.length,
//         assignments,
//         message: `Generated schedule has ${conflicts.length} conflict(s). Review and confirm to save anyway.`
//       });
//     }

//     // Save to database
//     await query('START TRANSACTION');
//     try {
//       const sectionIds = [];
//       for (let i = 0; i < sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [courseId, yearLevel, semester, sectionName, studentsCount]
//         );
//         sectionIds.push(result.insertId);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? subject.duration : 1;

//         const startHour = parseInt(timeSlot.start.split(':')[0]);
//         const endHour = startHour + duration;
//         const endTime = `${String(endHour).padStart(2, '0')}:00:00`;

//         await query(
//           `INSERT INTO schedule
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time, duration)
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             courseId, yearLevel, semester, sectionId, a.subject_id, a.teacher_id,
//             a.room_id, a.day, a.slot_index, a.section_index,
//             timeSlot.start, endTime, duration
//           ]
//         );
//         savedCount++;
//       }

//       await query('COMMIT');

//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
//       res.json({
//         success: true,
//         message: `Schedule generated and saved successfully for ${sectionCount} section(s)`,
//         sections: sectionIds,
//         assignments,
//         stats: {
//           totalAssignments: savedCount,
//           generationTimeSeconds: parseFloat(totalTime),
//           conflictsDetected: conflicts.length,
//           forcedGeneration: forceGenerate
//         }
//       });
//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }
//   } catch (err) {
//     console.error('❌ Error generating schedule:', err);
//     try { await query('ROLLBACK'); } catch {}
//     res.status(500).json({ error: 'Server error', detail: err.message });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;
//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }
//   try {
//     let sql = `
//       SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name
//       FROM schedule s
//       LEFT JOIN rooms r ON s.room_id = r.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       WHERE s.day = ? AND s.slot_index = ?
//     `;
//     let params = [day, Number(slot_index)];
//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }
//     const results = await query(sql, params);
//     const usedRoomIds = results.map(r => r.room_id).filter(Boolean);
//     const usedInstructorIds = results.map(r => r.instructor_id).filter(Boolean);
//     res.json({
//       usedRoomIds,
//       usedInstructorIds,
//       count: results.length
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;
//     let sql = `
//       SELECT
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         s.year_level, s.semester,
//         s.section_id, sec.name AS section_name,
//         s.subject_id, subj.subject_code, subj.description AS subject_name,
//         s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name,
//         s.day, s.slot_index, s.start_time, s.end_time, s.duration
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;
//     const conditions = [];
//     const params = [];
//     if (courseId) { conditions.push('s.course_id = ?'); params.push(courseId); }
//     if (yearLevel) { conditions.push('s.year_level = ?'); params.push(yearLevel); }
//     if (semester) { conditions.push('s.semester = ?'); params.push(semester); }
//     if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id,
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;
//     const results = await query(sql, params);
//     res.json(results);
//   } catch (err) {
//     console.error("Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;
//   try {
//     await query("DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?", [courseId, yearLevel, semester]);
//     const result = await query("DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?", [courseId, yearLevel, semester]);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Database error" });
//   }
// });

// module.exports = router;

//WORKING BUT NOT STRICK IN MWF AND TTHS
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');
// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error(' Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');

//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error(' Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error(' Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );

//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });

//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchExistingInstructorSchedules() {
//   try {
//     const results = await query(
//       `SELECT 
//         s.instructor_id,
//         i.name as instructor_name,
//         s.day,
//         s.slot_index,
//         s.start_time,
//         s.end_time,
//         s.duration,
//         s.course_id,
//         c.name as course_name,
//         c.code as course_code,
//         s.year_level,
//         s.semester,
//         subj.subject_code,
//         subj.description as subject_name
//        FROM schedule s
//        LEFT JOIN instructors i ON s.instructor_id = i.id
//        LEFT JOIN courses c ON s.course_id = c.id
//        LEFT JOIN subjects subj ON s.subject_id = subj.id
//        WHERE s.instructor_id IS NOT NULL`
//     );

//     const scheduleMap = {};
//     results.forEach(row => {
//       const instructorId = row.instructor_id;
//       if (!scheduleMap[instructorId]) {
//         scheduleMap[instructorId] = {
//           instructor_name: row.instructor_name,
//           occupied_slots: []
//         };
//       }

//       const duration = row.duration || 1;
//       const slotsNeeded = Math.ceil(duration);

//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = row.slot_index + i;
//         scheduleMap[instructorId].occupied_slots.push({
//           day: row.day,
//           slot_index: slotIndex,
//           course_code: row.course_code,
//           course_name: row.course_name,
//           year_level: row.year_level,
//           semester: row.semester,
//           subject_code: row.subject_code,
//           subject_name: row.subject_name,
//           time: `${row.start_time.substring(0, 5)}-${row.end_time.substring(0, 5)}`
//         });
//       }
//     });

//     return scheduleMap;
//   } catch (err) {
//     console.error('Error fetching existing instructor schedules:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;
//     const params = [courseId, yearLevel, semester];
//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }
//     const results = await query(sql, params);

//     const assignmentMap = {};
//     results.forEach(row => {
//       assignmentMap[row.subject_id] = {
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       };
//     });

//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );

//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // ENHANCED PATTERN VALIDATION AND ENFORCEMENT
// // ============================================

// function strictPatternValidation(assignments, schedulePattern, allowedDays) {
//   console.log(`🔒 STRICT pattern validation: ${schedulePattern}`);
  
//   let violations = 0;
//   let fixed = 0;

//   // First pass: Fix individual day violations
//   assignments.forEach(assignment => {
//     if (!allowedDays.includes(assignment.day)) {
//       violations++;
//       console.warn(`⚠️ VIOLATION: ${assignment.day} not in allowed days [${allowedDays.join(', ')}]`);
      
//       const validDay = allowedDays[Math.floor(Math.random() * allowedDays.length)];
//       console.log(`   🔧 Fixed: ${assignment.day} → ${validDay}`);
//       assignment.day = validDay;
//       fixed++;
//     }
//   });

//   // Second pass: Ensure each subject follows ONE pattern consistently
//   if (schedulePattern === 'BOTH') {
//     const subjectPatterns = {};
//     assignments.forEach(a => {
//       if (!subjectPatterns[a.subject_id]) {
//         subjectPatterns[a.subject_id] = new Set();
//       }
//       subjectPatterns[a.subject_id].add(a.day);
//     });

//     for (const [subjectId, daysSet] of Object.entries(subjectPatterns)) {
//       const daysArray = Array.from(daysSet);
//       const hasMWF = daysArray.some(d => DAYS_MWF.includes(d));
//       const hasTTH = daysArray.some(d => DAYS_TTHS.includes(d));
      
//       if (hasMWF && hasTTH) {
//         violations++;
//         console.warn(`⚠️ Subject ${subjectId} mixes MWF and TTH patterns!`);
        
//         // Choose dominant pattern
//         const mwfCount = daysArray.filter(d => DAYS_MWF.includes(d)).length;
//         const tthCount = daysArray.filter(d => DAYS_TTHS.includes(d)).length;
//         const targetDays = mwfCount >= tthCount ? DAYS_MWF : DAYS_TTHS;
        
//         console.log(`   🔧 Enforcing ${targetDays === DAYS_MWF ? 'MWF' : 'TTH'} pattern for subject ${subjectId}`);
        
//         assignments.forEach(a => {
//           if (a.subject_id === parseInt(subjectId) && !targetDays.includes(a.day)) {
//             const newDay = targetDays[Math.floor(Math.random() * targetDays.length)];
//             console.log(`      ${a.day} → ${newDay}`);
//             a.day = newDay;
//             fixed++;
//           }
//         });
//       }
//     }
//   }

//   console.log(`✅ Pattern validation: ${violations} violations found, ${fixed} fixed`);
//   return assignments;
// }

// // ============================================
// // COMPREHENSIVE CONFLICT DETECTION & RESOLUTION
// // ============================================

// function validateAndFixConflicts(assignments, payload) {
//   console.log('🔍 Starting comprehensive conflict detection...');
  
//   const instructorMap = new Map();
//   const roomMap = new Map();
//   const sectionMap = new Map();
  
//   // Pre-populate with existing schedules from other courses
//   if (payload.existingInstructorSchedules) {
//     let preloadedCount = 0;
//     for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
//       data.occupied_slots.forEach(slot => {
//         const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
//         instructorMap.set(key, { 
//           existing: true, 
//           course: slot.course_code,
//           subject: slot.subject_code,
//           instructor: data.instructor_name
//         });
//         preloadedCount++;
//       });
//     }
//     console.log(`📌 Pre-loaded ${preloadedCount} occupied slots from existing courses`);
//   }

//   const conflicts = [];
  
//   // First pass: Detect all conflicts
//   assignments.forEach((assignment, index) => {
//     const subject = payload.subjects.find(s => s.id === assignment.subject_id);
//     const duration = subject ? Math.ceil(subject.duration) : 1;
    
//     for (let i = 0; i < duration; i++) {
//       const slotIndex = assignment.slot_index + i;
//       if (slotIndex >= 12) continue;
      
//       // Check instructor conflicts (both cross-course and within-course)
//       const instrKey = `${assignment.teacher_id}-${assignment.day}-${slotIndex}`;
//       const existingInstr = instructorMap.get(instrKey);
      
//       if (existingInstr) {
//         conflicts.push({
//           type: existingInstr.existing ? 'cross-course' : 'instructor',
//           assignment,
//           slotIndex,
//           existing: existingInstr,
//           index,
//           duration
//         });
//       } else {
//         instructorMap.set(instrKey, { 
//           assignment, 
//           slotIndex, 
//           existing: false 
//         });
//       }
      
//       // Check room conflicts
//       const roomKey = `${assignment.room_id}-${assignment.day}-${slotIndex}`;
//       const existingRoom = roomMap.get(roomKey);
      
//       if (existingRoom) {
//         conflicts.push({
//           type: 'room',
//           assignment,
//           slotIndex,
//           existing: existingRoom,
//           index,
//           duration
//         });
//       } else {
//         roomMap.set(roomKey, { assignment, slotIndex });
//       }
      
//       // Check section conflicts
//       const sectionKey = `${assignment.section_index}-${assignment.day}-${slotIndex}`;
//       const existingSection = sectionMap.get(sectionKey);
      
//       if (existingSection) {
//         conflicts.push({
//           type: 'section',
//           assignment,
//           slotIndex,
//           existing: existingSection,
//           index,
//           duration
//         });
//       } else {
//         sectionMap.set(sectionKey, { assignment, slotIndex });
//       }
//     }
//   });

//   // Second pass: Resolve conflicts
//   if (conflicts.length > 0) {
//     console.warn(`⚠️ Found ${conflicts.length} conflicts. Attempting resolution...`);
    
//     // Group conflicts by assignment to avoid fixing same assignment multiple times
//     const conflictsByAssignment = new Map();
//     conflicts.forEach(conflict => {
//       const key = `${conflict.assignment.subject_id}-${conflict.assignment.section_index}`;
//       if (!conflictsByAssignment.has(key)) {
//         conflictsByAssignment.set(key, []);
//       }
//       conflictsByAssignment.get(key).push(conflict);
//     });
    
//     let resolved = 0;
//     let unresolved = 0;
    
//     conflictsByAssignment.forEach((conflictGroup, key) => {
//       const conflict = conflictGroup[0]; // Use first conflict for the assignment
//       const assignment = conflict.assignment;
//       const subject = payload.subjects.find(s => s.id === assignment.subject_id);
      
//       console.log(`   🔧 Resolving ${conflict.type} conflict for ${subject?.code || assignment.subject_id}...`);
      
//       if (conflict.type === 'cross-course') {
//         console.log(`      Instructor ${conflict.existing.instructor} already teaching ${conflict.existing.course} - ${conflict.existing.subject}`);
//       }
      
//       const newSlot = findAlternativeSlot(
//         assignment,
//         payload,
//         instructorMap,
//         roomMap,
//         sectionMap
//       );
      
//       if (newSlot) {
//         // Clear old entries
//         const duration = subject ? Math.ceil(subject.duration) : 1;
//         for (let i = 0; i < duration; i++) {
//           const oldSlotIndex = assignment.slot_index + i;
//           instructorMap.delete(`${assignment.teacher_id}-${assignment.day}-${oldSlotIndex}`);
//           roomMap.delete(`${assignment.room_id}-${assignment.day}-${oldSlotIndex}`);
//           sectionMap.delete(`${assignment.section_index}-${assignment.day}-${oldSlotIndex}`);
//         }
        
//         // Update assignment
//         assignment.day = newSlot.day;
//         assignment.slot_index = newSlot.slot_index;
        
//         // Set new entries
//         for (let i = 0; i < duration; i++) {
//           const newSlotIndex = newSlot.slot_index + i;
//           instructorMap.set(`${assignment.teacher_id}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex, 
//             existing: false 
//           });
//           roomMap.set(`${assignment.room_id}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex 
//           });
//           sectionMap.set(`${assignment.section_index}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex 
//           });
//         }
        
//         console.log(`      ✅ Resolved: ${assignment.day} slot ${assignment.slot_index} → ${newSlot.day} slot ${newSlot.slot_index}`);
//         resolved++;
//       } else {
//         console.error(`      ❌ Could not resolve conflict - no alternative slots available`);
//         unresolved++;
//       }
//     });
    
//     console.log(`✅ Conflict resolution complete: ${resolved} resolved, ${unresolved} unresolved`);
//   } else {
//     console.log('✅ No conflicts detected!');
//   }

//   return assignments;
// }

// function findAlternativeSlot(assignment, payload, instructorMap, roomMap, sectionMap) {
//   const subject = payload.subjects.find(s => s.id === assignment.subject_id);
//   const duration = subject ? Math.ceil(subject.duration) : 1;
  
//   // Determine allowed days based on schedule pattern
//   let allowedDays;
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//   } else {
//     // For BOTH pattern, maintain the subject's current pattern
//     const currentDay = assignment.day;
//     if (DAYS_MWF.includes(currentDay)) {
//       allowedDays = DAYS_MWF;
//     } else if (DAYS_TTHS.includes(currentDay)) {
//       allowedDays = DAYS_TTHS;
//     } else {
//       allowedDays = DAYS_ALL;
//     }
//   }
  
//   // Try to find alternative slot
//   for (const day of allowedDays) {
//     for (let slot = 0; slot <= 12 - duration; slot++) {
//       let canUseSlot = true;
      
//       // Check all required consecutive slots
//       for (let i = 0; i < duration; i++) {
//         const slotIndex = slot + i;
//         const instrKey = `${assignment.teacher_id}-${day}-${slotIndex}`;
//         const roomKey = `${assignment.room_id}-${day}-${slotIndex}`;
//         const sectionKey = `${assignment.section_index}-${day}-${slotIndex}`;
        
//         // Check if any slot is occupied
//         if (instructorMap.has(instrKey) || roomMap.has(roomKey) || sectionMap.has(sectionKey)) {
//           canUseSlot = false;
//           break;
//         }
//       }
      
//       if (canUseSlot) {
//         return { day, slot_index: slot };
//       }
//     }
//   }
  
//   return null;
// }

// // ============================================
// // ENHANCED GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');

//   if (retryCount > 0) {
//     console.log(` Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Request details:');
//   console.log(' Subjects:', payload.subjects.length);
//   console.log(' Teachers:', payload.teachers.length);
//   console.log(' Rooms:', payload.rooms.length);
//   console.log(' Sections:', payload.sectionCount);
//   console.log(' Pattern:', payload.schedulePattern);

//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
//   let patternRules = '';

//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet on Monday, Wednesday, Friday only';
//     patternRules = `
// **ABSOLUTE MWF PATTERN ENFORCEMENT (CRITICAL):**
// - YOU MUST USE ONLY: Monday, Wednesday, Friday
// - STRICTLY FORBIDDEN: Tuesday, Thursday, Saturday, Sunday
// - EVERY single assignment MUST have day = "Monday" OR "Wednesday" OR "Friday"
// - If you include ANY class on Tuesday, Thursday, or Saturday, the ENTIRE schedule is INVALID
// - For 3-unit courses: Schedule 3 sessions (one on Mon, one on Wed, one on Fri), typically 1 hour each
// - Double-check EVERY assignment before returning - NO EXCEPTIONS
// - Violation of this rule means complete schedule rejection`;
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet on Tuesday, Thursday, Saturday only';
//     patternRules = `
// **ABSOLUTE TTH PATTERN ENFORCEMENT (CRITICAL):**
// - YOU MUST USE ONLY: Tuesday, Thursday, Saturday
// - STRICTLY FORBIDDEN: Monday, Wednesday, Friday, Sunday
// - EVERY single assignment MUST have day = "Tuesday" OR "Thursday" OR "Saturday"
// - If you include ANY class on Monday, Wednesday, or Friday, the ENTIRE schedule is INVALID
// - For 3-unit courses: Schedule 2-3 sessions across these days with appropriate durations
// - Double-check EVERY assignment before returning - NO EXCEPTIONS
// - Violation of this rule means complete schedule rejection`;
//   } else {
//     patternDescription = 'BOTH Pattern: Each subject uses EITHER MWF OR TTH - NEVER mixed';
//     patternRules = `
// **STRICT BOTH PATTERN ENFORCEMENT (CRITICAL):**
// - Each subject MUST follow EITHER MWF OR TTH pattern exclusively
// - ASSIGNMENT RULE: 
//   * Major subjects (3+ units): Use MWF pattern (Monday, Wednesday, Friday)
//   * Minor subjects (less than 3 units): Use TTH pattern (Tuesday, Thursday, Saturday)
//   * Laboratory subjects: Prefer TTH for longer continuous blocks
// - Once a pattern is assigned to a subject, ALL sessions of that subject MUST use the same pattern
// - FORBIDDEN EXAMPLE: Math on Monday + Math on Tuesday (this mixes patterns - INVALID)
// - CORRECT EXAMPLE: Math on Monday + Math on Wednesday + Math on Friday (consistent MWF)
// - Track each subject's pattern and verify 100% consistency before returning`;
//   }

//   // Build detailed instructor conflict information
//   let instructorBusySlotsText = '';
//   if (payload.existingInstructorSchedules && Object.keys(payload.existingInstructorSchedules).length > 0) {
//     instructorBusySlotsText = '\n\n**CRITICAL: INSTRUCTORS ALREADY TEACHING IN OTHER COURSES (ABSOLUTE CONFLICTS):**';
//     instructorBusySlotsText += '\nThese time slots are COMPLETELY BLOCKED - instructors are teaching other courses:';
    
//     for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
//       const teacher = payload.teachers.find(t => t.id === parseInt(instructorId));
//       if (teacher) {
//         instructorBusySlotsText += `\n\n**${data.instructor_name}** (ID: ${instructorId}) - UNAVAILABLE AT:`;
        
//         const slotsByDay = {};
//         data.occupied_slots.forEach(slot => {
//           if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
//           slotsByDay[slot.day].push(slot);
//         });
        
//         for (const [day, slots] of Object.entries(slotsByDay)) {
//           instructorBusySlotsText += `\n  ${day}: `;
//           const uniqueSlots = [...new Map(slots.map(s => [s.slot_index, s])).values()];
//           instructorBusySlotsText += uniqueSlots
//             .sort((a, b) => a.slot_index - b.slot_index)
//             .map(s => `Slot ${s.slot_index} (${s.time}) teaching ${s.course_code}-${s.subject_code}`)
//             .join(', ');
//         }
//       }
//     }
    
//     instructorBusySlotsText += '\n\n**MANDATORY**: Before assigning ANY instructor, verify they are NOT in the above list for that day/time!';
//   } else {
//     instructorBusySlotsText = '\n\n**No existing instructor schedules found** - This appears to be the first course being scheduled.';
//   }

//   const systemPrompt = `You are an expert university scheduling AI with ZERO TOLERANCE for conflicts and pattern violations.

// ${patternRules}

// **CRITICAL CONSTRAINTS (ABSOLUTE REQUIREMENTS):**

// 1. **SCHEDULE PATTERN COMPLIANCE:**
//    - This is your #1 priority - NEVER violate the pattern rules above
//    - Validate EVERY assignment before including it in your response
//    - If in doubt about a day, DON'T USE IT

// 2. **INSTRUCTOR CONFLICT PREVENTION (TOP PRIORITY):**
//    - An instructor CANNOT teach multiple classes at the same time
//    - This applies ACROSS all courses (cross-course conflicts)
//    - This applies WITHIN this course (same instructor, different sections)
//    - CHECK THREE THINGS before every instructor assignment:
//      a) Is this instructor busy in another course at this time? (see existing schedules below)
//      b) Is this instructor already assigned to another section at this time?
//      c) Does this instructor have availability restrictions?

// 3. **CONFLICT CHECKING ALGORITHM YOU MUST FOLLOW:**
//    Before assigning instructor to day/slot:
   
//    Step 1: Calculate slots_needed = ceil(duration)
//    Step 2: For each slot from slot_index to (slot_index + slots_needed - 1):
//            - Check existing_schedules[instructor_id][day][slot]
//            - Check current_assignments[instructor_id][day][slot]
//            - If ANY slot is occupied → SKIP this time, try next slot
//    Step 3: If all slots free → ASSIGN and mark slots as occupied
//    Step 4: Update your mental schedule map
   
//    Example: 2-hour Math class starting at slot 0 needs to check slots 0 AND 1

// 4. **SECTION STAGGERING (MANDATORY):**
//    - If Section A has instructor X at Monday 7-8, Section B CANNOT have instructor X at Monday 7-8
//    - Stagger sections to different times to avoid instructor conflicts
//    - Track each instructor's schedule across all sections as you build the timetable

// 5. **ROOM RULES:**
//    - Each section is assigned ONE dedicated room
//    - ALL subjects in a section MUST use that section's room_id
//    - No room can be used by multiple sections at the same time

// 6. **AFTERNOON DISTRIBUTION (REQUIRED):**
//    - Slots 0-4 = Morning (7 AM - 12 PM)
//    - Slots 5-11 = Afternoon (12 PM - 7 PM)
//    - MANDATE: At least 40% of classes must be in afternoon slots
//    - DO NOT cram all classes in the morning
//    - This spreads workload and reduces conflicts

// 7. **DURATION HANDLING:**
//    - Each subject has a specific duration (e.g., 1h, 1.5h, 2h, 3h)
//    - Multi-hour classes occupy CONSECUTIVE time slots
//    - When reporting: Only include the STARTING slot_index
//    - System will automatically block consecutive slots based on duration

// ${instructorBusySlotsText}

// **VALIDATION CHECKLIST BEFORE RETURNING YOUR SCHEDULE:**
// □ Every "day" field is from allowed list: ${allowedDays.join(', ')}
// □ Each subject consistently uses ONE pattern (all MWF or all TTH)
// □ No instructor is scheduled during their occupied slots from other courses
// □ No instructor teaches multiple sections at the same time
// □ No room conflicts (multiple sections in same room at same time)
// □ At least 40% of assignments are in afternoon slots (5-11)
// □ All sections (0 to ${payload.sectionCount - 1}) have complete schedules
// □ Each subject appears exactly ${payload.sectionCount} times (once per section)

// Return schedule as JSON array "assignments" with these exact fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}),
//   "teacher_name": string (exact match from teacher list),
//   "room_id": number (section's assigned room_id),
//   "day": string (MUST be from: ${allowedDays.join(', ')}),
//   "slot_index": number (0-11, starting slot only)
// }`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\n**INSTRUCTOR AVAILABILITY WINDOWS (RESPECT THESE):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a =>
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Generate a complete, conflict-free schedule for ${payload.sectionCount} section(s).

// **SUBJECTS WITH ASSIGNED TEACHERS (USE THESE EXACT PAIRINGS):**
// ${payload.subjects.map(s => `- ${s.code} (ID: ${s.id}, ${s.units} units, ${s.duration}h per session) → Instructor: "${s.teacher_name}" (ID: ${s.teacher_id})`).join('\n')}

// **ROOM ASSIGNMENTS (ONE ROOM PER SECTION):**
// ${payload.sectionRoomMap ? Object.entries(payload.sectionRoomMap).map(([secIdx, room]) => 
//   `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): MUST use Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`
// ).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id})`).join('\n')}

// ${availabilityText}

// **SCHEDULE PATTERN:** ${payload.schedulePattern}
// **ALLOWED DAYS (ONLY USE THESE):** ${allowedDays.join(', ')}
// **FORBIDDEN DAYS (NEVER USE):** ${DAYS_ALL.filter(d => !allowedDays.includes(d)).join(', ')}

// **SECTIONS:** ${payload.sectionCount} total (section_index: 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B  
//   - Section 2 = Section C
//   - etc.

// **TIME SLOTS:** 0-11 representing:
//   - 0 = 7-8 AM, 1 = 8-9 AM, 2 = 9-10 AM, 3 = 10-11 AM, 4 = 11 AM-12 PM
//   - 5 = 12-1 PM, 6 = 1-2 PM, 7 = 2-3 PM, 8 = 3-4 PM, 9 = 4-5 PM, 10 = 5-6 PM, 11 = 6-7 PM

// **IMPORTANT REMINDERS:**
// ✓ Use ONLY the assigned teacher for each subject (exact name match)
// ✓ Each section gets ONE dedicated room for ALL its subjects
// ✓ Check instructor availability before EVERY assignment
// ✓ Stagger sections - don't duplicate instructor times
// ✓ Use afternoon slots (5-11) for at least 40% of classes
// ✓ For multi-hour classes, only report starting slot_index
// ✓ Generate schedules for ALL ${payload.sectionCount} section(s)
// ✓ Each subject appears exactly ${payload.sectionCount} times in output
// ✓ ABSOLUTE: Every day must be from allowed list: ${allowedDays.join(', ')}

// **FINAL CHECK:** Before returning, count how many assignments use forbidden days. If > 0, FIX THEM!

// Generate the complete schedule now. Return ONLY valid JSON with "assignments" array. No markdown, no explanations.`;

//   try {
//     const startTime = Date.now();

//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.2, // Lower temperature for more deterministic outputs
//       max_tokens: 4000
//     });

//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️ GPT responded in ${elapsedTime}s`);

//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received, parsing...');

//     let parsed = JSON.parse(responseText);

//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     console.log(`📊 GPT generated ${assignments.length} assignments`);

//     // Check section distribution
//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });
//     console.log('📊 Section distribution:', sectionCounts);

//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }
//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     // CRITICAL: Apply strict validation and conflict resolution
//     console.log('🔒 Applying strict validation...');
//     assignments = strictPatternValidation(assignments, payload.schedulePattern, allowedDays);
//     assignments = validateAndFixConflicts(assignments, payload);

//     return assignments;
//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);

//     const isTimeout = error.message.includes('timed out');

//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }

//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Check OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Schedule generation request (Enhanced GPT Mode)');
//     console.log(' Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log(' Pattern:', schedulePattern);
//     console.log(' Sections:', sectionCount);
//     console.log(' Major:', major || 'N/A');

//     // Validate inputs
//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects array are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     // Warn about BOTH pattern
//     if (schedulePattern === 'BOTH') {
//       console.warn('⚠️ BOTH pattern selected - will enforce strict MWF/TTH per subject');
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);

//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     console.log('🔍 Fetching existing instructor schedules...');
//     const existingInstructorSchedules = await fetchExistingInstructorSchedules();
    
//     if (Object.keys(existingInstructorSchedules).length > 0) {
//       console.log(`📊 Found ${Object.keys(existingInstructorSchedules).length} instructors with existing schedules`);
//       for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//         console.log(`   - ${data.instructor_name}: ${data.occupied_slots.length} occupied slots`);
//       }
//     } else {
//       console.log('📊 No existing schedules - first course to be scheduled');
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);

//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms in the Rooms page'
//       });
//     }

//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({
//         error: 'Not enough rooms',
//         detail: `Need ${sectionCount} rooms for ${sectionCount} section(s). Only ${roomAssignments.length} assigned.`
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!subjRows || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     const subjectsWithTeachers = subjRows.map(s => {
//       const assignment = teacherAssignments[s.id];
//       if (!assignment) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }

//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: Number(assignment.duration) || 1,
//         teacher_name: assignment.teacher_name,
//         teacher_id: assignment.teacher_id
//       };
//     });

//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       if (!uniqueTeachers[s.teacher_name]) {
//         const availData = instructorAvailData[s.teacher_name];
//         uniqueTeachers[s.teacher_name] = {
//           id: s.teacher_id,
//           name: s.teacher_name,
//           availability: availData ? availData.slots : []
//         };
//       }
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Scheduling details:`);
//     console.log(` - Subjects: ${subjectsWithTeachers.length}`);
//     console.log(` - Teachers: ${teachersForScheduler.length}`);
//     console.log(` - Rooms: ${roomAssignments.length}`);
//     console.log(` - Sections: ${sectionCount}`);

//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//       console.log(`📍 Section ${String.fromCharCode(65 + i)} → ${roomAssignments[i].room_name}`);
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount),
//       sectionCount: Number(sectionCount),
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap: sectionRoomMap,
//       schedulePattern: schedulePattern,
//       considerInstructorAvailability: considerInstructorAvailability,
//       existingInstructorSchedules: existingInstructorSchedules
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create valid assignments. Try adjusting constraints.'
//       });
//     }

//     console.log(`✅ Generated ${assignments.length} assignments`);

//     // Match teacher names to IDs and fix room assignments
//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();
//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);

//       if (!teacher) {
//         teacher = teachersForScheduler.find(t =>
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }

//       if (!teacher && a.subject_id) {
//         const subjectAssignment = teacherAssignments[a.subject_id];
//         if (subjectAssignment) {
//           teacher = teachersForScheduler.find(t => t.id === subjectAssignment.teacher_id);
//         }
//       }

//       // Fix room assignment
//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         console.log(`🔧 Fixed room for Section ${a.section_index}: ${correctRoom.room_name}`);
//         a.room_id = correctRoom.room_id;
//       }

//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? Number(subject.duration) : 1;

//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name,
//         duration: duration
//       };
//     });

//     // Final validation check
//     const invalidAssignments = assignments.filter(a => !a.teacher_id);
//     if (invalidAssignments.length > 0) {
//       console.warn(`⚠️ ${invalidAssignments.length} assignments missing teacher_id`);
//       invalidAssignments.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Teacher: "${a.teacher_name}"`);
//       });
//     }

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];

//         if (!timeSlot || !sectionId || !a.teacher_id) {
//           console.error(`❌ Skipping invalid assignment: slot=${a.slot_index}, section=${a.section_index}, teacher=${a.teacher_id}`);
//           continue;
//         }

//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? Number(subject.duration) : 1;

//         const startTime = timeSlot.start;
//         const startHour = parseInt(startTime.split(':')[0]);
//         const endHour = startHour + duration;
//         const endTime = `${String(endHour).padStart(2, '0')}:00:00`;

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time, duration) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             startTime,
//             endTime,
//             duration
//           ]
//         );

//         savedCount++;
//       }

//       await query('COMMIT');

//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

//       // Final conflict check
//       const finalConflicts = {
//         instructor: [],
//         room: [],
//         crossCourse: []
//       };

//       const instructorCheck = new Map();
//       const roomCheck = new Map();

//       // Pre-load existing schedules
//       if (existingInstructorSchedules) {
//         for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//           data.occupied_slots.forEach(slot => {
//             const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
//             instructorCheck.set(key, { existing: true, data: slot });
//           });
//         }
//       }

//       // Check saved assignments
//       for (const a of assignments) {
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? Math.ceil(subject.duration) : 1;

//         for (let i = 0; i < duration; i++) {
//           const slotIndex = a.slot_index + i;
//           if (slotIndex >= 12) continue;

//           const instrKey = `${a.teacher_id}-${a.day}-${slotIndex}`;
//           const existing = instructorCheck.get(instrKey);

//           if (existing) {
//             if (existing.existing) {
//               finalConflicts.crossCourse.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex,
//                 course: existing.data.course_code,
//                 subject: existing.data.subject_code
//               });
//             } else {
//               finalConflicts.instructor.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex
//               });
//             }
//           } else {
//             instructorCheck.set(instrKey, { existing: false, assignment: a });
//           }

//           const roomKey = `${a.room_id}-${a.day}-${slotIndex}`;
//           if (roomCheck.has(roomKey)) {
//             finalConflicts.room.push({
//               room: a.room_id,
//               day: a.day,
//               slot: slotIndex
//             });
//           } else {
//             roomCheck.set(roomKey, true);
//           }
//         }
//       }

//       const totalConflicts = finalConflicts.instructor.length + 
//                             finalConflicts.room.length + 
//                             finalConflicts.crossCourse.length;

//       if (totalConflicts > 0) {
//         console.warn(`⚠️ Final check found ${totalConflicts} conflicts:`);
//         console.warn(`   - Cross-course: ${finalConflicts.crossCourse.length}`);
//         console.warn(`   - Within-course instructor: ${finalConflicts.instructor.length}`);
//         console.warn(`   - Room: ${finalConflicts.room.length}`);
//       } else {
//         console.log('✅ Final check: ZERO conflicts detected!');
//       }

//       console.log(`✅ Successfully saved ${savedCount} schedule entries in ${totalTime}s`);

//       res.json({
//         success: true,
//         message: `Schedule generated for ${payload.sectionCount} section(s)${totalConflicts > 0 ? ' with ' + totalConflicts + ' conflicts' : ' with NO conflicts'}`,
//         method: 'Enhanced GPT-3.5-Turbo with Strict Validation',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           conflictsDetected: totalConflicts,
//           crossCourseConflicts: finalConflicts.crossCourse.length,
//           withinCourseConflicts: finalConflicts.instructor.length,
//           roomConflicts: finalConflicts.room.length,
//           generationTimeSeconds: parseFloat(totalTime)
//         },
//         warnings: totalConflicts > 0 ? {
//           crossCourseConflicts: finalConflicts.crossCourse.map(c => 
//             `${c.instructor}: Teaching ${c.course}-${c.subject} conflicts with this schedule on ${c.day} slot ${c.slot}`
//           ),
//           instructorConflicts: finalConflicts.instructor.map(c =>
//             `${c.instructor}: Double-booked on ${c.day} slot ${c.slot}`
//           ),
//           roomConflicts: finalConflicts.room.map(c =>
//             `Room ${c.room}: Double-booked on ${c.day} slot ${c.slot}`
//           )
//         } : undefined
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error:', err);
//     try { await query('ROLLBACK'); } catch (e) { }

//     res.status(500).json({
//       error: 'Schedule generation failed',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `
//       SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name
//       FROM schedule s
//       LEFT JOIN rooms r ON s.room_id = r.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       WHERE s.day = ? AND s.slot_index = ?
//     `;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);

//     res.json({
//       usedRoomIds: results.map(r => r.room_id).filter(Boolean),
//       usedInstructorIds: results.map(r => r.instructor_id).filter(Boolean),
//       usedRoomNames: results.map(r => r.room_name).filter(Boolean),
//       usedInstructorNames: results.map(r => r.instructor_name).filter(Boolean),
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;

//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time, s.duration
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;
//   try {
//     console.log(`🗑️ Batch delete: Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);

//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router

//FUNCTIONAL WITHOUT TTHS and MWF RESTRICTION
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');
// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error(' Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');

//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error(' Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error(' Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" },
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );

//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });

//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchExistingInstructorSchedules() {
//   try {
//     const results = await query(
//       `SELECT 
//         s.instructor_id,
//         i.name as instructor_name,
//         s.day,
//         s.slot_index,
//         s.start_time,
//         s.end_time,
//         s.duration,
//         s.course_id,
//         c.name as course_name,
//         c.code as course_code,
//         s.year_level,
//         s.semester,
//         subj.subject_code,
//         subj.description as subject_name
//        FROM schedule s
//        LEFT JOIN instructors i ON s.instructor_id = i.id
//        LEFT JOIN courses c ON s.course_id = c.id
//        LEFT JOIN subjects subj ON s.subject_id = subj.id
//        WHERE s.instructor_id IS NOT NULL`
//     );

//     const scheduleMap = {};
//     results.forEach(row => {
//       const instructorId = row.instructor_id;
//       if (!scheduleMap[instructorId]) {
//         scheduleMap[instructorId] = {
//           instructor_name: row.instructor_name,
//           occupied_slots: []
//         };
//       }

//       const duration = row.duration || 1;
//       const slotsNeeded = Math.ceil(duration);

//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = row.slot_index + i;
//         scheduleMap[instructorId].occupied_slots.push({
//           day: row.day,
//           slot_index: slotIndex,
//           course_code: row.course_code,
//           course_name: row.course_name,
//           year_level: row.year_level,
//           semester: row.semester,
//           subject_code: row.subject_code,
//           subject_name: row.subject_name,
//           time: `${row.start_time.substring(0, 5)}-${row.end_time.substring(0, 5)}`
//         });
//       }
//     });

//     return scheduleMap;
//   } catch (err) {
//     console.error('Error fetching existing instructor schedules:', err);
//     return {};
//   }
// }

// // IMPROVED: Now handles multiple instructors per subject
// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;
//     const params = [courseId, yearLevel, semester];
//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }
//     const results = await query(sql, params);

//     // Group by subject_id to handle multiple instructors per subject
//     const assignmentMap = {};
//     results.forEach(row => {
//       if (!assignmentMap[row.subject_id]) {
//         assignmentMap[row.subject_id] = [];
//       }
//       assignmentMap[row.subject_id].push({
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       });
//     });

//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );

//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // ENHANCED PATTERN VALIDATION AND ENFORCEMENT
// // ============================================

// function strictPatternValidation(assignments, schedulePattern, allowedDays) {
//   console.log(`🔒 STRICT pattern validation: ${schedulePattern}`);
  
//   let violations = 0;
//   let fixed = 0;

//   // First pass: Fix individual day violations
//   assignments.forEach(assignment => {
//     if (!allowedDays.includes(assignment.day)) {
//       violations++;
//       console.warn(`⚠️ VIOLATION: ${assignment.day} not in allowed days [${allowedDays.join(', ')}]`);
      
//       const validDay = allowedDays[Math.floor(Math.random() * allowedDays.length)];
//       console.log(`   🔧 Fixed: ${assignment.day} → ${validDay}`);
//       assignment.day = validDay;
//       fixed++;
//     }
//   });

//   // Second pass: Ensure each subject follows ONE pattern consistently
//   if (schedulePattern === 'BOTH') {
//     const subjectPatterns = {};
//     assignments.forEach(a => {
//       if (!subjectPatterns[a.subject_id]) {
//         subjectPatterns[a.subject_id] = new Set();
//       }
//       subjectPatterns[a.subject_id].add(a.day);
//     });

//     for (const [subjectId, daysSet] of Object.entries(subjectPatterns)) {
//       const daysArray = Array.from(daysSet);
//       const hasMWF = daysArray.some(d => DAYS_MWF.includes(d));
//       const hasTTH = daysArray.some(d => DAYS_TTHS.includes(d));
      
//       if (hasMWF && hasTTH) {
//         violations++;
//         console.warn(`⚠️ Subject ${subjectId} mixes MWF and TTH patterns!`);
        
//         // Choose dominant pattern
//         const mwfCount = daysArray.filter(d => DAYS_MWF.includes(d)).length;
//         const tthCount = daysArray.filter(d => DAYS_TTHS.includes(d)).length;
//         const targetDays = mwfCount >= tthCount ? DAYS_MWF : DAYS_TTHS;
        
//         console.log(`   🔧 Enforcing ${targetDays === DAYS_MWF ? 'MWF' : 'TTH'} pattern for subject ${subjectId}`);
        
//         assignments.forEach(a => {
//           if (a.subject_id === parseInt(subjectId) && !targetDays.includes(a.day)) {
//             const newDay = targetDays[Math.floor(Math.random() * targetDays.length)];
//             console.log(`      ${a.day} → ${newDay}`);
//             a.day = newDay;
//             fixed++;
//           }
//         });
//       }
//     }
//   }

//   console.log(`✅ Pattern validation: ${violations} violations found, ${fixed} fixed`);
//   return assignments;
// }

// // ============================================
// // COMPREHENSIVE CONFLICT DETECTION & RESOLUTION
// // ============================================

// function validateAndFixConflicts(assignments, payload) {
//   console.log('🔍 Starting comprehensive conflict detection...');
  
//   const instructorMap = new Map();
//   const roomMap = new Map();
//   const sectionMap = new Map();
  
//   // Pre-populate with existing schedules from other courses
//   if (payload.existingInstructorSchedules) {
//     let preloadedCount = 0;
//     for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
//       data.occupied_slots.forEach(slot => {
//         const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
//         instructorMap.set(key, { 
//           existing: true, 
//           course: slot.course_code,
//           subject: slot.subject_code,
//           instructor: data.instructor_name
//         });
//         preloadedCount++;
//       });
//     }
//     console.log(`📌 Pre-loaded ${preloadedCount} occupied slots from existing courses`);
//   }

//   const conflicts = [];
  
//   // First pass: Detect all conflicts
//   assignments.forEach((assignment, index) => {
//     const subject = payload.subjects.find(s => s.id === assignment.subject_id);
//     const duration = subject ? Math.ceil(subject.duration) : 1;
    
//     for (let i = 0; i < duration; i++) {
//       const slotIndex = assignment.slot_index + i;
//       if (slotIndex >= 12) continue;
      
//       // Check instructor conflicts (both cross-course and within-course)
//       const instrKey = `${assignment.teacher_id}-${assignment.day}-${slotIndex}`;
//       const existingInstr = instructorMap.get(instrKey);
      
//       if (existingInstr) {
//         conflicts.push({
//           type: existingInstr.existing ? 'cross-course' : 'instructor',
//           assignment,
//           slotIndex,
//           existing: existingInstr,
//           index,
//           duration
//         });
//       } else {
//         instructorMap.set(instrKey, { 
//           assignment, 
//           slotIndex, 
//           existing: false 
//         });
//       }
      
//       // Check room conflicts
//       const roomKey = `${assignment.room_id}-${assignment.day}-${slotIndex}`;
//       const existingRoom = roomMap.get(roomKey);
      
//       if (existingRoom) {
//         conflicts.push({
//           type: 'room',
//           assignment,
//           slotIndex,
//           existing: existingRoom,
//           index,
//           duration
//         });
//       } else {
//         roomMap.set(roomKey, { assignment, slotIndex });
//       }
      
//       // Check section conflicts
//       const sectionKey = `${assignment.section_index}-${assignment.day}-${slotIndex}`;
//       const existingSection = sectionMap.get(sectionKey);
      
//       if (existingSection) {
//         conflicts.push({
//           type: 'section',
//           assignment,
//           slotIndex,
//           existing: existingSection,
//           index,
//           duration
//         });
//       } else {
//         sectionMap.set(sectionKey, { assignment, slotIndex });
//       }
//     }
//   });

//   // Second pass: Resolve conflicts
//   if (conflicts.length > 0) {
//     console.warn(`⚠️ Found ${conflicts.length} conflicts. Attempting resolution...`);
    
//     // Group conflicts by assignment to avoid fixing same assignment multiple times
//     const conflictsByAssignment = new Map();
//     conflicts.forEach(conflict => {
//       const key = `${conflict.assignment.subject_id}-${conflict.assignment.section_index}`;
//       if (!conflictsByAssignment.has(key)) {
//         conflictsByAssignment.set(key, []);
//       }
//       conflictsByAssignment.get(key).push(conflict);
//     });
    
//     let resolved = 0;
//     let unresolved = 0;
    
//     conflictsByAssignment.forEach((conflictGroup, key) => {
//       const conflict = conflictGroup[0]; // Use first conflict for the assignment
//       const assignment = conflict.assignment;
//       const subject = payload.subjects.find(s => s.id === assignment.subject_id);
      
//       console.log(`   🔧 Resolving ${conflict.type} conflict for ${subject?.code || assignment.subject_id}...`);
      
//       if (conflict.type === 'cross-course') {
//         console.log(`      Instructor ${conflict.existing.instructor} already teaching ${conflict.existing.course} - ${conflict.existing.subject}`);
//       }
      
//       const newSlot = findAlternativeSlot(
//         assignment,
//         payload,
//         instructorMap,
//         roomMap,
//         sectionMap
//       );
      
//       if (newSlot) {
//         // Clear old entries
//         const duration = subject ? Math.ceil(subject.duration) : 1;
//         for (let i = 0; i < duration; i++) {
//           const oldSlotIndex = assignment.slot_index + i;
//           instructorMap.delete(`${assignment.teacher_id}-${assignment.day}-${oldSlotIndex}`);
//           roomMap.delete(`${assignment.room_id}-${assignment.day}-${oldSlotIndex}`);
//           sectionMap.delete(`${assignment.section_index}-${assignment.day}-${oldSlotIndex}`);
//         }
        
//         // Update assignment
//         assignment.day = newSlot.day;
//         assignment.slot_index = newSlot.slot_index;
        
//         // Set new entries
//         for (let i = 0; i < duration; i++) {
//           const newSlotIndex = newSlot.slot_index + i;
//           instructorMap.set(`${assignment.teacher_id}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex, 
//             existing: false 
//           });
//           roomMap.set(`${assignment.room_id}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex 
//           });
//           sectionMap.set(`${assignment.section_index}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex 
//           });
//         }
        
//         console.log(`      ✅ Resolved: ${assignment.day} slot ${assignment.slot_index} → ${newSlot.day} slot ${newSlot.slot_index}`);
//         resolved++;
//       } else {
//         console.error(`      ❌ Could not resolve conflict - no alternative slots available`);
//         unresolved++;
//       }
//     });
    
//     console.log(`✅ Conflict resolution complete: ${resolved} resolved, ${unresolved} unresolved`);
//   } else {
//     console.log('✅ No conflicts detected!');
//   }

//   return assignments;
// }

// function findAlternativeSlot(assignment, payload, instructorMap, roomMap, sectionMap) {
//   const subject = payload.subjects.find(s => s.id === assignment.subject_id);
//   const duration = subject ? Math.ceil(subject.duration) : 1;
  
//   // Determine allowed days based on schedule pattern
//   let allowedDays;
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//   } else {
//     // For BOTH pattern, maintain the subject's current pattern
//     const currentDay = assignment.day;
//     if (DAYS_MWF.includes(currentDay)) {
//       allowedDays = DAYS_MWF;
//     } else if (DAYS_TTHS.includes(currentDay)) {
//       allowedDays = DAYS_TTHS;
//     } else {
//       allowedDays = DAYS_ALL;
//     }
//   }
  
//   // Try to find alternative slot
//   for (const day of allowedDays) {
//     for (let slot = 0; slot <= 12 - duration; slot++) {
//       let canUseSlot = true;
      
//       // Check all required consecutive slots
//       for (let i = 0; i < duration; i++) {
//         const slotIndex = slot + i;
//         const instrKey = `${assignment.teacher_id}-${day}-${slotIndex}`;
//         const roomKey = `${assignment.room_id}-${day}-${slotIndex}`;
//         const sectionKey = `${assignment.section_index}-${day}-${slotIndex}`;
        
//         // Check if any slot is occupied
//         if (instructorMap.has(instrKey) || roomMap.has(roomKey) || sectionMap.has(sectionKey)) {
//           canUseSlot = false;
//           break;
//         }
//       }
      
//       if (canUseSlot) {
//         return { day, slot_index: slot };
//       }
//     }
//   }
  
//   return null;
// }

// // ============================================
// // ENHANCED GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');

//   if (retryCount > 0) {
//     console.log(` Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Request details:');
//   console.log(' Subjects:', payload.subjects.length);
//   console.log(' Teachers:', payload.teachers.length);
//   console.log(' Rooms:', payload.rooms.length);
//   console.log(' Sections:', payload.sectionCount);
//   console.log(' Pattern:', payload.schedulePattern);

//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
//   let patternRules = '';

//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet on Monday, Wednesday, Friday only';
//     patternRules = `
// **ABSOLUTE MWF PATTERN ENFORCEMENT (CRITICAL):**
// - YOU MUST USE ONLY: Monday, Wednesday, Friday
// - STRICTLY FORBIDDEN: Tuesday, Thursday, Saturday, Sunday
// - EVERY single assignment MUST have day = "Monday" OR "Wednesday" OR "Friday"
// - If you include ANY class on Tuesday, Thursday, or Saturday, the ENTIRE schedule is INVALID
// - For 3-unit courses: Schedule 3 sessions (one on Mon, one on Wed, one on Fri), typically 1 hour each
// - Double-check EVERY assignment before returning - NO EXCEPTIONS
// - Violation of this rule means complete schedule rejection`;
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTH Pattern: Classes meet on Tuesday, Thursday, Saturday only';
//     patternRules = `
// **ABSOLUTE TTH PATTERN ENFORCEMENT (CRITICAL):**
// - YOU MUST USE ONLY: Tuesday, Thursday, Saturday
// - STRICTLY FORBIDDEN: Monday, Wednesday, Friday, Sunday
// - EVERY single assignment MUST have day = "Tuesday" OR "Thursday" OR "Saturday"
// - If you include ANY class on Monday, Wednesday, or Friday, the ENTIRE schedule is INVALID
// - For 3-unit courses: Schedule 2-3 sessions across these days with appropriate durations
// - Double-check EVERY assignment before returning - NO EXCEPTIONS
// - Violation of this rule means complete schedule rejection`;
//   } else {
//     patternDescription = 'BOTH Pattern: Each subject uses EITHER MWF OR TTH - NEVER mixed';
//     patternRules = `
// **STRICT BOTH PATTERN ENFORCEMENT (CRITICAL):**
// - Each subject MUST follow EITHER MWF OR TTH pattern exclusively
// - ASSIGNMENT RULE: 
//   * Major subjects (3+ units): Use MWF pattern (Monday, Wednesday, Friday)
//   * Minor subjects (less than 3 units): Use TTH pattern (Tuesday, Thursday, Saturday)
//   * Laboratory subjects: Prefer TTH for longer continuous blocks
// - Once a pattern is assigned to a subject, ALL sessions of that subject MUST use the same pattern
// - FORBIDDEN EXAMPLE: Math on Monday + Math on Tuesday (this mixes patterns - INVALID)
// - CORRECT EXAMPLE: Math on Monday + Math on Wednesday + Math on Friday (consistent MWF)
// - Track each subject's pattern and verify 100% consistency before returning`;
//   }

//   // IMPROVED: Build instructor assignment text with multiple instructors per subject
//   let instructorAssignmentText = '\n\n**SUBJECTS WITH ASSIGNED TEACHERS:**';
//   payload.subjects.forEach(s => {
//     instructorAssignmentText += `\n- ${s.code} (ID: ${s.id}, ${s.units} units, ${s.duration}h per session)`;
    
//     if (s.instructors && s.instructors.length > 1) {
//       instructorAssignmentText += ` → ${s.instructors.length} Instructors Available:`;
//       s.instructors.forEach((inst, idx) => {
//         instructorAssignmentText += `\n    ${idx + 1}. "${inst.teacher_name}" (ID: ${inst.teacher_id})`;
//       });
//       instructorAssignmentText += `\n    **DISTRIBUTE SMARTLY**: Assign different instructors to different sections to balance workload`;
//     } else if (s.instructors && s.instructors.length === 1) {
//       instructorAssignmentText += ` → Instructor: "${s.instructors[0].teacher_name}" (ID: ${s.instructors[0].teacher_id})`;
//     }
//   });

//   // Build detailed instructor conflict information
//   let instructorBusySlotsText = '';
//   if (payload.existingInstructorSchedules && Object.keys(payload.existingInstructorSchedules).length > 0) {
//     instructorBusySlotsText = '\n\n**CRITICAL: INSTRUCTORS ALREADY TEACHING IN OTHER COURSES (ABSOLUTE CONFLICTS):**';
//     instructorBusySlotsText += '\nThese time slots are COMPLETELY BLOCKED - instructors are teaching other courses:';
    
//     for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
//       const teacher = payload.teachers.find(t => t.id === parseInt(instructorId));
//       if (teacher) {
//         instructorBusySlotsText += `\n\n**${data.instructor_name}** (ID: ${instructorId}) - UNAVAILABLE AT:`;
        
//         const slotsByDay = {};
//         data.occupied_slots.forEach(slot => {
//           if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
//           slotsByDay[slot.day].push(slot);
//         });
        
//         for (const [day, slots] of Object.entries(slotsByDay)) {
//           instructorBusySlotsText += `\n  ${day}: `;
//           const uniqueSlots = [...new Map(slots.map(s => [s.slot_index, s])).values()];
//           instructorBusySlotsText += uniqueSlots
//             .sort((a, b) => a.slot_index - b.slot_index)
//             .map(s => `Slot ${s.slot_index} (${s.time}) teaching ${s.course_code}-${s.subject_code}`)
//             .join(', ');
//         }
//       }
//     }
    
//     instructorBusySlotsText += '\n\n**MANDATORY**: Before assigning ANY instructor, verify they are NOT in the above list for that day/time!';
//   } else {
//     instructorBusySlotsText = '\n\n**No existing instructor schedules found** - This appears to be the first course being scheduled.';
//   }

//   const systemPrompt = `You are an expert university scheduling AI with ZERO TOLERANCE for conflicts and pattern violations.

// ${patternRules}

// **CRITICAL CONSTRAINTS (ABSOLUTE REQUIREMENTS):**

// 1. **SCHEDULE PATTERN COMPLIANCE:**
//    - This is your #1 priority - NEVER violate the pattern rules above
//    - Validate EVERY assignment before including it in your response
//    - If in doubt about a day, DON'T USE IT

// 2. **INSTRUCTOR CONFLICT PREVENTION (TOP PRIORITY):**
//    - An instructor CANNOT teach multiple classes at the same time
//    - This applies ACROSS all courses (cross-course conflicts)
//    - This applies WITHIN this course (same instructor, different sections)
//    - CHECK THREE THINGS before every instructor assignment:
//      a) Is this instructor busy in another course at this time? (see existing schedules below)
//      b) Is this instructor already assigned to another section at this time?
//      c) Does this instructor have availability restrictions?

// 3. **SMART MULTI-INSTRUCTOR DISTRIBUTION (NEW):**
//    - When a subject has MULTIPLE instructors assigned, DISTRIBUTE them across sections
//    - Example: If Math has 2 instructors and 4 sections:
//      * Section A (0) → Instructor 1
//      * Section B (1) → Instructor 2
//      * Section C (2) → Instructor 1
//      * Section D (3) → Instructor 2
//    - This ensures FAIR WORKLOAD and prevents one instructor from being overloaded
//    - Use round-robin distribution pattern

// 4. **CONFLICT CHECKING ALGORITHM YOU MUST FOLLOW:**
//    Before assigning instructor to day/slot:
   
//    Step 1: Calculate slots_needed = ceil(duration)
//    Step 2: For each slot from slot_index to (slot_index + slots_needed - 1):
//            - Check existing_schedules[instructor_id][day][slot]
//            - Check current_assignments[instructor_id][day][slot]
//            - If ANY slot is occupied → SKIP this time, try next slot
//    Step 3: If all slots free → ASSIGN and mark slots as occupied
//    Step 4: Update your mental schedule map
   
//    Example: 2-hour Math class starting at slot 0 needs to check slots 0 AND 1

// 5. **SECTION STAGGERING (MANDATORY):**
//    - If Section A has instructor X at Monday 7-8, Section B CANNOT have instructor X at Monday 7-8
//    - Stagger sections to different times to avoid instructor conflicts
//    - Track each instructor's schedule across all sections as you build the timetable

// 6. **ROOM RULES:**
//    - Each section is assigned ONE dedicated room
//    - ALL subjects in a section MUST use that section's room_id
//    - No room can be used by multiple sections at the same time

// 7. **AFTERNOON DISTRIBUTION (REQUIRED):**
//    - Slots 0-4 = Morning (7 AM - 12 PM)
//    - Slots 5-11 = Afternoon (12 PM - 7 PM)
//    - MANDATE: At least 40% of classes must be in afternoon slots
//    - DO NOT cram all classes in the morning
//    - This spreads workload and reduces conflicts

// 8. **DURATION HANDLING:**
//    - Each subject has a specific duration (e.g., 1h, 1.5h, 2h, 3h)
//    - Multi-hour classes occupy CONSECUTIVE time slots
//    - When reporting: Only include the STARTING slot_index
//    - System will automatically block consecutive slots based on duration

// ${instructorBusySlotsText}

// **VALIDATION CHECKLIST BEFORE RETURNING YOUR SCHEDULE:**
// □ Every "day" field is from allowed list: ${allowedDays.join(', ')}
// □ Each subject consistently uses ONE pattern (all MWF or all TTH)
// □ Multiple instructors for same subject are DISTRIBUTED across sections (not all same instructor)
// □ No instructor is scheduled during their occupied slots from other courses
// □ No instructor teaches multiple sections at the same time
// □ No room conflicts (multiple sections in same room at same time)
// □ At least 40% of assignments are in afternoon slots (5-11)
// □ All sections (0 to ${payload.sectionCount - 1}) have complete schedules
// □ Each subject appears exactly ${payload.sectionCount} times (once per section)

// Return schedule as JSON array "assignments" with these exact fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}),
//   "teacher_name": string (exact match from teacher list),
//   "room_id": number (section's assigned room_id),
//   "day": string (MUST be from: ${allowedDays.join(', ')}),
//   "slot_index": number (0-11, starting slot only)
// }`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\n**INSTRUCTOR AVAILABILITY WINDOWS (RESPECT THESE):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a =>
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Generate a complete, conflict-free schedule for ${payload.sectionCount} section(s).

// ${instructorAssignmentText}

// **ROOM ASSIGNMENTS (ONE ROOM PER SECTION):**
// ${payload.sectionRoomMap ? Object.entries(payload.sectionRoomMap).map(([secIdx, room]) => 
//   `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): MUST use Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`
// ).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id})`).join('\n')}

// ${availabilityText}

// **SCHEDULE PATTERN:** ${payload.schedulePattern}
// **ALLOWED DAYS (ONLY USE THESE):** ${allowedDays.join(', ')}
// **FORBIDDEN DAYS (NEVER USE):** ${DAYS_ALL.filter(d => !allowedDays.includes(d)).join(', ')}

// **SECTIONS:** ${payload.sectionCount} total (section_index: 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A
//   - Section 1 = Section B  
//   - Section 2 = Section C
//   - etc.

// **TIME SLOTS:** 0-11 representing:
//   - 0 = 7-8 AM, 1 = 8-9 AM, 2 = 9-10 AM, 3 = 10-11 AM, 4 = 11 AM-12 PM
//   - 5 = 12-1 PM, 6 = 1-2 PM, 7 = 2-3 PM, 8 = 3-4 PM, 9 = 4-5 PM, 10 = 5-6 PM, 11 = 6-7 PM

// **IMPORTANT REMINDERS:**
// ✓ When a subject has multiple instructors, DISTRIBUTE them across sections (round-robin)
// ✓ Use ONLY the assigned teachers for each subject (exact name match)
// ✓ Each section gets ONE dedicated room for ALL its subjects
// ✓ Check instructor availability before EVERY assignment
// ✓ Stagger sections - don't duplicate instructor times
// ✓ Use afternoon slots (5-11) for at least 40% of classes
// ✓ For multi-hour classes, only report starting slot_index
// ✓ Generate schedules for ALL ${payload.sectionCount} section(s)
// ✓ Each subject appears exactly ${payload.sectionCount} times in output
// ✓ ABSOLUTE: Every day must be from allowed list: ${allowedDays.join(', ')}

// **FINAL CHECK:** Before returning, count how many assignments use forbidden days. If > 0, FIX THEM!

// Generate the complete schedule now. Return ONLY valid JSON with "assignments" array. No markdown, no explanations.`;

//   try {
//     const startTime = Date.now();

//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.2,
//       max_tokens: 4000
//     });

//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️ GPT responded in ${elapsedTime}s`);

//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received, parsing...');

//     let parsed = JSON.parse(responseText);

//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     console.log(`📊 GPT generated ${assignments.length} assignments`);

//     // Check section distribution
//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });
//     console.log('📊 Section distribution:', sectionCounts);

//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }
//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     // CRITICAL: Apply strict validation and conflict resolution
//     console.log('🔒 Applying strict validation...');
//     assignments = strictPatternValidation(assignments, payload.schedulePattern, allowedDays);
//     assignments = validateAndFixConflicts(assignments, payload);

//     return assignments;
//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);

//     const isTimeout = error.message.includes('timed out');

//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }

//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Check OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Schedule generation request (Enhanced GPT Mode)');
//     console.log(' Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log(' Pattern:', schedulePattern);
//     console.log(' Sections:', sectionCount);
//     console.log(' Major:', major || 'N/A');

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects array are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     if (schedulePattern === 'BOTH') {
//       console.warn('⚠️ BOTH pattern selected - will enforce strict MWF/TTH per subject');
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);

//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     console.log('🔍 Fetching existing instructor schedules...');
//     const existingInstructorSchedules = await fetchExistingInstructorSchedules();
    
//     if (Object.keys(existingInstructorSchedules).length > 0) {
//       console.log(`📊 Found ${Object.keys(existingInstructorSchedules).length} instructors with existing schedules`);
//       for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//         console.log(`   - ${data.instructor_name}: ${data.occupied_slots.length} occupied slots`);
//       }
//     } else {
//       console.log('📊 No existing schedules - first course to be scheduled');
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);

//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms in the Rooms page'
//       });
//     }

//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({
//         error: 'Not enough rooms',
//         detail: `Need ${sectionCount} rooms for ${sectionCount} section(s). Only ${roomAssignments.length} assigned.`
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!subjRows || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     // IMPROVED: Build subjects with ALL instructors per subject
//     const subjectsWithTeachers = subjRows.map(s => {
//       const instructors = teacherAssignments[s.id];
//       if (!instructors || instructors.length === 0) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }

//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: Number(instructors[0].duration) || 1,
//         instructors: instructors // Pass all instructors
//       };
//     });

//     // Collect all unique teachers
//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       s.instructors.forEach(inst => {
//         if (!uniqueTeachers[inst.teacher_name]) {
//           const availData = instructorAvailData[inst.teacher_name];
//           uniqueTeachers[inst.teacher_name] = {
//             id: inst.teacher_id,
//             name: inst.teacher_name,
//             availability: availData ? availData.slots : []
//           };
//         }
//       });
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Scheduling details:`);
//     console.log(` - Subjects: ${subjectsWithTeachers.length}`);
//     console.log(` - Teachers: ${teachersForScheduler.length}`);
//     console.log(` - Rooms: ${roomAssignments.length}`);
//     console.log(` - Sections: ${sectionCount}`);
    
//     // Log multi-instructor subjects
//     const multiInstructorSubjects = subjectsWithTeachers.filter(s => s.instructors.length > 1);
//     if (multiInstructorSubjects.length > 0) {
//       console.log(`📊 Subjects with multiple instructors:`);
//       multiInstructorSubjects.forEach(s => {
//         console.log(`   - ${s.code}: ${s.instructors.length} instructors`);
//       });
//     }

//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//       console.log(`📍 Section ${String.fromCharCode(65 + i)} → ${roomAssignments[i].room_name}`);
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount),
//       sectionCount: Number(sectionCount),
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap: sectionRoomMap,
//       schedulePattern: schedulePattern,
//       considerInstructorAvailability: considerInstructorAvailability,
//       existingInstructorSchedules: existingInstructorSchedules
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create valid assignments. Try adjusting constraints.'
//       });
//     }

//     console.log(`✅ Generated ${assignments.length} assignments`);

//     // Match teacher names to IDs and fix room assignments
//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();
//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);

//       if (!teacher) {
//         teacher = teachersForScheduler.find(t =>
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }

//       if (!teacher && a.subject_id) {
//         const subjectInstructors = teacherAssignments[a.subject_id];
//         if (subjectInstructors && subjectInstructors.length > 0) {
//           teacher = teachersForScheduler.find(t => t.id === subjectInstructors[0].teacher_id);
//         }
//       }

//       // Fix room assignment
//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         console.log(`🔧 Fixed room for Section ${a.section_index}: ${correctRoom.room_name}`);
//         a.room_id = correctRoom.room_id;
//       }

//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? Number(subject.duration) : 1;

//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name,
//         duration: duration
//       };
//     });

//     // Final validation check
//     const invalidAssignments = assignments.filter(a => !a.teacher_id);
//     if (invalidAssignments.length > 0) {
//       console.warn(`⚠️ ${invalidAssignments.length} assignments missing teacher_id`);
//       invalidAssignments.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Teacher: "${a.teacher_name}"`);
//       });
//     }

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];

//         if (!timeSlot || !sectionId || !a.teacher_id) {
//           console.error(`❌ Skipping invalid assignment: slot=${a.slot_index}, section=${a.section_index}, teacher=${a.teacher_id}`);
//           continue;
//         }

//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? Number(subject.duration) : 1;

//         const startTime = timeSlot.start;
//         const startHour = parseInt(startTime.split(':')[0]);
//         const endHour = startHour + duration;
//         const endTime = `${String(endHour).padStart(2, '0')}:00:00`;

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time, duration) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             startTime,
//             endTime,
//             duration
//           ]
//         );

//         savedCount++;
//       }

//       await query('COMMIT');

//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

//       // Final conflict check
//       const finalConflicts = {
//         instructor: [],
//         room: [],
//         crossCourse: []
//       };

//       const instructorCheck = new Map();
//       const roomCheck = new Map();

//       if (existingInstructorSchedules) {
//         for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//           data.occupied_slots.forEach(slot => {
//             const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
//             instructorCheck.set(key, { existing: true, data: slot });
//           });
//         }
//       }

//       for (const a of assignments) {
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? Math.ceil(subject.duration) : 1;

//         for (let i = 0; i < duration; i++) {
//           const slotIndex = a.slot_index + i;
//           if (slotIndex >= 12) continue;

//           const instrKey = `${a.teacher_id}-${a.day}-${slotIndex}`;
//           const existing = instructorCheck.get(instrKey);

//           if (existing) {
//             if (existing.existing) {
//               finalConflicts.crossCourse.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex,
//                 course: existing.data.course_code,
//                 subject: existing.data.subject_code
//               });
//             } else {
//               finalConflicts.instructor.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex
//               });
//             }
//           } else {
//             instructorCheck.set(instrKey, { existing: false, assignment: a });
//           }

//           const roomKey = `${a.room_id}-${a.day}-${slotIndex}`;
//           if (roomCheck.has(roomKey)) {
//             finalConflicts.room.push({
//               room: a.room_id,
//               day: a.day,
//               slot: slotIndex
//             });
//           } else {
//             roomCheck.set(roomKey, true);
//           }
//         }
//       }

//       const totalConflicts = finalConflicts.instructor.length + 
//                             finalConflicts.room.length + 
//                             finalConflicts.crossCourse.length;

//       if (totalConflicts > 0) {
//         console.warn(`⚠️ Final check found ${totalConflicts} conflicts:`);
//         console.warn(`   - Cross-course: ${finalConflicts.crossCourse.length}`);
//         console.warn(`   - Within-course instructor: ${finalConflicts.instructor.length}`);
//         console.warn(`   - Room: ${finalConflicts.room.length}`);
//       } else {
//         console.log('✅ Final check: ZERO conflicts detected!');
//       }

//       console.log(`✅ Successfully saved ${savedCount} schedule entries in ${totalTime}s`);

//       res.json({
//         success: true,
//         message: `Schedule generated for ${payload.sectionCount} section(s)${totalConflicts > 0 ? ' with ' + totalConflicts + ' conflicts' : ' with NO conflicts'}`,
//         method: 'Enhanced GPT-3.5-Turbo with Multi-Instructor Support',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           conflictsDetected: totalConflicts,
//           crossCourseConflicts: finalConflicts.crossCourse.length,
//           withinCourseConflicts: finalConflicts.instructor.length,
//           roomConflicts: finalConflicts.room.length,
//           generationTimeSeconds: parseFloat(totalTime)
//         },
//         warnings: totalConflicts > 0 ? {
//           crossCourseConflicts: finalConflicts.crossCourse.map(c => 
//             `${c.instructor}: Teaching ${c.course}-${c.subject} conflicts with this schedule on ${c.day} slot ${c.slot}`
//           ),
//           instructorConflicts: finalConflicts.instructor.map(c =>
//             `${c.instructor}: Double-booked on ${c.day} slot ${c.slot}`
//           ),
//           roomConflicts: finalConflicts.room.map(c =>
//             `Room ${c.room}: Double-booked on ${c.day} slot ${c.slot}`
//           )
//         } : undefined
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error:', err);
//     try { await query('ROLLBACK'); } catch (e) { }

//     res.status(500).json({
//       error: 'Schedule generation failed',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `
//       SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name
//       FROM schedule s
//       LEFT JOIN rooms r ON s.room_id = r.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       WHERE s.day = ? AND s.slot_index = ?
//     `;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);

//     res.json({
//       usedRoomIds: results.map(r => r.room_id).filter(Boolean),
//       usedInstructorIds: results.map(r => r.instructor_id).filter(Boolean),
//       usedRoomNames: results.map(r => r.room_name).filter(Boolean),
//       usedInstructorNames: results.map(r => r.instructor_name).filter(Boolean),
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;

//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time, s.duration
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;
//   try {
//     console.log(`🗑️ Batch delete: Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);

//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//FUNCTIONALLLLL
// const express = require('express');
// const router = express.Router();
// const db = require('../db');
// const util = require('util');
// const OpenAI = require('openai');
// const query = util.promisify(db.query).bind(db);

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// if (!process.env.OPENAI_API_KEY) {
//   console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
//   console.error(' Please add OPENAI_API_KEY to your .env file');
// } else {
//   console.log('✅ OpenAI API Key loaded successfully');

//   // Test the OpenAI connection
//   (async () => {
//     try {
//       const testResponse = await openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Say 'OK'" }],
//         max_tokens: 5
//       });
//       console.log('✅ OpenAI API connection test successful');
//     } catch (testErr) {
//       console.error('⚠️ OpenAI API connection test failed:', testErr.message);
//       if (testErr.message.includes('Incorrect API key')) {
//         console.error(' Your API key appears to be invalid. Please check your .env file');
//       } else if (testErr.message.includes('quota')) {
//         console.error(' Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
//       }
//     }
//   })();
// }

// const TIME_SLOTS = [
//   { start: "07:00:00", end: "08:00:00" },
//   { start: "08:00:00", end: "09:00:00" },
//   { start: "09:00:00", end: "10:00:00" },
//   { start: "10:00:00", end: "11:00:00" },
//   { start: "11:00:00", end: "12:00:00" },
//   { start: "12:00:00", end: "13:00:00" }, // LUNCH - SKIP THIS SLOT
//   { start: "13:00:00", end: "14:00:00" },
//   { start: "14:00:00", end: "15:00:00" },
//   { start: "15:00:00", end: "16:00:00" },
//   { start: "16:00:00", end: "17:00:00" },
//   { start: "17:00:00", end: "18:00:00" },
//   { start: "18:00:00", end: "19:00:00" }
// ];

// const LUNCH_SLOT = 5; // 12:00 PM - 1:00 PM - NEVER USE THIS SLOT

// const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
// const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
// const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// async function fetchInstructorAvailability() {
//   try {
//     const results = await query(
//       `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
//        FROM instructor_availability ia
//        LEFT JOIN instructors i ON ia.instructor_id = i.id`
//     );

//     const availMap = {};
//     results.forEach(row => {
//       if (!availMap[row.instructor_name]) {
//         availMap[row.instructor_name] = {
//           instructor_id: row.instructor_id,
//           slots: []
//         };
//       }
//       availMap[row.instructor_name].slots.push({
//         day: row.day,
//         start_time: row.start_time,
//         end_time: row.end_time
//       });
//     });

//     return availMap;
//   } catch (err) {
//     console.error('Error fetching instructor availability:', err);
//     return {};
//   }
// }

// async function fetchExistingInstructorSchedules() {
//   try {
//     const results = await query(
//       `SELECT 
//         s.instructor_id,
//         i.name as instructor_name,
//         s.day,
//         s.slot_index,
//         s.start_time,
//         s.end_time,
//         s.duration,
//         s.course_id,
//         c.name as course_name,
//         c.code as course_code,
//         s.year_level,
//         s.semester,
//         subj.subject_code,
//         subj.description as subject_name
//        FROM schedule s
//        LEFT JOIN instructors i ON s.instructor_id = i.id
//        LEFT JOIN courses c ON s.course_id = c.id
//        LEFT JOIN subjects subj ON s.subject_id = subj.id
//        WHERE s.instructor_id IS NOT NULL`
//     );

//     const scheduleMap = {};
//     results.forEach(row => {
//       const instructorId = row.instructor_id;
//       if (!scheduleMap[instructorId]) {
//         scheduleMap[instructorId] = {
//           instructor_name: row.instructor_name,
//           occupied_slots: []
//         };
//       }

//       const duration = row.duration || 1;
//       const slotsNeeded = Math.ceil(duration);

//       for (let i = 0; i < slotsNeeded; i++) {
//         const slotIndex = row.slot_index + i;
//         scheduleMap[instructorId].occupied_slots.push({
//           day: row.day,
//           slot_index: slotIndex,
//           course_code: row.course_code,
//           course_name: row.course_name,
//           year_level: row.year_level,
//           semester: row.semester,
//           subject_code: row.subject_code,
//           subject_name: row.subject_name,
//           time: `${row.start_time.substring(0, 5)}-${row.end_time.substring(0, 5)}`
//         });
//       }
//     });

//     return scheduleMap;
//   } catch (err) {
//     console.error('Error fetching existing instructor schedules:', err);
//     return {};
//   }
// }

// async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
//   try {
//     let sql = `
//       SELECT
//         ta.id, ta.teacher_id, ta.subject_id, ta.duration,
//         i.name as teacher_name,
//         s.subject_code, s.description, s.units
//        FROM teacher_assignments ta
//        LEFT JOIN instructors i ON ta.teacher_id = i.id
//        LEFT JOIN subjects s ON ta.subject_id = s.id
//        WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
//     `;
//     const params = [courseId, yearLevel, semester];
//     if (major) {
//       sql += " AND (s.major = ? OR s.major IS NULL)";
//       params.push(major);
//     }
//     const results = await query(sql, params);

//     // Group by subject_id to handle multiple instructors per subject
//     const assignmentMap = {};
//     results.forEach(row => {
//       if (!assignmentMap[row.subject_id]) {
//         assignmentMap[row.subject_id] = [];
//       }
//       assignmentMap[row.subject_id].push({
//         teacher_id: row.teacher_id,
//         teacher_name: row.teacher_name,
//         duration: row.duration || 1,
//         subject_code: row.subject_code,
//         units: row.units
//       });
//     });

//     return assignmentMap;
//   } catch (err) {
//     console.error('Error fetching teacher assignments:', err);
//     return {};
//   }
// }

// async function fetchRoomAssignments(courseId, yearLevel, semester) {
//   try {
//     const results = await query(
//       `SELECT
//         ra.id, ra.building_id, ra.room_id,
//         r.name as room_name,
//         b.name as building_name
//        FROM room_assignments ra
//        LEFT JOIN rooms r ON ra.room_id = r.id
//        LEFT JOIN buildings b ON ra.building_id = b.id
//        WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
//       [courseId, yearLevel, semester]
//     );

//     return results.map(row => ({
//       room_id: row.room_id,
//       room_name: row.room_name,
//       building_id: row.building_id,
//       building_name: row.building_name
//     }));
//   } catch (err) {
//     console.error('Error fetching room assignments:', err);
//     return [];
//   }
// }

// // ============================================
// // ENHANCED PATTERN VALIDATION AND ENFORCEMENT
// // ============================================

// function strictPatternValidation(assignments, schedulePattern, allowedDays) {
//   console.log(`🔒 STRICT pattern validation: ${schedulePattern}`);
//   console.log(`🔒 Allowed days: ${allowedDays.join(', ')}`);
  
//   let violations = 0;
//   let fixed = 0;

//   // First pass: Fix individual day violations for MWF and TTHS patterns
//   if (schedulePattern === 'MWF' || schedulePattern === 'TTH') {
//     assignments.forEach(assignment => {
//       if (!allowedDays.includes(assignment.day)) {
//         violations++;
//         console.warn(`⚠️ VIOLATION: ${assignment.day} not in allowed days [${allowedDays.join(', ')}]`);
        
//         // Select a valid day from allowed days
//         const validDay = allowedDays[Math.floor(Math.random() * allowedDays.length)];
//         console.log(`   🔧 Fixed: ${assignment.day} → ${validDay}`);
//         assignment.day = validDay;
//         fixed++;
//       }
//     });
//   }

//   // Second pass: For BOTH pattern, ensure ALTERNATING sections use correct pattern
//   if (schedulePattern === 'BOTH') {
//     console.log('🔄 Enforcing ALTERNATING section patterns (Even=TTHS, Odd=MWF)');
    
//     assignments.forEach(assignment => {
//       const sectionIndex = assignment.section_index;
//       const isEvenSection = sectionIndex % 2 === 0;
      
//       // Even sections (0, 2, 4...) should use TTHS
//       // Odd sections (1, 3, 5...) should use MWF
//       const expectedDays = isEvenSection ? DAYS_TTHS : DAYS_MWF;
//       const patternName = isEvenSection ? 'TTHS' : 'MWF';
      
//       if (!expectedDays.includes(assignment.day)) {
//         violations++;
//         console.warn(`⚠️ VIOLATION: Section ${sectionIndex} (${patternName}) has class on ${assignment.day}`);
        
//         // Fix to correct pattern
//         const validDay = expectedDays[Math.floor(Math.random() * expectedDays.length)];
//         console.log(`   🔧 Fixed: Section ${sectionIndex} ${assignment.day} → ${validDay} (${patternName} pattern)`);
//         assignment.day = validDay;
//         fixed++;
//       }
//     });
    
//     // Verify alternating pattern is correct
//     const sectionPatterns = {};
//     assignments.forEach(a => {
//       if (!sectionPatterns[a.section_index]) {
//         sectionPatterns[a.section_index] = new Set();
//       }
//       sectionPatterns[a.section_index].add(a.day);
//     });
    
//     console.log('📊 Section pattern summary:');
//     for (const [sectionIdx, daysSet] of Object.entries(sectionPatterns)) {
//       const isEven = parseInt(sectionIdx) % 2 === 0;
//       const expectedPattern = isEven ? 'TTHS' : 'MWF';
//       const daysArray = Array.from(daysSet);
//       const hasMWF = daysArray.some(d => DAYS_MWF.includes(d));
//       const hasTTHS = daysArray.some(d => DAYS_TTHS.includes(d));
      
//       const actualPattern = hasMWF && hasTTHS ? 'MIXED❌' : 
//                            hasMWF ? 'MWF' : 
//                            hasTTHS ? 'TTHS' : 'UNKNOWN';
      
//       const status = actualPattern === expectedPattern ? '✅' : '❌';
//       console.log(`   Section ${sectionIdx}: Expected ${expectedPattern}, Got ${actualPattern} ${status}`);
//     }
//   }

//   console.log(`✅ Pattern validation: ${violations} violations found, ${fixed} fixed`);
//   return assignments;
// }

// // ============================================
// // COMPREHENSIVE CONFLICT DETECTION & RESOLUTION
// // ============================================

// function validateAndFixConflicts(assignments, payload) {
//   console.log('🔍 Starting comprehensive conflict detection...');
  
//   const instructorMap = new Map();
//   const roomMap = new Map();
//   const sectionMap = new Map();
  
//   // Pre-populate with existing schedules from other courses
//   if (payload.existingInstructorSchedules) {
//     let preloadedCount = 0;
//     for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
//       data.occupied_slots.forEach(slot => {
//         const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
//         instructorMap.set(key, { 
//           existing: true, 
//           course: slot.course_code,
//           subject: slot.subject_code,
//           instructor: data.instructor_name
//         });
//         preloadedCount++;
//       });
//     }
//     console.log(`📌 Pre-loaded ${preloadedCount} occupied slots from existing courses`);
//   }

//   const conflicts = [];
  
//   // First pass: Detect all conflicts
//   assignments.forEach((assignment, index) => {
//     const subject = payload.subjects.find(s => s.id === assignment.subject_id);
//     const duration = subject ? Math.ceil(subject.duration) : 1;
    
//     for (let i = 0; i < duration; i++) {
//       const slotIndex = assignment.slot_index + i;
//       if (slotIndex >= 12) continue;
      
//       // Check instructor conflicts (both cross-course and within-course)
//       const instrKey = `${assignment.teacher_id}-${assignment.day}-${slotIndex}`;
//       const existingInstr = instructorMap.get(instrKey);
      
//       if (existingInstr) {
//         conflicts.push({
//           type: existingInstr.existing ? 'cross-course' : 'instructor',
//           assignment,
//           slotIndex,
//           existing: existingInstr,
//           index,
//           duration
//         });
//       } else {
//         instructorMap.set(instrKey, { 
//           assignment, 
//           slotIndex, 
//           existing: false 
//         });
//       }
      
//       // Check room conflicts
//       const roomKey = `${assignment.room_id}-${assignment.day}-${slotIndex}`;
//       const existingRoom = roomMap.get(roomKey);
      
//       if (existingRoom) {
//         conflicts.push({
//           type: 'room',
//           assignment,
//           slotIndex,
//           existing: existingRoom,
//           index,
//           duration
//         });
//       } else {
//         roomMap.set(roomKey, { assignment, slotIndex });
//       }
      
//       // Check section conflicts
//       const sectionKey = `${assignment.section_index}-${assignment.day}-${slotIndex}`;
//       const existingSection = sectionMap.get(sectionKey);
      
//       if (existingSection) {
//         conflicts.push({
//           type: 'section',
//           assignment,
//           slotIndex,
//           existing: existingSection,
//           index,
//           duration
//         });
//       } else {
//         sectionMap.set(sectionKey, { assignment, slotIndex });
//       }
//     }
//   });

//   // Second pass: Resolve conflicts
//   if (conflicts.length > 0) {
//     console.warn(`⚠️ Found ${conflicts.length} conflicts. Attempting resolution...`);
    
//     // Group conflicts by assignment to avoid fixing same assignment multiple times
//     const conflictsByAssignment = new Map();
//     conflicts.forEach(conflict => {
//       const key = `${conflict.assignment.subject_id}-${conflict.assignment.section_index}`;
//       if (!conflictsByAssignment.has(key)) {
//         conflictsByAssignment.set(key, []);
//       }
//       conflictsByAssignment.get(key).push(conflict);
//     });
    
//     let resolved = 0;
//     let unresolved = 0;
    
//     conflictsByAssignment.forEach((conflictGroup, key) => {
//       const conflict = conflictGroup[0]; // Use first conflict for the assignment
//       const assignment = conflict.assignment;
//       const subject = payload.subjects.find(s => s.id === assignment.subject_id);
      
//       console.log(`   🔧 Resolving ${conflict.type} conflict for ${subject?.code || assignment.subject_id}...`);
      
//       if (conflict.type === 'cross-course') {
//         console.log(`      Instructor ${conflict.existing.instructor} already teaching ${conflict.existing.course} - ${conflict.existing.subject}`);
//       }
      
//       const newSlot = findAlternativeSlot(
//         assignment,
//         payload,
//         instructorMap,
//         roomMap,
//         sectionMap
//       );
      
//       if (newSlot) {
//         // Clear old entries
//         const duration = subject ? Math.ceil(subject.duration) : 1;
//         for (let i = 0; i < duration; i++) {
//           const oldSlotIndex = assignment.slot_index + i;
//           instructorMap.delete(`${assignment.teacher_id}-${assignment.day}-${oldSlotIndex}`);
//           roomMap.delete(`${assignment.room_id}-${assignment.day}-${oldSlotIndex}`);
//           sectionMap.delete(`${assignment.section_index}-${assignment.day}-${oldSlotIndex}`);
//         }
        
//         // Update assignment
//         assignment.day = newSlot.day;
//         assignment.slot_index = newSlot.slot_index;
        
//         // Set new entries
//         for (let i = 0; i < duration; i++) {
//           const newSlotIndex = newSlot.slot_index + i;
//           instructorMap.set(`${assignment.teacher_id}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex, 
//             existing: false 
//           });
//           roomMap.set(`${assignment.room_id}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex 
//           });
//           sectionMap.set(`${assignment.section_index}-${newSlot.day}-${newSlotIndex}`, { 
//             assignment, 
//             slotIndex: newSlotIndex 
//           });
//         }
        
//         console.log(`      ✅ Resolved: ${assignment.day} slot ${assignment.slot_index} → ${newSlot.day} slot ${newSlot.slot_index}`);
//         resolved++;
//       } else {
//         console.error(`      ❌ Could not resolve conflict - no alternative slots available`);
//         unresolved++;
//       }
//     });
    
//     console.log(`✅ Conflict resolution complete: ${resolved} resolved, ${unresolved} unresolved`);
//   } else {
//     console.log('✅ No conflicts detected!');
//   }

//   return assignments;
// }

// function findAlternativeSlot(assignment, payload, instructorMap, roomMap, sectionMap) {
//   const subject = payload.subjects.find(s => s.id === assignment.subject_id);
//   const duration = subject ? Math.ceil(subject.duration) : 1;
  
//   // Determine allowed days based on schedule pattern
//   let allowedDays;
//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//   } else {
//     // For BOTH pattern, maintain the subject's current pattern
//     const currentDay = assignment.day;
//     if (DAYS_MWF.includes(currentDay)) {
//       allowedDays = DAYS_MWF;
//     } else if (DAYS_TTHS.includes(currentDay)) {
//       allowedDays = DAYS_TTHS;
//     } else {
//       allowedDays = DAYS_ALL;
//     }
//   }
  
//   // Try to find alternative slot
//   for (const day of allowedDays) {
//     for (let slot = 0; slot <= 12 - duration; slot++) {
//       // CRITICAL: Skip lunch slot (12-1 PM)
//       if (slot === LUNCH_SLOT || (slot < LUNCH_SLOT && slot + duration > LUNCH_SLOT)) {
//         continue; // Skip if slot is lunch or class would overlap lunch
//       }
      
//       let canUseSlot = true;
      
//       // Check all required consecutive slots
//       for (let i = 0; i < duration; i++) {
//         const slotIndex = slot + i;
        
//         // Double-check: never use lunch slot
//         if (slotIndex === LUNCH_SLOT) {
//           canUseSlot = false;
//           break;
//         }
        
//         const instrKey = `${assignment.teacher_id}-${day}-${slotIndex}`;
//         const roomKey = `${assignment.room_id}-${day}-${slotIndex}`;
//         const sectionKey = `${assignment.section_index}-${day}-${slotIndex}`;
        
//         // Check if any slot is occupied
//         if (instructorMap.has(instrKey) || roomMap.has(roomKey) || sectionMap.has(sectionKey)) {
//           canUseSlot = false;
//           break;
//         }
//       }
      
//       if (canUseSlot) {
//         return { day, slot_index: slot };
//       }
//     }
//   }
  
//   return null;
// }

// // ============================================
// // ENHANCED GPT SCHEDULING FUNCTION
// // ============================================

// async function generateScheduleWithGPT(payload, retryCount = 0) {
//   const maxRetries = 2;
//   console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');

//   if (retryCount > 0) {
//     console.log(` Retry attempt ${retryCount}/${maxRetries}`);
//   }

//   console.log('📤 Request details:');
//   console.log(' Subjects:', payload.subjects.length);
//   console.log(' Teachers:', payload.teachers.length);
//   console.log(' Rooms:', payload.rooms.length);
//   console.log(' Sections:', payload.sectionCount);
//   console.log(' Pattern:', payload.schedulePattern);

//   let allowedDays = DAYS_ALL;
//   let patternDescription = '';
//   let patternRules = '';

//   if (payload.schedulePattern === 'MWF') {
//     allowedDays = DAYS_MWF;
//     patternDescription = 'MWF Pattern: Classes meet on Monday, Wednesday, Friday ONLY';
//     patternRules = `
// **ABSOLUTE MWF PATTERN ENFORCEMENT (CRITICAL):**
// - YOU MUST USE ONLY: Monday, Wednesday, Friday
// - STRICTLY FORBIDDEN: Tuesday, Thursday, Saturday, Sunday
// - EVERY single assignment MUST have day = "Monday" OR "Wednesday" OR "Friday"
// - If you include ANY class on Tuesday, Thursday, or Saturday, the ENTIRE schedule is INVALID
// - For 3-unit courses: Schedule on MWF pattern (typically 1 hour each session)
// - For classes needing longer duration: Use multiple consecutive slots on MWF days
// - Double-check EVERY assignment before returning - NO EXCEPTIONS
// - Violation of this rule means complete schedule rejection`;
//   } else if (payload.schedulePattern === 'TTH') {
//     allowedDays = DAYS_TTHS;
//     patternDescription = 'TTHS Pattern: Classes meet on Tuesday, Thursday, Saturday ONLY';
//     patternRules = `
// **ABSOLUTE TTHS PATTERN ENFORCEMENT (CRITICAL):**
// - YOU MUST USE ONLY: Tuesday, Thursday, Saturday
// - STRICTLY FORBIDDEN: Monday, Wednesday, Friday, Sunday
// - EVERY single assignment MUST have day = "Tuesday" OR "Thursday" OR "Saturday"
// - If you include ANY class on Monday, Wednesday, or Friday, the ENTIRE schedule is INVALID
// - For 3-unit courses: Schedule on TTHS pattern with appropriate durations
// - For classes needing longer duration: Use multiple consecutive slots on TTHS days
// - Double-check EVERY assignment before returning - NO EXCEPTIONS
// - Violation of this rule means complete schedule rejection`;
//   } else {
//     patternDescription = 'BOTH Pattern: Alternating MWF and TTHS between sections';
//     patternRules = `
// **STRICT ALTERNATING PATTERN ENFORCEMENT (CRITICAL):**
// - Sections ALTERNATE between MWF and TTHS patterns
// - **Section A (index 0)**: Use TTHS pattern ONLY (Tuesday, Thursday, Saturday)
// - **Section B (index 1)**: Use MWF pattern ONLY (Monday, Wednesday, Friday)
// - **Section C (index 2)**: Use TTHS pattern ONLY (Tuesday, Thursday, Saturday)
// - **Section D (index 3)**: Use MWF pattern ONLY (Monday, Wednesday, Friday)
// - Pattern continues alternating: Even sections (0,2,4...) = TTHS, Odd sections (1,3,5...) = MWF

// **PATTERN ASSIGNMENT RULE:**
// - If section_index is EVEN (0, 2, 4, 6, 8...): Use ONLY Tuesday, Thursday, Saturday
// - If section_index is ODD (1, 3, 5, 7, 9...): Use ONLY Monday, Wednesday, Friday

// **CRITICAL VALIDATION:**
// - EVERY assignment for section_index 0 MUST be on Tue/Thu/Sat
// - EVERY assignment for section_index 1 MUST be on Mon/Wed/Fri
// - EVERY assignment for section_index 2 MUST be on Tue/Thu/Sat
// - EVERY assignment for section_index 3 MUST be on Mon/Wed/Fri
// - Check section_index % 2: if 0 use TTHS, if 1 use MWF
// - ALL subjects in a section follow the SAME pattern (the section's assigned pattern)

// **BENEFITS OF THIS APPROACH:**
// - No scheduling conflicts between sections (they meet on different days)
// - Same instructor can teach multiple sections without conflicts
// - Same room can be used by multiple sections without conflicts
// - Better resource utilization

// **FORBIDDEN:**
// ❌ Section A having ANY classes on Monday, Wednesday, or Friday
// ❌ Section B having ANY classes on Tuesday, Thursday, or Saturday
// ❌ Mixing patterns within a single section`;
//   }

//   // Build instructor assignment text with multiple instructors per subject
//   let instructorAssignmentText = '\n\n**SUBJECTS WITH ASSIGNED TEACHERS:**';
//   payload.subjects.forEach(s => {
//     instructorAssignmentText += `\n- ${s.code} (ID: ${s.id}, ${s.units} units, ${s.duration}h per session)`;
    
//     if (s.instructors && s.instructors.length > 1) {
//       instructorAssignmentText += ` → ${s.instructors.length} Instructors Available:`;
//       s.instructors.forEach((inst, idx) => {
//         instructorAssignmentText += `\n    ${idx + 1}. "${inst.teacher_name}" (ID: ${inst.teacher_id})`;
//       });
//       instructorAssignmentText += `\n    **DISTRIBUTE SMARTLY**: Assign different instructors to different sections to balance workload`;
//     } else if (s.instructors && s.instructors.length === 1) {
//       instructorAssignmentText += ` → Instructor: "${s.instructors[0].teacher_name}" (ID: ${s.instructors[0].teacher_id})`;
//     }
//   });

//   // Build detailed instructor conflict information
//   let instructorBusySlotsText = '';
//   if (payload.existingInstructorSchedules && Object.keys(payload.existingInstructorSchedules).length > 0) {
//     instructorBusySlotsText = '\n\n**CRITICAL: INSTRUCTORS ALREADY TEACHING IN OTHER COURSES (ABSOLUTE CONFLICTS):**';
//     instructorBusySlotsText += '\nThese time slots are COMPLETELY BLOCKED - instructors are teaching other courses:';
    
//     for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
//       const teacher = payload.teachers.find(t => t.id === parseInt(instructorId));
//       if (teacher) {
//         instructorBusySlotsText += `\n\n**${data.instructor_name}** (ID: ${instructorId}) - UNAVAILABLE AT:`;
        
//         const slotsByDay = {};
//         data.occupied_slots.forEach(slot => {
//           if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
//           slotsByDay[slot.day].push(slot);
//         });
        
//         for (const [day, slots] of Object.entries(slotsByDay)) {
//           instructorBusySlotsText += `\n  ${day}: `;
//           const uniqueSlots = [...new Map(slots.map(s => [s.slot_index, s])).values()];
//           instructorBusySlotsText += uniqueSlots
//             .sort((a, b) => a.slot_index - b.slot_index)
//             .map(s => `Slot ${s.slot_index} (${s.time}) teaching ${s.course_code}-${s.subject_code}`)
//             .join(', ');
//         }
//       }
//     }
    
//     instructorBusySlotsText += '\n\n**MANDATORY**: Before assigning ANY instructor, verify they are NOT in the above list for that day/time!';
//   } else {
//     instructorBusySlotsText = '\n\n**No existing instructor schedules found** - This appears to be the first course being scheduled.';
//   }

//   const systemPrompt = `You are an expert university scheduling AI with ZERO TOLERANCE for conflicts and pattern violations.

// ${patternRules}

// **CRITICAL CONSTRAINTS (ABSOLUTE REQUIREMENTS):**

// 1. **SCHEDULE PATTERN COMPLIANCE:**
//    - This is your #1 priority - NEVER violate the pattern rules above
//    - Validate EVERY assignment before including it in your response
//    - If in doubt about a day, DON'T USE IT

// 2. **INSTRUCTOR CONFLICT PREVENTION (TOP PRIORITY):**
//    - An instructor CANNOT teach multiple classes at the same time
//    - This applies ACROSS all courses (cross-course conflicts)
//    - This applies WITHIN this course (same instructor, different sections)
//    - CHECK THREE THINGS before every instructor assignment:
//      a) Is this instructor busy in another course at this time? (see existing schedules below)
//      b) Is this instructor already assigned to another section at this time?
//      c) Does this instructor have availability restrictions?

// 3. **SMART MULTI-INSTRUCTOR DISTRIBUTION (NEW):**
//    - When a subject has MULTIPLE instructors assigned, DISTRIBUTE them across sections
//    - Example: If Math has 2 instructors and 4 sections:
//      * Section A (0) → Instructor 1
//      * Section B (1) → Instructor 2
//      * Section C (2) → Instructor 1
//      * Section D (3) → Instructor 2
//    - This ensures FAIR WORKLOAD and prevents one instructor from being overloaded
//    - Use round-robin distribution pattern

// 4. **CONFLICT CHECKING ALGORITHM YOU MUST FOLLOW:**
//    Before assigning instructor to day/slot:
   
//    Step 1: Calculate slots_needed = ceil(duration)
//    Step 2: For each slot from slot_index to (slot_index + slots_needed - 1):
//            - Check existing_schedules[instructor_id][day][slot]
//            - Check current_assignments[instructor_id][day][slot]
//            - If ANY slot is occupied → SKIP this time, try next slot
//    Step 3: If all slots free → ASSIGN and mark slots as occupied
//    Step 4: Update your mental schedule map
   
//    Example: 2-hour Math class starting at slot 0 needs to check slots 0 AND 1

// 5. **SECTION STAGGERING (MANDATORY):**
//    - If Section A has instructor X at Monday 7-8, Section B CANNOT have instructor X at Monday 7-8
//    - Stagger sections to different times to avoid instructor conflicts
//    - Track each instructor's schedule across all sections as you build the timetable

// 6. **ROOM RULES:**
//    - Each section is assigned ONE dedicated room
//    - ALL subjects in a section MUST use that section's room_id
//    - No room can be used by multiple sections at the same time

// 7. **AFTERNOON DISTRIBUTION (REQUIRED):**
//    - Slots 0-4 = Morning (7 AM - 12 PM)
//    - Slot 5 = LUNCH BREAK (12 PM - 1 PM) - NEVER SCHEDULE CLASSES HERE
//    - Slots 6-11 = Afternoon (1 PM - 7 PM)
//    - MANDATE: At least 40% of classes must be in afternoon slots (6-11)
//    - DO NOT cram all classes in the morning
//    - This spreads workload and reduces conflicts

// 8. **DURATION HANDLING:**
//    - Each subject has a specific duration (e.g., 1h, 1.5h, 2h, 3h)
//    - Multi-hour classes occupy CONSECUTIVE time slots
//    - When reporting: Only include the STARTING slot_index
//    - System will automatically block consecutive slots based on duration

// ${instructorBusySlotsText}

// **VALIDATION CHECKLIST BEFORE RETURNING YOUR SCHEDULE:**
// □ Every "day" field is from allowed list: ${allowedDays.join(', ')}
// □ For BOTH pattern: Even sections (0,2,4...) use ONLY TTHS, Odd sections (1,3,5...) use ONLY MWF
// □ Section 0: ALL classes on Tue/Thu/Sat
// □ Section 1: ALL classes on Mon/Wed/Fri
// □ Section 2: ALL classes on Tue/Thu/Sat
// □ Section 3: ALL classes on Mon/Wed/Fri
// □ Multiple instructors for same subject are DISTRIBUTED across sections (not all same instructor)
// □ No instructor is scheduled during their occupied slots from other courses
// □ No instructor teaches multiple sections at the same time
// □ No room conflicts (multiple sections in same room at same time)
// □ At least 40% of assignments are in afternoon slots (6-11)
// □ All sections (0 to ${payload.sectionCount - 1}) have complete schedules
// □ Each subject appears exactly ${payload.sectionCount} times (once per section)
// □ NO assignments use slot 5 (12-1 PM lunch break)

// Return schedule as JSON array "assignments" with these exact fields:
// {
//   "subject_id": number,
//   "section_index": number (0 to ${payload.sectionCount - 1}),
//   "teacher_name": string (exact match from teacher list),
//   "room_id": number (section's assigned room_id),
//   "day": string (MUST be from: ${allowedDays.join(', ')}),
//   "slot_index": number (0-11, starting slot only)
// }`;

//   let availabilityText = '';
//   if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
//     availabilityText = '\n\n**INSTRUCTOR AVAILABILITY WINDOWS (RESPECT THESE):';
//     payload.teachers.forEach(teacher => {
//       if (teacher.availability && teacher.availability.length > 0) {
//         availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
//         availabilityText += teacher.availability.map(a =>
//           `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
//         ).join(', ');
//       }
//     });
//   }

//   const userPrompt = `Generate a complete, conflict-free schedule for ${payload.sectionCount} section(s).

// ${instructorAssignmentText}

// **ROOM ASSIGNMENTS (ONE ROOM PER SECTION):**
// ${payload.sectionRoomMap ? Object.entries(payload.sectionRoomMap).map(([secIdx, room]) => 
//   `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): MUST use Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`
// ).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id})`).join('\n')}

// ${availabilityText}

// **SCHEDULE PATTERN:** ${payload.schedulePattern}
// **ALLOWED DAYS (ONLY USE THESE):** ${allowedDays.join(', ')}
// **FORBIDDEN DAYS (NEVER USE):** ${DAYS_ALL.filter(d => !allowedDays.includes(d)).join(', ')}

// **SECTIONS:** ${payload.sectionCount} total (section_index: 0 to ${payload.sectionCount - 1})
//   - Section 0 = Section A → MUST use TTHS pattern (Tue/Thu/Sat)
//   - Section 1 = Section B → MUST use MWF pattern (Mon/Wed/Fri)
//   - Section 2 = Section C → MUST use TTHS pattern (Tue/Thu/Sat)
//   - Section 3 = Section D → MUST use MWF pattern (Mon/Wed/Fri)
//   - Pattern: Even index = TTHS, Odd index = MWF

// **TIME SLOTS:** 0-11 representing:
//   - 0 = 7-8 AM, 1 = 8-9 AM, 2 = 9-10 AM, 3 = 10-11 AM, 4 = 11 AM-12 PM
//   - 5 = 12-1 PM (LUNCH BREAK - NEVER USE THIS SLOT)
//   - 6 = 1-2 PM, 7 = 2-3 PM, 8 = 3-4 PM, 9 = 4-5 PM, 10 = 5-6 PM, 11 = 6-7 PM

// **CRITICAL LUNCH BREAK RULE:**
// ✓ NEVER schedule any class at slot 5 (12:00 PM - 1:00 PM)
// ✓ This is the lunch break - it must remain free
// ✓ If a class needs multiple hours, ensure it does NOT overlap with slot 5
// ✓ Valid morning slots: 0, 1, 2, 3, 4
// ✓ Valid afternoon slots: 6, 7, 8, 9, 10, 11

// **IMPORTANT REMINDERS:**
// ✓ When a subject has multiple instructors, DISTRIBUTE them across sections (round-robin)
// ✓ Use ONLY the assigned teachers for each subject (exact name match)
// ✓ Each section gets ONE dedicated room for ALL its subjects
// ✓ Check instructor availability before EVERY assignment
// ✓ Stagger sections - don't duplicate instructor times
// ✓ Use afternoon slots (6-11) for at least 40% of classes - NOT slot 5!
// ✓ NEVER use slot 5 (12-1 PM) - this is lunch break
// ✓ For multi-hour classes, only report starting slot_index and ensure it doesn't overlap slot 5
// ✓ Generate schedules for ALL ${payload.sectionCount} section(s)
// ✓ Each subject appears exactly ${payload.sectionCount} times in output
// ✓ ABSOLUTE: Every day must be from allowed list: ${allowedDays.join(', ')}
// ✓ ABSOLUTE: No assignments with slot_index = 5 or that would overlap with slot 5

// **FINAL CHECK:** Before returning, verify:
// 1. Count how many assignments use forbidden days. If > 0, FIX THEM!
// 2. Count how many assignments use slot_index = 5 (lunch). If > 0, FIX THEM!
// 3. Check if any multi-hour class overlaps with slot 5. If yes, FIX THEM!
// 4. For BOTH pattern: Verify section 0,2,4... are ALL on TTHS, section 1,3,5... are ALL on MWF
// 5. Check section_index % 2 for each assignment to confirm correct pattern

// Generate the complete schedule now. Return ONLY valid JSON with "assignments" array. No markdown, no explanations.`;

//   try {
//     const startTime = Date.now();

//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.2,
//       max_tokens: 4000
//     });

//     const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
//     console.log(`⏱️ GPT responded in ${elapsedTime}s`);

//     const responseText = completion.choices[0].message.content;
//     console.log('📝 GPT Response received, parsing...');

//     let parsed = JSON.parse(responseText);

//     let assignments = [];
//     if (parsed.assignments && Array.isArray(parsed.assignments)) {
//       assignments = parsed.assignments;
//     } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
//       assignments = parsed.schedule;
//     } else if (Array.isArray(parsed)) {
//       assignments = parsed;
//     } else {
//       throw new Error('GPT response does not contain assignments array');
//     }

//     console.log(`📊 GPT generated ${assignments.length} assignments`);

//     // Check section distribution
//     const sectionCounts = {};
//     assignments.forEach(a => {
//       sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
//     });
//     console.log('📊 Section distribution:', sectionCounts);

//     const missingSections = [];
//     for (let i = 0; i < payload.sectionCount; i++) {
//       if (!sectionCounts[i]) {
//         missingSections.push(i);
//       }
//     }
//     if (missingSections.length > 0) {
//       console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
//     }

//     // CRITICAL: Apply strict validation and conflict resolution
//     console.log('🔒 Applying strict validation...');
    
//     // Remove any assignments that use lunch slot
//     const beforeLunchFilter = assignments.length;
//     assignments = assignments.filter(a => {
//       if (a.slot_index === LUNCH_SLOT) {
//         console.warn(`⚠️ Removed assignment at lunch slot (12-1 PM): ${a.subject_id} on ${a.day}`);
//         return false;
//       }
      
//       // Check if multi-hour class overlaps with lunch
//       const subject = payload.subjects.find(s => s.id === a.subject_id);
//       const duration = subject ? Math.ceil(subject.duration) : 1;
//       if (a.slot_index < LUNCH_SLOT && a.slot_index + duration > LUNCH_SLOT) {
//         console.warn(`⚠️ Removed assignment that overlaps lunch: ${a.subject_id} on ${a.day} slot ${a.slot_index} (${duration}h)`);
//         return false;
//       }
      
//       return true;
//     });
    
//     if (beforeLunchFilter !== assignments.length) {
//       console.log(`🍽️ Removed ${beforeLunchFilter - assignments.length} lunch-time assignments`);
//     }
    
//     assignments = strictPatternValidation(assignments, payload.schedulePattern, allowedDays);
//     assignments = validateAndFixConflicts(assignments, payload);

//     return assignments;
//   } catch (error) {
//     console.error('❌ OpenAI API Error:', error.message);

//     const isTimeout = error.message.includes('timed out');

//     if (isTimeout && retryCount < maxRetries) {
//       console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
//       await new Promise(resolve => setTimeout(resolve, 5000));
//       return generateScheduleWithGPT(payload, retryCount + 1);
//     }

//     if (isTimeout) {
//       throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts.`);
//     } else if (error.message.includes('rate_limit')) {
//       throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
//     } else if (error.message.includes('insufficient_quota')) {
//       throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check billing at https://platform.openai.com/account/billing');
//     } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
//       throw new Error('GPT scheduling failed: Invalid API key. Check OPENAI_API_KEY in .env file.');
//     } else {
//       throw new Error(`GPT scheduling failed: ${error.message}`);
//     }
//   }
// }

// // ============================================
// // MAIN GENERATE ROUTE
// // ============================================

// router.post('/generate', async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const {
//       courseId,
//       yearLevel,
//       semester,
//       studentsCount = 30,
//       sectionCount = 1,
//       subjects: subjectsPayload,
//       schedulePattern = 'BOTH',
//       considerInstructorAvailability = true,
//       major
//     } = req.body;

//     console.log('📥 Schedule generation request (Enhanced GPT Mode)');
//     console.log(' Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
//     console.log(' Pattern:', schedulePattern);
//     console.log(' Sections:', sectionCount);
//     console.log(' Major:', major || 'N/A');

//     if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
//       return res.status(400).json({
//         error: 'Missing required parameters',
//         detail: 'courseId, yearLevel, semester, and subjects array are required'
//       });
//     }

//     if (sectionCount < 1 || sectionCount > 10) {
//       return res.status(400).json({
//         error: 'Invalid section count',
//         detail: 'Section count must be between 1 and 10'
//       });
//     }

//     if (schedulePattern === 'BOTH') {
//       console.warn('⚠️ BOTH pattern selected - will enforce strict MWF/TTHS per subject');
//     }

//     console.log('🔍 Fetching teacher assignments...');
//     const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);

//     if (Object.keys(teacherAssignments).length === 0) {
//       return res.status(400).json({
//         error: 'No teacher assignments found',
//         detail: 'Please assign teachers to subjects first in the Courses page'
//       });
//     }

//     console.log('🔍 Fetching existing instructor schedules...');
//     const existingInstructorSchedules = await fetchExistingInstructorSchedules();
    
//     if (Object.keys(existingInstructorSchedules).length > 0) {
//       console.log(`📊 Found ${Object.keys(existingInstructorSchedules).length} instructors with existing schedules`);
//       for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//         console.log(`   - ${data.instructor_name}: ${data.occupied_slots.length} occupied slots`);
//       }
//     } else {
//       console.log('📊 No existing schedules - first course to be scheduled');
//     }

//     console.log('🔍 Fetching room assignments...');
//     const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);

//     if (roomAssignments.length === 0) {
//       return res.status(400).json({
//         error: 'No room assignments found',
//         detail: 'Please assign rooms in the Rooms page'
//       });
//     }

//     if (roomAssignments.length < sectionCount) {
//       return res.status(400).json({
//         error: 'Not enough rooms',
//         detail: `Need ${sectionCount} rooms for ${sectionCount} section(s). Only ${roomAssignments.length} assigned.`
//       });
//     }

//     const subjRows = await query(
//       'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
//       [subjectsPayload]
//     );

//     if (!subjRows || subjRows.length === 0) {
//       return res.status(400).json({ error: 'No matching subjects found' });
//     }

//     let instructorAvailData = {};
//     if (considerInstructorAvailability) {
//       console.log('🔍 Fetching instructor availability...');
//       instructorAvailData = await fetchInstructorAvailability();
//     }

//     // Build subjects with ALL instructors per subject
//     const subjectsWithTeachers = subjRows.map(s => {
//       const instructors = teacherAssignments[s.id];
//       if (!instructors || instructors.length === 0) {
//         throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
//       }

//       return {
//         id: s.id,
//         code: s.subject_code,
//         units: Number(s.units) || 3,
//         duration: Number(instructors[0].duration) || 1,
//         instructors: instructors // Pass all instructors
//       };
//     });

//     // Collect all unique teachers
//     const uniqueTeachers = {};
//     subjectsWithTeachers.forEach(s => {
//       s.instructors.forEach(inst => {
//         if (!uniqueTeachers[inst.teacher_name]) {
//           const availData = instructorAvailData[inst.teacher_name];
//           uniqueTeachers[inst.teacher_name] = {
//             id: inst.teacher_id,
//             name: inst.teacher_name,
//             availability: availData ? availData.slots : []
//           };
//         }
//       });
//     });

//     const teachersForScheduler = Object.values(uniqueTeachers);

//     console.log(`📊 Scheduling details:`);
//     console.log(` - Subjects: ${subjectsWithTeachers.length}`);
//     console.log(` - Teachers: ${teachersForScheduler.length}`);
//     console.log(` - Rooms: ${roomAssignments.length}`);
//     console.log(` - Sections: ${sectionCount}`);
    
//     // Log multi-instructor subjects
//     const multiInstructorSubjects = subjectsWithTeachers.filter(s => s.instructors.length > 1);
//     if (multiInstructorSubjects.length > 0) {
//       console.log(`📊 Subjects with multiple instructors:`);
//       multiInstructorSubjects.forEach(s => {
//         console.log(`   - ${s.code}: ${s.instructors.length} instructors`);
//       });
//     }

//     const sectionRoomMap = {};
//     for (let i = 0; i < sectionCount; i++) {
//       sectionRoomMap[i] = roomAssignments[i];
//       console.log(`📍 Section ${String.fromCharCode(65 + i)} → ${roomAssignments[i].room_name}`);
//     }

//     const payload = {
//       courseId: Number(courseId),
//       yearLevel: Number(yearLevel),
//       semester: String(semester),
//       studentsCount: Number(studentsCount),
//       sectionCount: Number(sectionCount),
//       subjects: subjectsWithTeachers,
//       teachers: teachersForScheduler,
//       rooms: roomAssignments,
//       sectionRoomMap: sectionRoomMap,
//       schedulePattern: schedulePattern,
//       considerInstructorAvailability: considerInstructorAvailability,
//       existingInstructorSchedules: existingInstructorSchedules
//     };

//     // Generate schedule with GPT
//     let assignments = await generateScheduleWithGPT(payload);

//     if (!assignments || assignments.length === 0) {
//       return res.status(400).json({
//         error: 'No assignments generated',
//         detail: 'GPT could not create valid assignments. Try adjusting constraints.'
//       });
//     }

//     console.log(`✅ Generated ${assignments.length} assignments`);

//     // Match teacher names to IDs and fix room assignments
//     assignments = assignments.map(a => {
//       const gptName = (a.teacher_name || '').trim();
//       let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);

//       if (!teacher) {
//         teacher = teachersForScheduler.find(t =>
//           (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
//         );
//       }

//       if (!teacher && a.subject_id) {
//         const subjectInstructors = teacherAssignments[a.subject_id];
//         if (subjectInstructors && subjectInstructors.length > 0) {
//           teacher = teachersForScheduler.find(t => t.id === subjectInstructors[0].teacher_id);
//         }
//       }

//       // Fix room assignment
//       const correctRoom = sectionRoomMap[a.section_index];
//       if (correctRoom && a.room_id !== correctRoom.room_id) {
//         console.log(`🔧 Fixed room for Section ${a.section_index}: ${correctRoom.room_name}`);
//         a.room_id = correctRoom.room_id;
//       }

//       const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//       const duration = subject ? Number(subject.duration) : 1;

//       return {
//         ...a,
//         teacher_id: teacher ? teacher.id : null,
//         instructor_name: a.teacher_name,
//         duration: duration
//       };
//     });

//     // Final validation check
//     const invalidAssignments = assignments.filter(a => !a.teacher_id);
//     if (invalidAssignments.length > 0) {
//       console.warn(`⚠️ ${invalidAssignments.length} assignments missing teacher_id`);
//       invalidAssignments.forEach(a => {
//         console.warn(`   - Subject ${a.subject_id}, Teacher: "${a.teacher_name}"`);
//       });
//     }

//     // Save to database
//     await query('START TRANSACTION');

//     try {
//       const sectionIds = [];
//       for (let i = 0; i < payload.sectionCount; i++) {
//         const sectionName = `Section ${String.fromCharCode(65 + i)}`;
//         const result = await query(
//           'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
//           [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
//         );
//         sectionIds.push(result.insertId);
//         console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
//       }

//       let savedCount = 0;
//       for (const a of assignments) {
//         const sectionId = sectionIds[a.section_index];
//         const timeSlot = TIME_SLOTS[a.slot_index];

//         if (!timeSlot || !sectionId || !a.teacher_id) {
//           console.error(`❌ Skipping invalid assignment: slot=${a.slot_index}, section=${a.section_index}, teacher=${a.teacher_id}`);
//           continue;
//         }

//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? Number(subject.duration) : 1;

//         const startTime = timeSlot.start;
//         const startHour = parseInt(startTime.split(':')[0]);
//         const endHour = startHour + duration;
//         const endTime = `${String(endHour).padStart(2, '0')}:00:00`;

//         await query(
//           `INSERT INTO schedule 
//            (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time, duration) 
//            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//           [
//             payload.courseId,
//             payload.yearLevel,
//             payload.semester,
//             sectionId,
//             a.subject_id,
//             a.teacher_id,
//             a.room_id,
//             a.day,
//             a.slot_index,
//             a.section_index,
//             startTime,
//             endTime,
//             duration
//           ]
//         );

//         savedCount++;
//       }

//       await query('COMMIT');

//       const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

//       // Final conflict check
//       const finalConflicts = {
//         instructor: [],
//         room: [],
//         crossCourse: []
//       };

//       const instructorCheck = new Map();
//       const roomCheck = new Map();

//       if (existingInstructorSchedules) {
//         for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
//           data.occupied_slots.forEach(slot => {
//             const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
//             instructorCheck.set(key, { existing: true, data: slot });
//           });
//         }
//       }

//       for (const a of assignments) {
//         const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
//         const duration = subject ? Math.ceil(subject.duration) : 1;

//         for (let i = 0; i < duration; i++) {
//           const slotIndex = a.slot_index + i;
//           if (slotIndex >= 12) continue;

//           const instrKey = `${a.teacher_id}-${a.day}-${slotIndex}`;
//           const existing = instructorCheck.get(instrKey);

//           if (existing) {
//             if (existing.existing) {
//               finalConflicts.crossCourse.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex,
//                 course: existing.data.course_code,
//                 subject: existing.data.subject_code
//               });
//             } else {
//               finalConflicts.instructor.push({
//                 instructor: a.instructor_name,
//                 day: a.day,
//                 slot: slotIndex
//               });
//             }
//           } else {
//             instructorCheck.set(instrKey, { existing: false, assignment: a });
//           }

//           const roomKey = `${a.room_id}-${a.day}-${slotIndex}`;
//           if (roomCheck.has(roomKey)) {
//             finalConflicts.room.push({
//               room: a.room_id,
//               day: a.day,
//               slot: slotIndex
//             });
//           } else {
//             roomCheck.set(roomKey, true);
//           }
//         }
//       }

//       const totalConflicts = finalConflicts.instructor.length + 
//                             finalConflicts.room.length + 
//                             finalConflicts.crossCourse.length;

//       if (totalConflicts > 0) {
//         console.warn(`⚠️ Final check found ${totalConflicts} conflicts:`);
//         console.warn(`   - Cross-course: ${finalConflicts.crossCourse.length}`);
//         console.warn(`   - Within-course instructor: ${finalConflicts.instructor.length}`);
//         console.warn(`   - Room: ${finalConflicts.room.length}`);
//       } else {
//         console.log('✅ Final check: ZERO conflicts detected!');
//       }

//       console.log(`✅ Successfully saved ${savedCount} schedule entries in ${totalTime}s`);

//       res.json({
//         success: true,
//         message: `Schedule generated for ${payload.sectionCount} section(s)${totalConflicts > 0 ? ' with ' + totalConflicts + ' conflicts' : ' with NO conflicts'}`,
//         method: 'Enhanced GPT-3.5-Turbo with Multi-Instructor Support',
//         sections: sectionIds,
//         assignments: assignments,
//         stats: {
//           totalAssignments: savedCount,
//           subjects: subjectsWithTeachers.length,
//           teachers: teachersForScheduler.length,
//           rooms: roomAssignments.length,
//           sections: sectionCount,
//           schedulePattern: schedulePattern,
//           conflictsDetected: totalConflicts,
//           crossCourseConflicts: finalConflicts.crossCourse.length,
//           withinCourseConflicts: finalConflicts.instructor.length,
//           roomConflicts: finalConflicts.room.length,
//           generationTimeSeconds: parseFloat(totalTime)
//         },
//         warnings: totalConflicts > 0 ? {
//           crossCourseConflicts: finalConflicts.crossCourse.map(c => 
//             `${c.instructor}: Teaching ${c.course}-${c.subject} conflicts with this schedule on ${c.day} slot ${c.slot}`
//           ),
//           instructorConflicts: finalConflicts.instructor.map(c =>
//             `${c.instructor}: Double-booked on ${c.day} slot ${c.slot}`
//           ),
//           roomConflicts: finalConflicts.room.map(c =>
//             `Room ${c.room}: Double-booked on ${c.day} slot ${c.slot}`
//           )
//         } : undefined
//       });

//     } catch (err) {
//       await query('ROLLBACK');
//       throw err;
//     }

//   } catch (err) {
//     console.error('❌ Error:', err);
//     try { await query('ROLLBACK'); } catch (e) { }

//     res.status(500).json({
//       error: 'Schedule generation failed',
//       detail: err.message
//     });
//   }
// });

// // ============================================
// // OTHER ROUTES
// // ============================================

// router.get("/check", async (req, res) => {
//   const { day, slot_index, courseId, yearLevel, semester } = req.query;

//   if (!day || slot_index === undefined) {
//     return res.status(400).json({ error: "Missing day or slot_index" });
//   }

//   try {
//     let sql = `
//       SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name
//       FROM schedule s
//       LEFT JOIN rooms r ON s.room_id = r.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       WHERE s.day = ? AND s.slot_index = ?
//     `;
//     let params = [day, Number(slot_index)];

//     if (courseId && yearLevel && semester) {
//       sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
//       params.push(courseId, yearLevel, semester);
//     }

//     const results = await query(sql, params);

//     res.json({
//       usedRoomIds: results.map(r => r.room_id).filter(Boolean),
//       usedInstructorIds: results.map(r => r.instructor_id).filter(Boolean),
//       usedRoomNames: results.map(r => r.room_name).filter(Boolean),
//       usedInstructorNames: results.map(r => r.instructor_name).filter(Boolean),
//       count: results.length
//     });
//   } catch (err) {
//     console.error("Error checking availability:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// router.get("/", async (req, res) => {
//   try {
//     const { courseId, yearLevel, semester } = req.query;

//     let sql = `
//       SELECT 
//         s.id, s.course_id, c.name AS course_name, c.code AS course_code,
//         CASE s.year_level
//           WHEN 1 THEN '1st Year'
//           WHEN 2 THEN '2nd Year'
//           WHEN 3 THEN '3rd Year'
//           WHEN 4 THEN '4th Year'
//           ELSE CONCAT(s.year_level, 'th Year')
//         END AS year_level,
//         CASE 
//           WHEN s.semester = '1' THEN '1st Semester'
//           WHEN s.semester = '2' THEN '2nd Semester'
//           WHEN s.semester = 'Summer' THEN 'Summer'
//           ELSE s.semester
//         END AS semester,
//         s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
//         subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
//         s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time, s.duration
//       FROM schedule s
//       LEFT JOIN courses c ON s.course_id = c.id
//       LEFT JOIN sections sec ON s.section_id = sec.id
//       LEFT JOIN subjects subj ON s.subject_id = subj.id
//       LEFT JOIN instructors i ON s.instructor_id = i.id
//       LEFT JOIN rooms r ON s.room_id = r.id
//     `;

//     const conditions = [];
//     const params = [];

//     if (courseId) {
//       conditions.push('s.course_id = ?');
//       params.push(courseId);
//     }

//     if (yearLevel) {
//       conditions.push('s.year_level = ?');
//       params.push(yearLevel);
//     }

//     if (semester) {
//       conditions.push('s.semester = ?');
//       params.push(semester);
//     }

//     if (conditions.length > 0) {
//       sql += ' WHERE ' + conditions.join(' AND ');
//     }

//     sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
//                FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//                s.slot_index`;

//     const results = await query(sql, params);
//     console.log(`✅ Fetched ${results.length} schedule entries`);
//     res.json(results);
//   } catch (err) {
//     console.error("❌ Error fetching schedules:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     console.log(`🗑️ Deleting schedule ID: ${id}`);
//     const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: "Schedule not found" });
//     }

//     console.log(`✅ Schedule deleted`);
//     res.json({ success: true, message: "Schedule deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting schedule:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
//   const { courseId, yearLevel, semester } = req.params;
//   try {
//     console.log(`🗑️ Batch delete: Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);

//     await query(
//       "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     const result = await query(
//       "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
//       [courseId, yearLevel, semester]
//     );

//     console.log(`✅ Deleted ${result.affectedRows} entries`);
//     res.json({
//       success: true,
//       message: `Deleted ${result.affectedRows} schedule entries`,
//       deletedCount: result.affectedRows
//     });
//   } catch (err) {
//     console.error("❌ Error batch deleting:", err);
//     res.status(500).json({ error: "Database error", detail: err.message });
//   }
// });

// module.exports = router;

//FUNCTIONAL BUT DIDNT BASE ON UNITS

const express = require('express');
const router = express.Router();
const db = require('../db');
const util = require('util');
const OpenAI = require('openai');
const query = util.promisify(db.query).bind(db);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

if (!process.env.OPENAI_API_KEY) {
  console.error('⚠️ WARNING: OPENAI_API_KEY not found in environment variables!');
  console.error(' Please add OPENAI_API_KEY to your .env file');
} else {
  console.log('✅ OpenAI API Key loaded successfully');

  // Test the OpenAI connection
  (async () => {
    try {
      const testResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_tokens: 5
      });
      console.log('✅ OpenAI API connection test successful');
    } catch (testErr) {
      console.error('⚠️ OpenAI API connection test failed:', testErr.message);
      if (testErr.message.includes('Incorrect API key')) {
        console.error(' Your API key appears to be invalid. Please check your .env file');
      } else if (testErr.message.includes('quota')) {
        console.error(' Your API quota may be exceeded. Check: https://platform.openai.com/account/billing');
      }
    }
  })();
}

const TIME_SLOTS = [
  { start: "07:00:00", end: "08:00:00" },
  { start: "08:00:00", end: "09:00:00" },
  { start: "09:00:00", end: "10:00:00" },
  { start: "10:00:00", end: "11:00:00" },
  { start: "11:00:00", end: "12:00:00" },
  { start: "12:00:00", end: "13:00:00" }, // LUNCH - SKIP THIS SLOT
  { start: "13:00:00", end: "14:00:00" },
  { start: "14:00:00", end: "15:00:00" },
  { start: "15:00:00", end: "16:00:00" },
  { start: "16:00:00", end: "17:00:00" },
  { start: "17:00:00", end: "18:00:00" },
  { start: "18:00:00", end: "19:00:00" }
];

const LUNCH_SLOT = 5; // 12:00 PM - 1:00 PM - NEVER USE THIS SLOT

const DAYS_MWF = ['Monday', 'Wednesday', 'Friday'];
const DAYS_TTHS = ['Tuesday', 'Thursday', 'Saturday'];
const DAYS_ALL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchInstructorAvailability() {
  try {
    const results = await query(
      `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
       FROM instructor_availability ia
       LEFT JOIN instructors i ON ia.instructor_id = i.id`
    );

    const availMap = {};
    results.forEach(row => {
      if (!availMap[row.instructor_name]) {
        availMap[row.instructor_name] = {
          instructor_id: row.instructor_id,
          slots: []
        };
      }
      availMap[row.instructor_name].slots.push({
        day: row.day,
        start_time: row.start_time,
        end_time: row.end_time
      });
    });

    return availMap;
  } catch (err) {
    console.error('Error fetching instructor availability:', err);
    return {};
  }
}

async function fetchExistingInstructorSchedules() {
  try {
    const results = await query(
      `SELECT 
        s.instructor_id,
        i.name as instructor_name,
        s.day,
        s.slot_index,
        s.start_time,
        s.end_time,
        s.duration,
        s.course_id,
        c.name as course_name,
        c.code as course_code,
        s.year_level,
        s.semester,
        subj.subject_code,
        subj.description as subject_name
       FROM schedule s
       LEFT JOIN instructors i ON s.instructor_id = i.id
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN subjects subj ON s.subject_id = subj.id
       WHERE s.instructor_id IS NOT NULL`
    );

    const scheduleMap = {};
    results.forEach(row => {
      const instructorId = row.instructor_id;
      if (!scheduleMap[instructorId]) {
        scheduleMap[instructorId] = {
          instructor_name: row.instructor_name,
          occupied_slots: []
        };
      }

      const duration = row.duration || 1;
      const slotsNeeded = Math.ceil(duration);

      for (let i = 0; i < slotsNeeded; i++) {
        const slotIndex = row.slot_index + i;
        scheduleMap[instructorId].occupied_slots.push({
          day: row.day,
          slot_index: slotIndex,
          course_code: row.course_code,
          course_name: row.course_name,
          year_level: row.year_level,
          semester: row.semester,
          subject_code: row.subject_code,
          subject_name: row.subject_name,
          time: `${row.start_time.substring(0, 5)}-${row.end_time.substring(0, 5)}`
        });
      }
    });

    return scheduleMap;
  } catch (err) {
    console.error('Error fetching existing instructor schedules:', err);
    return {};
  }
}

async function fetchTeacherAssignments(courseId, yearLevel, semester, major = null) {
  try {
    let sql = `
      SELECT
        ta.id, ta.teacher_id, ta.subject_id, ta.duration,
        i.name as teacher_name,
        s.subject_code, s.description, s.units
       FROM teacher_assignments ta
       LEFT JOIN instructors i ON ta.teacher_id = i.id
       LEFT JOIN subjects s ON ta.subject_id = s.id
       WHERE ta.course_id = ? AND ta.year_level = ? AND ta.semester = ?
    `;
    const params = [courseId, yearLevel, semester];
    if (major) {
      sql += " AND (s.major = ? OR s.major IS NULL)";
      params.push(major);
    }
    const results = await query(sql, params);

    // Group by subject_id to handle multiple instructors per subject
    const assignmentMap = {};
    results.forEach(row => {
      if (!assignmentMap[row.subject_id]) {
        assignmentMap[row.subject_id] = [];
      }
      assignmentMap[row.subject_id].push({
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        duration: row.duration || 1,
        subject_code: row.subject_code,
        units: row.units
      });
    });

    return assignmentMap;
  } catch (err) {
    console.error('Error fetching teacher assignments:', err);
    return {};
  }
}

async function fetchRoomAssignments(courseId, yearLevel, semester) {
  try {
    const results = await query(
      `SELECT
        ra.id, ra.building_id, ra.room_id,
        r.name as room_name,
        b.name as building_name
       FROM room_assignments ra
       LEFT JOIN rooms r ON ra.room_id = r.id
       LEFT JOIN buildings b ON ra.building_id = b.id
       WHERE ra.course_id = ? AND ra.year_level = ? AND ra.semester = ?`,
      [courseId, yearLevel, semester]
    );

    return results.map(row => ({
      room_id: row.room_id,
      room_name: row.room_name,
      building_id: row.building_id,
      building_name: row.building_name
    }));
  } catch (err) {
    console.error('Error fetching room assignments:', err);
    return [];
  }
}

// ============================================
// ENHANCED PATTERN VALIDATION AND ENFORCEMENT
// ============================================

function strictPatternValidation(assignments, schedulePattern, allowedDays) {
  console.log(`🔒 STRICT pattern validation: ${schedulePattern}`);
  console.log(`🔒 Allowed days: ${allowedDays.join(', ')}`);
  
  let violations = 0;
  let fixed = 0;

  // First pass: Fix individual day violations for MWF and TTHS patterns
  if (schedulePattern === 'MWF' || schedulePattern === 'TTH') {
    assignments.forEach(assignment => {
      if (!allowedDays.includes(assignment.day)) {
        violations++;
        console.warn(`⚠️ VIOLATION: ${assignment.day} not in allowed days [${allowedDays.join(', ')}]`);
        
        // Select a valid day from allowed days
        const validDay = allowedDays[Math.floor(Math.random() * allowedDays.length)];
        console.log(`   🔧 Fixed: ${assignment.day} → ${validDay}`);
        assignment.day = validDay;
        fixed++;
      }
    });
  }

  // Second pass: For BOTH pattern, ensure ALTERNATING sections use correct pattern
  if (schedulePattern === 'BOTH') {
    console.log('🔄 Enforcing ALTERNATING section patterns (Even=TTHS, Odd=MWF)');
    
    assignments.forEach(assignment => {
      const sectionIndex = assignment.section_index;
      const isEvenSection = sectionIndex % 2 === 0;
      
      // Even sections (0, 2, 4...) should use TTHS
      // Odd sections (1, 3, 5...) should use MWF
      const expectedDays = isEvenSection ? DAYS_TTHS : DAYS_MWF;
      const patternName = isEvenSection ? 'TTHS' : 'MWF';
      
      if (!expectedDays.includes(assignment.day)) {
        violations++;
        console.warn(`⚠️ VIOLATION: Section ${sectionIndex} (${patternName}) has class on ${assignment.day}`);
        
        // Fix to correct pattern
        const validDay = expectedDays[Math.floor(Math.random() * expectedDays.length)];
        console.log(`   🔧 Fixed: Section ${sectionIndex} ${assignment.day} → ${validDay} (${patternName} pattern)`);
        assignment.day = validDay;
        fixed++;
      }
    });
    
    // Verify alternating pattern is correct
    const sectionPatterns = {};
    assignments.forEach(a => {
      if (!sectionPatterns[a.section_index]) {
        sectionPatterns[a.section_index] = new Set();
      }
      sectionPatterns[a.section_index].add(a.day);
    });
    
    console.log('📊 Section pattern summary:');
    for (const [sectionIdx, daysSet] of Object.entries(sectionPatterns)) {
      const isEven = parseInt(sectionIdx) % 2 === 0;
      const expectedPattern = isEven ? 'TTHS' : 'MWF';
      const daysArray = Array.from(daysSet);
      const hasMWF = daysArray.some(d => DAYS_MWF.includes(d));
      const hasTTHS = daysArray.some(d => DAYS_TTHS.includes(d));
      
      const actualPattern = hasMWF && hasTTHS ? 'MIXED❌' : 
                           hasMWF ? 'MWF' : 
                           hasTTHS ? 'TTHS' : 'UNKNOWN';
      
      const status = actualPattern === expectedPattern ? '✅' : '❌';
      console.log(`   Section ${sectionIdx}: Expected ${expectedPattern}, Got ${actualPattern} ${status}`);
    }
  }

  console.log(`✅ Pattern validation: ${violations} violations found, ${fixed} fixed`);
  return assignments;
}

// ============================================
// COMPREHENSIVE CONFLICT DETECTION & RESOLUTION
// ============================================

function validateAndFixConflicts(assignments, payload) {
  console.log('🔍 Starting comprehensive conflict detection...');
  
  const instructorMap = new Map();
  const roomMap = new Map();
  const sectionMap = new Map();
  
  // Pre-populate with existing schedules from other courses
  if (payload.existingInstructorSchedules) {
    let preloadedCount = 0;
    for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
      data.occupied_slots.forEach(slot => {
        const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
        instructorMap.set(key, { 
          existing: true, 
          course: slot.course_code,
          subject: slot.subject_code,
          instructor: data.instructor_name
        });
        preloadedCount++;
      });
    }
    console.log(`📌 Pre-loaded ${preloadedCount} occupied slots from existing courses`);
  }

  const conflicts = [];
  
  // First pass: Detect all conflicts
  assignments.forEach((assignment, index) => {
    const subject = payload.subjects.find(s => s.id === assignment.subject_id);
    const duration = subject ? Math.ceil(subject.duration) : 1;
    
    for (let i = 0; i < duration; i++) {
      const slotIndex = assignment.slot_index + i;
      if (slotIndex >= 12) continue;
      
      // Check instructor conflicts (both cross-course and within-course)
      const instrKey = `${assignment.teacher_id}-${assignment.day}-${slotIndex}`;
      const existingInstr = instructorMap.get(instrKey);
      
      if (existingInstr) {
        conflicts.push({
          type: existingInstr.existing ? 'cross-course' : 'instructor',
          assignment,
          slotIndex,
          existing: existingInstr,
          index,
          duration
        });
      } else {
        instructorMap.set(instrKey, { 
          assignment, 
          slotIndex, 
          existing: false 
        });
      }
      
      // Check room conflicts
      const roomKey = `${assignment.room_id}-${assignment.day}-${slotIndex}`;
      const existingRoom = roomMap.get(roomKey);
      
      if (existingRoom) {
        conflicts.push({
          type: 'room',
          assignment,
          slotIndex,
          existing: existingRoom,
          index,
          duration
        });
      } else {
        roomMap.set(roomKey, { assignment, slotIndex });
      }
      
      // Check section conflicts
      const sectionKey = `${assignment.section_index}-${assignment.day}-${slotIndex}`;
      const existingSection = sectionMap.get(sectionKey);
      
      if (existingSection) {
        conflicts.push({
          type: 'section',
          assignment,
          slotIndex,
          existing: existingSection,
          index,
          duration
        });
      } else {
        sectionMap.set(sectionKey, { assignment, slotIndex });
      }
    }
  });

  // Second pass: Resolve conflicts
  if (conflicts.length > 0) {
    console.warn(`⚠️ Found ${conflicts.length} conflicts. Attempting resolution...`);
    
    // Group conflicts by assignment to avoid fixing same assignment multiple times
    const conflictsByAssignment = new Map();
    conflicts.forEach(conflict => {
      const key = `${conflict.assignment.subject_id}-${conflict.assignment.section_index}`;
      if (!conflictsByAssignment.has(key)) {
        conflictsByAssignment.set(key, []);
      }
      conflictsByAssignment.get(key).push(conflict);
    });
    
    let resolved = 0;
    let unresolved = 0;
    
    conflictsByAssignment.forEach((conflictGroup, key) => {
      const conflict = conflictGroup[0]; // Use first conflict for the assignment
      const assignment = conflict.assignment;
      const subject = payload.subjects.find(s => s.id === assignment.subject_id);
      
      console.log(`   🔧 Resolving ${conflict.type} conflict for ${subject?.code || assignment.subject_id}...`);
      
      if (conflict.type === 'cross-course') {
        console.log(`      Instructor ${conflict.existing.instructor} already teaching ${conflict.existing.course} - ${conflict.existing.subject}`);
      }
      
      const newSlot = findAlternativeSlot(
        assignment,
        payload,
        instructorMap,
        roomMap,
        sectionMap
      );
      
      if (newSlot) {
        // Clear old entries
        const duration = subject ? Math.ceil(subject.duration) : 1;
        for (let i = 0; i < duration; i++) {
          const oldSlotIndex = assignment.slot_index + i;
          instructorMap.delete(`${assignment.teacher_id}-${assignment.day}-${oldSlotIndex}`);
          roomMap.delete(`${assignment.room_id}-${assignment.day}-${oldSlotIndex}`);
          sectionMap.delete(`${assignment.section_index}-${assignment.day}-${oldSlotIndex}`);
        }
        
        // Update assignment
        assignment.day = newSlot.day;
        assignment.slot_index = newSlot.slot_index;
        
        // Set new entries
        for (let i = 0; i < duration; i++) {
          const newSlotIndex = newSlot.slot_index + i;
          instructorMap.set(`${assignment.teacher_id}-${newSlot.day}-${newSlotIndex}`, { 
            assignment, 
            slotIndex: newSlotIndex, 
            existing: false 
          });
          roomMap.set(`${assignment.room_id}-${newSlot.day}-${newSlotIndex}`, { 
            assignment, 
            slotIndex: newSlotIndex 
          });
          sectionMap.set(`${assignment.section_index}-${newSlot.day}-${newSlotIndex}`, { 
            assignment, 
            slotIndex: newSlotIndex 
          });
        }
        
        console.log(`      ✅ Resolved: ${assignment.day} slot ${assignment.slot_index} → ${newSlot.day} slot ${newSlot.slot_index}`);
        resolved++;
      } else {
        console.error(`      ❌ Could not resolve conflict - no alternative slots available`);
        unresolved++;
      }
    });
    
    console.log(`✅ Conflict resolution complete: ${resolved} resolved, ${unresolved} unresolved`);
  } else {
    console.log('✅ No conflicts detected!');
  }

  return assignments;
}

function findAlternativeSlot(assignment, payload, instructorMap, roomMap, sectionMap) {
  const subject = payload.subjects.find(s => s.id === assignment.subject_id);
  const duration = subject ? Math.ceil(subject.duration) : 1;
  
  // Determine allowed days based on schedule pattern
  let allowedDays;
  if (payload.schedulePattern === 'MWF') {
    allowedDays = DAYS_MWF;
  } else if (payload.schedulePattern === 'TTH') {
    allowedDays = DAYS_TTHS;
  } else {
    // For BOTH pattern, maintain the subject's current pattern
    const currentDay = assignment.day;
    if (DAYS_MWF.includes(currentDay)) {
      allowedDays = DAYS_MWF;
    } else if (DAYS_TTHS.includes(currentDay)) {
      allowedDays = DAYS_TTHS;
    } else {
      allowedDays = DAYS_ALL;
    }
  }
  
  // Try to find alternative slot
  for (const day of allowedDays) {
    for (let slot = 0; slot <= 12 - duration; slot++) {
      // CRITICAL: Skip lunch slot (12-1 PM)
      if (slot === LUNCH_SLOT || (slot < LUNCH_SLOT && slot + duration > LUNCH_SLOT)) {
        continue; // Skip if slot is lunch or class would overlap lunch
      }
      
      let canUseSlot = true;
      
      // Check all required consecutive slots
      for (let i = 0; i < duration; i++) {
        const slotIndex = slot + i;
        
        // Double-check: never use lunch slot
        if (slotIndex === LUNCH_SLOT) {
          canUseSlot = false;
          break;
        }
        
        const instrKey = `${assignment.teacher_id}-${day}-${slotIndex}`;
        const roomKey = `${assignment.room_id}-${day}-${slotIndex}`;
        const sectionKey = `${assignment.section_index}-${day}-${slotIndex}`;
        
        // Check if any slot is occupied
        if (instructorMap.has(instrKey) || roomMap.has(roomKey) || sectionMap.has(sectionKey)) {
          canUseSlot = false;
          break;
        }
      }
      
      if (canUseSlot) {
        return { day, slot_index: slot };
      }
    }
  }
  
  return null;
}

// ============================================
// ENHANCED GPT SCHEDULING FUNCTION
// ============================================

async function generateScheduleWithGPT(payload, retryCount = 0) {
  const maxRetries = 2;
  console.log('🤖 Using OpenAI GPT-3.5-Turbo for schedule generation...');

  if (retryCount > 0) {
    console.log(` Retry attempt ${retryCount}/${maxRetries}`);
  }

  console.log('📤 Request details:');
  console.log(' Subjects:', payload.subjects.length);
  console.log(' Teachers:', payload.teachers.length);
  console.log(' Rooms:', payload.rooms.length);
  console.log(' Sections:', payload.sectionCount);
  console.log(' Pattern:', payload.schedulePattern);

  let allowedDays = DAYS_ALL;
  let patternDescription = '';
  let patternRules = '';

  if (payload.schedulePattern === 'MWF') {
    allowedDays = DAYS_MWF;
    patternDescription = 'MWF Pattern: Classes meet on Monday, Wednesday, Friday ONLY';
    patternRules = `
**ABSOLUTE MWF PATTERN ENFORCEMENT (CRITICAL):**
- YOU MUST USE ONLY: Monday, Wednesday, Friday
- STRICTLY FORBIDDEN: Tuesday, Thursday, Saturday, Sunday
- EVERY single assignment MUST have day = "Monday" OR "Wednesday" OR "Friday"
- If you include ANY class on Tuesday, Thursday, or Saturday, the ENTIRE schedule is INVALID
- For 3-unit courses: Schedule on MWF pattern (typically 1 hour each session)
- For classes needing longer duration: Use multiple consecutive slots on MWF days
- Double-check EVERY assignment before returning - NO EXCEPTIONS
- Violation of this rule means complete schedule rejection`;
  } else if (payload.schedulePattern === 'TTH') {
    allowedDays = DAYS_TTHS;
    patternDescription = 'TTHS Pattern: Classes meet on Tuesday, Thursday, Saturday ONLY';
    patternRules = `
**ABSOLUTE TTHS PATTERN ENFORCEMENT (CRITICAL):**
- YOU MUST USE ONLY: Tuesday, Thursday, Saturday
- STRICTLY FORBIDDEN: Monday, Wednesday, Friday, Sunday
- EVERY single assignment MUST have day = "Tuesday" OR "Thursday" OR "Saturday"
- If you include ANY class on Monday, Wednesday, or Friday, the ENTIRE schedule is INVALID
- For 3-unit courses: Schedule on TTHS pattern with appropriate durations
- For classes needing longer duration: Use multiple consecutive slots on TTHS days
- Double-check EVERY assignment before returning - NO EXCEPTIONS
- Violation of this rule means complete schedule rejection`;
  } else {
    patternDescription = 'BOTH Pattern: Alternating MWF and TTHS between sections';
    patternRules = `
**STRICT ALTERNATING PATTERN ENFORCEMENT (CRITICAL):**
- Sections ALTERNATE between MWF and TTHS patterns
- **Section A (index 0)**: Use TTHS pattern ONLY (Tuesday, Thursday, Saturday)
- **Section B (index 1)**: Use MWF pattern ONLY (Monday, Wednesday, Friday)
- **Section C (index 2)**: Use TTHS pattern ONLY (Tuesday, Thursday, Saturday)
- **Section D (index 3)**: Use MWF pattern ONLY (Monday, Wednesday, Friday)
- Pattern continues alternating: Even sections (0,2,4...) = TTHS, Odd sections (1,3,5...) = MWF

**CRITICAL: DISTRIBUTE ACROSS ALL PATTERN DAYS:**
- DO NOT put all classes on just one day (e.g., all on Tuesday)
- MUST spread classes across ALL days in the pattern
- For TTHS sections: Use a mix of Tuesday, Thursday, AND Saturday
- For MWF sections: Use a mix of Monday, Wednesday, AND Friday
- Example for Section A (TTHS): Some classes on Tue, some on Thu, some on Sat
- Example for Section B (MWF): Some classes on Mon, some on Wed, some on Fri

**PATTERN ASSIGNMENT RULE:**
- If section_index is EVEN (0, 2, 4, 6, 8...): Use ONLY Tuesday, Thursday, Saturday (distribute across all 3 days)
- If section_index is ODD (1, 3, 5, 7, 9...): Use ONLY Monday, Wednesday, Friday (distribute across all 3 days)

**DISTRIBUTION STRATEGY:**
- Aim for roughly equal distribution across the 3 days in each pattern
- Don't overload one day while leaving others empty
- Example: If section has 7 subjects, distribute as 2-3-2 or 3-2-2 across the 3 days

**CRITICAL VALIDATION:**
- EVERY assignment for section_index 0 MUST be on Tue/Thu/Sat
- EVERY assignment for section_index 1 MUST be on Mon/Wed/Fri
- EVERY assignment for section_index 2 MUST be on Tue/Thu/Sat
- EVERY assignment for section_index 3 MUST be on Mon/Wed/Fri
- Check section_index % 2: if 0 use TTHS, if 1 use MWF
- Verify each section uses AT LEAST 2 different days from its pattern (preferably all 3)

**BENEFITS OF THIS APPROACH:**
- No scheduling conflicts between sections (they meet on different days)
- Same instructor can teach multiple sections without conflicts
- Same room can be used by multiple sections without conflicts
- Better workload distribution across the week
- Students and teachers don't have all classes on one day

**FORBIDDEN:**
❌ Section A having ANY classes on Monday, Wednesday, or Friday
❌ Section B having ANY classes on Tuesday, Thursday, or Saturday
❌ Putting all classes for a section on just ONE day (must spread across pattern days)
❌ Section C with all classes on Tuesday only (must use Tue + Thu + Sat)
❌ Section D with all classes on Monday only (must use Mon + Wed + Fri)
❌ Mixing patterns within a single section`;
  }

  // Build instructor assignment text with multiple instructors per subject
  let instructorAssignmentText = '\n\n**SUBJECTS WITH ASSIGNED TEACHERS:**';
  payload.subjects.forEach(s => {
    instructorAssignmentText += `\n- ${s.code} (ID: ${s.id}, ${s.units} units, ${s.duration}h per session)`;
    
    if (s.instructors && s.instructors.length > 1) {
      instructorAssignmentText += ` → ${s.instructors.length} Instructors Available:`;
      s.instructors.forEach((inst, idx) => {
        instructorAssignmentText += `\n    ${idx + 1}. "${inst.teacher_name}" (ID: ${inst.teacher_id})`;
      });
      instructorAssignmentText += `\n    **DISTRIBUTE SMARTLY**: Assign different instructors to different sections to balance workload`;
    } else if (s.instructors && s.instructors.length === 1) {
      instructorAssignmentText += ` → Instructor: "${s.instructors[0].teacher_name}" (ID: ${s.instructors[0].teacher_id})`;
    }
  });

  // Build detailed instructor conflict information
  let instructorBusySlotsText = '';
  if (payload.existingInstructorSchedules && Object.keys(payload.existingInstructorSchedules).length > 0) {
    instructorBusySlotsText = '\n\n**CRITICAL: INSTRUCTORS ALREADY TEACHING IN OTHER COURSES (ABSOLUTE CONFLICTS):**';
    instructorBusySlotsText += '\nThese time slots are COMPLETELY BLOCKED - instructors are teaching other courses:';
    
    for (const [instructorId, data] of Object.entries(payload.existingInstructorSchedules)) {
      const teacher = payload.teachers.find(t => t.id === parseInt(instructorId));
      if (teacher) {
        instructorBusySlotsText += `\n\n**${data.instructor_name}** (ID: ${instructorId}) - UNAVAILABLE AT:`;
        
        const slotsByDay = {};
        data.occupied_slots.forEach(slot => {
          if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
          slotsByDay[slot.day].push(slot);
        });
        
        for (const [day, slots] of Object.entries(slotsByDay)) {
          instructorBusySlotsText += `\n  ${day}: `;
          const uniqueSlots = [...new Map(slots.map(s => [s.slot_index, s])).values()];
          instructorBusySlotsText += uniqueSlots
            .sort((a, b) => a.slot_index - b.slot_index)
            .map(s => `Slot ${s.slot_index} (${s.time}) teaching ${s.course_code}-${s.subject_code}`)
            .join(', ');
        }
      }
    }
    
    instructorBusySlotsText += '\n\n**MANDATORY**: Before assigning ANY instructor, verify they are NOT in the above list for that day/time!';
  } else {
    instructorBusySlotsText = '\n\n**No existing instructor schedules found** - This appears to be the first course being scheduled.';
  }

  const systemPrompt = `You are an expert university scheduling AI with ZERO TOLERANCE for conflicts and pattern violations.

${patternRules}

**CRITICAL CONSTRAINTS (ABSOLUTE REQUIREMENTS):**

1. **SCHEDULE PATTERN COMPLIANCE:**
   - This is your #1 priority - NEVER violate the pattern rules above
   - Validate EVERY assignment before including it in your response
   - If in doubt about a day, DON'T USE IT

2. **INSTRUCTOR CONFLICT PREVENTION (TOP PRIORITY):**
   - An instructor CANNOT teach multiple classes at the same time
   - This applies ACROSS all courses (cross-course conflicts)
   - This applies WITHIN this course (same instructor, different sections)
   - CHECK THREE THINGS before every instructor assignment:
     a) Is this instructor busy in another course at this time? (see existing schedules below)
     b) Is this instructor already assigned to another section at this time?
     c) Does this instructor have availability restrictions?

3. **SMART MULTI-INSTRUCTOR DISTRIBUTION (NEW):**
   - When a subject has MULTIPLE instructors assigned, DISTRIBUTE them across sections
   - Example: If Math has 2 instructors and 4 sections:
     * Section A (0) → Instructor 1
     * Section B (1) → Instructor 2
     * Section C (2) → Instructor 1
     * Section D (3) → Instructor 2
   - This ensures FAIR WORKLOAD and prevents one instructor from being overloaded
   - Use round-robin distribution pattern

4. **CONFLICT CHECKING ALGORITHM YOU MUST FOLLOW:**
   Before assigning instructor to day/slot:
   
   Step 1: Calculate slots_needed = ceil(duration)
   Step 2: For each slot from slot_index to (slot_index + slots_needed - 1):
           - Check existing_schedules[instructor_id][day][slot]
           - Check current_assignments[instructor_id][day][slot]
           - If ANY slot is occupied → SKIP this time, try next slot
   Step 3: If all slots free → ASSIGN and mark slots as occupied
   Step 4: Update your mental schedule map
   
   Example: 2-hour Math class starting at slot 0 needs to check slots 0 AND 1

5. **SECTION STAGGERING (MANDATORY):**
   - If Section A has instructor X at Monday 7-8, Section B CANNOT have instructor X at Monday 7-8
   - Stagger sections to different times to avoid instructor conflicts
   - Track each instructor's schedule across all sections as you build the timetable

6. **ROOM RULES:**
   - Each section is assigned ONE dedicated room
   - ALL subjects in a section MUST use that section's room_id
   - No room can be used by multiple sections at the same time

7. **AFTERNOON DISTRIBUTION (REQUIRED):**
   - Slots 0-4 = Morning (7 AM - 12 PM)
   - Slot 5 = LUNCH BREAK (12 PM - 1 PM) - NEVER SCHEDULE CLASSES HERE
   - Slots 6-11 = Afternoon (1 PM - 7 PM)
   - MANDATE: At least 40% of classes must be in afternoon slots (6-11)
   - DO NOT cram all classes in the morning
   - This spreads workload and reduces conflicts

8. **DURATION HANDLING:**
   - Each subject has a specific duration (e.g., 1h, 1.5h, 2h, 3h)
   - Multi-hour classes occupy CONSECUTIVE time slots
   - When reporting: Only include the STARTING slot_index
   - System will automatically block consecutive slots based on duration

${instructorBusySlotsText}

**VALIDATION CHECKLIST BEFORE RETURNING YOUR SCHEDULE:**
□ Every "day" field is from allowed list: ${allowedDays.join(', ')}
□ For BOTH pattern: Even sections (0,2,4...) use ONLY TTHS, Odd sections (1,3,5...) use ONLY MWF
□ Section 0: Classes distributed across Tue, Thu, Sat (NOT all on one day)
□ Section 1: Classes distributed across Mon, Wed, Fri (NOT all on one day)
□ Section 2: Classes distributed across Tue, Thu, Sat (NOT all on one day)
□ Section 3: Classes distributed across Mon, Wed, Fri (NOT all on one day)
□ Each section uses AT LEAST 2 different days from its pattern (ideally all 3)
□ Multiple instructors for same subject are DISTRIBUTED across sections (not all same instructor)
□ No instructor is scheduled during their occupied slots from other courses
□ No instructor teaches multiple sections at the same time
□ No room conflicts (multiple sections in same room at same time)
□ At least 40% of assignments are in afternoon slots (6-11)
□ All sections (0 to ${payload.sectionCount - 1}) have complete schedules
□ Each subject appears exactly ${payload.sectionCount} times (once per section)
□ NO assignments use slot 5 (12-1 PM lunch break)

Return schedule as JSON array "assignments" with these exact fields:
{
  "subject_id": number,
  "section_index": number (0 to ${payload.sectionCount - 1}),
  "teacher_name": string (exact match from teacher list),
  "room_id": number (section's assigned room_id),
  "day": string (MUST be from: ${allowedDays.join(', ')}),
  "slot_index": number (0-11, starting slot only)
}`;

  let availabilityText = '';
  if (payload.considerInstructorAvailability && payload.teachers.some(t => t.availability && t.availability.length > 0)) {
    availabilityText = '\n\n**INSTRUCTOR AVAILABILITY WINDOWS (RESPECT THESE):';
    payload.teachers.forEach(teacher => {
      if (teacher.availability && teacher.availability.length > 0) {
        availabilityText += `\n- ${teacher.name} (ID: ${teacher.id}): `;
        availabilityText += teacher.availability.map(a =>
          `${a.day} ${a.start_time.substring(0,5)}-${a.end_time.substring(0,5)}`
        ).join(', ');
      }
    });
  }

  const userPrompt = `Generate a complete, conflict-free schedule for ${payload.sectionCount} section(s).

${instructorAssignmentText}

**ROOM ASSIGNMENTS (ONE ROOM PER SECTION):**
${payload.sectionRoomMap ? Object.entries(payload.sectionRoomMap).map(([secIdx, room]) => 
  `- Section ${secIdx} (Section ${String.fromCharCode(65 + parseInt(secIdx))}): MUST use Room ID ${room.room_id} - ${room.room_name} (${room.building_name})`
).join('\n') : payload.rooms.map(r => `- ${r.room_name} (ID: ${r.room_id})`).join('\n')}

${availabilityText}

**SCHEDULE PATTERN:** ${payload.schedulePattern}
**ALLOWED DAYS (ONLY USE THESE):** ${allowedDays.join(', ')}
**FORBIDDEN DAYS (NEVER USE):** ${DAYS_ALL.filter(d => !allowedDays.includes(d)).join(', ')}

**SECTIONS:** ${payload.sectionCount} total (section_index: 0 to ${payload.sectionCount - 1})
  - Section 0 = Section A → MUST use TTHS pattern (Tue/Thu/Sat)
  - Section 1 = Section B → MUST use MWF pattern (Mon/Wed/Fri)
  - Section 2 = Section C → MUST use TTHS pattern (Tue/Thu/Sat)
  - Section 3 = Section D → MUST use MWF pattern (Mon/Wed/Fri)
  - Pattern: Even index = TTHS, Odd index = MWF

**TIME SLOTS:** 0-11 representing:
  - 0 = 7-8 AM, 1 = 8-9 AM, 2 = 9-10 AM, 3 = 10-11 AM, 4 = 11 AM-12 PM
  - 5 = 12-1 PM (LUNCH BREAK - NEVER USE THIS SLOT)
  - 6 = 1-2 PM, 7 = 2-3 PM, 8 = 3-4 PM, 9 = 4-5 PM, 10 = 5-6 PM, 11 = 6-7 PM

**CRITICAL LUNCH BREAK RULE:**
✓ NEVER schedule any class at slot 5 (12:00 PM - 1:00 PM)
✓ This is the lunch break - it must remain free
✓ If a class needs multiple hours, ensure it does NOT overlap with slot 5
✓ Valid morning slots: 0, 1, 2, 3, 4
✓ Valid afternoon slots: 6, 7, 8, 9, 10, 11

**IMPORTANT REMINDERS:**
✓ When a subject has multiple instructors, DISTRIBUTE them across sections (round-robin)
✓ Use ONLY the assigned teachers for each subject (exact name match)
✓ Each section gets ONE dedicated room for ALL its subjects
✓ Check instructor availability before EVERY assignment
✓ Stagger sections - don't duplicate instructor times
✓ Use afternoon slots (6-11) for at least 40% of classes - NOT slot 5!
✓ NEVER use slot 5 (12-1 PM) - this is lunch break
✓ For multi-hour classes, only report starting slot_index and ensure it doesn't overlap slot 5
✓ Generate schedules for ALL ${payload.sectionCount} section(s)
✓ Each subject appears exactly ${payload.sectionCount} times in output
✓ ABSOLUTE: Every day must be from allowed list: ${allowedDays.join(', ')}
✓ ABSOLUTE: No assignments with slot_index = 5 or that would overlap with slot 5
✓ CRITICAL: Distribute classes across ALL 3 days in the pattern (don't use just one day)
✓ For TTHS sections: Spread classes across Tuesday, Thursday, AND Saturday
✓ For MWF sections: Spread classes across Monday, Wednesday, AND Friday

**FINAL CHECK:** Before returning, verify:
1. Count how many assignments use forbidden days. If > 0, FIX THEM!
2. Count how many assignments use slot_index = 5 (lunch). If > 0, FIX THEM!
3. Check if any multi-hour class overlaps with slot 5. If yes, FIX THEM!
4. For BOTH pattern: Verify section 0,2,4... are ALL on TTHS, section 1,3,5... are ALL on MWF
5. Check section_index % 2 for each assignment to confirm correct pattern
6. Count unique days used per section - each section should use 2-3 different days (not just 1)
7. If any section uses only 1 day, redistribute classes across multiple days in the pattern

Generate the complete schedule now. Return ONLY valid JSON with "assignments" array. No markdown, no explanations.`;

  try {
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 4000
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ GPT responded in ${elapsedTime}s`);

    const responseText = completion.choices[0].message.content;
    console.log('📝 GPT Response received, parsing...');

    let parsed = JSON.parse(responseText);

    let assignments = [];
    if (parsed.assignments && Array.isArray(parsed.assignments)) {
      assignments = parsed.assignments;
    } else if (parsed.schedule && Array.isArray(parsed.schedule)) {
      assignments = parsed.schedule;
    } else if (Array.isArray(parsed)) {
      assignments = parsed;
    } else {
      throw new Error('GPT response does not contain assignments array');
    }

    console.log(`📊 GPT generated ${assignments.length} assignments`);

    // Check section distribution
    const sectionCounts = {};
    assignments.forEach(a => {
      sectionCounts[a.section_index] = (sectionCounts[a.section_index] || 0) + 1;
    });
    console.log('📊 Section distribution:', sectionCounts);

    const missingSections = [];
    for (let i = 0; i < payload.sectionCount; i++) {
      if (!sectionCounts[i]) {
        missingSections.push(i);
      }
    }
    if (missingSections.length > 0) {
      console.warn(`⚠️ Warning: Missing sections: ${missingSections.join(', ')}`);
    }

    // CRITICAL: Apply strict validation and conflict resolution
    console.log('🔒 Applying strict validation...');
    
    // Remove any assignments that use lunch slot
    const beforeLunchFilter = assignments.length;
    assignments = assignments.filter(a => {
      if (a.slot_index === LUNCH_SLOT) {
        console.warn(`⚠️ Removed assignment at lunch slot (12-1 PM): ${a.subject_id} on ${a.day}`);
        return false;
      }
      
      // Check if multi-hour class overlaps with lunch
      const subject = payload.subjects.find(s => s.id === a.subject_id);
      const duration = subject ? Math.ceil(subject.duration) : 1;
      if (a.slot_index < LUNCH_SLOT && a.slot_index + duration > LUNCH_SLOT) {
        console.warn(`⚠️ Removed assignment that overlaps lunch: ${a.subject_id} on ${a.day} slot ${a.slot_index} (${duration}h)`);
        return false;
      }
      
      return true;
    });
    
    if (beforeLunchFilter !== assignments.length) {
      console.log(`🍽️ Removed ${beforeLunchFilter - assignments.length} lunch-time assignments`);
    }
    
    assignments = strictPatternValidation(assignments, payload.schedulePattern, allowedDays);
    assignments = validateAndFixConflicts(assignments, payload);

    return assignments;
  } catch (error) {
    console.error('❌ OpenAI API Error:', error.message);

    const isTimeout = error.message.includes('timed out');

    if (isTimeout && retryCount < maxRetries) {
      console.log(`⏳ Timeout occurred, retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return generateScheduleWithGPT(payload, retryCount + 1);
    }

    if (isTimeout) {
      throw new Error(`GPT scheduling failed: Request timed out after ${maxRetries + 1} attempts.`);
    } else if (error.message.includes('rate_limit')) {
      throw new Error('GPT scheduling failed: Rate limit exceeded. Please wait a minute and try again.');
    } else if (error.message.includes('insufficient_quota')) {
      throw new Error('GPT scheduling failed: OpenAI API quota exceeded. Check billing at https://platform.openai.com/account/billing');
    } else if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
      throw new Error('GPT scheduling failed: Invalid API key. Check OPENAI_API_KEY in .env file.');
    } else {
      throw new Error(`GPT scheduling failed: ${error.message}`);
    }
  }
}

// ============================================
// MAIN GENERATE ROUTE
// ============================================

router.post('/generate', async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      courseId,
      yearLevel,
      semester,
      studentsCount = 30,
      sectionCount = 1,
      subjects: subjectsPayload,
      schedulePattern = 'BOTH',
      considerInstructorAvailability = true,
      major
    } = req.body;

    console.log('📥 Schedule generation request (Enhanced GPT Mode)');
    console.log(' Course:', courseId, 'Year:', yearLevel, 'Semester:', semester);
    console.log(' Pattern:', schedulePattern);
    console.log(' Sections:', sectionCount);
    console.log(' Major:', major || 'N/A');

    if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        detail: 'courseId, yearLevel, semester, and subjects array are required'
      });
    }

    if (sectionCount < 1 || sectionCount > 10) {
      return res.status(400).json({
        error: 'Invalid section count',
        detail: 'Section count must be between 1 and 10'
      });
    }

    if (schedulePattern === 'BOTH') {
      console.warn('⚠️ BOTH pattern selected - will enforce strict MWF/TTHS per subject');
    }

    console.log('🔍 Fetching teacher assignments...');
    const teacherAssignments = await fetchTeacherAssignments(courseId, yearLevel, semester, major);

    if (Object.keys(teacherAssignments).length === 0) {
      return res.status(400).json({
        error: 'No teacher assignments found',
        detail: 'Please assign teachers to subjects first in the Courses page'
      });
    }

    console.log('🔍 Fetching existing instructor schedules...');
    const existingInstructorSchedules = await fetchExistingInstructorSchedules();
    
    if (Object.keys(existingInstructorSchedules).length > 0) {
      console.log(`📊 Found ${Object.keys(existingInstructorSchedules).length} instructors with existing schedules`);
      for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
        console.log(`   - ${data.instructor_name}: ${data.occupied_slots.length} occupied slots`);
      }
    } else {
      console.log('📊 No existing schedules - first course to be scheduled');
    }

    console.log('🔍 Fetching room assignments...');
    const roomAssignments = await fetchRoomAssignments(courseId, yearLevel, semester);

    if (roomAssignments.length === 0) {
      return res.status(400).json({
        error: 'No room assignments found',
        detail: 'Please assign rooms in the Rooms page'
      });
    }

    if (roomAssignments.length < sectionCount) {
      return res.status(400).json({
        error: 'Not enough rooms',
        detail: `Need ${sectionCount} rooms for ${sectionCount} section(s). Only ${roomAssignments.length} assigned.`
      });
    }

    const subjRows = await query(
      'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
      [subjectsPayload]
    );

    if (!subjRows || subjRows.length === 0) {
      return res.status(400).json({ error: 'No matching subjects found' });
    }

    let instructorAvailData = {};
    if (considerInstructorAvailability) {
      console.log('🔍 Fetching instructor availability...');
      instructorAvailData = await fetchInstructorAvailability();
    }

    // Build subjects with ALL instructors per subject
    const subjectsWithTeachers = subjRows.map(s => {
      const instructors = teacherAssignments[s.id];
      if (!instructors || instructors.length === 0) {
        throw new Error(`No teacher assigned to subject: ${s.subject_code}`);
      }

      return {
        id: s.id,
        code: s.subject_code,
        units: Number(s.units) || 3,
        duration: Number(instructors[0].duration) || 1,
        instructors: instructors // Pass all instructors
      };
    });

    // Collect all unique teachers
    const uniqueTeachers = {};
    subjectsWithTeachers.forEach(s => {
      s.instructors.forEach(inst => {
        if (!uniqueTeachers[inst.teacher_name]) {
          const availData = instructorAvailData[inst.teacher_name];
          uniqueTeachers[inst.teacher_name] = {
            id: inst.teacher_id,
            name: inst.teacher_name,
            availability: availData ? availData.slots : []
          };
        }
      });
    });

    const teachersForScheduler = Object.values(uniqueTeachers);

    console.log(`📊 Scheduling details:`);
    console.log(` - Subjects: ${subjectsWithTeachers.length}`);
    console.log(` - Teachers: ${teachersForScheduler.length}`);
    console.log(` - Rooms: ${roomAssignments.length}`);
    console.log(` - Sections: ${sectionCount}`);
    
    // Log multi-instructor subjects
    const multiInstructorSubjects = subjectsWithTeachers.filter(s => s.instructors.length > 1);
    if (multiInstructorSubjects.length > 0) {
      console.log(`📊 Subjects with multiple instructors:`);
      multiInstructorSubjects.forEach(s => {
        console.log(`   - ${s.code}: ${s.instructors.length} instructors`);
      });
    }

    const sectionRoomMap = {};
    for (let i = 0; i < sectionCount; i++) {
      sectionRoomMap[i] = roomAssignments[i];
      console.log(`📍 Section ${String.fromCharCode(65 + i)} → ${roomAssignments[i].room_name}`);
    }

    const payload = {
      courseId: Number(courseId),
      yearLevel: Number(yearLevel),
      semester: String(semester),
      studentsCount: Number(studentsCount),
      sectionCount: Number(sectionCount),
      subjects: subjectsWithTeachers,
      teachers: teachersForScheduler,
      rooms: roomAssignments,
      sectionRoomMap: sectionRoomMap,
      schedulePattern: schedulePattern,
      considerInstructorAvailability: considerInstructorAvailability,
      existingInstructorSchedules: existingInstructorSchedules
    };

    // Generate schedule with GPT
    let assignments = await generateScheduleWithGPT(payload);

    if (!assignments || assignments.length === 0) {
      return res.status(400).json({
        error: 'No assignments generated',
        detail: 'GPT could not create valid assignments. Try adjusting constraints.'
      });
    }

    console.log(`✅ Generated ${assignments.length} assignments`);

    // Match teacher names to IDs and fix room assignments
    assignments = assignments.map(a => {
      const gptName = (a.teacher_name || '').trim();
      let teacher = teachersForScheduler.find(t => (t.name || '').trim() === gptName);

      if (!teacher) {
        teacher = teachersForScheduler.find(t =>
          (t.name || '').trim().toLowerCase() === gptName.toLowerCase()
        );
      }

      if (!teacher && a.subject_id) {
        const subjectInstructors = teacherAssignments[a.subject_id];
        if (subjectInstructors && subjectInstructors.length > 0) {
          teacher = teachersForScheduler.find(t => t.id === subjectInstructors[0].teacher_id);
        }
      }

      // Fix room assignment
      const correctRoom = sectionRoomMap[a.section_index];
      if (correctRoom && a.room_id !== correctRoom.room_id) {
        console.log(`🔧 Fixed room for Section ${a.section_index}: ${correctRoom.room_name}`);
        a.room_id = correctRoom.room_id;
      }

      const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
      const duration = subject ? Number(subject.duration) : 1;

      return {
        ...a,
        teacher_id: teacher ? teacher.id : null,
        instructor_name: a.teacher_name,
        duration: duration
      };
    });

    // Final validation check
    const invalidAssignments = assignments.filter(a => !a.teacher_id);
    if (invalidAssignments.length > 0) {
      console.warn(`⚠️ ${invalidAssignments.length} assignments missing teacher_id`);
      invalidAssignments.forEach(a => {
        console.warn(`   - Subject ${a.subject_id}, Teacher: "${a.teacher_name}"`);
      });
    }

    // Save to database
    await query('START TRANSACTION');

    try {
      const sectionIds = [];
      for (let i = 0; i < payload.sectionCount; i++) {
        const sectionName = `Section ${String.fromCharCode(65 + i)}`;
        const result = await query(
          'INSERT INTO sections (course_id, year_level, semester, name, students_count) VALUES (?,?,?,?,?)',
          [payload.courseId, payload.yearLevel, payload.semester, sectionName, payload.studentsCount]
        );
        sectionIds.push(result.insertId);
        console.log(`📝 Created ${sectionName} (ID: ${result.insertId})`);
      }

      let savedCount = 0;
      for (const a of assignments) {
        const sectionId = sectionIds[a.section_index];
        const timeSlot = TIME_SLOTS[a.slot_index];

        if (!timeSlot || !sectionId || !a.teacher_id) {
          console.error(`❌ Skipping invalid assignment: slot=${a.slot_index}, section=${a.section_index}, teacher=${a.teacher_id}`);
          continue;
        }

        const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
        const duration = subject ? Number(subject.duration) : 1;

        const startTime = timeSlot.start;
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = startHour + duration;
        const endTime = `${String(endHour).padStart(2, '0')}:00:00`;

        await query(
          `INSERT INTO schedule 
           (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time, duration) 
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            payload.courseId,
            payload.yearLevel,
            payload.semester,
            sectionId,
            a.subject_id,
            a.teacher_id,
            a.room_id,
            a.day,
            a.slot_index,
            a.section_index,
            startTime,
            endTime,
            duration
          ]
        );

        savedCount++;
      }

      await query('COMMIT');

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

      // Final conflict check
      const finalConflicts = {
        instructor: [],
        room: [],
        crossCourse: []
      };

      const instructorCheck = new Map();
      const roomCheck = new Map();

      if (existingInstructorSchedules) {
        for (const [instructorId, data] of Object.entries(existingInstructorSchedules)) {
          data.occupied_slots.forEach(slot => {
            const key = `${instructorId}-${slot.day}-${slot.slot_index}`;
            instructorCheck.set(key, { existing: true, data: slot });
          });
        }
      }

      for (const a of assignments) {
        const subject = subjectsWithTeachers.find(s => s.id === a.subject_id);
        const duration = subject ? Math.ceil(subject.duration) : 1;

        for (let i = 0; i < duration; i++) {
          const slotIndex = a.slot_index + i;
          if (slotIndex >= 12) continue;

          const instrKey = `${a.teacher_id}-${a.day}-${slotIndex}`;
          const existing = instructorCheck.get(instrKey);

          if (existing) {
            if (existing.existing) {
              finalConflicts.crossCourse.push({
                instructor: a.instructor_name,
                day: a.day,
                slot: slotIndex,
                course: existing.data.course_code,
                subject: existing.data.subject_code
              });
            } else {
              finalConflicts.instructor.push({
                instructor: a.instructor_name,
                day: a.day,
                slot: slotIndex
              });
            }
          } else {
            instructorCheck.set(instrKey, { existing: false, assignment: a });
          }

          const roomKey = `${a.room_id}-${a.day}-${slotIndex}`;
          if (roomCheck.has(roomKey)) {
            finalConflicts.room.push({
              room: a.room_id,
              day: a.day,
              slot: slotIndex
            });
          } else {
            roomCheck.set(roomKey, true);
          }
        }
      }

      const totalConflicts = finalConflicts.instructor.length + 
                            finalConflicts.room.length + 
                            finalConflicts.crossCourse.length;

      if (totalConflicts > 0) {
        console.warn(`⚠️ Final check found ${totalConflicts} conflicts:`);
        console.warn(`   - Cross-course: ${finalConflicts.crossCourse.length}`);
        console.warn(`   - Within-course instructor: ${finalConflicts.instructor.length}`);
        console.warn(`   - Room: ${finalConflicts.room.length}`);
      } else {
        console.log('✅ Final check: ZERO conflicts detected!');
      }

      console.log(`✅ Successfully saved ${savedCount} schedule entries in ${totalTime}s`);

      res.json({
        success: true,
        message: `Schedule generated for ${payload.sectionCount} section(s)${totalConflicts > 0 ? ' with ' + totalConflicts + ' conflicts' : ' with NO conflicts'}`,
        method: 'Enhanced GPT-3.5-Turbo with Multi-Instructor Support',
        sections: sectionIds,
        assignments: assignments,
        stats: {
          totalAssignments: savedCount,
          subjects: subjectsWithTeachers.length,
          teachers: teachersForScheduler.length,
          rooms: roomAssignments.length,
          sections: sectionCount,
          schedulePattern: schedulePattern,
          conflictsDetected: totalConflicts,
          crossCourseConflicts: finalConflicts.crossCourse.length,
          withinCourseConflicts: finalConflicts.instructor.length,
          roomConflicts: finalConflicts.room.length,
          generationTimeSeconds: parseFloat(totalTime)
        },
        warnings: totalConflicts > 0 ? {
          crossCourseConflicts: finalConflicts.crossCourse.map(c => 
            `${c.instructor}: Teaching ${c.course}-${c.subject} conflicts with this schedule on ${c.day} slot ${c.slot}`
          ),
          instructorConflicts: finalConflicts.instructor.map(c =>
            `${c.instructor}: Double-booked on ${c.day} slot ${c.slot}`
          ),
          roomConflicts: finalConflicts.room.map(c =>
            `Room ${c.room}: Double-booked on ${c.day} slot ${c.slot}`
          )
        } : undefined
      });

    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

  } catch (err) {
    console.error('❌ Error:', err);
    try { await query('ROLLBACK'); } catch (e) { }

    res.status(500).json({
      error: 'Schedule generation failed',
      detail: err.message
    });
  }
});

// ============================================
// OTHER ROUTES
// ============================================

router.get("/check", async (req, res) => {
  const { day, slot_index, courseId, yearLevel, semester } = req.query;

  if (!day || slot_index === undefined) {
    return res.status(400).json({ error: "Missing day or slot_index" });
  }

  try {
    let sql = `
      SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name
      FROM schedule s
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN instructors i ON s.instructor_id = i.id
      WHERE s.day = ? AND s.slot_index = ?
    `;
    let params = [day, Number(slot_index)];

    if (courseId && yearLevel && semester) {
      sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
      params.push(courseId, yearLevel, semester);
    }

    const results = await query(sql, params);

    res.json({
      usedRoomIds: results.map(r => r.room_id).filter(Boolean),
      usedInstructorIds: results.map(r => r.instructor_id).filter(Boolean),
      usedRoomNames: results.map(r => r.room_name).filter(Boolean),
      usedInstructorNames: results.map(r => r.instructor_name).filter(Boolean),
      count: results.length
    });
  } catch (err) {
    console.error("Error checking availability:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const { courseId, yearLevel, semester } = req.query;

    let sql = `
      SELECT 
        s.id, s.course_id, c.name AS course_name, c.code AS course_code,
        CASE s.year_level
          WHEN 1 THEN '1st Year'
          WHEN 2 THEN '2nd Year'
          WHEN 3 THEN '3rd Year'
          WHEN 4 THEN '4th Year'
          ELSE CONCAT(s.year_level, 'th Year')
        END AS year_level,
        CASE 
          WHEN s.semester = '1' THEN '1st Semester'
          WHEN s.semester = '2' THEN '2nd Semester'
          WHEN s.semester = 'Summer' THEN 'Summer'
          ELSE s.semester
        END AS semester,
        s.section_id, sec.name AS section_name, s.subject_id, subj.subject_code,
        subj.description AS subject_name, s.instructor_id, i.name AS instructor_name,
        s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time, s.duration
      FROM schedule s
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN instructors i ON s.instructor_id = i.id
      LEFT JOIN rooms r ON s.room_id = r.id
    `;

    const conditions = [];
    const params = [];

    if (courseId) {
      conditions.push('s.course_id = ?');
      params.push(courseId);
    }

    if (yearLevel) {
      conditions.push('s.year_level = ?');
      params.push(yearLevel);
    }

    if (semester) {
      conditions.push('s.semester = ?');
      params.push(semester);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
               FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
               s.slot_index`;

    const results = await query(sql, params);
    console.log(`✅ Fetched ${results.length} schedule entries`);
    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching schedules:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    console.log(`🗑️ Deleting schedule ID: ${id}`);
    const result = await query("DELETE FROM schedule WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    console.log(`✅ Schedule deleted`);
    res.json({ success: true, message: "Schedule deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting schedule:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
  const { courseId, yearLevel, semester } = req.params;
  try {
    console.log(`🗑️ Batch delete: Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);

    await query(
      "DELETE FROM sections WHERE course_id = ? AND year_level = ? AND semester = ?",
      [courseId, yearLevel, semester]
    );

    const result = await query(
      "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
      [courseId, yearLevel, semester]
    );

    console.log(`✅ Deleted ${result.affectedRows} entries`);
    res.json({
      success: true,
      message: `Deleted ${result.affectedRows} schedule entries`,
      deletedCount: result.affectedRows
    });
  } catch (err) {
    console.error("❌ Error batch deleting:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

module.exports = router;

//NEW SCHEDULER.JS
