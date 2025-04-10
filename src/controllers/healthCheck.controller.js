import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthCheck = asyncHandler(async (req, res) => {
  return res
    .status(201)
    .json(new ApiResponse(200, "OK", "HealthCheck Created Successfully!"));
});

const heartCheck = asyncHandler(async (req, res) => {
  return res
    .status(201)
    .json(new ApiResponse(200, "OK", "HeartCheck Successfully!"));
});

export { healthCheck, heartCheck };
