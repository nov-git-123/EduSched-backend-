// import express from "express";
// import db from "../db.js"; // adjust path if needed

// const router = express.Router();

// // GET all buildings
// router.get("/", async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT * FROM buildings");
//     res.json(rows);
//   } catch (err) {
//     console.error("Error fetching buildings:", err);
//     res.status(500).json({ error: "Failed to fetch buildings" });
//   }
// });

// // POST new building
// router.post("/", async (req, res) => {
//   const { name } = req.body;
//   if (!name) return res.status(400).json({ error: "Name is required" });

//   try {
//     const [result] = await db.query(
//       "INSERT INTO buildings (name) VALUES (?)",
//       [name]
//     );

//     // Return the new building with ID
//     res.json({
//       id: result.insertId,
//       name,
//       rooms: []
//     });
//   } catch (err) {
//     console.error("Error adding building:", err);
//     res.status(500).json({ error: "Failed to add building" });
//   }
// });

// export default router;

// edusched-backend/routes/buildings.js
// routes/buildings.js
// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // Get all buildings
// router.get("/", (req, res) => {
//   db.query("SELECT * FROM buildings", (err, results) => {
//     if (err) {
//       console.error("Error fetching buildings:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(results);
//   });
// });

// // Add a new building
// router.post("/", (req, res) => {
//   const { name } = req.body;
//   db.query("INSERT INTO buildings (name) VALUES (?)", [name], (err, result) => {
//     if (err) {
//       console.error("Error adding building:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json({ id: result.insertId, name });
//   });
// });

// module.exports = router;

//functional

// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // ✅ Get all buildings with rooms
// router.get("/", (req, res) => {
//   const query = `
//     SELECT b.id AS building_id, b.name AS building_name,
//            r.id AS room_id, r.name AS room_name
//     FROM buildings b
//     LEFT JOIN rooms r ON b.id = r.building_id
//     ORDER BY b.id, r.id
//   `;

//   db.query(query, (err, results) => {
//     if (err) {
//       console.error("Error fetching buildings with rooms:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     // Group results by building
//     const buildings = [];
//     const map = {};

//     results.forEach(row => {
//       if (!map[row.building_id]) {
//         map[row.building_id] = {
//           id: row.building_id,
//           name: row.building_name,
//           rooms: []
//         };
//         buildings.push(map[row.building_id]);
//       }
//       if (row.room_id) {
//         map[row.building_id].rooms.push({
//           id: row.room_id,
//           name: row.room_name,
//           buildingId: row.building_id
//         });
//       }
//     });

//     res.json(buildings);
//   });
// });

// // ✅ Add a new building
// router.post("/", (req, res) => {
//   const { name } = req.body;
//   db.query("INSERT INTO buildings (name) VALUES (?)", [name], (err, result) => {
//     if (err) {
//       console.error("Error adding building:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json({ id: result.insertId, name, rooms: [] }); // include empty rooms array
//   });
// });

// module.exports = router;

//FUNCTIONAL

// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// router.get("/", (req, res) => {
//   const sql = `
//     SELECT 
//       b.id AS building_id, 
//       b.name AS building_name, 
//       r.id AS room_id, 
//       r.name AS room_name,
//       s.id AS schedule_id,
//       s.day,
//       s.start_time,
//       s.end_time
//     FROM buildings b
//     LEFT JOIN rooms r ON r.building_id = b.id
//     LEFT JOIN schedule s ON s.room_id = r.id
//     ORDER BY b.id, r.id
//   `;

//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("Error fetching buildings with rooms:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     // Group data: buildings → rooms → schedules
//     const buildings = [];

//     results.forEach((row) => {
//       // 🏢 find or create building
//       let building = buildings.find((b) => b.id === row.building_id);
//       if (!building) {
//         building = { id: row.building_id, name: row.building_name, rooms: [] };
//         buildings.push(building);
//       }

//       // 🚪 find or create room
//       if (row.room_id) {
//         let room = building.rooms.find((r) => r.id === row.room_id);
//         if (!room) {
//           room = { id: row.room_id, name: row.room_name, schedules: [] };
//           building.rooms.push(room);
//         }

//         // 📅 add schedule if exists
//         if (row.schedule_id) {
//           room.schedules.push({
//             id: row.schedule_id,
//             day: row.day,
//             start_time: row.start_time,
//             end_time: row.end_time,
//           });
//         }
//       }
//     });

//     res.json(buildings);
//   });
// });

// // ✅ Add a new building
// router.post("/", (req, res) => {
//   const { name } = req.body;
//   db.query("INSERT INTO buildings (name) VALUES (?)", [name], (err, result) => {
//     if (err) {
//       console.error("Error adding building:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json({ id: result.insertId, name, rooms: [] });
//   });
// });

// module.exports = router;
const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ Get all buildings + rooms + schedules
router.get("/", (req, res) => {
  const sql = `
    SELECT 
      b.id AS building_id, 
      b.name AS building_name, 
      r.id AS room_id, 
      r.name AS room_name,
      s.id AS schedule_id,
      s.day,
      s.start_time,
      s.end_time
    FROM buildings b
    LEFT JOIN rooms r ON r.building_id = b.id
    LEFT JOIN schedule s ON s.room_id = r.id
    ORDER BY b.id, r.id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching buildings with rooms:", err);
      return res.status(500).json({ error: "Database error" });
    }

    const buildings = [];

    results.forEach((row) => {
      let building = buildings.find((b) => b.id === row.building_id);
      if (!building) {
        building = { id: row.building_id, name: row.building_name, rooms: [] };
        buildings.push(building);
      }

      if (row.room_id) {
        let room = building.rooms.find((r) => r.id === row.room_id);
        if (!room) {
          room = { id: row.room_id, name: row.room_name, schedules: [] };
          building.rooms.push(room);
        }

        if (row.schedule_id) {
          room.schedules.push({
            id: row.schedule_id,
            day: row.day,
            start_time: row.start_time,
            end_time: row.end_time,
          });
        }
      }
    });

    res.json(buildings);
  });
});

// ✅ Add building
router.post("/", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  db.query("INSERT INTO buildings (name) VALUES (?)", [name], (err, result) => {
    if (err) {
      console.error("Error adding building:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ id: result.insertId, name });
  });
});

// ✅ Delete building (and its rooms)
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  // Delete related rooms first
  db.query("DELETE FROM rooms WHERE building_id = ?", [id], (err) => {
    if (err) {
      console.error("Error deleting rooms:", err);
      return res.status(500).json({ error: "Error deleting related rooms" });
    }

    // Then delete building
    db.query("DELETE FROM buildings WHERE id = ?", [id], (err, result) => {
      if (err) {
        console.error("Error deleting building:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (result.affectedRows === 0)
        return res.status(404).json({ error: "Building not found" });

      res.json({ message: "Building and its rooms deleted successfully" });
    });
  });
});
// ✅ Update a building
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Building name is required" });
  }

  db.query(
    "UPDATE buildings SET name = ? WHERE id = ?",
    [name, id],
    (err, result) => {
      if (err) {
        console.error("Error updating building:", err);
        return res.status(500).json({ message: "Failed to update building" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Building not found" });
      }

      res.json({ message: "Building updated successfully" });
    }
  );
});

module.exports = router;
