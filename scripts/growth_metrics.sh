#!/usr/bin/env bash
# growth_metrics.sh — pull on-chain traction metrics for the monthly growth report.
#
# Counts invoke_host_function operations made by the deployer/admin account on each
# network (a defensible floor for contract activity — buyer/investor accounts add more).
# Also reports contract event counts via stellar.expert.
#
# Usage: ./scripts/growth_metrics.sh
set -euo pipefail

MAINNET_ADMIN="GCFDGIZ4V356MHDLYNQWUOAWOFPBQ6K6PJWE3JCYYA3UXS4QULDG2YIO"
TESTNET_ADMIN="GD5HVOD6ZANYONRKCCDNQSSOSF5NLVW5UFY4OD4WBXSVM6E43KUB5JY2"
MAINNET_MKT="CD76S7XCNIC3Q64JKKX66YS4PQA4QLRKATRAGK6HZBC5KGKDSMFRI53F"
TESTNET_MKT="CDSLEGLUKSZ7X3M2I7DRP2PTKAGJOTAIZ5FVQVFJWTJBMZTJXRLDEUQD"

count_ops() {  # $1 horizon base, $2 account
  curl -s "$1/accounts/$2/operations?limit=200&order=desc" \
    | python3 -c "import sys,json;r=json.load(sys.stdin).get('_embedded',{}).get('records',[]);print(sum(1 for x in r if x.get('type')=='invoke_host_function'))"
}
count_events() {  # $1 network (public|testnet), $2 contract
  curl -s "https://api.stellar.expert/explorer/$1/contract/$2" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('events') or 0)"
}

echo "== InvoiceChain on-chain traction =="
echo "generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
printf "%-10s %-22s %-16s\n" "network" "admin_invocations" "contract_events"
printf "%-10s %-22s %-16s\n" "mainnet" "$(count_ops https://horizon.stellar.org $MAINNET_ADMIN)" "$(count_events public $MAINNET_MKT)"
printf "%-10s %-22s %-16s\n" "testnet" "$(count_ops https://horizon-testnet.stellar.org $TESTNET_ADMIN)" "$(count_events testnet $TESTNET_MKT)"
