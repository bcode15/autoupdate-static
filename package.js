Package.describe({
  name: 'brucejo:autoupdate-static',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'Enables autoupdate for staticly served websites',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: ''
});

Npm.depends({
  'simpl-schema': '1.12.0',
  'lodash': '4.17.15'
});

Package.onUse(function(api) {
  api.use('meteor-base', 'server');
  api.use('autoupdate', 'server');
  api.use('ecmascript', 'server');
  api.addFiles(['autoupdate-static_server.js'], 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
});
