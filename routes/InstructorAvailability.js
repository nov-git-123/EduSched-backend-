const express = require("express");
const router = express.Router();
const db = require("../db"); // mysql2 pool

// Save instructor availability
router.post("/", async (req, res) => {
  try {
    const { instructorId, day, start_time, end_time } = req.body;

    if (!instructorId || !day || !start_time || !end_time) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await db.query(
      "INSERT INTO instructor_availability (instructor_id, day, start_time, end_time) VALUES (?, ?, ?, ?)",
      [instructorId, day, start_time, end_time]
    );

    res.json({ success: true, message: "Availability saved" });
  } catch (err) {
    console.error("Error saving availability:", err);
    res.status(500).json({ error: "Failed to save availability" });
  }
});

module.exports = router;
