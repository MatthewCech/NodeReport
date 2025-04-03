// Requirements
const os = require('os');                   // Operating system inforamtion
const request = require('request');         // Issue GET requests
const config = require('./config');         // Custom-defined config file
const si = require('systeminformation');    // System information 
const querystring = require('querystring'); // URL escape

const BYTES_TO_MEGABYTES = 1024 * 1024;
const DECIMALS_CPU = 2;
const DECIMALS_RAM = 0;

// Collect RAM info into an object and pass it back to a provided callback function.
function getRAMInfo(callback) {
	si.mem().then(data => {
		let obj = {};

		obj.total = (data.total / BYTES_TO_MEGABYTES).toFixed(DECIMALS_RAM);
		obj.used = (data.active / BYTES_TO_MEGABYTES).toFixed(DECIMALS_RAM);
		obj.cached = (data.buffcache / BYTES_TO_MEGABYTES).toFixed(DECIMALS_RAM);

		callback(obj);
	})
}

// Collect CPU load info into an object and pass it back to a provided callback function.
function getCPUInfo(callback) {
	si.currentLoad().then(data => {
		let obj = {};

		let numCPUs = data.cpus.length;
		let loadUser = 0;
		let loadSystem = 0;

		for(let i = 0; i < numCPUs; ++i) {
			loadUser += data.cpus[i].loadUser;
			loadSystem += data.cpus[i].loadSystem;
		}

		loadUser /= numCPUs;
		loadSystem /= numCPUs;

		obj.user = loadUser.toFixed(DECIMALS_CPU);
		obj.system = loadSystem.toFixed(DECIMALS_CPU);

		callback(obj);
	});
}

// Staple a JSON query string with data blob onto target URL specified in the config file.
function sendBlob(dataJSON) {
	let query = `${config.target}?json=`;
	let stringyJson = JSON.stringify(dataJSON)
	query += querystring.escape(stringyJson);

	console.log(query);

	request(query, function (error, response, body) {
		if(error != null) {
			console.log("Error during data sending: " + error);
		} else {
			console.log(`Sent, code: ${response.statusCode}`);
		}
	});
}

// Main poll and report interval
setInterval(function() {
	getRAMInfo(ramInfo => {
		getCPUInfo(cpuInfo => {
			let blob = {};
			blob.key = config.machineKey;
			blob.ram = ramInfo;
			blob.cpu = cpuInfo;

			sendBlob(blob);
		})
	});
}, config.refreshRateMS);

