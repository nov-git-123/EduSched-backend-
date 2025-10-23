const mysql = require("mysql");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // Your Firebase Admin SDK key

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Connect to MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "capstone_edusched_app"
});

// Default Admin Configuration
const DEFAULT_ADMIN = {
  email: "admin@edusched.com",
  password: "Admin@123456", // Change this to a secure password
  full_name: "System Administrator",
  role: "admin"
};

async function seedAdmin() {
  try {
    console.log("🔄 Checking if admin exists...");

    // Check if admin already exists in Firebase
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(DEFAULT_ADMIN.email);
      console.log("✅ Admin already exists in Firebase");
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create admin in Firebase Auth
        console.log("🔄 Creating admin in Firebase Auth...");
        firebaseUser = await admin.auth().createUser({
          email: DEFAULT_ADMIN.email,
          password: DEFAULT_ADMIN.password,
          displayName: DEFAULT_ADMIN.full_name,
          emailVerified: true
        });
        console.log("✅ Admin created in Firebase with UID:", firebaseUser.uid);
      } else {
        throw error;
      }
    }

    // Check if admin exists in MySQL
    db.connect((err) => {
      if (err) {
        console.error("❌ Database connection failed:", err);
        process.exit(1);
      }

      const checkSql = "SELECT * FROM users WHERE email = ?";
      db.query(checkSql, [DEFAULT_ADMIN.email], (err, results) => {
        if (err) {
          console.error("❌ Error checking admin:", err);
          db.end();
          process.exit(1);
        }

        if (results.length > 0) {
          console.log("✅ Admin already exists in database");
          console.log("\n📧 Admin Credentials:");
          console.log("   Email:", DEFAULT_ADMIN.email);
          console.log("   Password:", DEFAULT_ADMIN.password);
          db.end();
          process.exit(0);
        }

        // Insert admin into MySQL
        const insertSql = "INSERT INTO users (uid, full_name, email, role) VALUES (?, ?, ?, ?)";
        db.query(
          insertSql,
          [firebaseUser.uid, DEFAULT_ADMIN.full_name, DEFAULT_ADMIN.email, DEFAULT_ADMIN.role],
          (err) => {
            if (err) {
              console.error("❌ Error inserting admin:", err);
              db.end();
              process.exit(1);
            }

            console.log("✅ Admin successfully created in database!");
            console.log("\n📧 Admin Credentials:");
            console.log("   Email:", DEFAULT_ADMIN.email);
            console.log("   Password:", DEFAULT_ADMIN.password);
            console.log("   UID:", firebaseUser.uid);
            console.log("\n⚠️  IMPORTANT: Change the admin password after first login!");
            
            db.end();
            process.exit(0);
          }
        );
      });
    });
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    process.exit(1);
  }
}

seedAdmin();