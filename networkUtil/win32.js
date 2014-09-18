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
			callback(stdout.split('\r\n')); 
	});
};

var formatMacAddress = function(str)
{
	return str.replace(/[\- :]/g,'-').toUpperCase();
};

var execIpconfigAll = function(callback){
	execDone('ipconfig /all', function(stdoutLines){
		var stdoutInterfaceInfo = {global:{keyValue:{}}, unparsedLines:[]}
		var currentInterface;
		var adapterMatch;
		var keyValueMatch;
		var additionalValueMatch;
		for(var i in stdoutLines)
		{
			var line = stdoutLines[i];
			if (line.match(/Windows IP Configuration/))
			{
				currentInterface = "global";
			}
			else if (adapterMatch = line.match(/([^\n]+)\ adapter ([^:]+):/))
			{
				currentInterface = adapterMatch[2];
				stdoutInterfaceInfo[currentInterface] = {adapterType:adapterMatch[1], interfaceName: adapterMatch[2], keyValue:{}};
			}
			else if (additionalValueMatch = line.match(/ {20,80}([^\r]+)/))
			{
				stdoutInterfaceInfo[currentInterface]["keyValue"][keyValueMatch[1].trim()] instanceof Array ?
				stdoutInterfaceInfo[currentInterface]["keyValue"][keyValueMatch[1].trim()].push(additionalValueMatch[1]) :
				(stdoutInterfaceInfo[currentInterface]["keyValue"][keyValueMatch[1].trim()] = [stdoutInterfaceInfo[currentInterface]["keyValue"][keyValueMatch[1].trim()], additionalValueMatch[1]]);
			}
			else if (keyValueMatch = line.match(/   ([^.]+)[ \.]+: ([^\r]*)/)){
				stdoutInterfaceInfo[currentInterface]["keyValue"][keyValueMatch[1].trim()] = keyValueMatch[2].trim();
			}
			else if (line.trim() == ""){
				continue;
			}
			else if (global.debug)
			{
				stdoutInterfaceInfo.unparsedLines[i] = line;
			}
		}

		if(!stdoutInterfaceInfo.unparsedLines.length) delete stdoutInterfaceInfo.unparsedLines;
		callback(stdoutInterfaceInfo);
	});
};

var execNetshInterfaceIpv4ShowInterfaces = function(callback)
{
	execDone('netsh interface ipv4 show interfaces', function(stdoutLines){
		var interfaces = [];
		var keys = stdoutLines[1].trim().split(/[ ]{2,80}/);
		for (var i = 3;i < stdoutLines.length -2; i++)
		{
			var values = stdoutLines[i].trim().split(/[ ]{2,80}/);
			var item = {};
			for (var j = 0; j < values.length; j++)
			{
				item[keys[j]] = values[j];
			}
			interfaces.push(item);
		}
		callback(interfaces);
	});
};

var execNetshInterfaceShowInterface = function(callback)
{
	execDone('netsh interface show interface', function(stdoutLines){
		var interfaces = [];
		var keys = stdoutLines[1].trim().split(/[ ]{2,80}/);
		for (var i = 3;i < stdoutLines.length -2; i++)
		{
			var values = stdoutLines[i].trim().split(/[ ]{2,80}/);
			var item = {};
			for (var j = 0; j < values.length; j++)
			{
				item[keys[j]] = values[j];
			}
			interfaces.push(item);
		}
		callback(interfaces);
	});
};

var execNetshMbnShowInterfaces = function(callback)
{
	execDone('netsh mbn show interfaces interface=*', function(stdoutLines){
		if (stdoutLines.length <= 3)
		{
			callback({});
		}
		else
		{
			var mbnInterfaces = {unparsedLines:[]};
			for (var i = 3; i < stdoutLines.length; i++){
				var line = stdoutLines[i];
				var currentInterface;
				var keyValueMatch;
				if (keyValueMatch = line.match(/    ([^:]+):([^:]+)/)){
					var key = keyValueMatch[1].trim();
					var value = keyValueMatch[2].trim();
					if (key == "Name")
					{
						currentInterface = value;
						mbnInterfaces[currentInterface] = {};
					}
					mbnInterfaces[currentInterface][key] = value;
				}
				else if (line.trim() == "")
				{
					continue;
				}
				else if (global.debug)
				{
					mbnInterfaces["unparsedLines"].push(line);
				}
			}
			if(!mbnInterfaces.unparsedLines.length) delete mbnInterfaces.unparsedLines;
			callback(mbnInterfaces);
		}
	});
};

