//functional
// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // Get schedule for logged-in instructor
// // Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   // Step 1: Find user by email
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err) return res.status(500).json({ error: "DB error (users)", detail: err.message });
//     if (users.length === 0) return res.status(404).json({ error: "User not found" });

//     const fullName = users[0].full_name;


//     // Step 2: Find instructor linked to this user
//     db.query("SELECT id FROM instructors WHERE name = ?", [fullName], (err, instructors) => {
//       if (err) return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
//       if (instructors.length === 0) return res.status(404).json({ error: "Instructor profile not found" });

//       const instructorId = instructors[0].id;

//       // Step 3: Fetch schedule
//       const sql = `
//         SELECT s.id, subj.description AS subject_description, c.name AS course_name, r.name AS room_name, 
//                s.day, s.slot_index AS time_slot
//         FROM schedule s
//         JOIN subjects subj ON s.subject_id = subj.id
//         JOIN courses c ON subj.course_id = c.id
//         JOIN rooms r ON s.room_id = r.id
//         WHERE s.instructor_id = ?`;

//       db.query(sql, [instructorId], (err, schedule) => {
//         if (err) return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
//         res.json(schedule);
//       });
//     });
//   });
// });


    

// module.exports = router;

// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // ✅ Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   // Step 1: Find user by email
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err) return res.status(500).json({ error: "DB error (users)", detail: err.message });
//     if (users.length === 0) return res.status(404).json({ error: "User not found" });

//     const fullName = users[0].full_name;

//     // Step 2: Find instructor linked to this user
//     db.query("SELECT id FROM instructors WHERE name = ?", [fullName], (err, instructors) => {
//       if (err) return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
//       if (instructors.length === 0) return res.status(404).json({ error: "Instructor profile not found" });

//       const instructorId = instructors[0].id;

//       // ✅ Step 3: Fetch full schedule with time and room info
//       const sql = `
//         SELECT 
//           s.id,
//           subj.description AS subject_description,
//           c.name AS course_name,
//           r.name AS room_name,
//           s.day,
//           s.start_time,
//           s.end_time,
//           s.slot_index AS time_slot
//         FROM schedule s
//         JOIN subjects subj ON s.subject_id = subj.id
//         JOIN courses c ON s.course_id = c.id
//         JOIN rooms r ON s.room_id = r.id
//         WHERE s.instructor_id = ?
//         ORDER BY 
//           FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//           s.start_time;
//       `;

//       db.query(sql, [instructorId], (err, schedule) => {
//         if (err) return res.status(500).json({ error: "DB error (schedule)", detail: err.message });

//         if (schedule.length === 0) {
//           return res.json({ error: "No schedule assigned yet." });
//         }

//         res.json(schedule);
//       });
//     });
//   });
// });

// module.exports = router;

//new add

//PRE-ORAL WORKING

// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // ✅ Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   console.log("🔍 Looking up schedule for email:", email);

//   // OPTION 1: Try linking via user_id first (if column exists)
//   const sqlWithUserId = `
//     SELECT 
//       s.id,
//       subj.description AS subject_description,
//       c.name AS course_name,
//       r.name AS room_name,
//       s.day,
//       s.start_time,
//       s.end_time,
//       s.slot_index AS time_slot
//     FROM users u
//     JOIN instructors i ON i.user_id = u.id
//     JOIN schedule s ON s.instructor_id = i.id
//     JOIN subjects subj ON s.subject_id = subj.id
//     JOIN courses c ON s.course_id = c.id
//     JOIN rooms r ON s.room_id = r.id
//     WHERE u.email = ?
//     ORDER BY 
//       FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//       s.start_time;
//   `;

//   db.query(sqlWithUserId, [email], (err, schedule) => {
//     // If user_id column doesn't exist, fall back to name matching
//     if (err && err.code === 'ER_BAD_FIELD_ERROR') {
//       console.log("⚠️ user_id column not found, falling back to name matching");
//       return fallbackNameMatching(email, res);
//     }

//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ error: "Database error", detail: err.message });
//     }

//     if (schedule.length === 0) {
//       console.log("⚠️ No schedule found for email:", email);
//       return res.json([]);
//     }

//     console.log(`✅ Found ${schedule.length} schedule entries`);
//     res.json(schedule);
//   });
// });

