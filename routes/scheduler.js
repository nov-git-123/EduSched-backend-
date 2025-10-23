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

const express = require('express');
const router = express.Router();
const db = require('../db');
const util = require('util');
const fetch = require('node-fetch');

const query = util.promisify(db.query).bind(db);
const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:5001/generate';

const TIME_SLOTS = [
  { start: "07:00:00", end: "08:00:00" },
  { start: "08:00:00", end: "09:00:00" },
  { start: "09:00:00", end: "10:00:00" },
  { start: "10:00:00", end: "11:00:00" },
  { start: "11:00:00", end: "12:00:00" },
  { start: "12:00:00", end: "13:00:00" },
  { start: "13:00:00", end: "14:00:00" },
  { start: "14:00:00", end: "15:00:00" },
  { start: "15:00:00", end: "16:00:00" },
  { start: "16:00:00", end: "17:00:00" },
  { start: "17:00:00", end: "18:00:00" },
  { start: "18:00:00", end: "19:00:00" }
];

function ensureArrayIds(input) {
  if (!input) return [];
  if (!Array.isArray(input)) return [];
  return input.map(x => (typeof x === 'object' ? x.id : x)).filter(Boolean);
}

async function checkExistingConflicts(courseId, yearLevel, semester) {
  try {
    const existing = await query(
      'SELECT COUNT(*) as count FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?',
      [courseId, yearLevel, semester]
    );
    return existing[0].count > 0;
  } catch (err) {
    console.error('Error checking conflicts:', err);
    return false;
  }
}

async function validateAssignmentsWithDetails(assignments) {
  const errors = [];
  const roomUsage = new Map();
  const instructorUsage = new Map();
  const sectionUsage = new Map();
  
  // Fetch room and instructor names for better error messages
  const roomIds = [...new Set(assignments.map(a => a.room_id))];
  const instructorIds = [...new Set(assignments.map(a => a.instructor_id))];
  const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
  
  let roomNames = {};
  let instructorNames = {};
  let subjectNames = {};
  
  try {
    if (roomIds.length > 0) {
      const rooms = await query('SELECT id, name FROM rooms WHERE id IN (?)', [roomIds]);
      rooms.forEach(r => { roomNames[r.id] = r.name; });
    }
    
    if (instructorIds.length > 0) {
      const instructors = await query('SELECT id, name FROM instructors WHERE id IN (?)', [instructorIds]);
      instructors.forEach(i => { instructorNames[i.id] = i.name; });
    }
    
    if (subjectIds.length > 0) {
      const subjects = await query('SELECT id, subject_code FROM subjects WHERE id IN (?)', [subjectIds]);
      subjects.forEach(s => { subjectNames[s.id] = s.subject_code; });
    }
  } catch (err) {
    console.error('Error fetching validation details:', err);
  }
  
  assignments.forEach((a, idx) => {
    const roomName = roomNames[a.room_id] || `Room-${a.room_id}`;
    const instructorName = instructorNames[a.instructor_id] || `Instructor-${a.instructor_id}`;
    const subjectName = subjectNames[a.subject_id] || `Subject-${a.subject_id}`;
    const timeSlot = TIME_SLOTS[a.slot_index];
    const timeStr = timeSlot ? `${timeSlot.start.substring(0,5)}-${timeSlot.end.substring(0,5)}` : `Slot ${a.slot_index}`;
    
    // Check room conflicts
    const roomKey = `${a.room_id}-${a.day}-${a.slot_index}`;
    if (roomUsage.has(roomKey)) {
      const existing = roomUsage.get(roomKey);
      errors.push({
        type: 'room',
        message: `Room "${roomName}" is double-booked on ${a.day} at ${timeStr}`,
        details: `Conflict: ${existing.subjectName} (Section ${String.fromCharCode(65 + existing.section_index)}) vs ${subjectName} (Section ${String.fromCharCode(65 + a.section_index)})`
      });
    }
    roomUsage.set(roomKey, { ...a, roomName, subjectName });
    
    // Check instructor conflicts
    const instrKey = `${a.instructor_id}-${a.day}-${a.slot_index}`;
    if (instructorUsage.has(instrKey)) {
      const existing = instructorUsage.get(instrKey);
      errors.push({
        type: 'instructor',
        message: `Instructor "${instructorName}" is scheduled twice on ${a.day} at ${timeStr}`,
        details: `Teaching: ${existing.subjectName} (Section ${String.fromCharCode(65 + existing.section_index)}) and ${subjectName} (Section ${String.fromCharCode(65 + a.section_index)})`
      });
    }
    instructorUsage.set(instrKey, { ...a, instructorName, subjectName });
    
    // Check section conflicts
    const sectionKey = `${a.section_index}-${a.day}-${a.slot_index}`;
    if (sectionUsage.has(sectionKey)) {
      const existing = sectionUsage.get(sectionKey);
      const sectionName = String.fromCharCode(65 + a.section_index);
      errors.push({
        type: 'section',
        message: `Section ${sectionName} has overlapping classes on ${a.day} at ${timeStr}`,
        details: `Both: ${existing.subjectName} (${existing.instructorName}) and ${subjectName} (${instructorName})`
      });
    }
    sectionUsage.set(sectionKey, { ...a, subjectName, instructorName });
  });
  
  return { valid: errors.length === 0, errors };
}

