var os = require('os');

var networkUtil;
switch(os.platform())
{
	case 'win32':
		networkUtil = require('./networkUtil/win32');
		break;
	case 'linux':
		networkUtil = require('./networkUtil/linux');
		break;
	default:
		throw new Error('Unsupported platform ' + os.platform());
}


for (var funcName in networkUtil){
	module.exports[funcName] = networkUtil[funcName];
}