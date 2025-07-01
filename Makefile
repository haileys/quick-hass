INSTALLBASE ?= $(HOME)/.local/share/gnome-shell/extensions
UUID = hassclimate@hails.org

.PHONY: default
default:

.PHONY: install
install:
	mkdir -p $(INSTALLBASE)
	cp -r $(UUID) $(INSTALLBASE)/
	cp config.js $(INSTALLBASE)/$(UUID)/

.PHONY: debug
debug: install
	dbus-run-session -- gnome-shell --nested --wayland
