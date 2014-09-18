var os = require('os');
var cp = require('child_process');
var exec = global.debug ? function(cmd, callback){
	console.log('\033[1;31m', cmd, '\033[m');
	cp.exec(cmd, callback);
} :cp.exec;
var execDone = function (cmd, callback)
{
	exec(cmd, function(err, stdout, stderr){
		if (err && stderr)
			callback(err, stdout + stderr);
		else
			callback(stdout.trim().split('\n')); 
	});
};

var formatMacAddress = function(str)
{
	return str.replace(/[\- :]/g,'-').toUpperCase();
};

var execIfconfig = function (callback){
	exec('ifconfig', function(err, stdout, stderr){
		if (err)
		{
			callback(err, stdout + stderr);
		}
		else
		{
			var interfaceStrArr = stdout.trim().split('\n\n');
			var interfaces = [];
			for (var i in interfaceStrArr)
			{
				var interfaceName = interfaceStrArr[i].substr(0,9).trim();
				var adapterType = interfaceStrArr[i].match(/Link encap:([a-zA-Z0-9])/) ? interfaceStrArr[i].match(/Link encap:([a-zA-Z0-9 ]*)/)[1].split(/ {2,10}/)[0].trim() : null;
				var mac = interfaceStrArr[i].match(/HWaddr ([a-zA-Z0-9:]*)/) ? interfaceStrArr[i].match(/HWaddr ([a-zA-Z0-9:]*)/)[1] : null;
				var ipAddress = interfaceStrArr[i].match(/inet addr:([0-9\.]*)/) ? interfaceStrArr[i].match(/inet addr:([0-9\.]*)/)[1] : null;
				var netmask =  interfaceStrArr[i].match(/Mask:([0-9\.]*)/) ? interfaceStrArr[i].match(/Mask:([0-9\.]*)/)[1] : null;
				var metric = interfaceStrArr[i].match(/Metric:([0-9\.]*)/) ? interfaceStrArr[i].match(/Metric:([0-9\.]*)/)[1] : null;
				interfaces.push({
					interfaceName: interfaceName,
					adapterType: adapterType,
					mac: mac,
					ipAddress: ipAddress,
					netmask: netmask,
					metric: metric
				});
			}
			callback(interfaces);
		}
	})
};

var execRouteN = function (callback){
	var routeTable = [];
	execDone('route -n', function(stdoutLines){
		var routeTableStartFlag = false;
		for (var i = 0; i < stdoutLines.length; i++)
		{
			var line = stdoutLines[i];
			if (line.match(/^Destination/)){
				routeTableStartFlag = true;
				var keys = line.trim().split(/ {1,20}/);
				continue;
			}
			else if (routeTableStartFlag)
			{
				var values = line.trim().split(/ {1,20}/);
				if (values.length == keys.length){
					var item = {}
					for (var j = 0; j < keys.length; j++)
					{
						item[keys[j]] = values[j];
					}
					routeTable.push(item);
				}
				else
				{
					routeTableStartFlag = false;
				}
			}
		}
		callback(routeTable);
	});
};

var getInfo = function(callback){
	var info = {hostname: require('os').hostname(), networkInterfaces:[], routeTable:[], default: null};
	execIfconfig(function(interfaces){
		var interfaceDict = {};
		for(var i in interfaces)
		{
			var the_interface = interfaces[i];
			if (the_interface.ipAddress){
				var networkInterface = {
					ipAddress: the_interface.ipAddress,
					netmask: the_interface.netmask,
					mac: the_interface.mac,
					adapterType: the_interface.adapterType,
					interfaceName: the_interface.interfaceName,
					enabled: true,
					connected: true
				};
				info.networkInterfaces.push(networkInterface);
				interfaceDict[networkInterface.interfaceName] = networkInterface;
			}
			else{
				var networkInterface = {
					mac: the_interface.mac,
					interfaceName: the_interface.interfaceName,
					enabled: true,
					connected: false
				};
				info.networkInterfaces.push(networkInterface);
				interfaceDict[networkInterface.interfaceName] = networkInterface;
			}
		}
		execRouteN(function(routeTable){
			var defaultRoute = {metric:999};
			for (var i in routeTable)
			{
				var route_item = routeTable[i];
				var item = {
					destination: route_item["Destination"],
					gateway: route_item["Gateway"],
					netmask: route_item["Genmask"],
					interfaceName: route_item["Iface"],
					interfaceAddress: interfaceDict[route_item["Iface"]] && interfaceDict[route_item["Iface"]].ipAddress,
					metric: parseInt(route_item["Metric"])
				}
				info.routeTable.push(item);
				if (item.metric < defaultRoute.metric && item.destination == "0.0.0.0"){
					defaultRoute = item;
				}
			}
			if (defaultRoute.interfaceName){
				info.default = JSON.parse(JSON.stringify(interfaceDict[defaultRoute.interfaceName]));
				info.default.gateway = defaultRoute.gateway;
				info.default.netmask = defaultRoute.netmask;
				info.default.metric = defaultRoute.metric;
				execDone('cat /etc/resolv.conf | grep nameserver', function(stdoutLines){
					info.default.dns = [];
					for (var i = 0; i < stdoutLines.length; i++){
						var dnsAddress = stdoutLines[i].match(/([\d\.]+)/) ? stdoutLines[i].match(/([\d\.]+)/)[0] : null;
						info.default.dns.push(dnsAddress);
					}
					callback(info);
				});
			}
		});
	});
};

module.exports.execIfconfig = execIfconfig;
module.exports.execRouteN = execRouteN;
module.exports.getInfo = getInfo;
