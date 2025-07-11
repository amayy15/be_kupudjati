import jwt from "jsonwebtoken";
import UserToken from "../models/userToken.js";

// const generateToken = async (user) => {
//   try {
//     const payload = {
//       _id: user._id,
//       username: user.username,
//       roles: user.roles,
//     };
//     const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
//       expiresIn: "25m",
//     });

//     const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
//       expiresIn: "3d",
//     });

//     const userToken = await UserToken.findOne({ userId: user._id });

//     if (userToken) await userToken.deleteOne();

//     await new UserToken({ userId: user._id, token: refreshToken }).save();

//     return Promise.resolve({ accessToken, refreshToken });
//   } catch (error) {
//     return Promise.reject(error);
//   }
// };

const generateToken = async (user) => {
  const payload = {
    _id: user._id,
    username: user.username,
    email: user.email,
    roles: user.roles,
  };

  try {
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "25m",
    });

    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: "3d",
    });

    // Save or update the refresh token in the database
    const userToken = await UserToken.findOne({ userId: user._id });
    if (userToken) {
      await userToken.deleteOne();
    }

    await new UserToken({ userId: user._id, token: refreshToken }).save();

    // Return only the refresh token; the access token will be set in a cookie
    return { accessToken, refreshToken };
  } catch (error) {
    throw new Error("Error generating tokens");
  }
};

export default generateToken;
