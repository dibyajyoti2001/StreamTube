import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(400, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    if (!accessToken && !refreshToken) {
      throw new ApiError(400, "AccessToken & Refresh Token missing");
    }

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong, While Generating Tokens");
  }
};

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
  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar must be required");
  }

  // Upload them to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
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

const loginUser = asyncHandler(async (req, res) => {
  // Get the Users data from frontend
  const { username, email, password } = req.body;

  // Validate the Users data
  if (!username && !email) {
    throw new ApiError(400, "Invalid Credentials");
  }

  // Check the user is register or not
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(409, "User not found");
  }

  // Check for password
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // Generate the AccessToken & RefreshToken
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Send to user by cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  // Return response
  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // Find the user and set refreshToken to empty
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  // Send cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  // Return response
  return res
    .status(201)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logout successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get the IncomingRefreshToken from cookies
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  // Validate it
  if (!incomingRefreshToken) {
    throw new ApiError(400, "Invalid Token");
  }

  // Verify it using jwt
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Find the user using decodedTokenId & validate it
    const user = await User.findById(decodedToken._id);

    if (!user) {
      throw new ApiError(400, "User not found");
    }

    // Match user refresh token & incoming refresh token
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    // Create new refresh token & validate it
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    // Send to user by cookies
    const options = {
      httpOnly: true,
      secure: true,
    };

    // Return response
    return res
      .status(201)
      .cookie("accessToken", accessToken, options)
      .cookie("newRefreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Get the user old & new password from frontend
  const { password, newPassword } = req.body;

  // Validate it
  if (!password && !newPassword) {
    throw new ApiError(400, "Invalid Credentials");
  }

  // Find the user
  const user = await User.findById(req.user?._id);

  // Check old password is correct or not
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid password");
  }

  // Update the password & save it to DB
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  // Return response
  return res
    .status(201)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(201)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  // Get the updated fields from users
  const { fullname, email } = req.body;

  // Validate it
  if (!fullname && !email) {
    throw new ApiError(400, "All fields are required");
  }

  // Find the user and update it
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email: email,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  // Return res
  return res
    .status(201)
    .json(new ApiResponse(200, user, "Account updated Successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // Get the avatar from users
  const avatarLocalPath = req.file?.path;

  // Validate it
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  // Upload it on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // Validate if it's upload or not
  if (!avatar?.url) {
    throw new ApiError(500, "Something went wrong while uploading avatar");
  }

  // Update the avatar
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar?.url } },
    { new: true }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(400, "User not found");
  }

  // Delete the old avatar from cloudinary
  if (user.avatar) {
    const publicId = user.avatar.split("/").pop().split(".")[0];
    await deleteFromCloudinary(publicId);
  }

  // Return response
  return res
    .status(201)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  // Get the user cover image
  const coverImageLocalPath = req.file?.path;

  // Validate it
  if (!coverImageLocalPath) {
    throw new ApiError(400, "CoverImage not found");
  }

  // Upload it on cloudinary
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage?.url) {
    throw new ApiError(400, "Invalid cover image");
  }

  // Retrive the cover image from the user document
  const user = await User.findById(req.user?.id).select("coverImage");

  // Update cover image on database
  const updateUser = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { coverImage: coverImage.url } },
    { new: true }
  ).select("-password");

  // Delete the old cover image from cloudinary
  if (user.coverImage) {
    const publicId = user.coverImage.split("/").pop().split(".")[0];
    await deleteFromCloudinary(publicId);
  }

  // Return response
  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { user: updateUser },
        "Cover image updated successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
