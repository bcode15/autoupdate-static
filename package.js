Package.describe({
  name: 'bcode15:autoupdate-static',
  version: '0.1.3',
  // Brief, one-line summary of the package.
  summary: 'Enables autoupdate for staticly served websites',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: ''
});

Package.onUse(function(api) {
  api.use('webapp', 'server');
  api.use('autoupdate', 'server');
  api.use('ecmascript', 'server');
  api.use('tmeasday:check-npm-versions', 'server');
  api.addFiles(['autoupdate-static_server.js'], 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
});
