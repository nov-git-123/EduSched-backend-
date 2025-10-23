//Functional
// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // your MySQL connection pool

// // ✅ GET profile by instructor ID
// router.get("/id/:id", async (req, res) => {
//   const { id } = req.params;
//   console.log("📥 Received request for profile ID:", id);

//   try {
//     const [rows] = await db.query(
//       "SELECT id AS instructorId, full_name AS name, email, role, profile_image AS photo_url FROM users WHERE id = ?",
//       [id]
//     );

//     if (!rows || rows.length === 0) {
//       console.log("⚠️ No user found for ID:", id);
//       return res.status(404).json({ message: "User not found" });
//     }

//     console.log("✅ User found:", rows[0]);
//     res.json(rows[0]);
//   } catch (error) {
//     console.error("❌ Database query failed:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// });

// module.exports = router;
const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ 1. GET profile by Firebase UID (most accurate)
router.get("/uid/:uid", async (req, res) => {
  const { uid } = req.params;
  console.log("📥 Received request for UID:", uid);

  try {
    const [rows] = await db.query(
      `SELECT 
         id AS userId,
         uid,
         full_name AS name,
         email,
         role,
         profile_pic AS photo_url,
         created_at,
         updated_at
       FROM users 
       WHERE uid = ?`,
      [uid]
    );

    if (!rows || rows.length === 0) {
      console.log("⚠️ No user found for UID:", uid);
      return res.status(404).json({ message: "Profile not found in database." });
    }

    console.log("✅ User found:", rows[0]);
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Database query failed:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ 2. GET profile by instructorId (fallback)
router.get("/id/:instructorId", async (req, res) => {
  const { instructorId } = req.params;
  console.log("📥 Received request for instructorId:", instructorId);

  try {
    // Step 1: Find instructor info
    const [instructorRows] = await db.query(
      "SELECT name FROM instructors WHERE id = ?",
      [instructorId]
    );

    if (!instructorRows || instructorRows.length === 0) {
      console.log("⚠️ Instructor not found:", instructorId);
      return res.status(404).json({ message: "Instructor not found" });
    }

    const instructorName = instructorRows[0].name;
    console.log("👤 Instructor name found:", instructorName);

    // Step 2: Find matching user record using full_name
    const [userRows] = await db.query(
      `SELECT 
         id AS userId,
         uid,
         full_name AS name,
         email,
         role,
         profile_pic AS photo_url,
         created_at,
         updated_at
       FROM users 
       WHERE TRIM(LOWER(full_name)) = TRIM(LOWER(?))`,
      [instructorName]
    );

    if (!userRows || userRows.length === 0) {
      console.log("⚠️ No user found linked to instructor:", instructorName);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ User found:", userRows[0]);
    res.json(userRows[0]);
  } catch (error) {
    console.error("❌ Database query failed:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ✅ 3. GET profile by email
router.get("/email/:email", async (req, res) => {
  const { email } = req.params;
  console.log("📥 Received request for profile email:", email);

  try {
    const [rows] = await db.query(
      `SELECT 
         id AS userId,
         uid,
         full_name AS name,
         email,
         role,
         profile_pic AS photo_url,
         created_at,
         updated_at
       FROM users 
       WHERE email = ?`,
      [email]
    );

    if (!rows || rows.length === 0) {
      console.log("⚠️ No user found for email:", email);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ User found:", rows[0]);
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Database query failed:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
