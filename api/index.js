// Vercel serverless entry point. Mounts the existing Express backend as a
// single function; vercel.json rewrites /api/* to here.
module.exports = require("../backend/server");
