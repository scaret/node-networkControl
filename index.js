var os = require('os');

var networkUtil;
switch(os.platform())
{
	case 'win32':
		networkUtil = require('./networkUtil/win32');
		break;
	default:
		throw new Error('Unsupported platform ' + os.platform());
}

module.exports.getInfo = networkUtil.getInfo;