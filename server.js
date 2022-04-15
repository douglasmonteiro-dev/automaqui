const path = require("path");
const express = require("express");
const config = require("./config");
const app = express();
const mongoose = require("mongoose");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

const connect = mongoose
  .connect(config.mongouri, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    // serverSelectionTimeoutMS: 5000,
    // autoIndex: false, // Don't build indexes
    // maxPoolSize: 10, // Maintain up to 10 socket connections
    // serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    // socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    // family: 4, // Use IPv4, skip trying IPv6
    authSource: "vitrine"

  })
  .then(() => console.log("Mondo db connected...."))
  .catch((err) => console.log(err));

app.use("/api/user", require("./routes/user"));

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "index.html"));
});

const port = config.port || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
