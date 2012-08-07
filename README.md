Developer tools for [basis.js](https://github.com/lahmatiy/basisjs) framework.

## Getting Started

### Requirements

* [nodeJS](http://github.com/ry/node)
  - versions: 0.8.0 or later
* [npm](http://github.com/isaacs/npm)

### Install

* With [npm](http://github.com/isaacs/npm)

        $ npm install basis-devtools

After that `basis` should be available in command line.

NOTE: If you are on Windows make sure `path/to/nodejs/node_modules/.bin` is present in PATH

## Tools

### Server

Server is a lightweight http server, which allow you run `basis.js` apps locally. Use follow command to launch server:

        $ basis server

After that current folder become a base for path resolving (you can change it using `--base` flag). You also can set listening port with `--port` flag.

Server cache files you access for and inject it into html page (via window.__resources__) on load. This approach speed up page loading with many files.

Also it watch for files changes and serve new file content to client when suitable (using `socket.io` and `basis.js` infrastructure). When you use `server` you don't need update page when you change `.tmpl`, `.css` or l10n files (`.json`).

For more help use:

        $ basis server --help

### Builder

Builder makes a build version of your app. Use follow command on certain path:

        $ basis build

Builder search for `index` file (`index.html` in current folder by default, but use can use `--file` flag to specify file) and use it as start point. It scan files and search for linked files, processing it and put result in `build` folder. As a result you get all used by application files in one folder.

Optional builder merge, optimize, pack, relink etc. Use `--help` options to get more info:

        $ basis server --help