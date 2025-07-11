import { config } from "dotenv";
import mysql from "mysql2/promise";
import express from "express";
import cors from "cors";
import { connection, mysqlConnection as mysqlConn} from "./db.js";
import authRoutes from "./routes/auth.js";
import refreshTokenRoutes from "./routes/refreshToken.js";
import userRoutes from "./routes/users.js";
import booksRoutes from "./routes/catalog.js";
import categoryRoutes from "./routes/category.js";
import roleCheck from "./middlewares/checkRole.js";
import cookieParser from "cookie-parser";
import auth from "./middlewares/auth.js";
import File from "./models/file.js";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleAuth } from "google-auth-library";
import axios from "axios";
import ga4Routes from "./routes/ga4report.js";
import "./utils/cronJob.js";
import {sendTemplatedEmail} from "./utils/nodemailer.js";

const keyFile = "./config/website-440222-f4f0ce19dc38.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

//database connection
config();
connection();

//middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:41260"], // Replace with your frontend URL
    credentials: true, // Allow credentials (cookies)
  })
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//routes
app.use("/api", authRoutes, booksRoutes, categoryRoutes, ga4Routes);
app.use("/api/refreshToken", refreshTokenRoutes);
app.use("/api/users", userRoutes);

async function getAccessToken() {
  const auth = new GoogleAuth({
    keyFile: keyFile,
    scopes: "https://www.googleapis.com/auth/analytics.readonly",
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  console.log(accessToken);
}

getAccessToken();

app.get("/nodemail-test", async (req, res) => {
  const tes1 = "damayseptiana@gmail.com";
  const tes2 = "AMAYYYYYYYYYYY";
  const tes3 = "amay123A_";
  try {
    await sendTemplatedEmail(tes1, tes2, tes3);
    res.status(200).json({
      error: false,
      message: "Email Terkirim!",
      email: tes1,
      username: tes2,
      password: tes3,
    });
  } catch (error) {
    res.status(500).send({ error: true, message: "gagal", error });
  }
});

// app.get("/api/run-realtime-report", async (req, res) => {
//   const auth = new GoogleAuth({
//     keyFile: keyFile,
//     scopes: "https://www.googleapis.com/auth/analytics.readonly",
//   });
//   try {
//     const client = await auth.getClient();
//     const { token } = await client.getAccessToken();

//     const response = await axios.post(
//       `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runRealtimeReport`, // Your GA4 property ID here
//       // {
//       //   dimensions: [{ name: "eventName" }, { name: "eventParams.key" }],
//       //   metrics: [{ name: "eventCount" }],
//       //   dimensionFilter: {
//       //     filter: {
//       //       fieldName: "eventName",
//       //       stringFilter: {
//       //         matchType: "EXACT",
//       //         value: `wego_custom_event`, // Ensure this matches the frontend event name
//       //       },
//       //     },
//       //   },
//       // },
//       {
//         dimensions: [
//           { name: "unifiedScreenName" },
//           { name: "country" },
//           { name: "city" },
//         ],
//         metrics: [
//           {
//             name: "screenPageViews",
//           },
//           {
//             name: "keyEvents",
//           },
//           {
//             name: "activeUsers",
//           },
//         ],
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log(response);

//     res.json(response.data);
//   } catch (error) {
//     console.error(
//       "Error fetching real-time data:",
//       error?.response?.data || error.message
//     );
//     res.status(500).send({
//       message: "Error fetching real-time data",
//       error: error?.response?.data || error.message,
//     });
//   }
// });

app.get("/api/run-report-test", async (req, res) => {
  const auth = new GoogleAuth({
    keyFile: keyFile,
    scopes: "https://www.googleapis.com/auth/analytics.readonly",
  });
  try {
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runReport`, // Your GA4 property ID here
      {
        dateRanges: [
          {
            startDate: "30daysAgo",
            endDate: "yesterday",
          },
        ],
        dimensions: [
          {
            name: "pagePath",
          },
        ],
        metrics: [
          {
            name: "sessions",
          },
          {
            name: "screenPageViews", // Changed from pageViews to screenPageViews
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // console.log(response);

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching real-time data:",
      error?.response?.data || error.message
    );
    res.status(500).send({
      message: "Error fetching real-time data",
      error: error?.response?.data || error.message,
    });
  }
});

mysqlConn.query("SELECT 1", (err, results) => {
  if (err) throw err;
  console.log("MySQL query test passed:", results);
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.get("/data", (req, res) => {
  try {
    // const mysqlConn = mysqlConnection();

    const sql =
      "SELECT c.id, c.title, c.author, c.edition, c.publisher, c.publisher, c.publishLocation, c.publishYear, c.publikasi, c.subject, c.physicalDescription FROM catalogs c JOIN collections cl ON c.id = cl.catalog_id JOIN collectionmedias cm ON cl.media_id = cm.id WHERE cm.id = 1 LIMIT 20";

    mysqlConn.query(sql, (error, results) => {
      if (error) {
        console.error("Database query error: ", error);
        return res.status(500).json({ error: "Database query failed" });
      }

      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Server error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/test", (req, res) => {
  try {
    const mediaId = req.query.mediaId;

    // const mysqlConn = mysqlConnection();

    const sql =
      "SELECT c.id, c.title, c.author, c.edition, c.publisher, c.publishLocation, c.publishYear, c.publikasi, c.subject, c.physicalDescription FROM catalogs c JOIN collections cl ON c.id = cl.catalog_id JOIN collectionmedias cm ON cm.id = cl.media_id WHERE cm.id = ?";

    mysqlConn.query(sql, [mediaId], (error, results) => {
      if (error) {
        console.error("Database query error: ", error);
        return res.status(500).json({ error: "Database query failed" });
      }

      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Server error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/category/:id", (req, res) => {
  const { id } = req.params;

  // console.log(id);

  let options;

  if (id == 1) {
    options = ["2", "3", "5", "6", "10", "15", "29", "34", "35", "40"];
  } else if (id == 2) {
    options = ["3", "5", "6", "7", "8"];
  } else if (id == 3) {
    options = ["3", "5", "6", "16", "24", "37"];
  } else if (id == 4) {
    options = ["12", "19", "20", "28", "36", "39", "54"];
  } else {
    return res.status(400).json({ error: "Invalid category ID" }); // Handle invalid id
  }
  try {
    // const mysqlConn = mysqlConnection();

    const sql = "SELECT id, code, name FROM collectionmedias WHERE id IN (?)";

    mysqlConn.query(sql, [options], (error, results) => {
      if (error) {
        console.error("Database query error: ", error);
        return res.status(500).json({ error: "Database query failed" });
      }

      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Server error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/catalogs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // const mysqlConn = mysqlConnection();

    const sql =
      "SELECT DISTINCT c.id, c.title, c.author, c.edition, c.publisher, c.publishLocation, c.publishYear, c.publikasi, c.subject, c.physicalDescription, c.coverURL " +
      "FROM catalogs c JOIN collections cl ON c.id = cl.catalog_id " +
      "JOIN collectionmedias cm ON cl.media_id = cm.id " +
      "WHERE cm.id = ? ORDER BY c.id DESC";

    mysqlConn.query(sql, [id], async (err, results) => {
      if (err) {
        // mysqlConn.end(); // Pastikan koneksi ditutup jika terjadi error
        return res
          .status(500)
          .json({ error: true, message: "SQL Query Error", err });
      }

      // Jika ada hasil, lanjutkan mencari file terkait
      try {
        for (let i = 0; i < results.length; i++) {
          const catalogFile = await File.find({ catalog_id: results[i].id });
          // console.log(results[i].id);
          results[i].files = catalogFile; // Tambahkan data file ke hasil SQL
        }

        res.status(200).json({
          error: false,
          message: "Data Berhasil Diambil",
          results,
        });
      } catch (fileError) {
        return res
          .status(500)
          .json({ error: true, message: "MongoDB Query Error", fileError });
      } finally {
        // mysqlConn.end(); // Pastikan koneksi MySQL selalu ditutup setelah query selesai
      }
    });
  } catch (error) {
    res.status(500).json({ error: true, message: "Server Error", error });
  }
});
