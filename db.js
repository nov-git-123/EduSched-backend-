// // edusched-backend/db.js
// const mysql = require("mysql");

// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",       // your MySQL username
//   password: "",       // your MySQL password (if any)
//   database: "capstone_edusched_app"  // ✅ correct database name
// });

// db.connect((err) => {
//   if (err) {
//     console.error("Database connection failed:", err);
//     return;
//   }
//   console.log("✅ Connected to MySQL Database: capstone_edusched_app");
// });

// module.exports = db;


const mysql = require('mysql');
const { promisify } = require('util');

const pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'capstone_edusched_app'
});

// Promisify for async/await
pool.query = promisify(pool.query);

module.exports = pool;

