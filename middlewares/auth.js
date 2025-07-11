import jwt from "jsonwebtoken";

// const auth = async (req, res, next) => {
//   const token = req.header("x-access-token");
//   if (!token)
//     return res.status(403).json({ error: true, message: "Access Denied" });

//   try {
//     const tokenDetails = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
//     req.user = tokenDetails;
//     next();
//   } catch (error) {
//     res.status(403).json({ error: true, message: "Invalid Token" });
//   }
// };

const auth = async (req, res, next) => {
  const token = req.cookies.accessToken; // Retrieve token from cookies

  if (!token) {
    console.log("Access token is missing.");
    return res
      .status(403)
      .json({ error: true, message: "Access token missing" });
  }

  try {
    const tokenDetails = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = tokenDetails; // Attach user details to the request
    console.log("Token verified successfully:", tokenDetails);
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.log("Access token expired.");
      return res.status(403).json({ error: true, message: "Token expired" });
    }

    console.error("Error verifying token (Malformed):", error.message);
    return res.status(403).json({ error: true, message: "Invalid token" });
  }
};

export default auth;
