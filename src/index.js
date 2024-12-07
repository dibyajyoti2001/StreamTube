import dotenv from "dotenv";
import { app } from "./app.js";
import { connectDB } from "./db/index.js";

dotenv.config({ path: "./.env" });

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening at port: ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB Connetion Failed: " + error);
  });
