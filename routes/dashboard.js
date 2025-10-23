// routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // keep this same path as other routes (../db)
const util = require('util');

/**
 * Create a promisified `query(sql, params)` wrapper that works whether:
 *  - db.query uses callbacks (mysql / mysql2 without promise())
 *  - db.promise() exists (mysql2)
 *  - db.query already returns a promise
 */
function createQueryFn(db) {
  if (!db) {
    throw new Error('db connection not provided');
  }

  // mysql2 with pool.promise()
  if (db.promise && typeof db.promise === 'function') {
    return async (sql, params = []) => {
      const [rows] = await db.promise().query(sql, params);
      return rows;
    };
  }

  // If db.query already returns a promise (some wrappers)
  try {
    const maybe = db.query('SELECT 1');
    if (maybe && typeof maybe.then === 'function') {
      return async (sql, params = []) => {
        const rows = await db.query(sql, params);
        // mysql2/promise might return [rows, fields] — handle both
        if (Array.isArray(rows) && rows.length && typeof rows[0] === 'object' && !rows[0].hasOwnProperty('length')) {
          return rows;
        }
        return rows;
      };
    }
  } catch (e) {
    // ignore, fallback to promisify
  }

  // callback-style db.query -> promisify
  if (db.query && db.query.length === 3) {
    return util.promisify(db.query).bind(db);
  }

  // generic wrapper
  return (sql, params = []) =>
    new Promise((resolve, reject) => {
      try {
        db.query(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      } catch (err) {
        reject(err);
      }
    });
}

const query = createQueryFn(db);

// Helper to safely count rows in a table (returns 0 if table missing)
async function safeCount(tableName) {
  try {
    const rows = await query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
    if (Array.isArray(rows) && rows.length > 0) {
      // different drivers may return [{total: X}] or {total: X}
      const r = rows[0];
      return Number(r.total || r.count || Object.values(r)[0] || 0);
    }
    // some drivers return object directly
    if (rows && typeof rows.total === 'number') return rows.total;
    return 0;
  } catch (err) {
    // table may not exist -> return 0
    return 0;
  }
}

// Check which schedules table exists (prefer 'schedules', fallback to 'schedule')
async function detectSchedulesTable() {
  const candidates = ['schedules', 'schedule'];
  for (const t of candidates) {
    try {
      // quick existence test
      await query(`SELECT 1 FROM \`${t}\` LIMIT 1`);
      return t;
    } catch (err) {
      // continue checking other candidate names
    }
  }
  return null;
}

// categorize slot index into time-of-day buckets
function categorizeSlot(slotIndex) {
  if (typeof slotIndex !== 'number') slotIndex = Number(slotIndex) || 0;
  if (slotIndex < 4) return 'Morning';    // e.g. 8-11
  if (slotIndex < 7) return 'Afternoon';  // e.g. 12-14
  return 'Evening';                       // e.g. 15+
}

router.get('/', async (req, res) => {
  try {
    // counts (use safeCount so missing tables won't crash)
    const [instructorsCount, coursesCount, subjectsCount, roomsCount] = await Promise.all([
      safeCount('instructors'),
      safeCount('courses'),
      safeCount('subjects'),
      safeCount('rooms')
    ]);

    const schedulesTable = await detectSchedulesTable();
    const schedulesCount = schedulesTable ? await safeCount(schedulesTable) : 0;

    // faculty distribution grouped by course code (robust to missing tables)
    let facultyDistribution = [];
    try {
      const rows = await query(
        `SELECT COALESCE(c.code, 'Unassigned') AS course_code, COUNT(*) AS cnt
         FROM instructors i
         LEFT JOIN courses c ON i.course_id = c.id
         GROUP BY course_code
         ORDER BY cnt DESC`
      );
      facultyDistribution = Array.isArray(rows) ? rows.map(r => ({ course_code: r.course_code, count: Number(r.cnt) || 0 })) : [];
    } catch (err) {
      // ignore and return empty distribution
      facultyDistribution = [];
    }

    // room utilization - compute counts per slot_index then bucket into Morning/Afternoon/Evening
    const utilBuckets = { Morning: 0, Afternoon: 0, Evening: 0 };
    try {
      if (schedulesTable) {
        const slotRows = await query(`SELECT slot_index, COUNT(*) AS cnt FROM \`${schedulesTable}\` GROUP BY slot_index`);
        if (Array.isArray(slotRows)) {
          slotRows.forEach(sr => {
            const bucket = categorizeSlot(Number(sr.slot_index));
            utilBuckets[bucket] = (utilBuckets[bucket] || 0) + Number(sr.cnt || 0);
          });
        }
      }
    } catch (err) {
      // ignore - return zeros
    }

    // recent activity (last 5 schedule rows joined to human-friendly fields)
    let recent = [];
    try {
      if (schedulesTable) {
        const rows = await query(
          `SELECT s.id, s.section_id, s.subject_id, s.instructor_id, s.room_id, s.day, s.slot_index,
                  sub.subject_code, sub.description AS subject_desc,
                  sec.name AS section_name,
                  i.name AS instructor_name,
                  r.name AS room_name
           FROM \`${schedulesTable}\` s
           LEFT JOIN subjects sub ON s.subject_id = sub.id
           LEFT JOIN sections sec ON s.section_id = sec.id
           LEFT JOIN instructors i ON s.instructor_id = i.id
           LEFT JOIN rooms r ON s.room_id = r.id
           ORDER BY s.id DESC
           LIMIT 5`
        );
        recent = Array.isArray(rows)
          ? rows.map(r => ({
              id: r.id,
              section_id: r.section_id,
              section_name: r.section_name,
              subject_id: r.subject_id,
              subject_code: r.subject_code,
              subject_desc: r.subject_desc,
              instructor_id: r.instructor_id,
              instructor_name: r.instructor_name,
              room_id: r.room_id,
              room_name: r.room_name,
              day: r.day,
              slot_index: Number(r.slot_index)
            }))
          : [];
      }
    } catch (err) {
      recent = [];
    }

    // return a single payload the frontend can use for charts & counts
    return res.json({
      ok: true,
      counts: {
        instructors: Number(instructorsCount || 0),
        courses: Number(coursesCount || 0),
        subjects: Number(subjectsCount || 0),
        rooms: Number(roomsCount || 0),
        schedules: Number(schedulesCount || 0),
      },
      facultyDistribution,
      roomUtilization: utilBuckets,
      recent
    });
  } catch (err) {
    console.error('Dashboard route error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard data', detail: err.message || String(err) });
  }
});

module.exports = router;
