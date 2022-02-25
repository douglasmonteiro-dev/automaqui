const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const linkSchema = new Schema({
  url: String,
  title: String,
  image: String,
  description: { type: String, default: "Clique e aproveite" },
  price: { type: Number, default: 0 },
  options: [{ type: String, default: "" }],
  type: { type: String, default: "" },
  clicks: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  created_date: { type: Date, default: Date.now },
});

const Link = mongoose.model("link", linkSchema);

module.exports = { Link, linkSchema };
