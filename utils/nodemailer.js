import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Define __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendTemplatedEmail = async (to, username, password) => {
  try {
    // Read the HTML template asynchronously
    const templatePath = path.join(__dirname, "..", "mail", "templater.html");
    let htmlTemplate = await fs.readFile(templatePath, "utf-8");

    // Replace variables in the template
    htmlTemplate = htmlTemplate
      .replace("{{username}}", username)
      .replace("{{password}}", password);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Welcome to Our Service!",
      html: htmlTemplate,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log("Email sent with template");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

const sendForgotPasswordEmail = async ({ to, token, resetUrl }) => {
  try {
    // Read the HTML template asynchronously
    const templatePath = path.join(__dirname, "..", "mail", "forgotPassword.html");
    let htmlTemplate = await fs.readFile(templatePath, "utf-8");

    console.log("to:", to);

    // Replace variables in the template
    htmlTemplate = htmlTemplate.replace("{{token}}", token).replace("{{resetUrl}}", resetUrl);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Password Reset Request",
      html: htmlTemplate
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log("Email sent with template");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

export { sendTemplatedEmail, sendForgotPasswordEmail };