// // Fallback function for name-based matching
// function fallbackNameMatching(email, res) {
//   // Step 1: Find user by email
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err) {
//       console.error("❌ DB error (users):", err);
//       return res.status(500).json({ error: "DB error (users)", detail: err.message });
//     }
    
//     if (users.length === 0) {
//       console.log("❌ User not found for email:", email);
//       return res.status(404).json({ error: "User not found" });
//     }

//     const fullName = users[0].full_name;
//     console.log("✅ Found user:", fullName);

//     // Step 2: Find instructor linked to this user (case-insensitive)
//     db.query(
//       "SELECT id FROM instructors WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))",
//       [fullName],
//       (err, instructors) => {
//         if (err) {
//           console.error("❌ DB error (instructors):", err);
//           return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
//         }
        
//         if (instructors.length === 0) {
//           console.log("❌ Instructor profile not found for name:", fullName);
          
//           // 🔍 Debug: Show all instructor names
//           db.query("SELECT name FROM instructors LIMIT 10", (err, allInstructors) => {
//             if (!err) {
//               console.log("📋 Available instructors:", allInstructors.map(i => i.name));
//             }
//           });
          
//           return res.status(404).json({ 
//             error: "Instructor profile not found",
//             detail: `No instructor record found for: ${fullName}. Please contact admin to create your instructor profile.`
//           });
//         }

//         const instructorId = instructors[0].id;
//         console.log("✅ Found instructor ID:", instructorId);

//         // Step 3: Fetch schedule
//         const sql = `
//           SELECT 
//             s.id,
//             subj.description AS subject_description,
//             c.name AS course_name,
//             r.name AS room_name,
//             s.day,
//             s.start_time,
//             s.end_time,
//             s.slot_index AS time_slot
//           FROM schedule s
//           JOIN subjects subj ON s.subject_id = subj.id
//           JOIN courses c ON s.course_id = c.id
//           JOIN rooms r ON s.room_id = r.id
//           WHERE s.instructor_id = ?
//           ORDER BY 
//             FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//             s.start_time;
//         `;

//         db.query(sql, [instructorId], (err, schedule) => {
//           if (err) {
//             console.error("❌ DB error (schedule):", err);
//             return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
//           }

//           if (schedule.length === 0) {
//             console.log("⚠️ No schedule assigned for instructor ID:", instructorId);
//             return res.json([]);
//           }

//           console.log(`✅ Found ${schedule.length} schedule entries`);
//           res.json(schedule);
//         });
//       }
//     );
//   });
// }

// module.exports = router;

//WORKING WITHOUT EDIT

// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // ✅ Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   console.log("🔍 Looking up schedule for email:", email);

//   // OPTION 1: Try linking via user_id first (if column exists)
//   const sqlWithUserId = `
//     SELECT 
//       s.id,
//       c.name AS course_name,
//       c.code AS course_code,
//       sec.name AS section_name,
//       subj.subject_code,
//       subj.description AS subject_description,
//       r.name AS room_name,
//       s.day,
//       s.start_time,
//       s.end_time,
//       s.slot_index AS time_slot
//     FROM users u
//     JOIN instructors i ON i.user_id = u.id
//     JOIN schedule s ON s.instructor_id = i.id
//     JOIN subjects subj ON s.subject_id = subj.id
//     JOIN courses c ON s.course_id = c.id
//     LEFT JOIN sections sec ON s.section_id = sec.id
//     JOIN rooms r ON s.room_id = r.id
//     WHERE u.email = ?
//     ORDER BY 
//       FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//       s.start_time;
//   `;

//   db.query(sqlWithUserId, [email], (err, schedule) => {
//     // If user_id column doesn't exist, fall back to name matching
//     if (err && err.code === 'ER_BAD_FIELD_ERROR') {
//       console.log("⚠️ user_id column not found, falling back to name matching");
//       return fallbackNameMatching(email, res);
//     }

//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ error: "Database error", detail: err.message });
//     }

//     if (schedule.length === 0) {
//       console.log("⚠️ No schedule found for email:", email);
//       return res.json([]);
//     }

//     console.log(`✅ Found ${schedule.length} schedule entries`);
//     res.json(schedule);
//   });
// });

// // Fallback function for name-based matching
// function fallbackNameMatching(email, res) {
//   // Step 1: Find user by email
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err) {
//       console.error("❌ DB error (users):", err);
//       return res.status(500).json({ error: "DB error (users)", detail: err.message });
//     }
    
//     if (users.length === 0) {
//       console.log("❌ User not found for email:", email);
//       return res.status(404).json({ error: "User not found" });
//     }

//     const fullName = users[0].full_name;
//     console.log("✅ Found user:", fullName);

//     // Step 2: Find instructor linked to this user (case-insensitive)
//     db.query(
//       "SELECT id FROM instructors WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))",
//       [fullName],
//       (err, instructors) => {
//         if (err) {
//           console.error("❌ DB error (instructors):", err);
//           return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
//         }
        
//         if (instructors.length === 0) {
//           console.log("❌ Instructor profile not found for name:", fullName);
          
//           // 🔍 Debug: Show all instructor names
//           db.query("SELECT name FROM instructors LIMIT 10", (err, allInstructors) => {
//             if (!err) {
//               console.log("📋 Available instructors:", allInstructors.map(i => i.name));
//             }
//           });
          
//           return res.status(404).json({ 
//             error: "Instructor profile not found",
//             detail: `No instructor record found for: ${fullName}. Please contact admin to create your instructor profile.`
//           });
//         }

//         const instructorId = instructors[0].id;
//         console.log("✅ Found instructor ID:", instructorId);

//         // Step 3: Fetch schedule with all necessary fields
//         const sql = `
//           SELECT 
//             s.id,
//             c.name AS course_name,
//             c.code AS course_code,
//             sec.name AS section_name,
//             subj.subject_code,
//             subj.description AS subject_description,
//             r.name AS room_name,
//             s.day,
//             s.start_time,
//             s.end_time,
//             s.slot_index AS time_slot
//           FROM schedule s
//           JOIN subjects subj ON s.subject_id = subj.id
//           JOIN courses c ON s.course_id = c.id
//           LEFT JOIN sections sec ON s.section_id = sec.id
//           JOIN rooms r ON s.room_id = r.id
//           WHERE s.instructor_id = ?
//           ORDER BY 
//             FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//             s.start_time;
//         `;

//         db.query(sql, [instructorId], (err, schedule) => {
//           if (err) {
//             console.error("❌ DB error (schedule):", err);
//             return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
//           }

//           if (schedule.length === 0) {
//             console.log("⚠️ No schedule assigned for instructor ID:", instructorId);
//             return res.json([]);
//           }

//           console.log(`✅ Found ${schedule.length} schedule entries`);
//           res.json(schedule);
//         });
//       }
//     );
//   });
// }

// module.exports = router;

//WROKING WITHOUT EDIT AI

// const express = require("express");
// const router = express.Router();
// const db = require("../db");
// const OpenAI = require('openai');

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// // ✅ Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   console.log("🔍 Looking up schedule for email:", email);

//   // OPTION 1: Try linking via user_id first (if column exists)
//   const sqlWithUserId = `
//     SELECT 
//       s.id,
//       c.name AS course_name,
//       c.code AS course_code,
//       sec.name AS section_name,
//       subj.subject_code,
//       subj.description AS subject_description,
//       r.name AS room_name,
//       s.day,
//       s.start_time,
//       s.end_time,
//       s.slot_index AS time_slot
//     FROM users u
//     JOIN instructors i ON i.user_id = u.id
//     JOIN schedule s ON s.instructor_id = i.id
//     JOIN subjects subj ON s.subject_id = subj.id
//     JOIN courses c ON s.course_id = c.id
//     LEFT JOIN sections sec ON s.section_id = sec.id
//     JOIN rooms r ON s.room_id = r.id
//     WHERE u.email = ?
//     ORDER BY 
//       FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//       s.start_time;
//   `;

//   db.query(sqlWithUserId, [email], (err, schedule) => {
//     // If user_id column doesn't exist, fall back to name matching
//     if (err && err.code === 'ER_BAD_FIELD_ERROR') {
//       console.log("⚠️ user_id column not found, falling back to name matching");
//       return fallbackNameMatching(email, res);
//     }

//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ error: "Database error", detail: err.message });
//     }

//     if (schedule.length === 0) {
//       console.log("⚠️ No schedule found for email:", email);
//       return res.json([]);
//     }

//     console.log(`✅ Found ${schedule.length} schedule entries`);
//     res.json(schedule);
//   });
// });

// // ✅ UPDATE schedule entry
// router.put("/:id", (req, res) => {
//   const { id } = req.params;
//   const { schedule_pattern, available_time } = req.body;

//   console.log("🔄 Updating schedule ID:", id);
//   console.log("📝 Data:", { schedule_pattern, available_time });

//   if (!schedule_pattern || !available_time) {
//     return res.status(400).json({ 
//       success: false, 
//       message: "schedule_pattern and available_time are required" 
//     });
//   }

//   // Parse the schedule pattern to update days
//   // Example: "MW" = Monday, Wednesday; "TH" = Thursday
//   const patternMap = {
//     'M': 'Monday',
//     'T': 'Tuesday',
//     'W': 'Wednesday',
//     'TH': 'Thursday',
//     'F': 'Friday',
//     'S': 'Saturday'
//   };

//   // Convert available_time "8:00 AM" to 24-hour format "08:00:00"
//   const convertTo24Hour = (timeStr) => {
//     const [time, period] = timeStr.split(' ');
//     let [hours, minutes] = time.split(':');
//     hours = parseInt(hours);
    
//     if (period === 'PM' && hours !== 12) {
//       hours += 12;
//     } else if (period === 'AM' && hours === 12) {
//       hours = 0;
//     }
    
//     return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
//   };

//   const start_time = convertTo24Hour(available_time);
  
//   // Calculate end_time (assuming 1 hour duration)
//   const [hours, minutes] = start_time.split(':');
//   const endHour = (parseInt(hours) + 1).toString().padStart(2, '0');
//   const end_time = `${endHour}:${minutes}:00`;

//   // For now, just update the time fields
//   // You might want to handle schedule_pattern differently based on your needs
//   const sql = `
//     UPDATE schedule 
//     SET start_time = ?, end_time = ?
//     WHERE id = ?
//   `;

//   db.query(sql, [start_time, end_time, id], (err, result) => {
//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ 
//         success: false, 
//         message: "Database error", 
//         detail: err.message 
//       });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Schedule not found" 
//       });
//     }

//     console.log("✅ Schedule updated successfully");
//     res.json({ 
//       success: true, 
//       message: "Schedule updated successfully",
//       data: { id, start_time, end_time, schedule_pattern }
//     });
//   });
// });

// // ✅ DELETE schedule entry
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;

//   console.log("🗑️ Deleting schedule ID:", id);

//   const sql = "DELETE FROM schedule WHERE id = ?";

//   db.query(sql, [id], (err, result) => {
//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ 
//         success: false, 
//         message: "Database error", 
//         detail: err.message 
//       });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Schedule not found" 
//       });
//     }

//     console.log("✅ Schedule deleted successfully");
//     res.json({ 
//       success: true, 
//       message: "Schedule deleted successfully" 
//     });
//   });
// });

// // Fallback function for name-based matching
// function fallbackNameMatching(email, res) {
//   // Step 1: Find user by email
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err) {
//       console.error("❌ DB error (users):", err);
//       return res.status(500).json({ error: "DB error (users)", detail: err.message });
//     }
    
//     if (users.length === 0) {
//       console.log("❌ User not found for email:", email);
//       return res.status(404).json({ error: "User not found" });
//     }

//     const fullName = users[0].full_name;
//     console.log("✅ Found user:", fullName);

//     // Step 2: Find instructor linked to this user (case-insensitive)
//     db.query(
//       "SELECT id FROM instructors WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))",
//       [fullName],
//       (err, instructors) => {
//         if (err) {
//           console.error("❌ DB error (instructors):", err);
//           return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
//         }
        
//         if (instructors.length === 0) {
//           console.log("❌ Instructor profile not found for name:", fullName);
          
//           // 🔍 Debug: Show all instructor names
//           db.query("SELECT name FROM instructors LIMIT 10", (err, allInstructors) => {
//             if (!err) {
//               console.log("📋 Available instructors:", allInstructors.map(i => i.name));
//             }
//           });
          
//           return res.status(404).json({ 
//             error: "Instructor profile not found",
//             detail: `No instructor record found for: ${fullName}. Please contact admin to create your instructor profile.`
//           });
//         }

//         const instructorId = instructors[0].id;
//         console.log("✅ Found instructor ID:", instructorId);

//         // Step 3: Fetch schedule with all necessary fields
//         const sql = `
//           SELECT 
//             s.id,
//             c.name AS course_name,
//             c.code AS course_code,
//             sec.name AS section_name,
//             subj.subject_code,
//             subj.description AS subject_description,
//             r.name AS room_name,
//             s.day,
//             s.start_time,
//             s.end_time,
//             s.slot_index AS time_slot
//           FROM schedule s
//           JOIN subjects subj ON s.subject_id = subj.id
//           JOIN courses c ON s.course_id = c.id
//           LEFT JOIN sections sec ON s.section_id = sec.id
//           JOIN rooms r ON s.room_id = r.id
//           WHERE s.instructor_id = ?
//           ORDER BY 
//             FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//             s.start_time;
//         `;

//         db.query(sql, [instructorId], (err, schedule) => {
//           if (err) {
//             console.error("❌ DB error (schedule):", err);
//             return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
//           }

//           if (schedule.length === 0) {
//             console.log("⚠️ No schedule assigned for instructor ID:", instructorId);
//             return res.json([]);
//           }

//           console.log(`✅ Found ${schedule.length} schedule entries`);
//           res.json(schedule);
//         });
//       }
//     );
//   });
// }

// // ============================================
// // AI-POWERED AVAILABILITY CHECKER
// // ============================================
// router.post("/check-availability-ai", async (req, res) => {
//   try {
//     const {
//       schedule_id,
//       schedule_pattern,
//       days,
//       instructor_id,
//       room_id,
//       subject_code,
//       instructor_name,
//       room_name,
//       all_schedules
//     } = req.body;

//     console.log('🤖 AI Availability Check requested');
//     console.log('   Pattern:', schedule_pattern, 'Days:', days);
//     console.log('   Instructor:', instructor_name, 'Room:', room_name);

//     // Build conflict data
//     const conflicts = all_schedules
//       .filter(s => s.id !== schedule_id)
//       .filter(s => days.includes(s.day))
//       .filter(s => s.room_id === room_id || s.instructor_id === instructor_id)
//       .map(s => ({
//         day: s.day,
//         time: `${s.start_time}-${s.end_time}`,
//         slot_index: s.slot_index,
//         subject: s.subject_code || s.subject_name,
//         instructor: s.instructor_name,
//         room: s.room_name,
//         conflict_type: s.room_id === room_id ? 'room' : 'instructor'
//       }));

//     const systemPrompt = `You are an intelligent schedule optimizer. Analyze conflicts and suggest the BEST available time slots.

// Consider:
// 1. Avoid back-to-back classes for instructors (prefer 1-hour gaps)
// 2. Prefer morning slots (7-11 AM) over afternoon
// 3. Distribute classes evenly across days
// 4. Respect the schedule pattern (${schedule_pattern})
// 5. Avoid lunch hours (12-1 PM) when possible

// Return JSON: { "available_times": ["7:00 AM - 8:00 AM", ...], "recommendation": "brief explanation" }`;

//     const userPrompt = `Find available times for:
// - Subject: ${subject_code}
// - Pattern: ${schedule_pattern} (${days.join(', ')})
// - Instructor: ${instructor_name}
// - Room: ${room_name}

// Current conflicts:
// ${conflicts.length > 0 ? conflicts.map(c => `- ${c.day} ${c.time}: ${c.subject} (${c.conflict_type})`).join('\n') : 'No conflicts found'}

// Available time slots: 7AM-9PM (14 one-hour slots)
// Suggest the TOP 5-10 best times that avoid all conflicts.`;

//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt }
//       ],
//       response_format: { type: "json_object" },
//       temperature: 0.3,
//       max_tokens: 500
//     });

//     const result = JSON.parse(completion.choices[0].message.content);
    
//     console.log(`✅ AI suggested ${result.available_times?.length || 0} times`);
    
//     res.json({
//       available_times: result.available_times || [],
//       recommendation: result.recommendation || 'Times selected based on optimal scheduling',
//       conflicts_analyzed: conflicts.length,
//       ai_powered: true
//     });

//   } catch (error) {
//     console.error('❌ AI availability check failed:', error);
//     res.status(500).json({
//       error: 'AI check failed',
//       detail: error.message,
//       fallback: true
//     });
//   }
// });

// module.exports = router;

//FUNCTIONAL WITHOUT YEAR AND SEM IN SCHEDULE

// const express = require("express");
// const router = express.Router();
// const db = require("../db");
// const OpenAI = require('openai');

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// // ✅ Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   console.log("🔍 Looking up schedule for email:", email);

//   // OPTION 1: Try linking via user_id first (if column exists)
//   const sqlWithUserId = `
//     SELECT 
//       s.id,
//       c.name AS course_name,
//       c.code AS course_code,
//       sec.name AS section_name,
//       subj.subject_code,
//       subj.description AS subject_description,
//       r.name AS room_name,
//       s.day,
//       s.start_time,
//       s.end_time,
//       s.slot_index AS time_slot
//     FROM users u
//     JOIN instructors i ON i.user_id = u.id
//     JOIN schedule s ON s.instructor_id = i.id
//     JOIN subjects subj ON s.subject_id = subj.id
//     JOIN courses c ON s.course_id = c.id
//     LEFT JOIN sections sec ON s.section_id = sec.id
//     JOIN rooms r ON s.room_id = r.id
//     WHERE u.email = ?
//     ORDER BY 
//       FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//       s.start_time;
//   `;

//   db.query(sqlWithUserId, [email], (err, schedule) => {
//     // If user_id column doesn't exist, fall back to name matching
//     if (err && err.code === 'ER_BAD_FIELD_ERROR') {
//       console.log("⚠️ user_id column not found, falling back to name matching");
//       return fallbackNameMatching(email, res);
//     }

//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ error: "Database error", detail: err.message });
//     }

//     if (schedule.length === 0) {
//       console.log("⚠️ No schedule found for email:", email);
//       return res.json([]);
//     }

//     console.log(`✅ Found ${schedule.length} schedule entries`);
//     res.json(schedule);
//   });
// });

// // ✅ UPDATE schedule entry
// router.put("/:id", (req, res) => {
//   const { id } = req.params;
//   const { schedule_pattern, available_time } = req.body;

//   console.log("🔄 Updating schedule ID:", id);
//   console.log("📝 Data:", { schedule_pattern, available_time });

//   if (!schedule_pattern || !available_time) {
//     return res.status(400).json({ 
//       success: false, 
//       message: "schedule_pattern and available_time are required" 
//     });
//   }

//   // Parse the schedule pattern to update days
//   // Example: "MW" = Monday, Wednesday; "TH" = Thursday
//   const patternMap = {
//     'M': 'Monday',
//     'T': 'Tuesday',
//     'W': 'Wednesday',
//     'TH': 'Thursday',
//     'F': 'Friday',
//     'S': 'Saturday'
//   };

//   // Convert available_time "8:00 AM" to 24-hour format "08:00:00"
//   const convertTo24Hour = (timeStr) => {
//     const [time, period] = timeStr.split(' ');
//     let [hours, minutes] = time.split(':');
//     hours = parseInt(hours);
    
//     if (period === 'PM' && hours !== 12) {
//       hours += 12;
//     } else if (period === 'AM' && hours === 12) {
//       hours = 0;
//     }
    
//     return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
//   };

//   const start_time = convertTo24Hour(available_time);
  
//   // Calculate end_time (assuming 1 hour duration)
//   const [hours, minutes] = start_time.split(':');
//   const endHour = (parseInt(hours) + 1).toString().padStart(2, '0');
//   const end_time = `${endHour}:${minutes}:00`;

//   // For now, just update the time fields
//   // You might want to handle schedule_pattern differently based on your needs
//   const sql = `
//     UPDATE schedule 
//     SET start_time = ?, end_time = ?
//     WHERE id = ?
//   `;

//   db.query(sql, [start_time, end_time, id], (err, result) => {
//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ 
//         success: false, 
//         message: "Database error", 
//         detail: err.message 
//       });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Schedule not found" 
//       });
//     }

//     console.log("✅ Schedule updated successfully");
//     res.json({ 
//       success: true, 
//       message: "Schedule updated successfully",
//       data: { id, start_time, end_time, schedule_pattern }
//     });
//   });
// });

// // ✅ DELETE schedule entry
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;

//   console.log("🗑️ Deleting schedule ID:", id);

//   const sql = "DELETE FROM schedule WHERE id = ?";

//   db.query(sql, [id], (err, result) => {
//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ 
//         success: false, 
//         message: "Database error", 
//         detail: err.message 
//       });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Schedule not found" 
//       });
//     }

//     console.log("✅ Schedule deleted successfully");
//     res.json({ 
//       success: true, 
//       message: "Schedule deleted successfully" 
//     });
//   });
// });

// // ✅ CREATE new schedule entry
// router.post("/", (req, res) => {
//   const {
//     course_id,
//     year_level,
//     semester,
//     section_id,
//     subject_id,
//     instructor_id,
//     room_id,
//     day,
//     slot_index,
//     start_time,
//     end_time,
//     section_index
//   } = req.body;

//   console.log("📝 Creating new schedule entry");

//   if (!course_id || !year_level || !semester || !section_id || !subject_id || !instructor_id || !room_id || !day) {
//     return res.status(400).json({
//       success: false,
//       message: "Missing required fields"
//     });
//   }

//   const sql = `
//     INSERT INTO schedule 
//     (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, start_time, end_time, section_index)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `;

//   db.query(
//     sql,
//     [course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, start_time, end_time, section_index || 0],
//     (err, result) => {
//       if (err) {
//         console.error("❌ DB error:", err);
//         return res.status(500).json({
//           success: false,
//           message: "Database error",
//           detail: err.message
//         });
//       }

//       console.log("✅ Schedule created successfully, ID:", result.insertId);
//       res.json({
//         success: true,
//         message: "Schedule created successfully",
//         id: result.insertId
//       });
//     }
//   );
// });

// // Fallback function for name-based matching
// function fallbackNameMatching(email, res) {
//   // Step 1: Find user by email
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err) {
//       console.error("❌ DB error (users):", err);
//       return res.status(500).json({ error: "DB error (users)", detail: err.message });
//     }
    
//     if (users.length === 0) {
//       console.log("❌ User not found for email:", email);
//       return res.status(404).json({ error: "User not found" });
//     }

//     const fullName = users[0].full_name;
//     console.log("✅ Found user:", fullName);

//     // Step 2: Find instructor linked to this user (case-insensitive)
//     db.query(
//       "SELECT id FROM instructors WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))",
//       [fullName],
//       (err, instructors) => {
//         if (err) {
//           console.error("❌ DB error (instructors):", err);
//           return res.status(500).json({ error: "DB error (instructors)", detail: err.message });
//         }
        
//         if (instructors.length === 0) {
//           console.log("❌ Instructor profile not found for name:", fullName);
          
//           // 🔍 Debug: Show all instructor names
//           db.query("SELECT name FROM instructors LIMIT 10", (err, allInstructors) => {
//             if (!err) {
//               console.log("📋 Available instructors:", allInstructors.map(i => i.name));
//             }
//           });
          
//           return res.status(404).json({ 
//             error: "Instructor profile not found",
//             detail: `No instructor record found for: ${fullName}. Please contact admin to create your instructor profile.`
//           });
//         }

//         const instructorId = instructors[0].id;
//         console.log("✅ Found instructor ID:", instructorId);

//         // Step 3: Fetch schedule with all necessary fields
//         const sql = `
//           SELECT 
//             s.id,
//             c.name AS course_name,
//             c.code AS course_code,
//             sec.name AS section_name,
//             subj.subject_code,
//             subj.description AS subject_description,
//             r.name AS room_name,
//             s.day,
//             s.start_time,
//             s.end_time,
//             s.slot_index AS time_slot
//           FROM schedule s
//           JOIN subjects subj ON s.subject_id = subj.id
//           JOIN courses c ON s.course_id = c.id
//           LEFT JOIN sections sec ON s.section_id = sec.id
//           JOIN rooms r ON s.room_id = r.id
//           WHERE s.instructor_id = ?
//           ORDER BY 
//             FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//             s.start_time;
//         `;

//         db.query(sql, [instructorId], (err, schedule) => {
//           if (err) {
//             console.error("❌ DB error (schedule):", err);
//             return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
//           }

//           if (schedule.length === 0) {
//             console.log("⚠️ No schedule assigned for instructor ID:", instructorId);
//             return res.json([]);
//           }

//           console.log(`✅ Found ${schedule.length} schedule entries`);
//           res.json(schedule);
//         });
//       }
//     );
//   });
// }

// // ============================================
// // AI-POWERED AVAILABILITY CHECKER (FIXED - FASTER & MORE RELIABLE)
// // ============================================
// router.post("/check-availability-ai", async (req, res) => {
//   try {
//     const {
//       schedule_id,
//       schedule_pattern,
//       days,
//       instructor_id,
//       room_id,
//       subject_code,
//       instructor_name,
//       room_name,
//       all_schedules
//     } = req.body;

//     console.log('🤖 AI Availability Check requested');
//     console.log('   Pattern:', schedule_pattern, 'Days:', days);
//     console.log('   Instructor:', instructor_name, 'Room:', room_name);

//     // Define all possible time slots (7:00 AM - 7:00 PM = 12 slots)
//     const ALL_TIME_SLOTS = [
//       "7:00 AM - 8:00 AM",
//       "8:00 AM - 9:00 AM",
//       "9:00 AM - 10:00 AM",
//       "10:00 AM - 11:00 AM",
//       "11:00 AM - 12:00 PM",
//       "12:00 PM - 1:00 PM",
//       "1:00 PM - 2:00 PM",
//       "2:00 PM - 3:00 PM",
//       "3:00 PM - 4:00 PM",
//       "4:00 PM - 5:00 PM",
//       "5:00 PM - 6:00 PM",
//       "6:00 PM - 7:00 PM"
//     ];

//     // Build conflict data
//     const conflicts = all_schedules
//       .filter(s => s.id !== schedule_id)
//       .filter(s => days.includes(s.day))
//       .filter(s => s.room_id === room_id || s.instructor_id === instructor_id)
//       .map(s => ({
//         day: s.day,
//         time: `${s.start_time}-${s.end_time}`,
//         slot_index: s.slot_index,
//         subject: s.subject_code || s.subject_name,
//         instructor: s.instructor_name,
//         room: s.room_name,
//         conflict_type: s.room_id === room_id ? 'room' : 'instructor'
//       }));

//     // Get conflicting slot indices
//     const conflictingSlots = conflicts.map(c => c.slot_index).filter(s => s !== null && s !== undefined);
    
//     // Filter available times (exclude conflicting slots)
//     const availableTimes = ALL_TIME_SLOTS.filter((_, index) => !conflictingSlots.includes(index));

//     console.log(`✅ Found ${availableTimes.length} available times (${conflictingSlots.length} conflicts)`);

//     // If no OpenAI key or no available times, return immediately
//     if (!process.env.OPENAI_API_KEY || availableTimes.length === 0) {
//       return res.json({
//         available_times: availableTimes,
//         recommendation: availableTimes.length > 0 
//           ? `Found ${availableTimes.length} available time slot(s). Morning slots (7-11 AM) are generally preferred.`
//           : 'No available times found. All slots have conflicts.',
//         conflicts_analyzed: conflicts.length,
//         ai_powered: false
//       });
//     }

//     // Try AI optimization with shorter, more focused prompt
//     try {
//       const systemPrompt = `You are a scheduling optimizer. Rank available time slots from best to worst based on:
// 1. Morning preference (7-11 AM best)
// 2. Avoid lunch hour (12-1 PM)
// 3. Spread classes across days
// 4. Minimize instructor back-to-back classes

// Return JSON: { "available_times": ["top times in order"], "recommendation": "brief reason" }`;

//       const userPrompt = `Subject: ${subject_code}
// Pattern: ${schedule_pattern} (${days.join(', ')})
// Available slots: ${availableTimes.join(', ')}
// Conflicts: ${conflicts.length} (${conflictingSlots.length} slots blocked)

// Rank top 5-8 times from available slots.`;

//       // Shorter timeout for faster response
//       const aiPromise = openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [
//           { role: "system", content: systemPrompt },
//           { role: "user", content: userPrompt }
//         ],
//         response_format: { type: "json_object" },
//         temperature: 0.3,
//         max_tokens: 300, // Reduced from 500
//         timeout: 10000 // 10 seconds instead of 15
//       });

//       const timeoutPromise = new Promise((_, reject) => {
//         setTimeout(() => reject(new Error('AI request timeout')), 10000);
//       });

//       const completion = await Promise.race([aiPromise, timeoutPromise]);
//       const result = JSON.parse(completion.choices[0].message.content);
      
//       console.log(`✅ AI suggested ${result.available_times?.length || 0} optimized times`);
      
//       return res.json({
//         available_times: result.available_times || availableTimes,
//         recommendation: result.recommendation || 'Times selected based on optimal scheduling',
//         conflicts_analyzed: conflicts.length,
//         ai_powered: true
//       });
//     } catch (aiError) {
//       console.warn('⚠️ AI optimization skipped:', aiError.message);
//       // Don't retry - just use basic availability immediately
//     }

//     // Fallback: Smart ranking without AI
//     const rankedTimes = availableTimes.sort((a, b) => {
//       const getScore = (timeSlot) => {
//         const hour = parseInt(timeSlot.split(':')[0]);
//         let score = 0;
        
//         // Prefer morning (7-11 AM)
//         if (hour >= 7 && hour < 11) score += 3;
//         // Afternoon OK (1-5 PM)
//         else if (hour >= 13 && hour < 17) score += 2;
//         // Avoid lunch (12-1 PM)
//         else if (hour >= 12 && hour < 13) score -= 2;
//         // Evening less preferred
//         else score += 1;
        
//         return score;
//       };
      
//       return getScore(b) - getScore(a);
//     });

//     res.json({
//       available_times: rankedTimes,
//       recommendation: `Found ${rankedTimes.length} available time slot(s). Times are ranked by preference (morning slots first).`,
//       conflicts_analyzed: conflicts.length,
//       ai_powered: false
//     });

//   } catch (error) {
//     console.error('❌ Availability check failed:', error);
//     res.status(500).json({
//       error: 'Failed to check availability',
//       detail: error.message,
//       fallback: true,
//       available_times: []
//     });
//   }
// });

// module.exports = router;

//WORKING WITHOUT DURATION

// const express = require("express");
// const router = express.Router();
// const db = require("../db");
// const OpenAI = require('openai');

// // Initialize OpenAI
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// // ✅ Get schedule for logged-in instructor
// router.get("/instructor/:email", (req, res) => {
//   const { email } = req.params;

//   console.log("🔍 Looking up schedule for email:", email);

//   // MAIN QUERY - major comes from subjects table (subj.major)
//   const sqlWithUserId = `
//     SELECT 
//       s.id,
//       c.name AS course_name,
//       c.code AS course_code,
//       sec.name AS section_name,
//       subj.subject_code,
//       subj.description AS subject_description,
//       r.name AS room_name,
//       s.day,
//       s.start_time,
//       s.end_time,
//       s.slot_index AS time_slot,
//       s.year_level,
//       s.semester,
//       subj.major                  -- ← Get major from subjects table
//     FROM users u
//     JOIN instructors i ON i.user_id = u.id
//     JOIN schedule s ON s.instructor_id = i.id
//     JOIN subjects subj ON s.subject_id = subj.id
//     JOIN courses c ON s.course_id = c.id
//     LEFT JOIN sections sec ON s.section_id = sec.id
//     JOIN rooms r ON s.room_id = r.id
//     WHERE u.email = ?
//     ORDER BY 
//       FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//       s.start_time;
//   `;

//   db.query(sqlWithUserId, [email], (err, schedule) => {
//     if (err && err.code === 'ER_BAD_FIELD_ERROR') {
//       console.log("⚠️ user_id column not found, falling back to name matching");
//       return fallbackNameMatching(email, res);
//     }

//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ error: "Database error", detail: err.message });
//     }

//     if (schedule.length === 0) {
//       console.log("⚠️ No schedule found for email:", email);
//       return res.json([]);
//     }

//     console.log(`✅ Found ${schedule.length} schedule entries`);
//     res.json(schedule);
//   });
// });

// // Fallback function (also fixed to get major from subjects)
// function fallbackNameMatching(email, res) {
//   db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
//     if (err || users.length === 0) {
//       console.error("❌ User not found");
//       return res.status(404).json({ error: "User not found" });
//     }

//     const fullName = users[0].full_name;

//     db.query(
//       "SELECT id FROM instructors WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))",
//       [fullName],
//       (err, instructors) => {
//         if (err || instructors.length === 0) {
//           console.log("❌ Instructor profile not found");
//           return res.status(404).json({ 
//             error: "Instructor profile not found",
//             detail: `No instructor record found for: ${fullName}`
//           });
//         }

//         const instructorId = instructors[0].id;

//         const sql = `
//           SELECT 
//             s.id,
//             c.name AS course_name,
//             c.code AS course_code,
//             sec.name AS section_name,
//             subj.subject_code,
//             subj.description AS subject_description,
//             r.name AS room_name,
//             s.day,
//             s.start_time,
//             s.end_time,
//             s.slot_index AS time_slot,
//             s.year_level,
//             s.semester,
//             subj.major                  -- ← major from subjects table
//           FROM schedule s
//           JOIN subjects subj ON s.subject_id = subj.id
//           JOIN courses c ON s.course_id = c.id
//           LEFT JOIN sections sec ON s.section_id = sec.id
//           JOIN rooms r ON s.room_id = r.id
//           WHERE s.instructor_id = ?
//           ORDER BY 
//             FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
//             s.start_time;
//         `;

//         db.query(sql, [instructorId], (err, schedule) => {
//           if (err) {
//             console.error("❌ DB error (schedule):", err);
//             return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
//           }

//           if (schedule.length === 0) {
//             return res.json([]);
//           }

//           console.log(`✅ Found ${schedule.length} schedule entries (fallback)`);
//           res.json(schedule);
//         });
//       }
//     );
//   });
// }

// // ✅ UPDATE schedule entry
// router.put("/:id", (req, res) => {
//   const { id } = req.params;
//   const { schedule_pattern, available_time } = req.body;

//   console.log("🔄 Updating schedule ID:", id);
//   console.log("📝 Data:", { schedule_pattern, available_time });

//   if (!schedule_pattern || !available_time) {
//     return res.status(400).json({ 
//       success: false, 
//       message: "schedule_pattern and available_time are required" 
//     });
//   }

//   const convertTo24Hour = (timeStr) => {
//     const [time, period] = timeStr.split(' ');
//     let [hours, minutes] = time.split(':');
//     hours = parseInt(hours);
    
//     if (period === 'PM' && hours !== 12) {
//       hours += 12;
//     } else if (period === 'AM' && hours === 12) {
//       hours = 0;
//     }
    
//     return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
//   };

//   const start_time = convertTo24Hour(available_time);
  
//   const [hours, minutes] = start_time.split(':');
//   const endHour = (parseInt(hours) + 1).toString().padStart(2, '0');
//   const end_time = `${endHour}:${minutes}:00`;

//   const sql = `
//     UPDATE schedule 
//     SET start_time = ?, end_time = ?
//     WHERE id = ?
//   `;

//   db.query(sql, [start_time, end_time, id], (err, result) => {
//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ 
//         success: false, 
//         message: "Database error", 
//         detail: err.message 
//       });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Schedule not found" 
//       });
//     }

//     console.log("✅ Schedule updated successfully");
//     res.json({ 
//       success: true, 
//       message: "Schedule updated successfully",
//       data: { id, start_time, end_time, schedule_pattern }
//     });
//   });
// });

// // ✅ DELETE schedule entry
// router.delete("/:id", (req, res) => {
//   const { id } = req.params;

//   console.log("🗑️ Deleting schedule ID:", id);

//   const sql = "DELETE FROM schedule WHERE id = ?";

//   db.query(sql, [id], (err, result) => {
//     if (err) {
//       console.error("❌ DB error:", err);
//       return res.status(500).json({ 
//         success: false, 
//         message: "Database error", 
//         detail: err.message 
//       });
//     }

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Schedule not found" 
//       });
//     }

//     console.log("✅ Schedule deleted successfully");
//     res.json({ 
//       success: true, 
//       message: "Schedule deleted successfully" 
//     });
//   });
// });

// // ✅ CREATE new schedule entry
// router.post("/", (req, res) => {
//   const {
//     course_id,
//     year_level,
//     semester,
//     section_id,
//     subject_id,
//     instructor_id,
//     room_id,
//     day,
//     slot_index,
//     start_time,
//     end_time,
//     section_index
//   } = req.body;

//   console.log("📝 Creating new schedule entry");

//   if (!course_id || !year_level || !semester || !section_id || !subject_id || !instructor_id || !room_id || !day) {
//     return res.status(400).json({
//       success: false,
//       message: "Missing required fields"
//     });
//   }

//   const sql = `
//     INSERT INTO schedule 
//     (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, start_time, end_time, section_index)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `;

//   db.query(
//     sql,
//     [course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, start_time, end_time, section_index || 0],
//     (err, result) => {
//       if (err) {
//         console.error("❌ DB error:", err);
//         return res.status(500).json({
//           success: false,
//           message: "Database error",
//           detail: err.message
//         });
//       }

//       console.log("✅ Schedule created successfully, ID:", result.insertId);
//       res.json({
//         success: true,
//         message: "Schedule created successfully",
//         id: result.insertId
//       });
//     }
//   );
// });

// // ============================================
// // AI-POWERED AVAILABILITY CHECKER (unchanged)
// // ============================================
// router.post("/check-availability-ai", async (req, res) => {
//   try {
//     const {
//       schedule_id,
//       schedule_pattern,
//       days,
//       instructor_id,
//       room_id,
//       subject_code,
//       instructor_name,
//       room_name,
//       all_schedules
//     } = req.body;

//     console.log('🤖 AI Availability Check requested');
//     console.log('   Pattern:', schedule_pattern, 'Days:', days);
//     console.log('   Instructor:', instructor_name, 'Room:', room_name);

//     const ALL_TIME_SLOTS = [
//       "7:00 AM - 8:00 AM",
//       "8:00 AM - 9:00 AM",
//       "9:00 AM - 10:00 AM",
//       "10:00 AM - 11:00 AM",
//       "11:00 AM - 12:00 PM",
//       "12:00 PM - 1:00 PM",
//       "1:00 PM - 2:00 PM",
//       "2:00 PM - 3:00 PM",
//       "3:00 PM - 4:00 PM",
//       "4:00 PM - 5:00 PM",
//       "5:00 PM - 6:00 PM",
//       "6:00 PM - 7:00 PM"
//     ];

//     const conflicts = all_schedules
//       .filter(s => s.id !== schedule_id)
//       .filter(s => days.includes(s.day))
//       .filter(s => s.room_id === room_id || s.instructor_id === instructor_id)
//       .map(s => ({
//         day: s.day,
//         time: `${s.start_time}-${s.end_time}`,
//         slot_index: s.slot_index,
//         subject: s.subject_code || s.subject_name,
//         instructor: s.instructor_name,
//         room: s.room_name,
//         conflict_type: s.room_id === room_id ? 'room' : 'instructor'
//       }));

//     const conflictingSlots = conflicts.map(c => c.slot_index).filter(s => s !== null && s !== undefined);
    
//     const availableTimes = ALL_TIME_SLOTS.filter((_, index) => !conflictingSlots.includes(index));

//     console.log(`✅ Found ${availableTimes.length} available times (${conflictingSlots.length} conflicts)`);

//     if (!process.env.OPENAI_API_KEY || availableTimes.length === 0) {
//       return res.json({
//         available_times: availableTimes,
//         recommendation: availableTimes.length > 0 
//           ? `Found ${availableTimes.length} available time slot(s). Morning slots (7-11 AM) are generally preferred.`
//           : 'No available times found. All slots have conflicts.',
//         conflicts_analyzed: conflicts.length,
//         ai_powered: false
//       });
//     }

//     try {
//       const systemPrompt = `You are a scheduling optimizer. Rank available time slots from best to worst based on:
// 1. Morning preference (7-11 AM best)
// 2. Avoid lunch hour (12-1 PM)
// 3. Spread classes across days
// 4. Minimize instructor back-to-back classes

// Return JSON: { "available_times": ["top times in order"], "recommendation": "brief reason" }`;

//       const userPrompt = `Subject: ${subject_code}
// Pattern: ${schedule_pattern} (${days.join(', ')})
// Available slots: ${availableTimes.join(', ')}
// Conflicts: ${conflicts.length} (${conflictingSlots.length} slots blocked)

// Rank top 5-8 times from available slots.`;

//       const aiPromise = openai.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [
//           { role: "system", content: systemPrompt },
//           { role: "user", content: userPrompt }
//         ],
//         response_format: { type: "json_object" },
//         temperature: 0.3,
//         max_tokens: 300,
//         timeout: 10000
//       });

//       const timeoutPromise = new Promise((_, reject) => {
//         setTimeout(() => reject(new Error('AI request timeout')), 10000);
//       });

//       const completion = await Promise.race([aiPromise, timeoutPromise]);
//       const result = JSON.parse(completion.choices[0].message.content);
      
//       console.log(`✅ AI suggested ${result.available_times?.length || 0} optimized times`);
      
//       return res.json({
//         available_times: result.available_times || availableTimes,
//         recommendation: result.recommendation || 'Times selected based on optimal scheduling',
//         conflicts_analyzed: conflicts.length,
//         ai_powered: true
//       });
//     } catch (aiError) {
//       console.warn('⚠️ AI optimization skipped:', aiError.message);
//     }

//     const rankedTimes = availableTimes.sort((a, b) => {
//       const getScore = (timeSlot) => {
//         const hour = parseInt(timeSlot.split(':')[0]);
//         let score = 0;
        
//         if (hour >= 7 && hour < 11) score += 3;
//         else if (hour >= 13 && hour < 17) score += 2;
//         else if (hour >= 12 && hour < 13) score -= 2;
//         else score += 1;
        
//         return score;
//       };
      
//       return getScore(b) - getScore(a);
//     });

//     res.json({
//       available_times: rankedTimes,
//       recommendation: `Found ${rankedTimes.length} available time slot(s). Times are ranked by preference (morning slots first).`,
//       conflicts_analyzed: conflicts.length,
//       ai_powered: false
//     });

//   } catch (error) {
//     console.error('❌ Availability check failed:', error);
//     res.status(500).json({
//       error: 'Failed to check availability',
//       detail: error.message,
//       fallback: true,
//       available_times: []
//     });
//   }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const db = require("../db");
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ✅ Get schedule for logged-in instructor
router.get("/instructor/:email", (req, res) => {
  const { email } = req.params;

  console.log("🔍 Looking up schedule for email:", email);

  // MAIN QUERY - includes duration
  const sqlWithUserId = `
    SELECT 
      s.id,
      c.name AS course_name,
      c.code AS course_code,
      sec.name AS section_name,
      subj.subject_code,
      subj.description AS subject_description,
      r.name AS room_name,
      s.day,
      s.start_time,
      s.end_time,
      s.slot_index AS time_slot,
      s.year_level,
      s.semester,
      s.duration,
      subj.major
    FROM users u
    JOIN instructors i ON i.user_id = u.id
    JOIN schedule s ON s.instructor_id = i.id
    JOIN subjects subj ON s.subject_id = subj.id
    JOIN courses c ON s.course_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    JOIN rooms r ON s.room_id = r.id
    WHERE u.email = ?
    ORDER BY 
      FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
      s.start_time;
  `;

  db.query(sqlWithUserId, [email], (err, schedule) => {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      console.log("⚠️ user_id column not found, falling back to name matching");
      return fallbackNameMatching(email, res);
    }

    if (err) {
      console.error("❌ DB error:", err);
      return res.status(500).json({ error: "Database error", detail: err.message });
    }

    if (schedule.length === 0) {
      console.log("⚠️ No schedule found for email:", email);
      return res.json([]);
    }

    console.log(`✅ Found ${schedule.length} schedule entries`);
    res.json(schedule);
  });
});

