## 1.3.0 (February 22, 2014)

Common

  - brand new module `clap` as command line argument parser (refactoring of commands, remove `commander` module as dependency)
  - add `jscs` config, base code style cleanup
  - rename `bin/basis.js` to `bin/basis`

Server

  - rework server file changes watcher (more stable and robust now)
  - reduce output messages (use `--verbose` flag for more messages)
  - colorize output messages (suppress by `--no-color` option)
  - use cache for `__basis_resources__` gzip
  - rename `__basis_resources__.js` to `/basisjs-tools/resourceCache.js`
  - rename `__devsync__.js` to `/basisjs-tools/syncFiles.js`
  - client/server handshake doesn't depend on `basis.js` anymore
  - new socket command `openFile` to open file in external editor
  - remove deprecated things, remove appcp client and server, clean requires
  - various improvements

Build

  - reduce output messages (use `--verbose` flag for more messages)
  - colorize output messages in non-verbose mode (suppress by `--no-color` option)
  - new `--css-inline-image` option to inline css images
  - new `--warnings` option to show warning list in summary
  - show matched `js` expression on extract in verbose mode
  - add build label `<meta>` to index file
  - copy unknown options in `basis-config` to build as is
  - add `./` prefix to relinked filenames for `basis.resource`, `basis.require` and `basis.l10n.dictionary`
  - remove `js/merge` handler as not working for now
  - FIX: relative `require` filename resolving
  - FIX: js file translate in some cases
  - FIX: left part resolving in assign expressions
  - FIX: asset `html` files output path
  - FIX: template extractor on `MacOS`
  - FIX: `l10n` pack for `basis.l10n` version 2
  - FIX: `l10n` dictionary filename resolving
  - FIX: various path related bugs

## 1.2.1 (January 29, 2014)

- FIX: fix regression that options in config can't be overwritten by command line

## 1.2.0 (January 28, 2014)

Create

  - NEW: init `git` repo in app folder on app create by default
  - NEW: use `bower` to install `basis.js`
  - NEW: `app` could be created in current and existence directories now
  - FIX: path resolving issues
  - update templates for new `basis.js` version

Server

  - FIX: `getFileGraph` filename resolving doesn't ignore search part in url
  - FIX: make server more stable for non-function callbacks in socket commands
  - prevent browsers to cache any files by default 
  - rework files sync `client.js` (`__dev_sync__.js`) to not depend on basis.js

Extract/build

  - FIX: image resources in `<link>` tag is not resolving
  - FIX: inline `javascript` translation when no pack mode
  - FIX: `injectToHead tries` inject node before `<body>` if possible when no `<head>` tag
  - FIX: internal `html` resources didn't parse to ast

Project

  - NEW: use `update-notifier` package to notify about new version of `basisjs-tools` is out
  - FIX: some fixes for `commander`, output available command list and description in help
  - remove `here` command

## 1.1.4 (November 28, 2013)

* add support for local version of basis.require in javascript resources
* fix stat handler in extractor

## 1.1.3 (November 19, 2013)

* fix basis.resource resolving
* fix basis.require relink
* fix basis.l10n.dictionary filename resolving

## 1.1.2 (October 24, 2013)

* hot fix for basis.js 0.9 apps

## 1.1.1 (October 24, 2013)

* rework processing of autoload
* replace config function in basis.js for config object
* add support for noConflict in basis-config
* add support for extProto in basis-config

## 1.1.0 (September 21, 2013)

* new basis resource layout
* support for new `basis.require` (`basis.js` 1.0.0)
* support for new `basis.l10n` (`basis.js` 1.0.0)
