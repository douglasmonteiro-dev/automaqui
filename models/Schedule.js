const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const scheduleSchema = new Schema({
  url: String,
  title: String,
  image: String,
  description: { type: String, default: "Clique e aproveite" },
  price: { type: Number, default: 0 },
  options: [{ type: String, default: "" }],
  type: { type: String, default: "" },
  pendingScheduled: { type: Number, default: 0 },
  confirmScheduled: { type: Number, default: 0 },
  created_date: { type: Date, default: Date.now },
});

const Schedule = mongoose.model("schedule", scheduleSchema);

module.exports = { Schedule, scheduleSchema };