// Fallback function - includes duration
function fallbackNameMatching(email, res) {
  db.query("SELECT id, full_name FROM users WHERE email = ?", [email], (err, users) => {
    if (err || users.length === 0) {
      console.error("❌ User not found");
      return res.status(404).json({ error: "User not found" });
    }

    const fullName = users[0].full_name;

    db.query(
      "SELECT id FROM instructors WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))",
      [fullName],
      (err, instructors) => {
        if (err || instructors.length === 0) {
          console.log("❌ Instructor profile not found");
          return res.status(404).json({ 
            error: "Instructor profile not found",
            detail: `No instructor record found for: ${fullName}`
          });
        }

        const instructorId = instructors[0].id;

        const sql = `
          SELECT 
            s.id,
            c.name AS course_name,
            c.code AS course_code,
            sec.name AS section_name,
            subj.subject_code,
            subj.description AS subject_description,
            r.name AS room_name,
            s.day,
            s.start_time,
            s.end_time,
            s.slot_index AS time_slot,
            s.year_level,
            s.semester,
            s.duration,
            subj.major
          FROM schedule s
          JOIN subjects subj ON s.subject_id = subj.id
          JOIN courses c ON s.course_id = c.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          JOIN rooms r ON s.room_id = r.id
          WHERE s.instructor_id = ?
          ORDER BY 
            FIELD(s.day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
            s.start_time;
        `;

        db.query(sql, [instructorId], (err, schedule) => {
          if (err) {
            console.error("❌ DB error (schedule):", err);
            return res.status(500).json({ error: "DB error (schedule)", detail: err.message });
          }

          if (schedule.length === 0) {
            return res.json([]);
          }

          console.log(`✅ Found ${schedule.length} schedule entries (fallback)`);
          res.json(schedule);
        });
      }
    );
  });
}