var execRoutePrint4 = function (callback)
{
	execDone('route PRINT -4', function (stdoutLines){
		var info = {interfaceList: [], activeRoutes:[]};
		var interfaceListFlag = false;
		var activeRouteFlag   = false;
		var routeKeys;
		for (var i = 0; i < stdoutLines.length; i++){
			var line = stdoutLines[i];
			if (line == 'Interface List'){
				interfaceListFlag = true;
				continue;
			}
			if (line.match(/Network Destination/))
			{
				routeKeys = line.trim().split(/ {2,30}/);

				activeRouteFlag = true;
				continue;
			}
			if (line.match(/={20,40}/g))
			{
				var interfaceListFlag = false;
				var activeRouteFlag   = false;
				continue;
			}
			if (interfaceListFlag)
			{
				var match = line.match(/(\d{1,3})[\. ]*([\da-f ]{17})?[\. ]*([^\n]+)/);
				if (match)
				{
					var interface = {
						interfaceIndex: match[1],
						macAddress: match[2],
						deviceName : match[3]
					};
					info.interfaceList.push(interface);
				}
			}
			if (activeRouteFlag)
			{
				var routeValues = line.trim().split(/ {2,30}/);
				var routeItem = {};
				for(var j in routeValues)
				{
					routeItem[routeKeys[j]] = routeValues[j];
				}
				info.activeRoutes.push(routeItem);
			}
		}
		callback(info);
	});
};

var getInfo = function (callback)
{
	var info = {hostName: null, networkInterfaces: [], routeTable: [], default: null};
	execIpconfigAll(function(result){
		var interfaceDict = {};
		for (var key in result)
		{
			var item = result[key];
			if (key == 'global')
			{
				info.hostName = item.keyValue['Host Name'];
			}
			else
			if (item.keyValue['Media State'] == 'Media disconnected')
			{
				var interfaceObj =
				{
					mac: item.keyValue['Physical Address'],
					adapterType: item.adapterType,
					adapterName: item.keyValue['Description'],
					interfaceName: item.interfaceName,
					isDhcp: item.keyValue['DHCP Enabled'] == 'Yes',
					enabled: true,
					connected: false
				};
				info.networkInterfaces.push(interfaceObj);
			}
			else
			{
				var interfaceObj =
				{
					ipAddress: item.keyValue['IPv4 Address'].match(/[0-9\.]*/) && item.keyValue['IPv4 Address'].match(/[0-9\.]*/)[0],
					netmask: item.keyValue['Subnet Mask'],
					gateway: item.keyValue['Default Gateway'],
					dns: item.keyValue['DNS Servers'],
					mac: item.keyValue['Physical Address'],
					adapterType: item.adapterType,
					adapterName: item.keyValue['Description'],
					interfaceName: item.interfaceName,
					isDhcp: item.keyValue['DHCP Enabled'] == 'Yes',
					enabled: true,
					connected: true
				};
				info.networkInterfaces.push(interfaceObj);
				interfaceDict[interfaceObj.ipAddress] = interfaceObj;
			}
		}
		execRoutePrint4(function(routeInfo){
			for (var i in routeInfo.interfaceList){
				for(var j in info.networkInterfaces){
					if (routeInfo.interfaceList[i].macAddress && formatMacAddress(routeInfo.interfaceList[i].macAddress) == formatMacAddress(info.networkInterfaces[j].mac)){
						info.networkInterfaces[j].interfaceIndex = parseInt(routeInfo.interfaceList[i].interfaceIndex);
					}
				}
			}
			var defaultRoute = {metric: 999};
			for (var i in routeInfo.activeRoutes)
			{
				var routeItem = routeInfo.activeRoutes[i];
				var item =
				{
					destination: routeItem['Network Destination'],
					netmask: routeItem['Netmask'],
					gateway: routeItem['Gateway'],
					interfaceAddress: routeItem['Interface'],
					interfaceName: interfaceDict[routeItem['Interface']] && interfaceDict[routeItem['Interface']].interfaceName,
					metric: parseInt(routeItem['Metric']),
				}
				info.routeTable.push(item);
				if (item.metric < defaultRoute.metric && item.destination == "0.0.0.0")
				{
					defaultRoute = item;
				}
			}
			for (var i in info.networkInterfaces)
			{
				if (info.networkInterfaces[i].ipAddress == defaultRoute.interfaceAddress && info.networkInterfaces[i].connected)
				{
					info.default = JSON.parse(JSON.stringify(info.networkInterfaces[i]));
					info.default.netmask = defaultRoute.netmask;
					info.default.gateway = defaultRoute.gateway;
					info.default.metric  = defaultRoute.metric;
				}
			}
			execNetshInterfaceShowInterface(function(interfaces){
				for (var i in interfaces)
				{
					var the_interface = interfaces[i];
					if (the_interface['Admin State'] != 'Enabled')
					{
						var interfaceObj =
						{
							interfaceName: the_interface['Interface Name'],
							enabled: false,
							connected: false
						}
						info.networkInterfaces.push(interfaceObj);
					}
				}
				callback(info);
			});
		});
	});
};

module.exports.execIpconfigAll = execIpconfigAll;
module.exports.execNetshInterfaceIpv4ShowInterfaces = execNetshInterfaceIpv4ShowInterfaces;
module.exports.execNetshMbnShowInterfaces = execNetshMbnShowInterfaces;
module.exports.execRoutePrint4 = execRoutePrint4;
module.exports.getInfo = getInfo;
