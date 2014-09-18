node-networkControl
===================

This project aims to provide basic network interface information & control method for Windows, Linux & OS X.

It will rely on the command-line output, so to make sure this project can work, set language to English.

Currently IPv4 only

- Windows
    - getInfo()
        - hostname
        - networkInterfaces
            - ipAddress (if connected)
            - netmask (if connected)
            - gateway (if connected)
            - dns (if connected)
            - mac
            - adapterType
            - adapterName
            - interfaceName
            - isDhcp
            - enabled
            - connected
            - interfaceIndex
        - routeTable
            - destination
            - netmask
            - gateway
            - interfaceAddress
            - interfaceName
            - metric
        - default (if has default gateway)
            - ipAddress
            - netmask
            - gateway
            - dns
            - mac
            - adapterType
            - adapterName
            - interfaceName
            - isDhcp
            - enabled
            - connected
            - interfaceIndex
            - metric

- Linux
    - getInfo
        - hostname
        - networkInterfaces
            - ipAddress (if connected)
            - netmask (if connected)
            - mac
            - adapterType
            - interfaceName
            - enabled
            - connected
        - routeTable
            - destination
            - gateway
            - netmask
            - interfaceName
            - interfaceAddress
            - metric
        - default
            - ipAddress
            - netmask
            - mac
            - adapterType
            - interfaceName
            - enabled
            - connected
            - gateway
            - metric
            - dns
