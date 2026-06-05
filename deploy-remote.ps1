# deploy-remote.ps1 — SSH into the home server and deploy the tasks app.
#
# Usage:
#   .\deploy-remote.ps1 <user> <host>
#
# On first run: clones the repo to ~/code/tasks if it doesn't exist yet.
# Subsequent runs: fetches latest main and runs ./deploy.sh

param(
    [Parameter(Mandatory = $true, Position = 0,
        HelpMessage = "Remote SSH username, e.g. 'shahar'")]
    [string]$Username,

    [Parameter(Mandatory = $true, Position = 1,
        HelpMessage = "Remote host or IP, e.g. '89.139.33.201'")]
    [string]$Hostname
)

$ErrorActionPreference = 'Stop'
$SshTarget = "$Username@$Hostname"

Write-Host "=> Connecting to $SshTarget ..."
Write-Host ""

$RemoteScript = @'
set -e
if [ ! -d "$HOME/code/tasks" ]; then
  echo "=> Cloning tasks repo for the first time..."
  mkdir -p "$HOME/code"
  git clone https://github.com/WeissShaharIL/tasks.git "$HOME/code/tasks"
fi
cd "$HOME/code/tasks"
git fetch --tags --prune --force origin
git checkout main
git reset --hard origin/main
sed -i 's/\r$//' deploy.sh
chmod +x deploy.sh
./deploy.sh
'@

$RemoteScript = $RemoteScript -replace "`r`n", "`n"
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($RemoteScript)
$B64 = [Convert]::ToBase64String($Bytes)
$RemoteCommand = "echo $B64 | base64 -d | bash"

ssh -t $SshTarget $RemoteCommand

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "=> Remote deploy FAILED (exit $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "=> Done." -ForegroundColor Green
