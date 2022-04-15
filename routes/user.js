const router = require("express").Router();
const bc = require("bcryptjs");
const jwt = require("jsonwebtoken");

const config = require("../config");
const verify = require("../verify");

const { User } = require("../models/User");
const { Link } = require("../models/Link");
const { Schedule } = require("../models/Schedule");
var generator = require("generate-password");
var nodemailer = require("nodemailer");

router.post("/register", async (req, res) => {
  console.log('req.body: ', req.body);
  const { dp, email, password, instagram, facebook, twitter, style, name } = req.body;
  const salt = await bc.genSalt(10);
  const hashed = await bc.hash(password, salt);
  const userExist = await User.findOne({ instagram: instagram });
  console.log('userExist: ', userExist);
  if (userExist) {
    return res.status(500).json({ status: 1, mssg: "User already exists" });
  }
  const emailExist = await User.findOne({ email: email });
  if (emailExist) {
    return res.status(500).json({ status: 1, mssg: "Email already exists" });
  }
  const newUser = new User({
    password: hashed,
    instagram,
    email,
    facebook,
    twitter,
    dp,
    style,
    name
  });
  try {
    const addedUser = await newUser.save();
    const token = await jwt.sign({ _id: addedUser._id }, config.jwt_secret);
    return res.json({ token, user: addedUser });
  } catch (err) {
    return res.status(500).json({ status: 1, mssg: "Something went wrong" });
  }
});

router.post("/login", async (req, res) => {
  const { instagram, password } = req.body;
  const userExist = await User.findOne({ instagram: instagram });
  console.log('userExist', userExist);
  if (!userExist)
    return res.status(500).json({ status: 1, mssg: "User does not exists" });
  const validPassword = await bc.compare(password, userExist.password);
  if (!validPassword)
    return res.status(500).json({ status: 1, mssg: "Password does not match" });
  const token = jwt.sign({ _id: userExist._id }, config.jwt_secret);
  return res.json({ token, user: userExist });
});

//links routes

router.post("/addlink", verify, async (req, res) => {
  const { url, title, image, description } = req.body;
  const newLink = new Link({ url, title, image, description });
  User.findByIdAndUpdate(
    req.user._id,
    { $push: { links: newLink }, $inc: { total_links: 1 } },
    { new: true }
  )
    .then((data) => {
      data.links = data.links.sort(function (a, b) {
        return new Date(b.created_date) - new Date(a.created_date);
      });
      res.json(data);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ status: 1, mssg: "Something went wrong" });
    });
});

router.post("/updatelink", verify, async (req, res) => {
  const { link } = req.body;
  User.findOneAndUpdate(
    { _id: req.user._id, "links._id": link._id },
    { $set: { "links.$": link } },
    { new: true }
  )
    .then((data) => res.json(data))
    .catch((err) =>
      res.status(500).json({ status: 1, mssg: "Something went wrong" })
    );
});

router.post("/deletelink", verify, async (req, res) => {
  const { _id } = req.body;
  await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { links: { _id: _id } } },
    { new: true }
  )
    .then((data) => res.json({ mssg: "Successfully deleted" }))
    .catch((err) =>
      res.status(500).json({ status: 1, mssg: "Something went wrong" })
    );
});

//schedule routes

router.post("/addschedule", verify, async (req, res) => {
  const { url, title, image, description } = req.body;
  const newSchedule = new Schedule({ url, title, image, description });
  User.findByIdAndUpdate(
    req.user._id,
    { $push: { schedules: newSchedule }, $inc: { total_schedules: 1 } },
    { new: true }
  )
    .then((data) => {
      data.schedules = data.schedules.sort(function (a, b) {
        return new Date(b.created_date) - new Date(a.created_date);
      });
      res.json(data);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ status: 1, mssg: "Something went wrong" });
    });
});

router.post("/updateschedule", verify, async (req, res) => {
  const { schedule } = req.body;
  User.findOneAndUpdate(
    { _id: req.user._id, "schedules._id": schedule._id },
    { $set: { "schedules.$": schedule } },
    { new: true }
  )
    .then((data) => res.json(data))
    .catch((err) =>
      res.status(500).json({ status: 1, mssg: "Something went wrong" })
    );
});

router.post("/deleteschedule", verify, async (req, res) => {
  const { _id } = req.body;
  await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { schedules: { _id: _id } } },
    { new: true }
  )
    .then((data) => res.json({ mssg: "Successfully deleted" }))
    .catch((err) =>
      res.status(500).json({ status: 1, mssg: "Something went wrong" })
    );
});

router.get("/info", verify, async (req, res) => {
  const { _id } = req.user;
  await User.findById(_id)
    .then((data) => {
      data.links = data.links.sort(function (a, b) {
        return new Date(b.created_date) - new Date(a.created_date);
      });
      res.json(data);
    })
    .catch((err) =>
      res.status(500).json({ status: 1, mssg: "Something went wrong" })
    );
});

router.post("/displayuser", async (req, res) => {
  const { name } = req.body;
  await User.findOne({ instagram: name })
    .select("-password")
    .then((data) => {
      data.links = data.links.sort(function (a, b) {
        return new Date(b.created_date) - new Date(a.created_date);
      });
      res.json(data);
    })
    .catch((err) =>
      res.status(500).json({ status: 1, mssg: "Something went wrong" })
    );
});

router.post("/resetpassword", async (req, res) => {
  var password = generator.generate({
    length: 10,
    numbers: true,
  });
  let user = await User.findOne({ email: req.body.email });
  if (!user) return res.json({ status: 1, mssg: "Email not found" });
  user = await User.findOneAndUpdate(
    { email: req.body.email },
    { resetpassword: password },
    { new: true }
  );
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "miniorganisation@gmail.com",
      pass: "sankarvishnu23",
    },
  });

  var mailOptions = {
    from: "miniorganisation@gmail.com",
    to: req.body.email,
    subject: "LinkInBio ResetPassword",
    text: "If its not you please ignore!! " + "Otp : " + password,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      return res.json({ status: 1, mssg: "Something went wrong" });
    } else {
      return res.json({
        status: 0,
        mssg: "Sent email, please check your inbox",
      });
    }
  });
});

router.post("/check", async (req, res) => {
  const { email, otp, password } = req.body;
  let user = await User.findOne({ email, resetpassword: otp });
  if (!user) return res.json({ status: 1, mssg: "Re-enter OTP" });
  await User.findOneAndUpdate({ email }, { password });
  return res.json({ status: 0, mssg: "Successfully updated" });
});

router.post("/viewadd", async (req, res) => {
  const { instagram } = req.body;
  await User.findOneAndUpdate({ instagram }, { $inc: { views: 1 } });
  res.json({ yes: 1 });
});

router.post("/clickadd", async (req, res) => {
  const { instagram, _id } = req.body;
  await User.findOneAndUpdate(
    { instagram, "links._id": _id },
    { $inc: { "links.$.clicks": 1 } }
  );
  res.json({ yes: 1 });
});

router.post("/viewadd", async (req, res) => {
  const { instagram } = req.body;
  await User.findOneAndUpdate({ instagram }, { $inc: { views: 1 } });
  res.json({ yes: 1 });
});

module.exports = router;
