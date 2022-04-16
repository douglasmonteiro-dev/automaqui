const {config} = require('dotenv');
const replace = require('@rollup/plugin-replace');

const production = !process.env.ROLLUP_WATCH;

module.exports = {
  plugins: [
    replace({
      // stringify the object       
      __myapp: JSON.stringify({
        env: {
          isProd: production,
          ...config().parsed // attached the .env config
        }
      }),
    }),
  ],
  jwt_secret: process.env.jwt_secret,
  mongouri: process.env.mongouri,
  port: process.env.port
};
