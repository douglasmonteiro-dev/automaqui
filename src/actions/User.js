import { userStore } from "../store/User";
import axios from "axios";

export const displayuser = async (name) => {
  let user = null;
  await axios
    .post("/api/user/displayuser", { name })
    .then((res) => {
      user = res.data;
    })
    .catch((err) => {
      console.log(err);
    });
  return user;
};

export const reset = async (email) => {
  let user;
  await axios
    .post("/api/user/resetpassword", { email })
    .then((res) => {
      user = res.data;
    })
    .catch((err) => {
      user = res.data;
    });
  return user;
};

export const check = async (email, otp, password) => {
  let user;
  await axios
    .post("/api/user/check", { email, otp, password })
    .then((res) => {
      user = res.data;
    })
    .catch((err) => {
      user = res.data;
    });
  return user;
};

export const getinfo = async () => {
  let token = "";
  userStore.subscribe((data) => {
    token = data.token;
  });
  const config = {
    headers: {
      "Content-type": "application/json",
    },
  };
  if (token) config.headers["auth-token"] = token;
  await axios.get("/api/user/info", config).then((res) =>
    userStore.update((currUser) => {
      console.log("updated");
      return { ...currUser, token: currUser.token, user: res.data };
    })
  );
};

export const addlink = async (a) => {
  let token = "";
  let status = 1,
    mssg = "Something went wrong";
  userStore.subscribe((data) => {
    token = data.token;
  });
  const config = {
    headers: {
      "Content-type": "application/json",
    },
  };
  if (token) config.headers["auth-token"] = token;
  console.log(a);
  axios
    .post("/api/user/addlink", a, config)
    .then((res) => {
      status = 0;
      mssg = "Successfully added";
    })
    .catch((err) => {
      console.log(err);
    });
  await getinfo();
  return { status, mssg };
};

export const deletelink = async (a) => {
  let token = "";
  let status = 1,
    mssg = "Something went wrong";
  userStore.subscribe((data) => {
    token = data.token;
  });
  const config = {
    headers: {
      "Content-type": "application/json",
    },
  };
  if (token) config.headers["auth-token"] = token;
  console.log(a);
  axios
    .post("/api/user/deletelink", { _id: a }, config)
    .then((res) => {
      status = 0;
      mssg = "Successfully added";
    })
    .catch((err) => {
      console.log(err);
    });
  await getinfo();
  return { status, mssg };
};

export const addschedule = async (a) => {
  let token = "";
  let status = 1,
    mssg = "Something went wrong";
  userStore.subscribe((data) => {
    token = data.token;
  });
  const config = {
    headers: {
      "Content-type": "application/json",
    },
  };
  if (token) config.headers["auth-token"] = token;
  console.log(a);
  axios
    .post("/api/user/addschedule", a, config)
    .then((res) => {
      status = 0;
      mssg = "Successfully added";
    })
    .catch((err) => {
      console.log(err);
    });
  await getinfo();
  return { status, mssg };
};

export const deleteschedule = async (a) => {
  let token = "";
  let status = 1,
    mssg = "Something went wrong";
  userStore.subscribe((data) => {
    token = data.token;
  });
  const config = {
    headers: {
      "Content-type": "application/json",
    },
  };
  if (token) config.headers["auth-token"] = token;
  console.log(a);
  axios
    .post("/api/user/deleteschedule", { _id: a }, config)
    .then((res) => {
      status = 0;
      mssg = "Successfully added";
    })
    .catch((err) => {
      console.log(err);
    });
  await getinfo();
  return { status, mssg };
};
