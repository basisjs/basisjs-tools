## 1.3.15 (July 10, 2014)

- build: fix build regression for `basis.js` prior `1.3.0` (added in `1.3.12`)
- build: fix build for `basis.js` 1.3.0 with modules that create a sandbox (for example `basis.devpanel`)

## 1.3.14 (July 8, 2014)

- build & extract: set up env for `basis.js` (uses since `1.3.0`)
- server: show error message instead of exception when `socket.io` lib is not defined
- server: unify client/server communication on sync init (`ready`/`knownFiles` -> `handshake`)
- server: new option `--inspect` to include inspecting script
- server: fix internal redirects when no host in destination

## 1.3.13 (July 1, 2014)

- server: fix issue with `fileSync.js` on Mac OS

## 1.3.12 (July 1, 2014)

- server: fix `socket.io` issue when using with `require.js` using
- server: inject `socket.io` client in `fileSync.js`
- add support for `basis.js` 1.3.0 config in `extract` and `build`

## 1.3.11 (June 26, 2014)

- update dependancies versions 
- implement global config storage and `config` command
- create: update templates 
- create: use create.templates option in config to specify optional paths for templates
- server: tweak init output
- server: don't load socket.io through XHR, but using `<script>` (faster load, less noise in console)

## 1.3.10 (May 24, 2014)

- extractor: fix nested templates issue
- extractor: temporary solution for preprocessors to process file content on extract
- fix preprocessor relative paths resolving to config location

## 1.3.9 (May 23, 2014)

- server: add support for preprocessors
- extractor: add support for virtual resources

## 1.3.8 (April 27, 2014)

- server: fix crash on proxy error handling

## 1.3.7 (April 25, 2014)

- build: make `--css-inline-image` works for style attributes
- server: fix `createFile` command
- server: show proxy errors in log and correct error message in response
- server: fix `UNABLE_TO_VERIFY_LEAF_SIGNATURE` issue on proxy requests


## 1.3.6 (March 22, 2014)

- fix path resolving by `server` when `basisjs-tools` and app located on different drives (issue #12)

## 1.3.5 (March 21, 2014)

- server shows 'port already in use' warning and other errors now, but not silently exit
- fix `module.exports` values resolving on extract

## 1.3.4 (March 19, 2014)

Extractor

  - FIX: when `basis.require` invoke for namespace it didn't reference to `module.exports`
  - FIX: scope reference resolving
  - FIX: crash on warning when template source is not a `basis.js` resource  

Server

  - NEW: support for `http` -> `https` proxy
  - disable `x-forwarded` headers for proxy by default (some servers worry about it and some redirect requests)

## 1.3.3 (March 16, 2014)

- fix relative path resolving in `extractor` for `basis.require`
- fix `basis.js` installing by `create app` when app name specified

## 1.3.2 (March 8, 2014)

- fix absolute path resolving in `extractor` for `basis.resource` and `basis.require`
- some fixes in `server` message output

## 1.3.1 (February 28, 2014)

Common

  - update dependancy lib versions
  - small `server `message output improvements 
  - fix command argument processing for `build`, `create` and `extract`

Build & extract

  - `style` attributes in templates are now processing
  - output fatal error for more than one `<link>` with same filename
  - name main `basis.js` file as `script.js` if present
  - add `require` and `resource` arguments to module wrapper as 3rd party libraries could test for `require` is present
  - FIX: don't warn on `<script>` with external url
  - FIX: `style` attributes processing (fetch resources, pack and so on)
  - FIX: don't merge `<style>`/`<link>` with `id` attribute
  - FIX: don't lose id attribute on replaced `<link>`
  - FIX: avoid warning in build app for `_theme_css_` include

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
