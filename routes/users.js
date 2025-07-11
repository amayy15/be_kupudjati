import { Router } from "express";
import auth from "../middlewares/auth.js";
import User from "../models/user.js";
import roleCheck from "../middlewares/checkRole.js";
import { editUserValidation } from "../utils/validationSchema.js";

const router = Router();

// router.get("/home", auth, (req, res) => {
//   res
//     .status(200)
//     .json({
//       message: "user authenticated.",
//       id: req.user._id,
//       username: req.user.username,
//       roles: req.user.roles,
//     });
// });

router.get("/home", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    console.log("User authenticated:", user.username);

    return res.status(200).json({
      message: "User authenticated.",
      id: user._id,
      username: user.username,
      email: user.email,
      roles: user.roles,
    });
  } catch (error) {
    console.error("Error in /home route:", error);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
});
// router.get("/home", auth, (req, res) => {
//   res.status(200).json({
//     message: "User authenticated.",
//     id: req.user._id,
//     username: req.user.username,
//     email: req.user.email,
//     roles: req.user.roles,
//   });
// });

router.get("/validate-session", (req, res) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  if (!accessToken) {
    console.log("Access token is missing...");

    // If no accessToken, check if refreshToken exists
    if (refreshToken) {
      return res.status(200).json({
        authenticated: false,
        message: "No access token, but refresh token exists",
        hasRefreshToken: true,
      });
    }

    // If no accessToken and no refreshToken
    return res.status(200).json({
      authenticated: false,
      message: "No tokens provided",
    });
  }

  // Verify access token
  try {
    const tokenDetails = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET
    );
    console.log("Access token verified:", tokenDetails);

    // If token is valid, user is authenticated
    return res.status(200).json({
      authenticated: true,
      user: tokenDetails,
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.log("Access token expired.");
      return res.status(403).json({ error: true, message: "Token expired" });
    }

    console.error("Invalid access token:", error.message);
    return res.status(403).json({ error: true, message: "Invalid token" });
  }
});

router.get("/register", auth, (req, res) => {
  res.status(200).json({ message: "Super Admin authenticated." });
});

router.get("/getUsers", auth, roleCheck("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || ""; // Get the search query

    const query = search
      ? { username: { $regex: search, $options: "i" } } // Case-insensitive search
      : {};

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select("-password")
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query); // Total matching documents

    res.status(200).json({
      error: false,
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: true, message: "Internal server error" });
  }
});

router.get("/getUser/:id", auth, roleCheck("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user)
      return res.status(404).json({ error: true, message: "User not found" });

    res.status(200).json({ error: false, user });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.put("/editUser/:id", auth, roleCheck("admin"), async (req, res) => {
  try {
    const { error } = editUserValidation(req.body, req.user.roles); // Pass user's roles for validation
    if (error) {
      return res
        .status(400)
        .json({ error: true, message: error.details[0].message });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    // Check for existing username
    if (req.body.username && req.body.username !== user.username) {
      const usernameExists = await User.findOne({
        username: req.body.username,
      });
      if (usernameExists && usernameExists._id.toString() !== req.params.id) {
        return res
          .status(409)
          .json({ error: true, message: "Username already exists" });
      }
    }

    // Check for existing email
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists && emailExists._id.toString() !== req.params.id) {
        return res
          .status(409)
          .json({ error: true, message: "Email already exists" });
      }
    }
const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.status(200).json({
      error: false,
      message: "User updated successfully",
      updatedUser,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

export default router;
