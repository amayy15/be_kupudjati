import cron from "node-cron";
import axios from "axios";

cron.schedule("0 0 * * *", async () => {
  console.log("Attempting to fetch data...");
  try {
    const response = await axios.get("http://localhost:8000/api/run-report");
    console.log("GA4 data fetched and stored:", response.data);
  } catch (error) {
    console.error("Error in CRON job for GA4 data:", error.message);
  }
});

console.log("Cron job for GA4 report scheduling is set up.");
