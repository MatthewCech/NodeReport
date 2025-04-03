var config = {};
config.machineKey = "Solberry"; // The key used to store your machine in the DB
config.refreshRateMS = 5000; // Time between reports in milliseconds
config.target = "http://127.0.0.1:1234/report"; // Target, can be local or remote. Doesn't matter.

// Node export for access in other files
module.exports = config;