const mongoose = require("mongoose");
const redis = require("redis");
const util = require("util");
const keys = require("../config/keys");
const json = require("body-parser/lib/types/json");
const { CloudSearchDomain } = require("aws-sdk");


//To run redis sudo service redis-server start
const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || "");

  return this;
};

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );

  try{
  // See if we have a value for 'key' in redis
  const cacheValue = await client.hget(this.hashKey, key);

  //If we do , return that
  if (cacheValue) {
    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d))
      : new this.model(doc);
  }

  //otherwise , issue the query and store the result in redis
  const result = await exec.apply(this, arguments);

  // Store the result in Redis
  await client.hset(this.hashKey, key, JSON.stringify(result) , 'EX' , 10);

  return result;
  }catch(err){
    console.log("Error in caching logic:", err);
  }
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};
