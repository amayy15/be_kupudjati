import { Router } from "express";
import User from "../models/user.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/generateToken.js";
import {
  signUpValidation,
  logInValidation,
  addUserValidation,
} from "../utils/validationSchema.js";
import roleCheck from "../middlewares/checkRole.js";
import auth from "../middlewares/auth.js";
import {sendForgotPasswordEmail} from "../utils/nodemailer.js";

const router = Router();

router.post("/signUp", async (req, res) => {
  try {
    const { error } = signUpValidation(req.body);
    if (error)
      return res
        .status(400)
        .json({ error: true, message: error.details[0].message });

    const user = await User.findOne({ email: req.body.email });

    if (user)
      return res.status(409).json({
        error: true,
        message: "User with given email already exists!",
      });

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);

    await new User({ ...req.body, password: hashPassword }).save();

    res
      .status(201)
      .json({ error: false, message: "User created successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

// router.post("/signIn", async (req, res) => {
//   try {
//     const { error } = logInValidation(req.body);
//     if (error)
//       return res
//         .status(400)
//         .json({ error: true, message: error.details[0].message });

//     const user = await User.findOne({ email: req.body.email });

//     if (!user)
//       return res
//         .status(400)
//         .json({ error: true, message: "invalid email or password" });

//     const verifiedPassword = await bcrypt.compare(
//       req.body.password,
//       user.password
//     );

//     if (!verifiedPassword)
//       return res
//         .status(400)
//         .json({ error: true, message: "invalid email or password" });

//     const { accessToken, refreshToken } = await generateToken(user);

//     res.status(200).json({
//       error: false,
//       accessToken,
//       refreshToken,
//       message: "Logged in successfully",
//     });
//   } catch (error) {
//     console.log(error);
//     res.status(500).send({ error: true, message: "Internal server error" });
//   }
// });

// router.post("/signIn", async (req, res) => {
//   try {
//     const { error } = logInValidation(req.body);
//     if (error) {
//       return res
//         .status(400)
//         .json({ error: true, message: error.details[0].message });
//     }

//     const user = await User.findOne({ email: req.body.email });

//     if (!user) {
//       return res
//         .status(400)
//         .json({ error: true, message: "Invalid email or password" });
//     }

//     const verifiedPassword = await bcrypt.compare(
//       req.body.password,
//       user.password
//     );

//     if (!verifiedPassword) {
//       return res
//         .status(400)
//         .json({ error: true, message: "Invalid email or password" });
//     }

//     const { accessToken, refreshToken } = await generateToken(user);

//     // Set the `httpOnly` cookies for accessToken and refreshToken
//     res.cookie("accessToken", accessToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production", // HTTPS in production
//       sameSite: "Strict", // CSRF protection
//       maxAge: 25 * 60 * 1000, // 25 minutes
//     });

//     res.cookie("refreshToken", refreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "Strict", // CSRF protection
//       maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
//     });

//     // Optionally, send a confirmation message
//     res.status(200).json({
//       error: false,
//       message: "Logged in successfully",
//     });
//   } catch (error) {
//     console.error("Sign-in error:", error);
//     res.status(500).json({ error: true, message: "Internal server error" });
//   }
// });
router.post("/signin", async (req, res) => {
  try {
    const rememberMe = req.query.rememberMe === "true"; // Get rememberMe from query params

    const { error } = logInValidation(req.body); // Validate only the req.body
    if (error) {
      return res
        .status(400)
        .json({ error: true, message: error.details[0].message });
    }

    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid email or password" });
    }

    const verifiedPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!verifiedPassword) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid email or password" });
    }

    const { accessToken, refreshToken } = await generateToken(user);

    // const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 25 * 60 * 1000;

    const maxAge = rememberMe ? 2 * 60 * 1000 : 25 * 60 * 1000; // 7 days or 25 minutes

    // mobile check
    const isMobile = req.headers['user-agent']?.includes("Mobile") || req.query.source === "mobile";

    if (isMobile) {
      return res.status(200).json({
        error: false,
        message: "Logged in successfully",
        accessToken,
        refreshToken: rememberMe ? refreshToken : null,
      });
    }
    // mobile check

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge,
    });

    if (rememberMe) {
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    console.log(maxAge, rememberMe);

    res.status(200).json({
      error: false,
      message: "Logged in successfully",
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    res.status(500).json({ error: true, message: "Internal server error" });
  }
});


// router.get("/getUsers", auth, roleCheck("admin"), async (req, res) => {
//   try {
//     const users = await User.find().select("-password");
//     res.status(200).json({ error: false, users });
//   } catch (error) {
//     console.log(error);
//     res.status(500).send({ error: true, message: "Internal server error" });
//   }
// });

router.post("/addUser", async (req, res) => {
  try {
    const { error } = addUserValidation(req.body);
    if (error)
      return res
        .status(400)
        .json({ error: true, message: error.details[0].message });

    const user = await User.findOne({ email: req.body.email });

    if (user)
      return res.status(409).json({
        error: true,
        message: "User with given email already exists!",
      });

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);

    await new User({ ...req.body, password: hashPassword }).save();

    res
      .status(201)
      .json({ error: false, message: "User created successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.delete("/deleteUser/:id", auth, roleCheck("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ error: true, message: "User not found" });

    await user.deleteOne();
    res.status(200).json({ error: false, message: "User deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.post("/addAdmin", auth, roleCheck("superAdmin"), async (req, res) => {
  try {
    const { error } = signUpValidation(req.body);
    if (error)
      return res
        .status(400)
        .json({ error: true, message: error.details[0].message });

    const user = await User.findOne({ email: req.body.email });

    if (user)
      return res.status(409).json({
        error: true,
        message: "User with given email already exists!",
      });

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(req.body.password, salt);

    await new User({
      ...req.body,
      password: hashPassword,
      roles: "admin",
    }).save();

    res
      .status(201)
      .json({ error: false, message: "Admin created successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: true, message: "Internal server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    console.log("User found:", user.email);

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Save the hashed token and expiration in the user record
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token valid for 1 hour
    await user.save();

    // Create reset URL
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    await sendForgotPasswordEmail({
      to: user.email,
      token: resetToken,
      resetUrl
    });

    res.status(200).json({ message: "Password reset email sent!" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/reset-password/:token", async (req, res) => {
  const token = req.params.token;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  try {
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send("Invalid or expired token");
    }

    // Render your reset password form, passing token into the form action
    res.render("resetPassword", { token, message: null });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  const token = req.params.token;
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  try {
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", error });
  }
});

export default router;