// Fetch instructor availability from database
async function fetchInstructorAvailability() {
  try {
    const results = await query(
      `SELECT ia.instructor_id, ia.day, ia.start_time, ia.end_time, i.name as instructor_name
       FROM instructor_availability ia
       LEFT JOIN instructors i ON ia.instructor_id = i.id`
    );
    
    // Group by instructor_id
    const availMap = {};
    results.forEach(row => {
      if (!availMap[row.instructor_id]) {
        availMap[row.instructor_id] = {
          name: row.instructor_name,
          slots: []
        };
      }
      availMap[row.instructor_id].slots.push({
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

router.post('/generate', async (req, res) => {
  try {
    const {
      courseId,
      yearLevel,
      semester,
      studentsCount = 30,
      sectionCount = 1,
      subjects: subjectsPayload,
      instructors: instructorsPayload,
      considerInstructorAvailability = true
    } = req.body;

    console.log('📥 Generate request received');
    console.log('   Consider Availability:', considerInstructorAvailability);

    // Validation
    if (!courseId || !yearLevel || !semester || !Array.isArray(subjectsPayload) || subjectsPayload.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        detail: 'courseId, yearLevel, semester, and subjects are required'
      });
    }

    const subjectIds = ensureArrayIds(subjectsPayload);
    if (subjectIds.length === 0) {
      return res.status(400).json({ error: 'No valid subject IDs provided' });
    }

    // Check for existing schedules
    const hasConflicts = await checkExistingConflicts(courseId, yearLevel, semester);
    if (hasConflicts) {
      console.log('⚠️ Warning: Existing schedule found for this course/year/semester');
    }

    // Fetch subjects with room names
    const subjRows = await query(
      'SELECT id, subject_code, description, units FROM subjects WHERE id IN (?)',
      [subjectIds]
    );

    if (!Array.isArray(subjRows) || subjRows.length === 0) {
      return res.status(400).json({ error: 'No matching subjects found in database' });
    }

    // Process instructors payload
    let instructorIdsFromBody = [];
    let availabilityStatusMap = {};
    
    if (Array.isArray(instructorsPayload)) {
      instructorsPayload.forEach(item => {
        const id = typeof item === 'object' ? item.id : item;
        instructorIdsFromBody.push(id);
        if (typeof item === 'object') {
          availabilityStatusMap[id] = item.available !== false;
        } else {
          availabilityStatusMap[id] = true;
        }
      });
    }
    
    if (instructorIdsFromBody.length === 0) {
      return res.status(400).json({
        error: 'No instructors selected',
        detail: 'Please select at least one instructor for this course'
      });
    }

    // Fetch instructor details
    const instructorRows = await query(
      'SELECT id, name FROM instructors WHERE id IN (?)',
      [instructorIdsFromBody]
    );

    if (!Array.isArray(instructorRows) || instructorRows.length === 0) {
      return res.status(400).json({
        error: 'Selected instructors not found',
        detail: 'The instructors you selected do not exist in the database'
      });
    }

    // Fetch rooms with names
    const rooms = await query('SELECT id, name FROM rooms');
    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({
        error: 'No rooms available',
        detail: 'Please add rooms to the system before generating schedules'
      });
    }

    console.log(`📊 Course ${courseId}, Year ${yearLevel}, Semester ${semester}`);
    console.log(`   Subjects: ${subjRows.length}, Instructors: ${instructorRows.length}, Rooms: ${rooms.length}, Sections: ${sectionCount}`);
    console.log(`   Room names: ${rooms.map(r => r.name).join(', ')}`);

    // Fetch availability data from database
    let instructorAvailData = {};
    let availableInstructorIds = instructorIdsFromBody;
    
    if (considerInstructorAvailability) {
      console.log('🔍 Fetching instructor availability data...');
      instructorAvailData = await fetchInstructorAvailability();
      
      // Filter to only instructors marked as available AND have availability data
      availableInstructorIds = instructorIdsFromBody.filter(id => {
        const markedAvailable = availabilityStatusMap[id] === true;
        const hasAvailabilityData = instructorAvailData[id] !== undefined;
        return markedAvailable && hasAvailabilityData;
      });
      
      if (availableInstructorIds.length === 0) {
        return res.status(400).json({
          error: 'No available instructors',
          detail: 'None of the selected instructors have availability data. Please add availability records or disable availability constraints.'
        });
      }
      
      console.log(`✅ Filtered to ${availableInstructorIds.length} available instructors with data`);
    }

    // Build payload for Python scheduler with availability constraints
    const instructorsForScheduler = instructorRows
      .filter(i => availableInstructorIds.includes(i.id))
      .map(i => {
        const availData = instructorAvailData[i.id];
        return {
          id: i.id,
          name: i.name,
          available: availabilityStatusMap[i.id] !== false,
          availability: availData ? availData.slots : []
        };
      });

    if (instructorsForScheduler.length === 0) {
      return res.status(400).json({
        error: 'No instructors available after filtering',
        detail: 'All selected instructors were filtered out based on availability constraints.'
      });
    }

    const payload = {
      courseId: Number(courseId),
      yearLevel: Number(yearLevel),
      semester: String(semester),
      studentsCount: Number(studentsCount) || 30,
      sectionCount: Number(sectionCount) || 1,
      subjects: subjRows.map(s => ({
        id: s.id,
        code: s.subject_code,
        units: Number(s.units) || 3
      })),
      instructors: instructorsForScheduler,
      rooms: rooms.map(r => ({ id: r.id, name: r.name })),
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      slotsPerDay: 12,
      considerInstructorAvailability: considerInstructorAvailability
    };

    console.log('🚀 Calling Python scheduler microservice...');
    const schedulerRes = await fetch(SCHEDULER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 60000
    });

    if (!schedulerRes.ok) {
      const errorText = await schedulerRes.text();
      console.error('❌ Scheduler microservice error:', errorText);
      return res.status(500).json({
        error: 'Schedule generation failed',
        detail: errorText
      });
    }

    const schedulerJson = await schedulerRes.json();
    let assignments = schedulerJson.assignments || [];

    if (assignments.length === 0) {
      return res.status(400).json({
        error: 'No assignments generated',
        detail: 'The scheduler could not create any valid assignments. Try adjusting constraints.'
      });
    }

    console.log(`✅ Scheduler returned ${assignments.length} assignments`);

    // Validate assignments with detailed conflict information
    const validation = await validateAssignmentsWithDetails(assignments);
    if (!validation.valid) {
      console.error('❌ Validation failed - conflicts detected:');
      validation.errors.forEach((err, idx) => {
        console.error(`   ${idx + 1}. [${err.type.toUpperCase()}] ${err.message}`);
        console.error(`      ${err.details}`);
      });
      
      return res.status(400).json({
        error: 'Schedule validation failed - conflicts detected',
        conflicts: validation.errors,
        conflictCount: validation.errors.length
      });
    }

    console.log('✅ Validation passed - no conflicts detected');

    // Save to database
    await query('START TRANSACTION');

    try {
      // Create sections
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

      // Save schedule entries
      let savedCount = 0;
      for (const a of assignments) {
        const sectionId = sectionIds[a.section_index] || null;
        const timeSlot = TIME_SLOTS[a.slot_index];
        
        if (!timeSlot) {
          console.error(`❌ Invalid slot_index: ${a.slot_index}`);
          continue;
        }

        await query(
          `INSERT INTO schedule 
           (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, section_index, start_time, end_time) 
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            payload.courseId,
            payload.yearLevel,
            payload.semester,
            sectionId,
            a.subject_id,
            a.instructor_id,
            a.room_id,
            a.day,
            a.slot_index,
            a.section_index,
            timeSlot.start,
            timeSlot.end
          ]
        );
        savedCount++;
      }

      await query('COMMIT');
      console.log(`✅ Successfully saved ${savedCount} schedule entries with room names`);

      res.json({
        success: true,
        message: 'Schedule generated successfully with no conflicts',
        sections: sectionIds,
        assignments: assignments,
        stats: {
          totalAssignments: savedCount,
          subjects: subjRows.length,
          instructors: instructorsForScheduler.length,
          rooms: rooms.length,
          sections: sectionCount,
          considerInstructorAvailability: considerInstructorAvailability,
          availabilityEnforced: considerInstructorAvailability,
          conflictsDetected: 0
        }
      });

    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

  } catch (err) {
    console.error('❌ Error generating schedule:', err);
    try {
      await query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('❌ Rollback error:', rollbackErr);
    }
    
    res.status(500).json({
      error: 'Server error during schedule generation',
      detail: err.message
    });
  }
});

router.get("/check", async (req, res) => {
  const { day, slot_index, courseId, yearLevel, semester } = req.query;

  if (!day || slot_index === undefined) {
    return res.status(400).json({ error: "Missing day or slot_index" });
  }

  try {
    let sql = `SELECT s.room_id, s.instructor_id, r.name as room_name, i.name as instructor_name 
               FROM schedule s
               LEFT JOIN rooms r ON s.room_id = r.id
               LEFT JOIN instructors i ON s.instructor_id = i.id
               WHERE s.day = ? AND s.slot_index = ?`;
    let params = [day, Number(slot_index)];

    if (courseId && yearLevel && semester) {
      sql += " AND s.course_id = ? AND s.year_level = ? AND s.semester = ?";
      params.push(courseId, yearLevel, semester);
    }

    const results = await query(sql, params);
    const usedRoomIds = results.map(row => row.room_id).filter(Boolean);
    const usedInstructorIds = results.map(row => row.instructor_id).filter(Boolean);
    const usedRoomNames = results.map(row => row.room_name).filter(Boolean);
    const usedInstructorNames = results.map(row => row.instructor_name).filter(Boolean);

    res.json({
      usedRoomIds,
      usedInstructorIds,
      usedRoomNames,
      usedInstructorNames,
      count: results.length
    });
  } catch (err) {
    console.error("Error checking availability:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const sql = `
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
        s.room_id, r.name AS room_name, s.day, s.slot_index, s.start_time, s.end_time
      FROM schedule s
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN subjects subj ON s.subject_id = subj.id
      LEFT JOIN instructors i ON s.instructor_id = i.id
      LEFT JOIN rooms r ON s.room_id = r.id
      ORDER BY s.course_id, s.year_level, s.semester, s.section_id, 
               FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
               s.slot_index
    `;

    const results = await query(sql);
    console.log(`✅ Fetched ${results.length} schedule entries with room names`);
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

    console.log(`✅ Schedule deleted successfully`);
    res.json({ success: true, message: "Schedule deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting schedule:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

router.delete("/batch/:courseId/:yearLevel/:semester", async (req, res) => {
  const { courseId, yearLevel, semester } = req.params;

  try {
    console.log(`🗑️ Deleting all schedules for Course ${courseId}, Year ${yearLevel}, Sem ${semester}`);
    const result = await query(
      "DELETE FROM schedule WHERE course_id = ? AND year_level = ? AND semester = ?",
      [courseId, yearLevel, semester]
    );

    console.log(`✅ Deleted ${result.affectedRows} schedule entries`);
    res.json({
      success: true,
      message: `Deleted ${result.affectedRows} schedule entries`,
      deletedCount: result.affectedRows
    });
  } catch (err) {
    console.error("❌ Error batch deleting schedules:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

module.exports = router;