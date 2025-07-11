import { Router } from "express";
import { config } from "dotenv";
import { GoogleAuth } from "google-auth-library";
import axios from "axios";
import GA4Report from "../models/ga4report.js";
import { format } from "date-fns";
import idLocale from "date-fns/locale/id";

config();
const router = Router();

// Replace with the path to your GA4 credentials JSON file
const keyFile = "./config/website-440222-f4f0ce19dc38.json";
const propertyId = process.env.GA4_PROPERTY_ID;

router.get("/get-reports", async (req, res) => {
  try {
    const { year } = req.query; // e.g., /get-reports?year=2024
    const yearString = year.toString(); // Convert the year to a string if needed

    // Fetch the reports from the database
    const reports = await GA4Report.find({
      monthYear: { $regex: yearString },
    });

    // List of base paths to include
    const includePaths = ["/Faqs", "/naskah", "/audio", "/video", "/grafis", "/"];

    // Process each month's data and aggregate stats
    const aggregatedRows = reports.map((report) => {
      // Object to store aggregated data for the current month
      const aggregatedData = {};

      // Initialize base paths in the aggregated data object
      includePaths.forEach((basePath) => {
        aggregatedData[basePath] = {
          pagePath: basePath,
          sessions: 0,
          screenPageViews: 0,
        };
      });

      // Process the data for the current month
      report.data.forEach((item) => {
        const path = item.pagePath;

        // Handle root path explicitly
        if (path === "/") {
          aggregatedData["/"].sessions += item.sessions;
          aggregatedData["/"].screenPageViews += item.screenPageViews;
        } else {
          // Check if the path matches a base path or starts with a base path
          const basePath = includePaths.find(
            (base) =>
              base !== "/" && (path === base || path.startsWith(base + "/"))
          );

          // If it matches, add the stats to the base path
          if (basePath) {
            aggregatedData[basePath].sessions += item.sessions;
            aggregatedData[basePath].screenPageViews += item.screenPageViews;
          }
        }
      });

      // Convert the aggregated data object to an array for the current month
      return {
        _id: report._id,
        monthYear: report.monthYear,
        data: Object.values(aggregatedData),
        __v: report.__v,
      };
    });

    // Send the aggregated data
    res.json({ rows: aggregatedRows });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.get("/run-realtime-report", async (req, res) => {
  const auth = new GoogleAuth({
    keyFile: keyFile,
    scopes: "https://www.googleapis.com/auth/analytics.readonly",
  });
  try {
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    // console.log(token);

    const now = new Date();
    const endDate = now.toISOString();
    const startDate = new Date(now.getTime() - 10 * 60000).toISOString();

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
      //   {
      //     "name": "test",
      //     "startMinutesAgo": 15,
      //     "endMinutesAgo": 0
      //   },
      {
        dimensions: [
          { name: "unifiedScreenName" },
          { name: "country" },
          { name: "city" },
        ],
        metrics: [
          {
            name: "screenPageViews",
          },
          {
            name: "keyEvents",
          },
          {
            name: "activeUsers",
          },
        ],
        minuteRanges: [
          {
            name: "test",
            startMinutesAgo: 29,
            endMinutesAgo: 0,
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

    console.log(response);

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

router.get("/run-report", async (req, res) => {
  const auth = new GoogleAuth({
    keyFile,
    scopes: "https://www.googleapis.com/auth/analytics.readonly",
  });

  try {
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    const startDate = new Date();
    startDate.setDate(1); // Tanggal 1 bulan sekarang
    startDate.setMonth(startDate.getMonth() - 1); // Bulan sebelumnya

    const endDate = new Date();
    endDate.setDate(0); // Hari terakhir bulan sebelumnya

    const formattedStartDate = startDate.toISOString().split("T")[0];
    const formattedEndDate = endDate.toISOString().split("T")[0];

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        dateRanges: [
          { startDate: formattedStartDate, endDate: formattedEndDate },
        ],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reportData = response.data.rows.map((row) => ({
      pagePath: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value, 10),
      screenPageViews: parseInt(row.metricValues[1].value, 10),
    }));

    // Format bulan dan tahun
    const formattedMonth = `${startDate.toLocaleString("id-ID", {
      month: "long",
    })} ${startDate.getFullYear()}`;

    const monthlyReport = {
      monthYear: formattedMonth,
      data: reportData,
    };

    // Periksa apakah data untuk bulan ini sudah ada
    const existingReport = await GA4Report.findOne({ monthYear: formattedMonth });

    if (existingReport) {
      // Jika ada, perbarui data
      existingReport.data = reportData;
      await existingReport.save();
      console.log(`Updated report for ${formattedMonth}`);
      res.status(200).json({ message: `Updated report for ${formattedMonth}` });
    } else {
      // Jika tidak ada, buat data baru
      const savedReport = await GA4Report.create(monthlyReport);
      console.log(`Saved new report for ${formattedMonth}`);
      res.status(201).json(savedReport);
    }
  } catch (error) {
    console.error("Error fetching report:", error.message);
    res.status(500).send("Error fetching report data.");
  }
});

export default router;