// ✅ UPDATE schedule entry - NOW CALCULATES CORRECT END_TIME BASED ON DURATION
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { schedule_pattern, available_time, duration } = req.body;

  console.log("🔄 Updating schedule ID:", id);
  console.log("📝 Data:", { schedule_pattern, available_time, duration });

  if (!schedule_pattern || !available_time) {
    return res.status(400).json({ 
      success: false, 
      message: "schedule_pattern and available_time are required" 
    });
  }

  const convertTo24Hour = (timeStr) => {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
  };

  const start_time = convertTo24Hour(available_time);
  
  // ✅ CRITICAL FIX: Calculate end_time based on duration
  const [hours, minutes] = start_time.split(':');
  const startHour = parseInt(hours);
  const classDuration = duration ? Number(duration) : 1;
  const endHour = startHour + classDuration;
  const end_time = `${endHour.toString().padStart(2, '0')}:${minutes}:00`;

  console.log(`   Calculated: ${start_time} - ${end_time} (${classDuration}h duration)`);

  const sql = `
    UPDATE schedule 
    SET start_time = ?, end_time = ?, duration = ?
    WHERE id = ?
  `;

  db.query(sql, [start_time, end_time, classDuration, id], (err, result) => {
    if (err) {
      console.error("❌ DB error:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Database error", 
        detail: err.message 
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Schedule not found" 
      });
    }

    console.log("✅ Schedule updated successfully");
    res.json({ 
      success: true, 
      message: "Schedule updated successfully",
      data: { id, start_time, end_time, duration: classDuration, schedule_pattern }
    });
  });
});

