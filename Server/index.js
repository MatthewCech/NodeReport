let http = require('http');                       // HTTP server
let execSync = require('child_process').execSync; // Cxecuting commands, in this case python
const querystring = require('querystring');       // URL unescape

const PORT = 1234;
const UPKEEP_TIME_MS = 12 * 1000;
const MAX_DATA_AGE_MS = 30 * 1000;
const EINK_UPDATE_TIME_MS = 60 * 1000;
const EINK_EXTRA_ARGS = '--weight="thin"';
const EINK_HEADER = "CPU  RAM  Name\n";

// A record of last data received with no history
let latestData = {};

// The actual history going back until it hits max data age MS
let history = [];

// Provide an option for displaying only the latest data collected without averaging history
function displayLatest() {
	let displayString = EINK_HEADER;

	let keys = Object.keys(latestData);
	for(let i = 0; i < keys.length; i++) {
		let currentData = latestData[keys[i]];
		
		let line = "";
		line += `${(Number(currentData.cpu.user) + Number(currentData.cpu.system)).toFixed(0).padStart(3)}% `;
		line += `${(Number(currentData.ram.used) / Number(currentData.ram.total) * 100).toFixed(0).padStart(3)}% `;
		line += `${keys[i]}`;

		displayString += line + "\n";
	}

	writeEInk(displayString);
}

// Comb over data collected and average it, then send it to the e-ink display.
function displayAverage() {
	let totals = {};
	let counts = {};

	for(let i = 0; i < history.length; i++) {
		let current = history[i];
		if(!(current.key in totals)) {
			totals[current.key] = {};
			totals[current.key].ram = 0;
			totals[current.key].cpu = 0;
			totals[current.key].totalRam = 0;
			counts[current.key] = 0;
		}
	}

	for(let i = 0; i < history.length; i++) {
		let current = history[i];
		
		totals[current.key].ram += Number(current.ram.used);
		totals[current.key].cpu += Number(current.cpu.user) + Number(current.cpu.system);
		totals[current.key].totalRam = Number(current.ram.total); // just write over with last number seen, it's fine
		counts[current.key] += 1;
	}

	let displayString = EINK_HEADER;
	let keys = Object.keys(totals);
	for(let i = 0; i < keys.length; i++) {
		let currentData = totals[keys[i]];
		
		let line = "";
		line += `${(currentData.cpu / counts[keys[i]]).toFixed(0).padStart(3)}% `;
		line += `${(currentData.ram / counts[keys[i]] / currentData.totalRam * 100).toFixed(0).padStart(3)}% `;
		line += `${keys[i]}`;

		displayString += line + "\n";
	}

	writeEInk(displayString);
}

// Check and see if any data hasn't been updated in our expiration limit, and if not, remove it.
// Do so for both latest snapshot since it only keeps the latest from a given machine as well
// as combing through history.
function upkeep() {
	let currentTime = Date.now();
	
	console.log("----- [Performing data upkeep]");
	console.log(`Latest snapshot before: ${JSON.stringify(latestData)}`);
	console.log(`History length before: ${history.length}`);
	
	let keys = Object.keys(latestData);
	for(let i = keys.length - 1; i >= 0; i--) {
		let dataAgeMS = currentTime - latestData[keys[i]].time;
		if(dataAgeMS > MAX_DATA_AGE_MS) {
			delete latestData[keys[i]];
		}
	}

	for(let i = history.length - 1; i >= 0; i--) {
		let dataAgeMS = currentTime - history[i].time;
		if(dataAgeMS > MAX_DATA_AGE_MS) {
			history.splice(i, 1);
		}
	}

	console.log(`Latest snapshot after: ${JSON.stringify(latestData)}`);
	console.log(`History length after: ${JSON.stringify(history.length)}`);
	console.log("-----")
}

// Lean on a system call to write out to the python display
function writeEInk(stringToWrite) {
	console.log("----- [Trying to write to e-ink]");
	console.log(stringToWrite)
	console.log("-----");

	try {
		execSync(`python display.py ${EINK_EXTRA_ARGS} --text="${stringToWrite}"`);
	}
	catch {
		console.log("error: Something went wrong trying to write out to the e-ink display!");
	}
}

// Take a raw HTTP request and parse out what information I want from it
function parseHTTPRequest(request) {
	const slug = "?json=";
	const requestURL = request.url;
	const queryStartIndex = requestURL.indexOf(slug) + slug.length;
	const queryString = requestURL.substring(queryStartIndex);
	const rawJSON = querystring.unescape(queryString);

	let data = JSON.parse(rawJSON);
	data.time = Date.now();

	// Log and track data we received
	console.log(data);
	latestData[data.key] = data;
	history.push(data);
}

// Spin up a server and listen for GET requests, then pass them for processing.
http.createServer(function (req, res) {
  if(req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    parseHTTPRequest(req);
    res.end('Data submitted successfully');
  } else {
    res.writeHead(405, {'Content-Type': 'text/plain'});
    res.end('Method Not Allowed');
    console.log("Error! A bad request was received!");
  }
}).listen(PORT);

// E-ink update cycle
setInterval(function() {
	displayAverage();
	// displayLatest(); More immediate, less accurate.
}, EINK_UPDATE_TIME_MS);

// Internal update cycle
setInterval(function() {
	upkeep();
}, UPKEEP_TIME_MS);

// Notify we're at least going to start
console.log(`Server running on port ${PORT}`);
