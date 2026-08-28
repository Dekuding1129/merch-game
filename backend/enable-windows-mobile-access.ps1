#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$wslIp = ((wsl.exe hostname -I).Trim() -split '\s+')[0]
if (-not $wslIp) { throw 'Could not determine the WSL IP address.' }

netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=8000 2>$null
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=8787 2>$null
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8000 connectaddress=$wslIp connectport=8000
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8787 connectaddress=$wslIp connectport=8787

Get-NetFirewallRule -DisplayName 'LOOT Demo Frontend','LOOT Demo Backend' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'LOOT Demo Frontend' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Private | Out-Null
New-NetFirewallRule -DisplayName 'LOOT Demo Backend' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787 -Profile Private | Out-Null

$wifiIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|WiFi' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)
Write-Host "WSL target: $wslIp"
Write-Host "Phone URL: http://$wifiIp`:8000/?api=http://$wifiIp`:8787"
Write-Host "Backend check: http://$wifiIp`:8787/api/health"
netsh interface portproxy show all