// ✅ DELETE schedule entry
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  console.log("🗑️ Deleting schedule ID:", id);

  const sql = "DELETE FROM schedule WHERE id = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("❌ DB error:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Database error", 
        detail: err.message 
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Schedule not found" 
      });
    }

    console.log("✅ Schedule deleted successfully");
    res.json({ 
      success: true, 
      message: "Schedule deleted successfully" 
    });
  });
});

// ✅ CREATE new schedule entry - NOW WITH DURATION SUPPORT
router.post("/", (req, res) => {
  const {
    course_id,
    year_level,
    semester,
    section_id,
    subject_id,
    instructor_id,
    room_id,
    day,
    slot_index,
    start_time,
    end_time,
    duration,
    section_index
  } = req.body;

  console.log("📝 Creating new schedule entry");
  console.log("   Duration:", duration, "hours");

  if (!course_id || !year_level || !semester || !section_id || !subject_id || !instructor_id || !room_id || !day) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });
  }

  // ✅ CRITICAL FIX: Include duration in INSERT
  const sql = `
    INSERT INTO schedule 
    (course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, start_time, end_time, duration, section_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const finalDuration = duration ? Number(duration) : 1;

  db.query(
    sql,
    [course_id, year_level, semester, section_id, subject_id, instructor_id, room_id, day, slot_index, start_time, end_time, finalDuration, section_index || 0],
    (err, result) => {
      if (err) {
        console.error("❌ DB error:", err);
        return res.status(500).json({
          success: false,
          message: "Database error",
          detail: err.message
        });
      }

      console.log("✅ Schedule created successfully, ID:", result.insertId);
      res.json({
        success: true,
        message: "Schedule created successfully",
        id: result.insertId
      });
    }
  );
});

// ============================================
// AI-POWERED AVAILABILITY CHECKER
// ============================================
router.post("/check-availability-ai", async (req, res) => {
  try {
    const {
      schedule_id,
      schedule_pattern,
      days,
      instructor_id,
      room_id,
      subject_code,
      instructor_name,
      room_name,
      all_schedules
    } = req.body;

    console.log('🤖 AI Availability Check requested');
    console.log('   Pattern:', schedule_pattern, 'Days:', days);
    console.log('   Instructor:', instructor_name, 'Room:', room_name);

    const ALL_TIME_SLOTS = [
      "7:00 AM - 8:00 AM",
      "8:00 AM - 9:00 AM",
      "9:00 AM - 10:00 AM",
      "10:00 AM - 11:00 AM",
      "11:00 AM - 12:00 PM",
      "12:00 PM - 1:00 PM",
      "1:00 PM - 2:00 PM",
      "2:00 PM - 3:00 PM",
      "3:00 PM - 4:00 PM",
      "4:00 PM - 5:00 PM",
      "5:00 PM - 6:00 PM",
      "6:00 PM - 7:00 PM"
    ];

    const conflicts = all_schedules
      .filter(s => s.id !== schedule_id)
      .filter(s => days.includes(s.day))
      .filter(s => s.room_id === room_id || s.instructor_id === instructor_id)
      .map(s => ({
        day: s.day,
        time: `${s.start_time}-${s.end_time}`,
        slot_index: s.slot_index,
        subject: s.subject_code || s.subject_name,
        instructor: s.instructor_name,
        room: s.room_name,
        conflict_type: s.room_id === room_id ? 'room' : 'instructor'
      }));

    const conflictingSlots = conflicts.map(c => c.slot_index).filter(s => s !== null && s !== undefined);
    
    const availableTimes = ALL_TIME_SLOTS.filter((_, index) => !conflictingSlots.includes(index));

    console.log(`✅ Found ${availableTimes.length} available times (${conflictingSlots.length} conflicts)`);

    if (!process.env.OPENAI_API_KEY || availableTimes.length === 0) {
      return res.json({
        available_times: availableTimes,
        recommendation: availableTimes.length > 0 
          ? `Found ${availableTimes.length} available time slot(s). Morning slots (7-11 AM) are generally preferred.`
          : 'No available times found. All slots have conflicts.',
        conflicts_analyzed: conflicts.length,
        ai_powered: false
      });
    }

    try {
      const systemPrompt = `You are a scheduling optimizer. Rank available time slots from best to worst based on:
