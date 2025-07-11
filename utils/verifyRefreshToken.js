import UserToken from "../models/userToken.js";
import jwt from "jsonwebtoken";

const verifyRefreshToken = async (refreshToken) => {
  const privateKey = process.env.REFRESH_TOKEN_SECRET;

  try {
    // Find the token in the database using async/await
    const userToken = await UserToken.findOne({ token: refreshToken });

    if (!userToken) {
      throw { error: true, message: "Invalid refresh token" };
    }

    // Verify the token using jwt.verify
    const tokenDetails = await new Promise((resolve, reject) => {
      jwt.verify(refreshToken, privateKey, (error, decoded) => {
        if (error) {
          return reject({ error: true, message: "Invalid refresh token" });
        }
        resolve(decoded);
      });
    });

    // If verification is successful, return token details
    return { tokenDetails, error: false, message: "Valid refresh token" };
  } catch (error) {
    throw error;
  }
};

// const verifyRefreshToken = (req, res, next) => {
//   const token = req.cookies.accessToken;

//   if (!token) {
//     return res.status(403).json({ error: true, message: "Access token missing" });
//   }

//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if (err) {
//       const message =
//         err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";

//       return res.status(403).json({ error: true, message });
//     }

//     req.user = decoded; // attach user data to request
//     next();
//   });
// };

export default verifyRefreshToken;
