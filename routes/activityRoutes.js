// routes/activityRoutes.js
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// ✅ Database Configuration (using environment variables)
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'capstone_edusched_app',

};

// ✅ Create connection pool for better performance
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ✅ Initialize activity_logs table
const initializeTable = async () => {
  try {
    const connection = await pool.getConnection();
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_role ENUM('dean', 'instructor', 'staff') NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        INDEX idx_user_id (user_id),
        INDEX idx_user_role (user_role),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await connection.execute(createTableSQL);
    connection.release();
    console.log('✅ Activity logs table initialized');
  } catch (error) {
    console.error('❌ Error initializing activity_logs table:', error);
  }
};

// Initialize table on module load
initializeTable();

// ===============================================
// 📊 API ENDPOINTS
// ===============================================

// ✅ POST /api/log-activity - Create new activity log
router.post('/api/log-activity', async (req, res) => {
  try {
    const { user_id, user_name, user_role, action, details } = req.body;

    // Validate required fields
    if (!user_id || !user_name || !user_role || !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, user_name, user_role, action'
      });
    }

    // Validate user_role
    const validRoles = ['dean', 'instructor', 'staff'];
    if (!validRoles.includes(user_role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user_role. Must be: dean, instructor, or staff'
      });
    }

    // Get IP address
    const ip_address = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';

    const [result] = await pool.execute(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, details, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, user_name, user_role, action, details || '', ip_address]
    );

    res.status(201).json({
      success: true,
      message: 'Activity logged successfully',
      log_id: result.insertId
    });

  } catch (error) {
    console.error('❌ Error logging activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log activity'
    });
  }
});

// ✅ GET /api/activity-logs - Get all recent logs (last 50)
router.get('/api/activity-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    const [rows] = await pool.execute(
      `SELECT * FROM activity_logs 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      count: rows.length,
      logs: rows
    });

  } catch (error) {
    console.error('❌ Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity logs'
    });
  }
});

// ✅ GET /api/activity-logs/user/:userId - Get logs for specific user
router.get('/api/activity-logs/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const [rows] = await pool.execute(
      `SELECT * FROM activity_logs 
       WHERE user_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [userId, limit]
    );

    res.json({
      success: true,
      count: rows.length,
      logs: rows
    });

  } catch (error) {
    console.error('❌ Error fetching user logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user logs'
    });
  }
});

// ✅ GET /api/activity-logs/role/:role - Get logs by role
router.get('/api/activity-logs/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Validate role
    const validRoles = ['dean', 'instructor', 'staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be: dean, instructor, or staff'
      });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM activity_logs 
       WHERE user_role = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [role, limit]
    );

    res.json({
      success: true,
      count: rows.length,
      logs: rows
    });

  } catch (error) {
    console.error('❌ Error fetching role logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role logs'
    });
  }
});

// ✅ GET /api/activity-logs/recent-logins - Get recent login activities
router.get('/api/activity-logs/recent-logins', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const [rows] = await pool.execute(
      `SELECT * FROM activity_logs 
       WHERE action LIKE '%logged in%' 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      count: rows.length,
      logs: rows
    });

  } catch (error) {
    console.error('❌ Error fetching login logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch login logs'
    });
  }
});

// ✅ GET /api/activity-logs/stats - Get activity statistics
router.get('/api/activity-logs/stats', async (req, res) => {
  try {
    // Total logs count
    const [totalCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM activity_logs'
    );

    // Logs by role
    const [roleStats] = await pool.execute(`
      SELECT 
        user_role,
        COUNT(*) as count
      FROM activity_logs
      GROUP BY user_role
    `);

    // Recent activity (last 24 hours)
    const [recentActivity] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM activity_logs
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    // Most active users (top 5)
    const [activeUsers] = await pool.execute(`
      SELECT 
        user_name,
        user_role,
        COUNT(*) as activity_count
      FROM activity_logs
      GROUP BY user_id, user_name, user_role
      ORDER BY activity_count DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        total_logs: totalCount[0].total,
        logs_by_role: roleStats,
        last_24_hours: recentActivity[0].count,
        most_active_users: activeUsers
      }
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// ✅ GET /api/activity-logs/date-range - Get logs within date range
router.get('/api/activity-logs/date-range', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Both start_date and end_date are required (YYYY-MM-DD format)'
      });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM activity_logs 
       WHERE DATE(timestamp) BETWEEN ? AND ?
       ORDER BY timestamp DESC`,
      [start_date, end_date]
    );

    res.json({
      success: true,
      count: rows.length,
      logs: rows,
      date_range: { start: start_date, end: end_date }
    });

  } catch (error) {
    console.error('❌ Error fetching date range logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs for date range'
    });
  }
});

// ✅ DELETE /api/activity-logs/cleanup - Delete logs older than specified days
router.delete('/api/activity-logs/cleanup', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90; // Default: 90 days

    const [result] = await pool.execute(
      `DELETE FROM activity_logs 
       WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );

    res.json({
      success: true,
      message: `Deleted logs older than ${days} days`,
      deleted_count: result.affectedRows
    });

  } catch (error) {
    console.error('❌ Error cleaning up logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup old logs'
    });
  }
});

// ✅ GET /api/activity-logs/search - Search logs by keyword
router.get('/api/activity-logs/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'Search keyword is required'
      });
    }

    const searchTerm = `%${keyword}%`;
    const [rows] = await pool.execute(
      `SELECT * FROM activity_logs 
       WHERE action LIKE ? OR details LIKE ? OR user_name LIKE ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [searchTerm, searchTerm, searchTerm, limit]
    );

    res.json({
      success: true,
      count: rows.length,
      logs: rows,
      keyword: keyword
    });

  } catch (error) {
    console.error('❌ Error searching logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search logs'
    });
  }
});

module.exports = router;
