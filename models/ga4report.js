import mongoose from "mongoose";

const Schema = mongoose.Schema;

const GA4ReportSchema = new Schema({
  monthYear: {
    type: String,
    required: true, // Ensure monthYear is always provided
  },
  data: [
    {
      pagePath: String,
      sessions: Number,
      screenPageViews: Number,
    },
  ],
});

const GA4Report = mongoose.model("GA4Report", GA4ReportSchema);

export default GA4Report;
