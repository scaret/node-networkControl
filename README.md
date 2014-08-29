node-networkControl
===================

This project aims to provide basic network interface information & control method for Windows, Linux & OS X.

It will rely on the command-line output, so to make sure this project can work, set language to English.

Currently IPv4 only

## TODO

- Windows
	- getInfo()
		-networkInterfaces
			- ipAddress
			- netmask
			- gateway
			- dns
			- mac
			- adapterType
			- adapterName
			- interfaceName
			- interfaceIndex
			- ipconfigType (static, dhcp, mobile)
			- enabled
			- connected
		-routeTable
			- destination
			- netmask
			- gateway
			- interfaceAddress
			- interface
			- metric
		-default
