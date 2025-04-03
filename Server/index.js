let http = require('http');                       // HTTP server
let execSync = require('child_process').execSync; // Cxecuting commands, in this case python
const querystring = require('querystring');       // URL unescape

const PORT = 1234;
const EINK_UPDATE_TIME_MS = 60 * 1000;
const UPKEEP_TIME_MS = 30 * 1000;
const MAX_DATA_AGE_MS = 120 * 1000;

// A record of last data received with no history.
let trackedData = {};

// Lean on a system call to write out to the python display
function writeEInk(stringToWrite) {
	console.log("----- [Trying to write to e-ink]");
	console.log(stringToWrite)
	console.log("-----");

	try {
		execSync(`python display.py -t"${stringToWrite}"`);
	}
	catch {
		console.log("Something went wrong trying to write out to the e-ink display...");
	}
}

// Take a raw HTTP request and parse out what information I want from it
function parseHTTPRequest(request)
{
	const slug = "?json=";
	let requestURL = request.url;
	let queryStartIndex = requestURL.indexOf(slug) + slug.length;
	let queryString = requestURL.substring(queryStartIndex);
	let rawJSON = querystring.unescape(queryString);

	let data = JSON.parse(rawJSON);
	data.time = Date.now();

	// Log and track data we received
	console.log(data);
	trackedData[data.key] = data;
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

console.log(`Server running on port ${PORT}`);

// E-ink update cycle
setInterval(function() {
	console.log(`updating e-ink display with the following:\n${JSON.stringify(trackedData)}`)

	let displayString = "";

	let keys = Object.keys(trackedData);
	for(let i = 0; i < keys.length; i++) {
		let currentData = trackedData[keys[i]];
		
		let line = "";
		line += `C:${(Number(currentData.cpu.user) + Number(currentData.cpu.system)).toFixed(0)}% `;
		line += `M:${(Number(currentData.ram.used) / Number(currentData.ram.total) * 100).toFixed(0)}% `;
		line += `${keys[i]}`;

		displayString += line + "\n";
	}

	writeEInk(displayString);

}, EINK_UPDATE_TIME_MS);


// E-ink update cycle
setInterval(function() {
	let currentTime = Date.now();
	
	console.log("----- [Performing data upkeep]");
	console.log(`Data before: ${JSON.stringify(trackedData)}`);
	
	let keys = Object.keys(trackedData);
	for(let i = keys.length - 1; i >= 0; i--) {
		let dataAgeMS = currentTime - trackedData[keys[i]].time;
		if(dataAgeMS > MAX_DATA_AGE_MS) {
			delete trackedData[keys[i]];
		}
	}

	console.log(`Data after: ${JSON.stringify(trackedData)}`);
	console.log("-----")
}, UPKEEP_TIME_MS);
