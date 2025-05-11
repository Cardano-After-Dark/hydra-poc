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
