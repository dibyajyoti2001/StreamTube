import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";

const verifyJWT = asyncHandler(async (req, _, next) => {
  // Get token from the cookies
  const token =
    req.cookies.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  // Validate it
  if (!token) {
    throw new ApiError(401, "Unauthorized");
  }

  // Verify the token using jwt
  try {
    const decodedToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    // Find the User using decodedToken & Validate it
    const user = await User.findById(decodedToken._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(400, "User not found");
    }

    // Pass the user to the req user so that it can be act as a middlware
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(400, error?.message || "Invalid token");
  }
});

export { verifyJWT };
