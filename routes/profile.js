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
// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // ✅ 1. GET profile by Firebase UID (most accurate)
// router.get("/uid/:uid", async (req, res) => {
//   const { uid } = req.params;
//   console.log("📥 Received request for UID:", uid);

//   try {
//     const [rows] = await db.query(
//       `SELECT 
//          id AS userId,
//          uid,
//          full_name AS name,
//          email,
//          role,
//          profile_pic AS photo_url,
//          created_at,
//          updated_at
//        FROM users 
//        WHERE uid = ?`,
//       [uid]
//     );

//     if (!rows || rows.length === 0) {
//       console.log("⚠️ No user found for UID:", uid);
//       return res.status(404).json({ message: "Profile not found in database." });
//     }

//     console.log("✅ User found:", rows[0]);
//     res.json(rows[0]);
//   } catch (error) {
//     console.error("❌ Database query failed:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// });

// // ✅ 2. GET profile by instructorId (fallback)
// router.get("/id/:instructorId", async (req, res) => {
//   const { instructorId } = req.params;
//   console.log("📥 Received request for instructorId:", instructorId);

//   try {
//     // Step 1: Find instructor info
//     const [instructorRows] = await db.query(
//       "SELECT name FROM instructors WHERE id = ?",
//       [instructorId]
//     );

//     if (!instructorRows || instructorRows.length === 0) {
//       console.log("⚠️ Instructor not found:", instructorId);
//       return res.status(404).json({ message: "Instructor not found" });
//     }

//     const instructorName = instructorRows[0].name;
//     console.log("👤 Instructor name found:", instructorName);

//     // Step 2: Find matching user record using full_name
//     const [userRows] = await db.query(
//       `SELECT 
//          id AS userId,
//          uid,
//          full_name AS name,
//          email,
//          role,
//          profile_pic AS photo_url,
//          created_at,
//          updated_at
//        FROM users 
//        WHERE TRIM(LOWER(full_name)) = TRIM(LOWER(?))`,
//       [instructorName]
//     );

//     if (!userRows || userRows.length === 0) {
//       console.log("⚠️ No user found linked to instructor:", instructorName);
//       return res.status(404).json({ message: "User not found" });
//     }

//     console.log("✅ User found:", userRows[0]);
//     res.json(userRows[0]);
//   } catch (error) {
//     console.error("❌ Database query failed:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// });

// // ✅ 3. GET profile by email
// router.get("/email/:email", async (req, res) => {
//   const { email } = req.params;
//   console.log("📥 Received request for profile email:", email);

//   try {
//     const [rows] = await db.query(
//       `SELECT 
//          id AS userId,
//          uid,
//          full_name AS name,
//          email,
//          role,
//          profile_pic AS photo_url,
//          created_at,
//          updated_at
//        FROM users 
//        WHERE email = ?`,
//       [email]
//     );

//     if (!rows || rows.length === 0) {
//       console.log("⚠️ No user found for email:", email);
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

// ==================== routes/profile.js ====================
// ==================== routes/profile.js ====================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../db'); // Your existing database connection

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-pictures');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: userId-timestamp-originalname
    const uniqueName = `user-${req.body.userId}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ==================== GET PROFILE ====================
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const sql = 'SELECT uid as id, full_name as displayName, email, profile_picture as photoURL, role FROM users WHERE uid = ?';
    
    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: results[0]
      });
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// ==================== GET PROFILE BY EMAIL ====================
router.get('/by-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const sql = 'SELECT uid as id, full_name as displayName, email, profile_picture as photoURL, role FROM users WHERE email = ?';
    
    db.query(sql, [email], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: results[0]
      });
    });

  } catch (error) {
    console.error('Get user by email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// ==================== UPDATE PROFILE ====================
router.post('/update', upload.single('profilePhoto'), async (req, res) => {
  try {
    const { userId, displayName, password } = req.body;
    const profilePhoto = req.file;

    console.log('Update request received:', { userId, displayName, hasPhoto: !!profilePhoto, hasPassword: !!password });

    // Validate required fields
    if (!userId || !displayName) {
      // Delete uploaded file if validation fails
      if (profilePhoto) {
        fs.unlinkSync(profilePhoto.path);
      }
      
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and display name are required' 
      });
    }

    // Get current user data from users table using uid column
    const getUserSql = 'SELECT * FROM users WHERE uid = ?';
    
    db.query(getUserSql, [userId], async (err, users) => {
      if (err) {
        console.error('Database error:', err);
        
        // Delete uploaded file if error
        if (profilePhoto) {
          fs.unlinkSync(profilePhoto.path);
        }
        
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      console.log('User found:', users.length > 0 ? 'Yes' : 'No');

      if (users.length === 0) {
        // Delete uploaded file if user not found
        if (profilePhoto) {
          fs.unlinkSync(profilePhoto.path);
        }
        
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      const currentUser = users[0];
      let updateFields = [];
      let updateValues = [];

      // Update display name using full_name column
      updateFields.push('full_name = ?');
      updateValues.push(displayName);

      // Update photo URL if new photo uploaded
      if (profilePhoto) {
        const photoURL = `/uploads/profile-pictures/${profilePhoto.filename}`;
        updateFields.push('profile_picture = ?');
        updateValues.push(photoURL);

        // Delete old photo if exists
        if (currentUser.profile_picture) {
          const oldPhotoPath = path.join(__dirname, '..', currentUser.profile_picture);
          if (fs.existsSync(oldPhotoPath)) {
            try {
              fs.unlinkSync(oldPhotoPath);
              console.log('Old photo deleted:', oldPhotoPath);
            } catch (unlinkErr) {
              console.error('Error deleting old photo:', unlinkErr);
            }
          }
        }
      }

      // Update password if provided
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push('password = ?');
        updateValues.push(hashedPassword);
      }

      // Add userId for WHERE clause
      updateValues.push(userId);

      // Update database using uid column
      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')} 
        WHERE uid = ?
      `;

      console.log('Executing update query:', updateQuery);

      db.query(updateQuery, updateValues, (updateErr, updateResult) => {
        if (updateErr) {
          console.error('Update error:', updateErr);
          
          // Delete uploaded file if update fails
          if (profilePhoto) {
            fs.unlinkSync(profilePhoto.path);
          }
          
          return res.status(500).json({
            success: false,
            message: 'Failed to update profile'
          });
        }

        console.log('Update successful, rows affected:', updateResult.affectedRows);

        // Get updated user data
        const getUpdatedSql = 'SELECT uid as id, full_name as displayName, email, profile_picture as photoURL, role FROM users WHERE uid = ?';
        
        db.query(getUpdatedSql, [userId], (getErr, updatedUsers) => {
          if (getErr) {
            console.error('Error fetching updated user:', getErr);
            return res.status(500).json({
              success: false,
              message: 'Profile updated but failed to fetch updated data'
            });
          }

          res.json({
            success: true,
            message: 'Profile updated successfully',
            displayName: updatedUsers[0].displayName,
            photoURL: updatedUsers[0].photoURL,
            role: updatedUsers[0].role
          });
        });
      });
    });

  } catch (error) {
    console.error('Profile update error:', error);
    
    // Delete uploaded file if error occurs
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile'
    });
  }
});

