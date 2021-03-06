import { Request, Response } from "express";
import mongodb from "mongodb";
import User from "../models/User";
import Room from "../models/Room";
import Otp from "../models/Otp";
import {
  signupValidation,
  signinValidation,
  registerValidation,
  loginValidation,
} from "../libs/joi";
import jwt from "jsonwebtoken";

import moment from "moment";
import Admin from "../models/Admin";

const SESSION_TIME = 60 * 60 * 24 * 7; // week

class AuthController {
  constructor() {}

  public async signup(req: Request, res: Response) {
    // body request validation
    // const { error } = signupValidation(req.body);
    // if (error)
    //   return res.status(200).json({ success: true, msg: error.message });

    // username validation
    // const usernameExist = await User.findOne({ username: req.body.username });
    // if (usernameExist)
    //   return res.status(400).json({ msg: "Username already exist." });

    // const { name, email, username, password } = req.body;
    const { email, phone, photo, password, otp } = req.body;

    // if (!otp || otp === "")
    //   return res.status(200).json({ success: true, msg: "没有输入验证码" });

    // const otpExist = await Otp.findOne({ phone, otp });

    // if (!otpExist)
    //   return res.status(200).json({ success: false, msg: "输入验证码错误" });

    const currentUser = await User.findOne({ email });

    if (currentUser) {
      res.status(200).json({
        success: false,
        msg: "Already signed up!",
      });
      return;
    }

    try {
      const newUser = new User({
        email,
        photo,
        name: "",
        phone,
        password,
      });
      await newUser.save();

      const token: string = jwt.sign(
        { _id: newUser._id },
        process.env["TOKEN_SECRET"] || "MyS3cr3tT0k3n",
        {
          expiresIn: SESSION_TIME,
        }
      );

      res.status(200).header("auth_token", token).json({
        success: true,
        msg: "success!",
        user: newUser,
      });
    } catch (err) {
      console.log("error => ", err);
      res.status(200).json({
        success: false,
        msg: "error",
      });
    }
  }

  public async resetpwd(req: Request, res: Response) {
    const { phone, password, otp } = req.body;

    if (!otp || otp === "")
      return res.status(200).json({ success: true, msg: "没有输入验证码" });

    console.log(otp, "otp from user input");

    const otpExist = await Otp.findOne({ phone, otp });

    console.log(otpExist, "otpExist");

    if (!otpExist)
      return res.status(200).json({ success: false, msg: "输入验证码错误" });

    try {
      const updatedUser = await User.findOneAndUpdate(
        { phone },
        { password },
        {
          new: true,
        }
      );

      const token: string = jwt.sign(
        { _id: "" },
        process.env["TOKEN_SECRET"] || "MyS3cr3tT0k3n",
        {
          expiresIn: SESSION_TIME,
        }
      );

      res.status(200).header("auth_token", token).json({
        success: true,
        msg: "成功!",
        user: updatedUser,
      });
    } catch (err) {
      console.log("error => ", err);
      res.status(500).json({
        success: false,
        msg: "失败了",
      });
    }
  }

  public async signin(req: Request, res: Response) {
    console.log(req.body);

    const { error } = signinValidation(req.body);
    if (error)
      return res.status(200).json({ success: false, msg: error.message });

    const user = await User.findOne({
      // phone: req.body.phone,
      email: req.body.email,
      password: req.body.password,
    });

    console.log(user);

    if (!user)
      return res.status(200).json({ success: false, msg: "no registered" });

    if (user.block)
      return res.status(200).json({ success: false, msg: "blocked account!" });

    const rooms = await Room.find({
      users: { $in: [new mongodb.ObjectID(user._id)] }, //$elemMatch:{$eq:ObjectId("5e2916615f55cc6e3cb9838b")}
    });

    // create token
    const token: string = jwt.sign(
      { _id: user._id },
      process.env["TOKEN_SECRET"] || "MyS3cr3tT0k3n",
      {
        expiresIn: SESSION_TIME,
      }
    );

    res.status(200).header("auth_token", token).json({
      success: true,
      msg: "Sign in success.",
      user,
      rooms,
    });
  }

