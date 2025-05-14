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

scan:
	./hydra-mgr.sh scan

env:
	./hydra-mgr.sh env

query-funding-wallet:
	./hydra-mgr.sh query-funding-wallet

query-username-wallets:
	./hydra-mgr.sh query-username-wallets

refund-funding-wallet-demo:
	./hydra-mgr.sh refund-funding-wallet-demo

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

start-user-node:
	./hydra-mgr.sh start-user-node

demo-credentials:
	./hydra-mgr.sh demo-credentials

demo-hydra-keys:
	./hydra-mgr.sh demo-hydra-keys

fund-demo:
	./hydra-mgr.sh fund-demo

commit-funds-demo:
	./hydra-mgr.sh commit-funds-demo