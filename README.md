Developer tools for [basis.js](https://github.com/lahmatiy/basisjs) framework.

## Getting Started

### Requirements

* [nodeJS](http://github.com/ry/node) (0.8.0 or later)
* [npm](http://github.com/isaacs/npm)

### Install

* With [npm](http://github.com/isaacs/npm)

        $ npm install basis-devtools

After that `basis` should be available in command line.

NOTE: If you are on Windows make sure `path/to/nodejs/node_modules/.bin` is presented in PATH

## Tools

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

        $ basis server --help

## License

Dual licensed under the MIT or GPL Version 2 licenses.