var request = {};
module.exports = request;
var http = require('http');
var parser = require('xml2js').Parser();



var handleGoError = function(error) {
  console.log('Error in requesting go: ' + error.message);
};

var getHttpRequest = function(options, callback) {
	var goData = "";
	return http.request(options, function (response) {
		response.on('error', handleGoError);
		response.on('data', function(chunck) {
			goData += chunck;
		});
		response.on('end', function() {
			parser.parseString(goData, function(err, result) {
				if(err) console.log("Error occurred while parsing go data:",err);
				else callback(result);
			}); 
		});
	});	
}

var getOptionsFrom = function(go) {
	return {
		host: go.host,
		path: go.path,
		port: go.port,
		auth: go.username+':'+go.password,
		method: 'GET'
	};
}

request.requestGo = function(go,callback) {
	var options = getOptionsFrom(go);
	var httpRequest = getHttpRequest(options, callback);
	httpRequest.end();
}
