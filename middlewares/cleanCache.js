const { clearHash } = require("../services/cache");

module.exports = (req, res, next) => {
  clearHash(req.user.id);

  next();
};
