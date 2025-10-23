// edusched-backend/routes/schedule.js
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Default timeslots (you can change to match your school)
 * Each slot is 90 minutes. You can extend/modify.
 */
const TIMESLOTS = [
  { start: '08:00:00', end: '09:30:00' },
  { start: '09:30:00', end: '11:00:00' },
  { start: '13:00:00', end: '14:30:00' },
  { start: '14:30:00', end: '16:00:00' }
];

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/**
 * POST /api/schedule/generate
 * Request body (optional): { yearLevel: number, semester: string }
 * Will delete existing schedule for the chosen year/semester (subjects) and re-generate.
 */
router.post('/generate', async (req, res) => {
  const { yearLevel, semester } = req.body || {};

  try {
    // 1) Fetch subjects to schedule (filter by year/semester if provided)
    let subjectQuery = 'SELECT s.id, s.course_id, s.subject_code, s.description, s.units FROM subjects s';
    const params = [];
    if (yearLevel) {
      subjectQuery += ' WHERE s.year_level = ?';
      params.push(yearLevel);
    }
    if (semester) {
      subjectQuery += params.length ? ' AND s.semester = ?' : ' WHERE s.semester = ?';
      params.push(semester);
    }
    const subjects = await db.query(subjectQuery, params);

    if (!subjects.length) {
      return res.json({ message: 'No subjects found for the selection', assigned: 0, unassigned: [] });
    }

    // 2) Fetch all instructors + their qualified courses
    const instructors = await db.query('SELECT id, name FROM instructors');
    const instructorCoursesRows = await db.query('SELECT instructor_id, course_id FROM instructor_courses');
    const instructorCoursesMap = {};
    instructorCoursesRows.forEach(r => {
      instructorCoursesMap[r.instructor_id] = instructorCoursesMap[r.instructor_id] || new Set();
      instructorCoursesMap[r.instructor_id].add(r.course_id);
    });

    // 3) Fetch availability
    const availabilityRows = await db.query('SELECT instructor_id, day, start_time, end_time FROM instructor_availability');
    const availabilityMap = {};
    availabilityRows.forEach(a => {
      availabilityMap[a.instructor_id] = availabilityMap[a.instructor_id] || [];
      availabilityMap[a.instructor_id].push(a);
    });

    // 4) Fetch rooms
    const rooms = await db.query('SELECT id, name FROM rooms');

    // Build quick lookups
    const instructorIds = instructors.map(i => i.id);
    const roomIds = rooms.map(r => r.id);

    // helper: check if instructor available for a slot (simple overlap)
    function instructorAvailableForSlot(instructorId, day, start, end) {
      const av = availabilityMap[instructorId] || [];
      for (const a of av) {
        if (a.day === day) {
          // slot included in availability (start >= a.start_time && end <= a.end_time)
          if (start >= a.start_time && end <= a.end_time) return true;
        }
      }
      return false;
    }

    // 5) Prepare assignment trackers
    const instructorAssigned = {}; // instructorAssigned[instructorId][day_start] = true
    const roomAssigned = {}; // roomAssigned[roomId][day_start] = true

    // Delete existing schedules for the provided semester/year subjects to avoid duplicates
    // (We will delete schedule entries related to the chosen subjects)
    const subjectIds = subjects.map(s => s.id);
    if (subjectIds.length) {
      await db.query('DELETE FROM schedule WHERE subject_id IN (?)', [subjectIds]);
    }

    const assignedRows = [];
    const unassigned = [];

    // 6) Build all slots (day x timeslot)
    const allSlots = [];
    for (const day of DAYS) {
      for (let t = 0; t < TIMESLOTS.length; t++) {
        const slotId = `${day}_${t}`;
        allSlots.push({ day, start: TIMESLOTS[t].start, end: TIMESLOTS[t].end, slotId, t });
      }
    }

    // 7) Greedy assignment:
    // For each subject, find first slot where there exists a qualified instructor available and an available room.
    for (const subj of subjects) {
      let scheduled = false;
      // Shuffle or iterate slots in order
      for (const slot of allSlots) {
        // find available instructors qualified for this subject's course
        for (const instId of instructorIds) {
          // check qualification: if instructorCoursesMap empty means allow any instructor (fallback)
          const qualified = (instructorCoursesMap[instId] && instructorCoursesMap[instId].has(subj.course_id)) || false;
          if (!qualified) continue;

          // check instructor availability for the slot
          if (!instructorAvailableForSlot(instId, slot.day, slot.start, slot.end)) continue;

          // check instructor not already assigned to this slot
          instructorAssigned[instId] = instructorAssigned[instId] || {};
          if (instructorAssigned[instId][slot.slotId]) continue;

          // find a free room
          let foundRoom = null;
          for (const rId of roomIds) {
            roomAssigned[rId] = roomAssigned[rId] || {};
            if (roomAssigned[rId][slot.slotId]) continue;
            foundRoom = rId;
            break;
          }
          if (!foundRoom) continue;

          // Assign: insert schedule row
          const insertResult = await db.query(
            'INSERT INTO schedule (subject_id, instructor_id, room_id, day, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
            [subj.id, instId, foundRoom, slot.day, slot.start, slot.end]
          );

          // mark assigned
          instructorAssigned[instId][slot.slotId] = true;
          roomAssigned[foundRoom][slot.slotId] = true;

          assignedRows.push({ subjectId: subj.id, instructorId: instId, roomId: foundRoom, day: slot.day, start: slot.start, end: slot.end });
          scheduled = true;
          break; // subject scheduled -> break instructor loop
        }
        if (scheduled) break; // go to next subject
      }

      if (!scheduled) {
        unassigned.push({ subjectId: subj.id, subject_code: subj.subject_code, description: subj.description });
      }
    } // end for each subject

    res.json({ message: 'Schedule generation finished', assigned: assignedRows.length, unassigned, assignedRows });
  } catch (err) {
    console.error('Error generating schedule:', err);
    res.status(500).json({ error: 'Schedule generation failed', details: err.message });
  }
});

/**
 * GET /api/schedule
 * Query options: courseId, instructorId, roomId, day
 */
router.get('/', async (req, res) => {
  try {
    const { courseId, instructorId, roomId, day } = req.query;
    // Join to show subject code/name, instructor name, room name
    let sql = `SELECT sc.id, sc.day, sc.start_time, sc.end_time,
                      s.subject_code, s.description AS subject_description,
                      i.name AS instructor_name,
                      r.name AS room_name,
                      s.course_id
               FROM schedule sc
               JOIN subjects s ON sc.subject_id = s.id
               JOIN instructors i ON sc.instructor_id = i.id
               JOIN rooms r ON sc.room_id = r.id
               WHERE 1=1`;
    const params = [];
    if (courseId) { sql += ' AND s.course_id = ?'; params.push(courseId); }
    if (instructorId) { sql += ' AND sc.instructor_id = ?'; params.push(instructorId); }
    if (roomId) { sql += ' AND sc.room_id = ?'; params.push(roomId); }
    if (day) { sql += ' AND sc.day = ?'; params.push(day); }

    sql += ' ORDER BY FIELD(sc.day, "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"), sc.start_time';

    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching schedule:', err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

module.exports = router;
