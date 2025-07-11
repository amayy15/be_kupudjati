import { Router } from "express";
import UserToken from "../models/userToken.js";
import jwt from "jsonwebtoken";
import verifyRefreshToken from "../utils/verifyRefreshToken.js";
import { refreshTokenValidation } from "../utils/validationSchema.js";

const router = Router();

// router.post("/", async (req, res) => {
//   const { error } = refreshTokenValidation(req.body);
//   if (error)
//     return res
//       .status(400)
//       .json({ error: true, message: error.details[0].message });

//   try {
//     const { tokenDetails } = await verifyRefreshToken(req.body.refreshToken);

//     const payload = {
//       _id: tokenDetails._id,
//       roles: tokenDetails.roles,
//     };

//     const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
//       expiresIn: "25m",
//     });

//     res.status(200).json({
//       error: false,
//       accessToken,
//       message: "Access token generated successfully",
//     });
//   } catch (error) {
//     res.status(400).json({ error: true, message: error.message });
//   }
// });

// router.delete("/", async (req, res) => {
//   try {
//     const { error } = refreshTokenValidation(req.body);
//     if (error)
//       return res
//         .status(400)
//         .json({ error: true, message: error.details[0].message });

//     const userToken = await UserToken.findOne({ token: req.body.refreshToken });

//     if (!userToken)
//       return res
//         .status(200)
//         .json({ error: false, message: "Logged Out Successfully" });

//     await userToken.deleteOne();
//     res.status(200).json({ error: false, message: "Logged Out Successfully" });
//   } catch (error) {
//     console.log(error);
//     res.status(500).send({ error: true, message: "Internal server error" });
//   }
// });

router.post("/refresh", async (req, res) => {
  console.log("Refresh endpoint hit. Cookies:", req.cookies);

  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    console.log("Refresh token missing.");
    return res
      .status(403)
      .json({ error: true, message: "Refresh token missing" });
  }

  try {
    const { tokenDetails } = await verifyRefreshToken(refreshToken);
    console.log("Token details from refresh token:", tokenDetails);

    const newAccessToken = jwt.sign(
      {
        _id: tokenDetails._id,
        roles: tokenDetails.roles,
        username: tokenDetails.username,
        email: tokenDetails.email,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "25m" }
    );

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 25 * 60 * 1000, // 25 minutes
    });

    res.status(200).json({ message: "Token refreshed successfully" });
  } catch (error) {
    console.error("Error in refresh endpoint:", error.message);
    res.status(403).json({ error: true, message: "Invalid refresh token" });
  }
});

router.post("/", (req, res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  });
  res.status(200).json({ message: "Logged out successfully" });
});

export default router;
