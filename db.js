import mongoose from "mongoose";
import mysql from "mysql2";
import { config } from "dotenv";

config();

const connection = async () => {
  const connectParams = { useNewUrlParser: true };
  mongoose.connect(process.env.DB, connectParams);

  mongoose.connection.on("connected", () => {
    console.log("Connected to MongoDB");
  });

  mongoose.connection.on("error", (error) => {
    console.log(`Error: ${error}`);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("Disconnected from MongoDB");
  });
};

const mysqlConnection = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  port: process.env.MYSQL_PORT,
  waitForConnections: true,
  // connectionLimit: 10,
  queueLimit: 0,
});

export { connection, mysqlConnection };
