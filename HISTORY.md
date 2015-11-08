## 1.5.2 (November 8, 2015)

### server

- fix: warning on handshake when client sends deleted filenames (after server restart)
- refactor `fsWatcher` and related changes
- avoid locations compute on `html` parse if possible

### create
- fix `.gitignore` in app template

## 1.5.1 (October 26, 2015)

- update `socket.io` version (support for `node.js` 4+)

## 1.5 (September 19, 2015)

- move some parts to separate packages: `basisjs-tools-config`, `basisjs-tools-ast` and `basisjs-tools-build`
- don't check for new version of tools for some commands
- refactoring and clean up
- update `jscs` config and code style fixes

### extract, build and lint

Commands moved to package `basisjs-tools-build`. See changes [here](https://github.com/basisjs/basisjs-tools-build/releases/tag/v1.0.0).

### server

- basic plugin support
- drop `preprocess` setting in config in favor of plugins support
- don't apply preprocessors for `basisjs-tools` files
- remove `--no-dot-filename-ignore` option
- remove `--hot-start-cache-by-ext` option
- remove `handler` option (config only)
- new virtual file API
- split into modules

### create

- use `npm` instead of `bower`
- fix: npm spawn on windows

## 1.4 (June 14, 2015)

This version supports for basis.js 1.3 and greater only. For basis.js prior 1.3, please, use `basisjs-tools` 1.3.

Extract

  - support for basis.js 1.4
    - since 1.4 use `basis-config` to init core
    - less heuristics, use basis.js core as much as possible (a.e. use `basis.resource.resolveURI` to resolve all paths instead of custom logic)
  - improve handler skipping
  - consider file read and JSON parse errors as fatal
  - FIX: `base`, `file` and `output` path resolving
  - rework path resolving: `FileManager` is now work with app files as server path (root is `base` path now)
  - move `asset()` and `resource()` relink to `build`
  - return promise as command result (resolve async)
  - optimize css processing (performance)
  - FIX: `file-map` handler when no `basis.l10n` used
  - FIX: basis.js commit hash fetch
  - FIX: resolving of unknown basis namespace

  - l10n
    - improve `l10n` markup token processing (now this feature is completely supported!)
    - improve `l10n` dictionary processing
      - split `l10n` handlers in `v1` and `v2` versions and related changes
      - new `l10n` handler that relink for all links changes
      - remove empty `_meta` and `_meta.type` in `v2` dictionaries
      - delete unused cultures (that not in culture list) for `v2` dictionaries
    - FIX: `l10n` enabled check

  - locations & warnings
    - warn about file not found for files that refer for those files
    - collect start positions for some tokens on javascript parse
    - lint javascript: unused names (definitions) and implicit usage of global names
    - add location info to inline scripts and styles
    - collect location info for attributes in html
    - various fixes and improvements for template warnings
    - no warnings for removed template parts
    - fix warnings copy on template analyse
    - add location for css warnings
    - correct warning locations for styles embed in other files
    - reduce duplicates in style warnings
    - use value parts location map if provided (from basis.js) for correct classes position in attributes
    - use styles offset map if provided (from basis.js) for correct class token positions
    - add originator and isolate prefix into template and style warnings
    - remove class name isolate prefixes in some warnings
    - improve warnings output on css info collect
    - better warning for non-resolved argument in `dictionary.token()`
    - new warning for mismatched paths in `l10n` dictionary type definition

  - template
    - use `-js-cut-dev` option instead of `-js-build-mode` to optimize template size
    - add support for basis.template declaration `v3` (new bindings format)
    - fatal error on missed style files in isolated templates
    - fix working with template theme defines
      - take in account theme fallbacks
      - no redundant templates
      - correct style theme distribution
    - better support for template inline styles
    - fix issue when one template used as several explicit defines
    - fix issue when resource reused for explicit define
    - move template implicit define injection to build

Build

  - support for basis.js 1.4
  - improve handler skipping
  - consider file read and json parse errors as fatal
  - fix exit code on errors (important for automation)
  - fix `base`, `file` and `output` path resolving
  - initially solution to build `Web Worker` scripts
  - pretty offset for html injections
  - improve style theme choosing on app build startup
  - improve logging
    - log translated resources
    - move summary handler aside
    - log inline file in flow
    - better output for `css/translate`
  - make throw optimisation safe and optional (apply only when `--js-optimize-throws` option is set)
  - NEW: option `--same-filenames`
  - NEW: option `--tmpl-default-theme`
  - FIX: unknown type for `0.css`
  - FIX: asset relink for resource files
  - FIX: `--css-optimize-names` exception when basis.js is not used
  - FIX: `--css-optimize-names` to work correctly with `anim:` bindings
  - FIX: CSS corruption on CSS pack, when files contains shared subtrees
  - FIX: bug with class name renaming (`--css-optimize-names`)

Server

  - move proxy and request rewriting to separate module
  - fix issue with url resolving when server runs inside `basisjs-tools`
  - make case sensitive filename check universal (os-independant)

Other

  - new command `lint`
  - fix broken `config` command
  - use `exit` module instead of `process.exit()`
  - use hi-res time for timing
  - `basis -v` returns proper dev version now
  - use `<b:isolate>` in default templates (`create` command)
  - add some tests
  - improve work with CSS AST
    - add support for `/deep/` combinator in css parser
    - use own translator instead of `csso` translator (performance, less memory consumption)
    - new own fast walker
  - improve javascript scope processing
    - move aside everything not connected with scope from `ast/scope`
    - recognise some common global names
    - correct process scope for catch clause

## 1.3.20 (February 3, 2015)

- build: hot fix for [broken `htmlparser2` issue](https://github.com/cheeriojs/dom-serializer/issues/19)

## 1.3.19 (November 12, 2014)

- build: fix hash-digest for style files in theme map
- build: add read files content digest to build `<meta>`
- build: fetch commit when `basisjs-tools` installed not by version tag
- build: provide real config for `basis.js` 1.4
- build: require `basis.js` only once (in `processBasisFile.js`)
- build: support for local `asset` function and new resolving algorithm for `basis.asset` (for basis.js 1.4)
- build: better error output on `js` compress
- extract: fix issue with template files in the input graph
- extract: fix template comparison (`isolate` issue)
- extract: use basis core to resolve paths for `basis.js` 1.4
- extract: fix `css` info collection for `anim:` bindings
- cli: resolve `basis.config` relative to `process.env.PWD` when possible
- cli and module refactoring

## 1.3.18 (October 12, 2014)

- server: load injected scripts `async` and `defer`
- server: don't notify client about server internal files changes
- server: don't use `basis.js` implicit namespace extensions in client script (avoid warnings in `1.4+`)
- build: exit with code `8` when fatal error (instead of `0`)
- build: remove `--js-resolve-path` option as not working for now
- build: fix `--target output-graph`
- create: fix `app.js` in app template
- change global config name `basis` -> `basisjs-tools` and migration (file path changed as well)
- bump deps

## 1.3.17 (July 23, 2014)

- build & extract: fix `basisjsBaseURI`
- extract: fix l10n dictionary path resolve for `basis.js` prior `1.0`
- cleanup in repo root, remove GPL license

## 1.3.16 (July 16, 2014)

- build: output version and commit (for non-release versions) of `basisjs-tools` and `basis.js` if possible
- build: fix resolving expressions with `__dirname` in `basis.js` modules
- build: robust `--js-pack` handler, if `google-closure-compiler` command is not enabled, use `uglify-js`
- build: show extra info in non-TTY mode (i.e. file output)
- extract: pass correct `sourceOrigin` to `basis.template.makeDeclaration` but not just `true`
- better cli errors output

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
