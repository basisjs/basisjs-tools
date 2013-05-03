Developer tools for [basis.js](https://github.com/basisjs/basisjs) framework.

## Getting Started

### Requirements

* [node.js](http://nodejs.org/) (0.8.0 or later)
* [npm](http://github.com/isaacs/npm)

### Install

On Windows (with administrative access):

        $ npm install -g basisjs-tools
        
NOTE: Make sure `path/to/nodejs/node_modules/.bin` is presented in PATH.
        
On Mac OS:

        $ sudo npm install -g basisjs-tools

After that `basis` should be available in command line.

### Shell completion

To make completions for basisjs-tools available in your bash, run following command (ensure that you have bash-completion installed, first). Run this

        $ basis completion > /path/to/etc/bash_completion.d/basis

and restart bash.

If you aren't using bash-completion, you can add basis completion to your .bashrc and reload:

        $ basis completion >> ~/.bashrc
        $ source ~/.bashrc

## Common

### basis.config

Basis tries to find and use `basis.config` file by default. It attempts to find `basis.config` at the current working directory. If it is not found there, then it moves to the parent directory, and so on, until the root of the tree is reached.

If `basis.config` found, it's content parses as `json`. This file should contains a javascript object, where key is command name and value is setting for this command. Actually file can contains empty object, and it's not required specify setting for all commands.

`basis.config` file and it's directory using as relative point for path resolving, for cases when other is not defined. Most properties treats as corresponding command flags, and could be overridden by flags in command line.

Any command's flag could be put in config, as it's long name. If name contains `-` (dash) it should be camelize, i.e. `--css-pack` becomes `cssPack`. If flag contains '-no-', it must be ignored, i.e. `--js-no-single-file` becomes `jsSingleFile`.

You can disable `basis.config` usage by -n (--no-config) flag or specify your own file with -c (--config-file) argument.

Config file useful to set up command's defaults values.

Example of `basis.config` at `/path/to/config`:

```json
  {
    "build": {
      "file": "index.html",
      "output": "build"
    },
    "server": {
      "port": 8123
    }
  }
```

With this `basis.config` no difference at what directory you run `basis build` - `/path/to/config/app.html` will be built and result will be at `/path/to/config/output` directory. But you still able to override settings, for example, if you run `basis build -o temp` at `/path/to/config/foo/bar` - `/path/to/config/app.html` will be built and result will be at `/path/to/config/foo/bar/output`.

Use `basis --help` for more help.

### Relative path solving

Basis works with many various paths, and often it is relative paths. There are two general rules for relative path resolving.

* path defined in config file (`basis.config`) resolves to config file directory

* path defined in command line resolves to current working directory

## Tools

### Create

Create command helps generate code. As example, to create default application file structure, run command:

        $ basis create app myapp
        
That command creating directory `myapp` and other directories and files by default template.

### Server

Server is a lightweight http server, which allow you run `basis.js` apps locally. Use follow command to launch server:

        $ basis server

After that current folder become a base for path resolving (you can change it using `--base` flag). You also can set listening port with `--port` flag.

Server caches files you access for and inject it into html page (via `window.__resources__`) when send it to client. This approach speeds up loading of page with many files.

Also it watches for files changes and send new file content to client if neccessary (using `socket.io` and `basis.js` infrastructure). When you use `server` you don't need to refresh page when you change `.tmpl`, `.css` or l10n (`.json`) files.

For more help use:

        $ basis server --help

### Builder

Builder makes a build version of your app. Use follow command on certain path:

        $ basis build

Builder search for `index` file (`index.html` in current folder by default, but use can use `--file` flag to specify file) and use it as start point. It scan files and search for linked files, processing it and put result in `build` folder. As a result you get all used by application files in one folder.

Optionally builder may merge, optimize, pack etc. Use `--help` option to get more info:

        $ basis build --help

## License

Dual licensed under the MIT or GPL Version 2 licenses.
