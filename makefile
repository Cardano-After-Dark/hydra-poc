.PHONY: all help install cardano-node setup-funds alice-node bob-node init-head scan env

all: help

help:
	./hydra-mgr.sh

install:
	./hydra-mgr.sh install

cardano-node:
	./hydra-mgr.sh cardano-node

setup-funds:
	./hydra-mgr.sh setup-funds

alice-node:
	./hydra-mgr.sh alice-node

bob-node:
	./hydra-mgr.sh bob-node

commit-funds:
	./hydra-mgr.sh commit-funds

scan:
	./hydra-mgr.sh scan

env:
	./hydra-mgr.sh env

query-funding-wallet:
	./hydra-mgr.sh query-funding-wallet

query-username-wallets:
	./hydra-mgr.sh query-username-wallets

refund-funding-wallet:
	./hydra-mgr.sh refund-funding-wallet

refund-funding-wallet-username:
	./hydra-mgr.sh refund-funding-wallet-username

query-tip:
	./hydra-mgr.sh query-tip

query-demo-wallets:
	./hydra-mgr.sh query-demo-wallets

username-credentials:
	./hydra-mgr.sh username-credentials

fund-username:
	./hydra-mgr.sh fund-username