// ==================== DELETE PROFILE PHOTO ====================
router.delete('/photo/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('Delete photo request for user ID:', userId);

    // Get current user from users table using uid column
    const getUserSql = 'SELECT profile_picture FROM users WHERE uid = ?';
    
    db.query(getUserSql, [userId], (err, users) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error'
        });
      }

      if (users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      const photoURL = users[0].profile_picture;

      if (photoURL) {
        // Delete file from server
        const photoPath = path.join(__dirname, '..', photoURL);
        if (fs.existsSync(photoPath)) {
          try {
            fs.unlinkSync(photoPath);
            console.log('Photo file deleted:', photoPath);
          } catch (unlinkErr) {
            console.error('Error deleting file:', unlinkErr);
          }
        }

        // Update database using uid column
        const updateSql = 'UPDATE users SET profile_picture = NULL WHERE uid = ?';
        
        db.query(updateSql, [userId], (updateErr, result) => {
          if (updateErr) {
            console.error('Update error:', updateErr);
            return res.status(500).json({
              success: false,
              message: 'Failed to update database'
            });
          }

          console.log('Photo removed from database');

          res.json({
            success: true,
            message: 'Profile photo deleted successfully'
          });
        });
      } else {
        res.json({
          success: true,
          message: 'No profile photo to delete'
        });
      }
    });

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile photo'
    });
  }
});

module.exports = router;


// ==================== FRONTEND UPDATE ====================
/*
In your React component, update the API call to use the correct field name:

// The component should get the uid from your currentUser object
const performUpdate = async () => {
  setLoading(true);
  setShowConfirmModal(false);

  try {
    const formData = new FormData();
    formData.append('displayName', displayName.trim());
    
    // Make sure to use the uid field from your database
    // If currentUser has uid, use that. Otherwise use id.
    const userId = currentUser.uid || currentUser.id;
    console.log('Sending userId:', userId);
    
    formData.append('userId', userId);

    if (photoFile) {
      formData.append('profilePhoto', photoFile);
    }

    if (password) {
      formData.append('password', password);
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/profile/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    // ... rest of your code
  } catch (error) {
    console.error("Profile update error:", error);
    showToast(`Error updating profile: ${error.message}`, "error");
  } finally {
    setLoading(false);
  }
};
*/


// ==================== ADD TO YOUR server.js ====================
/*
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Your existing middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import profile routes
const profileRoutes = require('./routes/profile');

// Use profile routes
app.use('/api/profile', profileRoutes);

// Your other routes...
const buildingsRoutes = require('./routes/buildings');
const coursesRoutes = require('./routes/courses');
const schedulesRoutes = require('./routes/schedules');
// ... etc

app.use('/api/buildings', buildingsRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/schedules', schedulesRoutes);
// ... etc

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/


// ==================== TESTING ====================
/*
Test the endpoints using these IDs from your database:

GET Profile:
http://localhost:5000/api/profile/MW2DuyncOWjU2uQhuJDKDapBcP3cq1

UPDATE Profile:
POST http://localhost:5000/api/profile/update
Body (form-data):
- userId: MW2DuyncOWjU2uQhuJDKDapBcP3cq1
- displayName: Lance Arcilyn Montiano
- profilePhoto: [image file]

DELETE Photo:
DELETE http://localhost:5000/api/profile/photo/MW2DuyncOWjU2uQhuJDKDapBcP3cq1
*/