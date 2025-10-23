// app.get("/api/rooms/:buildingId", async (req, res) => {
//     const { buildingId } = req.params;
//     const [rows] = await db.query("SELECT * FROM rooms WHERE building_id = ?", [buildingId]);
//     res.json(rows);
//   });
  
//   app.post("/api/rooms", async (req, res) => {
//     const { building_id, name } = req.body;
//     await db.query("INSERT INTO rooms (building_id, name) VALUES (?, ?)", [building_id, name]);
//     res.json({ message: "Room added" });
//   });

// routes/rooms.js
// routes/rooms.js
// const express = require("express");
// const router = express.Router();
// const db = require("../db");


// // Get rooms by building
// router.get("/:buildingId", (req, res) => {
//   const { buildingId } = req.params;
//   db.query("SELECT * FROM rooms WHERE building_id = ?", [buildingId], (err, results) => {
//     if (err) {
//       console.error("Error fetching rooms:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(results);
//   });
// });

// // Add new room
// router.post("/", (req, res) => {
//   const { name, buildingId } = req.body;
//   db.query("INSERT INTO rooms (name, building_id) VALUES (?, ?)", [name, buildingId], (err, result) => {
//     if (err) {
//       console.error("Error adding room:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json({ id: result.insertId, name, buildingId });
//   });
// });

// module.exports = router;

//scispace

// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // Assuming you have a db connection setup

// // Get all buildings with their rooms
// router.get("/", (req, res) => {
//   // Fetch buildings from the buildings table
//   db.query("SELECT * FROM buildings", (err, buildings) => {
//     if (err) {
//       console.error("Error fetching buildings:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     // Log to check buildings fetched
//     console.log("Buildings fetched:", buildings);

//     // If no buildings exist, return empty array
//     if (!buildings || buildings.length === 0) {
//       return res.json([]);
//     }

//     // For each building, fetch its rooms
//     const buildingsWithRooms = buildings.map((building) => {
//       return new Promise((resolve, reject) => {
//         // Fetch rooms for each building
//         db.query("SELECT * FROM rooms WHERE building_id = ?", [building.id], (err, rooms) => {
//           if (err) {
//             reject(err);
//           } else {
//             // Log to check rooms fetched for each building
//             console.log(`Rooms for building ${building.name}:`, rooms);
//             // IMPORTANT: Ensure rooms is always an array and properly structured
//             building.rooms = rooms || [];  
//             resolve(building);
//           }
//         });
//       });
//     });

//     // Wait for all building queries to complete
//     Promise.all(buildingsWithRooms)
//       .then((result) => {
//         // Log final result with rooms
//         console.log("Buildings with rooms:", result);
//         res.json(result);  // Return the buildings with their rooms
//       })
//       .catch((err) => {
//         console.error("Error fetching rooms:", err);
//         res.status(500).json({ error: "Database error" });
//       });
//   });
// });

// // Get rooms by building
// router.get("/:buildingId", (req, res) => {
//   const { buildingId } = req.params;
//   db.query("SELECT * FROM rooms WHERE building_id = ?", [buildingId], (err, results) => {
//     if (err) {
//       console.error("Error fetching rooms:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(results);
//   });
// });

// // Add new room - FIXED: Return proper room object structure
// router.post("/", (req, res) => {
//   const { name, buildingId } = req.body;
  
//   // Validate input
//   if (!name || !buildingId) {
//     return res.status(400).json({ error: "Name and buildingId are required" });
//   }
  
//   db.query("INSERT INTO rooms (name, building_id) VALUES (?, ?)", [name, buildingId], (err, result) => {
//     if (err) {
//       console.error("Error adding room:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
    
//     // Return the complete room object that matches the database structure
//     const newRoom = {
//       id: result.insertId,
//       name: name,
//       building_id: buildingId, // Make sure this matches your database column name
//       buildingId: buildingId   // Also include camelCase for frontend compatibility
//     };
    
//     console.log("New room created:", newRoom);
//     res.json(newRoom);
//   });
// });

// module.exports = router;

// FUNCTIONAL

// const express = require("express");
// const router = express.Router();
// const db = require("../db"); // adjust if you have db connection differently

// // Get all rooms by building
// router.get("/:buildingId", (req, res) => {
//   const { buildingId } = req.params;
//   db.query(
//     "SELECT * FROM rooms WHERE building_id = ?",
//     [buildingId],
//     (err, results) => {
//       if (err) {
//         console.error("Error fetching rooms:", err);
//         return res.status(500).json({ error: "Database error" });
//       }
//       res.json(results);
//     }
//   );
// });

// // Add new room
// router.post("/", (req, res) => {
//   const { name, buildingId } = req.body;

//   if (!name || !buildingId) {
//     return res.status(400).json({ error: "Missing room name or buildingId" });
//   }

//   const query = "INSERT INTO rooms (name, building_id) VALUES (?, ?)";
//   db.query(query, [name, buildingId], (err, result) => {
//     if (err) {
//       console.error("Error adding room:", err);
//       return res.status(500).json({ error: "Database error" });
//     }

//     // Return newly inserted room
//     const newRoom = {
//       id: result.insertId,
//       name,
//       buildingId: Number(buildingId),
//     };

//     res.status(201).json(newRoom);
//   });
// });

// module.exports = router;
const express = require("express");
const router = express.Router();
const db = require("../db");

//ADD
// ✅ Get ALL rooms (add this route FIRST before the /:buildingId route)
router.get("/", (req, res) => {
  db.query("SELECT * FROM rooms", (err, results) => {
    if (err) {
      console.error("Error fetching rooms:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});
// ✅ Get all rooms by building
router.get("/:buildingId", (req, res) => {
  const { buildingId } = req.params;
  db.query("SELECT * FROM rooms WHERE building_id = ?", [buildingId], (err, results) => {
    if (err) {
      console.error("Error fetching rooms:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ✅ Add new room
router.post("/", (req, res) => {
  const { name, buildingId } = req.body;

  if (!name || !buildingId) {
    return res.status(400).json({ error: "Missing room name or buildingId" });
  }

  const query = "INSERT INTO rooms (name, building_id) VALUES (?, ?)";
  db.query(query, [name, buildingId], (err, result) => {
    if (err) {
      console.error("Error adding room:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.status(201).json({
      id: result.insertId,
      name,
      buildingId: Number(buildingId),
    });
  });
});

// ✅ Delete room
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM rooms WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Error deleting room:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Room not found" });

    res.json({ message: "Room deleted successfully" });
  });
});

// ✅ Update room
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, buildingId } = req.body;

  if (!name || !buildingId) {
    return res.status(400).json({ message: "Room name and building ID are required" });
  }

  db.query(
    "UPDATE rooms SET name = ?, building_id = ? WHERE id = ?",
    [name, buildingId, id],
    (err, result) => {
      if (err) {
        console.error("Error updating room:", err);
        return res.status(500).json({ message: "Failed to update room" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json({ message: "Room updated successfully" });
    }
  );
});
module.exports = router;