  public async otp(req: Request, res: Response) {
    // body request validation

    console.log(req.body);

    const { phone, kind } = req.body;

    if (!phone)
      return res.status(200).json({ success: false, msg: "wrong number!" });

    const currentUser = await User.findOne({ phone });
    console.log(currentUser, "-----------------");

    if (kind && kind === "forgot") {
      if (!currentUser) {
        res.status(200).json({
          success: false,
          msg: "error!",
        });
        return;
      }
    } else {
      if (currentUser) {
        res.status(200).json({
          success: false,
          msg: "already registered!",
        });
        return;
      }
    }

    ///////////////////////////////////////////////////

    let otp_code = Math.floor(1000 + Math.random() * 9000);

    const today = moment().startOf("day");
    let newOtp = await Otp.findOneAndUpdate(
      {
        phone,
        createAt: today.toDate(),
      },
      { phone, otp: otp_code, $inc: { limit: -1 } },
      {
        new: true,
      }
    );

    if (newOtp === null) {
      newOtp = new Otp({
        phone,
        otp: otp_code,
        createAt: today.toDate(),
        limit: 10,
      });
      await newOtp.save();
    }

    console.log(
      newOtp.limit,
      "it's possible to send otp request 3 times a day."
    );

    if (newOtp.limit < 1) {
      res.status(200).json({
        success: false,
        msg: "3 times a day",
      });
      return;
    }

    let content = `armap verification code is ${otp_code}`;

    console.log("will send sms  ...", content);

    let sid = "ACc7acca4ca70e55a3527d0d45dc15af93";
    let stoken = "f98728bd89d91c00065c00a3c9bea504";

    const client = require("twilio")(sid, stoken);

    try {
      const message = await client.messages.create({
        to: "+86 15567666835",
        from: "8615567666835",
        body: content,
      });
      console.log(message, "... from the twilio ...");
      res.status(200).json({
        success: true,
        msg: message,
      });
    } catch (error) {
      console.log(error);
      res.status(200).json({
        success: false,
        msg: "error!",
      });
    }
  }

  public async device(req: Request, res: Response) {
    try {
      console.log("device token request from the cient...", req.body);
      const { user_id, device } = req.body;
      const updatedUser = await User.findOneAndUpdate(
        { _id: user_id },
        { device },
        {
          new: true,
        }
      );

      if (!updatedUser)
        return res.status(200).json({
          success: false,
          msg: "User not updated",
        });

      res.status(200).json({
        success: true,
        msg: "User updated.",
        user: updatedUser,
      });
    } catch (err) {
      console.log("error => ", err);
      res.status(200).json({
        success: false,
        msg: "User not updated",
      });
    }
  }

  //admin register
  public async register(req: Request, res: Response) {
    const { error } = registerValidation(req.body);
    if (error)
      return res.status(200).json({ success: false, msg: error.message });

    const { email, password } = req.body;

    const usernameExist = await Admin.findOne({ email });
    console.log(usernameExist);

    if (usernameExist)
      return res
        .status(200)
        .json({ success: false, msg: "Email already exist." });

    try {
      const newAdmin = new Admin({ email, password });
      await newAdmin.save();

      const token: string = jwt.sign(
        { _id: newAdmin._id },
        process.env["TOKEN_SECRET"] || "MyS3cr3tT0k3n",
        {
          expiresIn: SESSION_TIME,
        }
      );

      res.status(200).header("auth_token", token).json({
        success: true,
        msg: "User saved.",
        user: newAdmin,
      });
    } catch (err) {
      console.log("error => ", err);
      res.status(200).json({
        success: false,
        msg: "User not saved",
      });
    }
  }

  //admin login
  public async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const { error } = loginValidation({ email, password });

    const admin = await Admin.findOne({
      email,
      password,
    });

    if (!admin)
      return res.status(200).json({ success: false, msg: "Not exist." });

