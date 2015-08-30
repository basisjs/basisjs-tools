[![NPM version](https://img.shields.io/npm/v/basisjs-tools.svg)](https://www.npmjs.com/package/basisjs-tools) [![Dependency Status](https://img.shields.io/david/basisjs/basisjs-tools.svg)](https://david-dm.org/basisjs/basisjs-tools)

Development tool set for apps built on [basis.js](https://github.com/basisjs/basisjs) framework.

## Getting Started

### Install

```
> npm install basisjs-tools
```

Or install it globally (prefered):

```
> npm install -g basisjs-tools
```

After that `basis` command should be available in command line.

### basis.config

`basisjs-tools` tries to find and use `basis.config` file by default. This file should contains base settings for commands. For more details see `basisjs-tools-config` [readme](https://github.com/basisjs/basisjs-tools-config).

## Tools

Commands provided:

- `completion`            – output completion script for *nix systems
- `config [name] [value]` – global configuration
- `create`                – code generator
- `server`                – launch dev-server
- `build [fileOrPreset]`  – make a build of app
- `extract [file]`        – extract app profile
- `find <reference>`      – resolve filename by reference
- `lint [fileOrPreset]`   – lint source code and output report

### completion

Completion command that is based on, and works similarly to the [npm completion](https://npmjs.org/doc/completion.html). It is not available for `Windows` users.

This command will output a Bash / ZSH script to put into your `~/.bashrc`, `~/.bash_profile`, or `~/.zshrc` file.

```
> basis completion >> ~/.bash_profile
> source ~/.bash_profile
```

### config

With `config` command you could set some setting. Those settings are primary user preference but not a project settings, and always override by options if any.

At this moment only setting are supported – `editor`. This setting sets command to open some filename in editor. For example, you could set `Sublime Text` as editor to open files in:

```
// command `subl` is available in console
> basis config editor subl

// if not, you could specify absolute path to `Sublime Text` on `Mac OS`
> basis config editor '/Applications/Sublime\ Text.app/Contents/SharedSupport/bin/subl'
```

If command run without arguments all current settings are listing.

### create

`create` command helps generate code. As example, to create default application file structure, run command:

```
> basis create app myapp
```
        
Command creating directory `myapp` and other directories and files by default app template.

### server

`server` command launch lightweight http development server:

```
> basis server
```

By default current folder becomes server root (you can change it using `--base` option). You also can set listening port with `--port` option on command run or define it in config (useful when launch several servers). By default server listen port `8000`.

```
> basis server -p 8123
Server run at http://localhost:8123
```

Server caches files you access to and inject it into html page (via `window.__resources__`). This approach speeds up page loading with many files.

Also it watches for files changes and send new file content to client if neccessary (using `socket.io` and `basis.js` infrastructure). When you use this server you usually don't need to refresh page when you change `.tmpl`, `.css`, `.json` or `.l10n` files.

### build

This command makes a build of your app:

```
> basis build
```

Builder search for `index.html` file (but use could use `--file` option to specify file or define it in config) and use it as start point. It scan file contents and search for linked files, processing it and put result in `build` folder (could be changed by `--output` option). As a result you get all used by application files in one folder.

Optionally builder may merge, optimize, compress sources etc.

See more details in [basisjs-tools-build](https://github.com/basisjs/basisjs-tools-build) repository.

### extract

Actually this command runs as first step of `build` and `lint` commands. It collect all useful information about app (app profile) and returns it as `json`.

```
> basis extract
```

Most options are the same as `build` command.

See more details in [basisjs-tools-build](https://github.com/basisjs/basisjs-tools-build) repository.

### lint

Output warnings from app profile as report. It supports several formats of output (reporters).

```
> basis lint
Warnings (2):

  /src/module/example/index.js
    * Defined but never used: missed

  /src/module/example/template/foo.tmpl
    * No style rules for: .mistake
```

Supported reporters:

- `console` (by default) - outputs warnings as plain text list (see example above)
- `checkstyle` - report in [checkstyle](http://checkstyle.sourceforge.net/) format
- `junit` - report in [JUnit](http://junit.org/) format

See more details in [basisjs-tools-build](https://github.com/basisjs/basisjs-tools-build) repository.

### find

Resolve file reference to absolute file path. It uses `basis.js` included by app (if available) with it's config.

```
> basis find basis:ui/popup.js
/path/to/app/node_modules/basisjs/src/basis/ui/popup.js
```

See more details in [basisjs-tools-build](https://github.com/basisjs/basisjs-tools-build) repository.

## License

Licensed under the MIT License.