1. Morning preference (7-11 AM best)
2. Avoid lunch hour (12-1 PM)
3. Spread classes across days
4. Minimize instructor back-to-back classes

Return JSON: { "available_times": ["top times in order"], "recommendation": "brief reason" }`;

      const userPrompt = `Subject: ${subject_code}
Pattern: ${schedule_pattern} (${days.join(', ')})
Available slots: ${availableTimes.join(', ')}
Conflicts: ${conflicts.length} (${conflictingSlots.length} slots blocked)

Rank top 5-8 times from available slots.`;

      const aiPromise = openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 300,
        timeout: 10000
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI request timeout')), 10000);
      });

      const completion = await Promise.race([aiPromise, timeoutPromise]);
      const result = JSON.parse(completion.choices[0].message.content);
      
      console.log(`✅ AI suggested ${result.available_times?.length || 0} optimized times`);
      
      return res.json({
        available_times: result.available_times || availableTimes,
        recommendation: result.recommendation || 'Times selected based on optimal scheduling',
        conflicts_analyzed: conflicts.length,
        ai_powered: true
      });
    } catch (aiError) {
      console.warn('⚠️ AI optimization skipped:', aiError.message);
    }

    const rankedTimes = availableTimes.sort((a, b) => {
      const getScore = (timeSlot) => {
        const hour = parseInt(timeSlot.split(':')[0]);
        let score = 0;
        
        if (hour >= 7 && hour < 11) score += 3;
        else if (hour >= 13 && hour < 17) score += 2;
        else if (hour >= 12 && hour < 13) score -= 2;
        else score += 1;
        
        return score;
      };
      
      return getScore(b) - getScore(a);
    });

    res.json({
      available_times: rankedTimes,
      recommendation: `Found ${rankedTimes.length} available time slot(s). Times are ranked by preference (morning slots first).`
,
      conflicts_analyzed: conflicts.length,
      ai_powered: false
    });

  } catch (error) {
    console.error('❌ Availability check failed:', error);
    res.status(500).json({
      error: 'Failed to check availability',
      detail: error.message,
      fallback: true,
      available_times: []
    });
  }
});

module.exports = router;