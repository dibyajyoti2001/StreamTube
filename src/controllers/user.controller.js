import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  // Get the data from Users frontend
  const { username, email, password, fullname } = req.body;

  // Validate the users data
  if (
    [username, email, password, fullname].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields must be required");
  } else if (!email.includes("@")) {
    throw new ApiError(400, "Invalid Email Address");
  }

  // Check If User is already exists or not by using Email & Username
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  // Check the Images, Avatar are get from frontend or not
  const avtarLocalPath = req.files?.avtar[0]?.path;

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avtarLocalPath) {
    throw new ApiError(400, "Avatar must be required");
  }

  // Upload them to Cloudinary
  const avatar = await uploadOnCloudinary(avtarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar must be required");
  }

  // Create a user object & Save that to DB
  const user = await User.create({
    fullname,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  // Before sending response to user remove the password & refreshToken from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Check User Creation or not
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }
  // Return the Response
  return res.status(201).json(new ApiResponse(200, createdUser, "Success"));
});

export { registerUser };
