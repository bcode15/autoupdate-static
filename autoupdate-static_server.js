import fs from 'fs';
import path from 'path';
const SimpleSchema = Npm.require('simpl-schema');
const _ = Npm.require('lodash');

const schemaVersionContext = new SimpleSchema({
  'version': String,
  'versionRefreshable': String,
  'versionNonRefreshable': String,
  'versionReplaceable': String,
  // assets are ignored but they could be defined
  'assets': {
    'type': Array,
    'optional': true
  },
  'assets.$': Object,
  'assets.$.url': String
}).newContext();

const schemaAutoupdateContext = new SimpleSchema({
  'versions': {
    'type': Object,
    'blackbox': true
  },
  'appId': String
}).newContext();

function validate(path, fileData) {
  const autoupdate = _.pick(fileData, ['versions', 'appId']);

  // Simpl-Schema does not support dotted keynames (e.g. 'web.browser')
  // So need to validate in 2 steps

  // Validate the top level object
  schemaAutoupdateContext.validate(autoupdate);

  if(!schemaAutoupdateContext.isValid()) {
    console.error(`${path}: did not pass schema validation, ignoring`);
    console.error(schemaAutoupdateContext.validationErrors());
    return false;
  }

  // Make sure expected keys are in autoupdate.versions
  const versionKeys = _.keys(autoupdate.versions);
  const expectedKeys = ['web.browser', 'web.browser.legacy', 'web.cordova'];
  if(_.difference(versionKeys, expectedKeys).length > 0) {
    console.error(`Expected ${expectedKeys} in autoupdate.versions, found: ${versionKeys}, ignoring`);
    return false;
  }

  // finally check version keys
  expectedKeys.forEach((k) => {
    schemaVersionContext.validate(autoupdate.versions[k])
    if(!schemaVersionContext.isValid()) {
      console.error(`${path}: did not pass schema validation, ignoring`);
      console.error(schemaVersionContext.validationErrors());
      return false;
    }
  });
  return true;
}

function log(str) {
  process.stdout.write('AutoupdateStatic: ' + str);
}

log.newline = () => process.stdout.write('\n');

/*
 * Monitor the autoupdate.json file in the release location
 * when the file updates update the autoupdate parameters for this appId
 * 
 * Directories to monitor are taken from (in priority order):
 * Meteor.private.autoupdate.monitors (array of strings)
 * process.env.AUTOUPDATE_MONITORS (',' separated list) 
 * 
 * Each monitored directory is looking for an autoupdate.json file
 * The expected format of the autoupdate.json file is:
 * 
 */

function fileChangeHander(filePath) {
  return function () {
    log(`Change detected [${(new Date()).toLocaleString()}]: ${filePath}\n`);
    let autoupdate;
    try {
      autoupdate = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      // onerror noop
      // output logging '\n\
      log.newline();
    }
    if(!autoupdate || !validate(filePath, autoupdate)) return;
    log(`[${autoupdate.appId}] version: ${autoupdate.versions['web.browser'].version}\n`);
    AutoupdateHookOtherClient(autoupdate.appId, autoupdate);
  };
}

Meteor.startup(() => {
  const envMonitors = process.env.AUTOUPDATE_MONITORS;
  let allWatched = envMonitors && envMonitors.split(',')
  || Meteor.settings.config?.['autoupdate.static']?.monitors
  || [];

  allWatched = allWatched.map((d) => d.trim());

  // create fully qualified paths
  allWatched = allWatched.map((p) => path.resolve(path.join(p, 'autoupdate.json')));

  log(`Watching: ${allWatched}\n`);
  allWatched.forEach((watched) => {
    // watchFile does not callback if the file exists on first call
    // but it does if the file does not exist
    if(fs.existsSync(watched)) fileChangeHander(watched)();
    fs.watchFile(watched, fileChangeHander(watched));
  })
});