    const token: string = jwt.sign(
      { _id: admin._id },
      process.env["TOKEN_SECRET"] || "MyS3cr3tT0k3n",
      {
        expiresIn: SESSION_TIME,
      }
    );

    console.log("Token to the client...", token);

    res
      .status(200)
      // .header("auth_token", token)
      .json({
        auth_token: token,
        success: true,
        msg: "Sign in success.",
        user: admin,
      });
  }

  public async resetpass(req: Request, res: Response) {
    const { phone, password, otp } = req.body;

    if (!otp || otp === "")
      return res.status(200).json({ success: true, msg: "没有输入验证码" });

    console.log(otp, "otp from user input");

    const otpExist = await Otp.findOne({ phone, otp });

    console.log(otpExist, "otpExist");

    if (!otpExist)
      return res.status(200).json({ success: false, msg: "输入验证码错误" });

    try {
      const updatedUser = await Admin.findOneAndUpdate(
        { phone },
        { password },
        {
          new: true,
        }
      );

      const token: string = jwt.sign(
        { _id: "" },
        process.env["TOKEN_SECRET"] || "MyS3cr3tT0k3n",
        {
          expiresIn: SESSION_TIME,
        }
      );

      res.status(200).header("auth_token", token).json({
        success: true,
        msg: "成功!",
        user: updatedUser,
      });
    } catch (err) {
      console.log("error => ", err);
      res.status(500).json({
        success: false,
        msg: "失败了",
      });
    }
  }

  public async invite(req: Request, res: Response): Promise<any> {
    try {
      const { email, user } = req.body;

      console.log("received from the client.......", email, user);

      const friend = await User.findOne({ email });

      if (!friend) {
        return res.status(200).json({
          success: false,
          msg: "Item not exist",
        });
      }

      const updatedMe = await User.findOneAndUpdate(
        { _id: new mongodb.ObjectID(user) },
        {
          $addToSet: {
            friends: {
              state: true,
              user: new mongodb.ObjectID(friend._id),
              _id: new mongodb.ObjectID(friend._id),
            },
          },
        },
        { new: true }
      ).populate("user", ["name", "email", "phone", "photo"]);

      const updatedFriend = await User.findOneAndUpdate(
        { email },
        {
          $addToSet: {
            friends: {
              state: false,
              user: new mongodb.ObjectID(user),
              _id: new mongodb.ObjectID(user),
            },
          },
        },
        { new: true }
      ).populate("user", ["name", "email", "phone", "photo"]);

      if (!updatedMe || !updatedFriend)
        return res.status(200).json({
          success: false,
          msg: "Item not updated",
        });

      res.status(200).json({
        success: true,
        msg: "Item updated.",
        item: updatedMe,
      });
    } catch (err) {
      console.log("error => ", err);
      res.status(200).json({
        success: false,
        msg: "Item not updated with error",
      });
    }
  }

  /**
   * accept friend request
   *
   * @param req
   * @param res
   */
  public async accept(req: Request, res: Response): Promise<any> {
    try {
      const { item, user } = req.body;

      console.log("received from the client.......", item, user);

      const newItem = { ...item };
      newItem.state = true;

      let updatedMe = await User.findOneAndUpdate(
        { _id: new mongodb.ObjectID(user) },
        {
          $addToSet: {
            friends: newItem,
          },
        },
        { new: true }
      ).populate("user", ["name", "email", "phone", "photo"]);

      updatedMe = await User.findOneAndUpdate(
        { _id: new mongodb.ObjectID(user) },
        {
          $pull: {
            friends: item,
          },
        },
        { new: true }
      ).populate("user", ["name", "email", "phone", "photo"]);

      if (!updatedMe)
        return res.status(200).json({
          success: false,
          msg: "Item not updated",
        });

      res.status(200).json({
        success: true,
        msg: "Item updated.",
        item: updatedMe,
      });
    } catch (err) {
      console.log("error => ", err);
      res.status(200).json({
        success: false,
        msg: "Item not updated with error",
      });
    }
  }
}

export default new AuthController();
