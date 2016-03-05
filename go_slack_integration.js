var request = require('./request.js');
var lines = require('./lines.js');
var fs = require('fs');
var Slack = require('slack-node');
var domain = require('domain').create();
var data = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, "config.json")));
var buildStatus = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, "lastBuildStatus.json")));
var FAILURE_MESSAGE = ":x: *@USER@* broke <@URL@|@BUILD@>. @LINE@\n";
var SUCCESS_MESSAGE = ":white_check_mark: <@URL@|@BUILD@> is green. @LINE@\n";
var messages = {};


var dateStamp = function() {
	return("["+new Date()+"]\t");
};

var sendToSlack = function(message, slackData) {
	var slack = new Slack();
	slack.setWebhook(slackData.webhook);
	slack.webhook({
		channel: slackData.channel,
		username: slackData.userName,
		text: message
	} ,function(err,response){
		err && console.log(dateStamp()+"Error at sending message to slack:",err);
		console.log(dateStamp()+"Response from slack:",response.status);
	});
};

var hasBuildChanged = function(build) {
	return(build['$'].lastBuildStatus != buildStatus[getFirstNameOf(build)]);
};

messages['Failure'] = function(build) {
	var breaker = "Someone";
	(build.messages) && (breaker = build.messages[0].message[0]['$'].text.split("<")[0]);
	var message = FAILURE_MESSAGE;
	message = message.replace(/@USER@/g,breaker);
	message = message.replace(/@LINE@/g,lines.failures[Math.floor(Math.random()*lines.failures.length)]);
	message = message.replace(/@URL@/g,build['$'].webUrl);
	message = message.replace(/@BUILD@/g,getFirstNameOf(build));
	return message;
}

messages['Success'] = function(build) {
	var message = SUCCESS_MESSAGE;
	message = message.replace(/@URL@/g,build['$'].webUrl);
	message = message.replace(/@BUILD@/g,getFirstNameOf(build));
	message = message.replace(/@LINE@/g,lines.success[Math.floor(Math.random()*lines.success.length)]);
	return message;
};


var getLogForBuild = function(build) {
	return("Updating Build " + build.lastBuildStatus + "...");
};

var updateLastBuildStatusFor = function(build) {
	buildStatus[getFirstNameOf(build)] = build['$'].lastBuildStatus;
	fs.writeFileSync("./lastBuildStatus.json", JSON.stringify(buildStatus));
};

var handleTheBuild = function(buildGroup) {
	var build = buildGroup[0];
	if(hasBuildChanged(build)) {
		var message = messages[build['$'].lastBuildStatus](build);
		var log = getLogForBuild(build['$']);
		updateLastBuildStatusFor(build);
		return [log, message];
	}
};

var getFirstNameOf = function(build) {
	return build['$'].name.split('::')[0];
};

var combineTheBuildsOfSameName = function(builds) {
	var combinedBuilds = {};
	builds.forEach(function(build) {
		var buildName = getFirstNameOf(build);
		if(combinedBuilds[buildName])
			combinedBuilds[buildName].push(build);
		else {
			combinedBuilds[buildName] = [];
			combinedBuilds[buildName].push(build);
		}
	});
	return combinedBuilds;
};

var sortByName = function(buildGroup) {
	return buildGroup.sort(function(pre, cur) {
		return(pre['$'].name - cur['$'].name);
	});
};

var handleGoData = function(goData, callback) {
	var builds = goData.Projects.Project;
	builds = combineTheBuildsOfSameName(builds);
	var buildNames = Object.keys(builds);
	console.log(buildNames);
	var buildResults = [];
	buildNames.forEach(function(buildName){
		buildGroup = sortByName(builds[buildName]);
		var result = handleTheBuild(buildGroup);
		if(result && result[0] && result[1]) {
			buildResults.push(result);
		}

	});
	callback(buildResults);
};

var run = function() {
	console.log(dateStamp()+"Requesting Go ...");
	request.requestGo(data.go, function(result) {
		handleGoData(result, function(buildResults) {
			console.log(buildResults);
			buildResults.forEach(function(result){
				var log = result[0];
				log && console.log(dateStamp()+""+log);
			});
			var messages = buildResults.map(function(result) {return result[1];}).join("\n");
			messages && sendToSlack(messages,data.slack);
		});
	});
	setTimeout(run,60000);
};

domain.on('error', function(error) {
	console.log(dateStamp()+"***** Error occurred: *****\n"+error);
	console.log("\n##### Program didn't stop, It is Running #####\n")
});

domain.run(run);

