import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { logger } from "./logger.js";
import dotenv from "dotenv";

dotenv.config();

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Upload file on Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    logger.info(`File uploaded successfully. File path: ${response.url}`);

    // File has been uploaded successfully and unlinked from the cloudinary after the upload completes
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    // Remove the locally save temporary file as the upload operation got failed
    fs.unlinkSync(localFilePath);
    return null;
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    throw new Error(error?.message || "Failed to delete image from Cloudinary");
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
