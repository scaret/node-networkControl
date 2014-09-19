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

var execIfconfig = function (callback){
	execDone('ifconfig', function(stdoutLines){
		var interfaceList = [];
        stdoutLines.push('');
		var interfaceStr;
		for (var i in stdoutLines){
			var line = stdoutLines[i];
			if (line.substr(0, 1).trim() != ''){
				if (interfaceStr)
				{
                    var match;
					match = interfaceStr.match(/^([^:]*): /);
					var interfaceName = match && match[1];
					match = interfaceStr.match(/ flags=([\d]+)<([A-Z,]+)>/);
					var flagNum = match && match[1];
					var flags = match && match[2].split(",");
					match = interfaceStr.match(/ options=([\d]+)<([A-Z,]+)>/);
					var optnum = match && match[1];
					var opts = match && match[2].split(",");
					match = interfaceStr.match(/ether ([a-zA-Z0-9:]{17})/);
					var mac = match && match[1];
					match = interfaceStr.match(/inet ([0-9\.]*)/);
					var ipAddress = match && match[1];
					match = interfaceStr.match(/netmask ([a-zA-Z0-9\.]*)/);
					var netmask = match && match[1];
					match = interfaceStr.match(/broadcast ([a-zA-Z0-9\.]*)/);
					var broadcast = match && match[1];
					match = interfaceStr.match(/status: ([a-zA-Z0-9]*)/);
					var status = match && match[1];
					if (interfaceName)
                    {
                        var the_interface = {};
                        if (interfaceName) the_interface.interfaceName = interfaceName;
                        if (ipAddress) the_interface.ipAddress = ipAddress;
                        if (netmask) the_interface.netmask = netmask;
                        if (mac) the_interface.mac = mac;
                        if (status) the_interface.status = status;
                        if (flagNum) the_interface.flagNum = flagNum;
                        if (flags) the_interface.flags = flags;
                        if (optnum) the_interface.optnum = optnum;
                        if (opts) the_interface.opts = opts;
                        if (broadcast) the_interface.broadcast = broadcast;
                    }
                    interfaceList.push(the_interface);
				}
				interfaceStr = line;
			}
			else if (interfaceStr){
                interfaceStr += '\n' + line;
			}
		}
		callback(interfaceList);
	});
};

var execNetworksetupListallhardwareports = function (callback){
    execDone('networksetup -listallhardwareports', function(stdoutLines){
        var hardwarePorts = [];
        var currentPort;
        for (var i in stdoutLines){
            var line = stdoutLines[i];
            if (line.match(/Hardware Port:/)){
                if (currentPort && currentPort['Hardware Port']){
                    hardwarePorts.push(currentPort);
                }
                currentPort = {};
            }
            var match = line.match(/([^:]+): ([^\n]*)/);
            if (currentPort && match){
                currentPort[match[1]] = match[2];
            }
        }
        callback(hardwarePorts);
    });
};


var execNetstatRNv4 = function (callback){
    var routeTable = [];
    execDone('netstat -rnf inet', function(stdoutLines){
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
                if (values.length > 3){
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

var execNetworksetupGetinfo = function (networkService, callback){
    execDone('networksetup -getinfo "' + networkService + '"', function(stdoutLines){
        var configType;
        var serviceInfo = stdoutLines instanceof Error ? null : {serviceName: networkService};
        for(var i in stdoutLines){
            var line = stdoutLines[i];
            if (line.match(/^([^:]*) Configuration/) && !configType){
                var match = line.match(/^([^:]*) Configuration/);
                configType = match[1];
            }
            else if (line.match(/^[^:]+: [\s\S]*$/)){
                var match = line.match(/^([^:]+): ([\s\S]*)$/);
                if (match){
                    serviceInfo[match[1]] = match[2];
                }
            }
        }
        callback(serviceInfo);
    });
};

execNetworksetupListallnetworkservices = function (callback){
    execDone('networksetup -listallnetworkservices', function(stdoutlines){
        var networkServices = [];
        for (var i in stdoutlines){
            var line = stdoutlines[i];
            if (line.length < 40){
                var match = line.match(/(\*)*([\s\S]*)/);
                if (match)
                {
                    var enabled = match[1] != "*";
                    var serviceName = match[2];
                    networkServices.push({enabled: enabled, serviceName: serviceName});
                }
            }
        }
        callback(networkServices);
    });
};

var getInfo = function (callback){
    var info = {networkInterfaces:[], routeTable: [], default: null}
    execIfconfig(function(interfaces){
        var interfaceDict = {};
        var interfaceDictByMac = {};
        for (var i in interfaces){
            var the_interface = interfaces[i];
            var interfaceObj = {
                ipAddress: the_interface.ipAddress,
                netmask: the_interface.netmask,
                mac: the_interface.mac,
                interfaceName: the_interface.interfaceName,
                enabled: true,
                connected: the_interface.status == 'active'
            };
            info.networkInterfaces.push(interfaceObj);
            if (interfaceObj.interfaceName) interfaceDict[interfaceObj.interfaceName] = interfaceObj;
            if (interfaceObj.mac) interfaceDictByMac[interfaceObj.mac] = interfaceObj;
        }
        execNetworksetupListallnetworkservices(function(services){
            var serviceDoneCount = 0;
            for (var i in services){
                execNetworksetupGetinfo(services[i].serviceName, function(serviceInfo){
                    serviceDoneCount ++;
                    if (serviceInfo){
                        var mac;
                        for (var key in serviceInfo){
                            var value = serviceInfo[key];
                            /////////////////////////////
                            if (value.match(/^([a-fA-F0-9]{2}:){5}([a-fA-F0-9]{2})$/)){
                                mac = value;
                            }
                        }
                        if (mac && interfaceDictByMac[mac]){
                            if (serviceInfo.serviceName)    interfaceDictByMac[mac].adapterName = serviceInfo.serviceName;
                            if (serviceInfo['Subnet mask']) interfaceDictByMac[mac].netmask = serviceInfo['Subnet mask'];
                            if (serviceInfo['Router']) interfaceDictByMac[mac].gateway = serviceInfo['Router'];
                        }
                    }
                    if (serviceDoneCount == services.length){
                        execNetstatRNv4(function(routeTable){
                            var defaultRoute;
                            for (var i in routeTable){
                                var routeItem = routeTable[i];
                                var routeObj = {
                                    destination: routeItem['Destination'] == 'default' ? '0.0.0.0' : routeItem['Destination'],
                                    gateway: routeItem['Gateway'],
                                    interfaceName: routeItem['Netif'],
                                    interfaceAddress: interfaceDict[routeItem['Netif']] && interfaceDict[routeItem['Netif']].ipAddress
                                };
                                info.routeTable.push(routeObj);
                                if (routeItem['Destination'] == 'default' && !defaultRoute)
                                {
                                    defaultRoute = routeObj;
                                }
                            }
                            if (defaultRoute && interfaceDict[defaultRoute.interfaceName]){
                                info.default = JSON.parse(JSON.stringify(interfaceDict[defaultRoute.interfaceName]));
                                info.default.gateway = defaultRoute.gateway;
                            }
                            callback(info);
                        });
                    }
                });
            }
        });
    });
};

module.exports.execIfconfig = execIfconfig;
module.exports.execNetworksetupListallhardwareports = execNetworksetupListallhardwareports;
module.exports.execNetstatRNv4 = execNetstatRNv4;
module.exports.execNetworksetupListallnetworkservices = execNetworksetupListallnetworkservices;
module.exports.getInfo = getInfo;