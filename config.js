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
  jwt_secret: '12d3s1ds2ds3s1adadassaasa23',//process.env.jwt_secret,
  mongouri: 'mongodb://uservitrine:senhavitrine@vps14938.publiccloud.com.br:27017', //process.env.mongouri,
  port: 3000//process.env.port
};
