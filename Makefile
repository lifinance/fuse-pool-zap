# include .env file and export its env vars
# (-include to ignore error if it does not exist)
-include .env

.PHONY: all test

# deps
update:; forge update

# Build & test
build  :; forge build
test   :; forge test --fork-url ${TEST_RPC_URL} --fork-block-number ${BLOCK_NUMBER} -vv
trace   :; forge test --fork-url ${TEST_RPC_URL} --fork-block-number ${BLOCK_NUMBER} -vvv
watch   :; forge test --watch src test --fork-url ${TEST_RPC_URL} --fork-block-number ${BLOCK_NUMBER} -vv
clean  :; forge clean
snapshot :; forge snapshot --fork-url ${TEST_RPC_URL} --fork-block-number ${BLOCK_NUMBER}
deploy :; forge create --rpc-url ${RPC_URL} --private-key ${PRIVATE_KEY} src/FusePoolZap.sol:FusePoolZap