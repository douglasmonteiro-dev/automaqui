const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const { linkSchema } = require("./Link.js");
const { scheduleSchema } = require("./Schedule.js");

const userSchema = new Schema({
  dp: {
    type: String,
    default:
      "https://st3.depositphotos.com/4111759/13425/v/600/depositphotos_134255710-stock-illustration-avatar-vector-male-profile-gray.jpg",
  },
  email: String,
  name: String,
  password: { type: String, required: true },
  created_date: { type: Date, default: Date.now },
  instagram: { type: String, required: true },
  facebook: String,
  twitter: String,
  views: { type: Number, default: 0 },
  links: [linkSchema],
  schedules: [scheduleSchema],
  style: {
    primary_color: { type: String, default: "blue" },
    secondary_color: { type: String, default: "yellow" },
    warning_color: { type: String, default: "red" },
    header_color: { type: String, default: "gray" },
    background_color: { type: String, default: "white" },
    text_color: { type: String, default: "black" },
    font_family: { type: String, default: "Roboto" },
    font_size: { type: String, default: "16px" }
  },
  total_links: { type: Number, default: 0 },
  resetpassword:{type:String,default:null}
});

//TODO Add fields by admins

const User = mongoose.model("user", userSchema);

module.exports = { User };
