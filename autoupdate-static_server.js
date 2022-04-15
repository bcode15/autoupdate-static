import fs from 'fs-extra';
import path from 'path';
import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';

checkNpmVersions({
  'simpl-schema': '1.12.0',
  'lodash': '4.17.21'
}, 'brucejo:autoupdate-static');

const SimpleSchema = require('simpl-schema');
const _ = require('lodash');

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

const expectedKeys = ['web.browser', 'web.browser.legacy', 'web.cordova'];

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
  // make sure versionKeys are in the expectedKeys set
  if(_.difference(versionKeys, expectedKeys).length > 0) {
    console.error(`Expected ${expectedKeys} in autoupdate.versions, found: ${versionKeys}, ignoring`);
    return false;
  }

  // finally check version keys
  for(const k of versionKeys) {
    schemaVersionContext.validate(autoupdate.versions[k])
    if(!schemaVersionContext.isValid()) {
      console.error(`${path}: did not pass schema validation, ignoring`);
      console.error(schemaVersionContext.validationErrors());
      return false;
    }
  }

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

  if(allWatched.length < 1) {
    log('No autoupdate files being watched');
    return;
  }

  // create fully qualified paths
  // make sure path is trimmed
  allWatched = allWatched.map((p) => path.resolve(path.join(p.trim(), 'autoupdate.json')));

  log(`Watching: ${allWatched}\n`);
  allWatched.forEach((watched) => {
    // watchFile does not callback if the file exists on first call
    // but it does if the file does not exist
    if(fs.existsSync(watched)) fileChangeHander(watched)();
    fs.watchFile(watched, fileChangeHander(watched));
  });
});

// Monitor any updates to app configuration
// let autoupdateCache;
// WebApp.addUpdatedNotifyHook(({runtimeConfig}) => {
//   if(!Meteor.isDevelopment) return;
//   // for development builds
//   // if we have a new autoupdate & it is different than the one on
//   // disk, then write out a new one (when we write a new one meteor will restart)
//   const autoupdate = _.cloneDeep(runtimeConfig.autoupdate);
//   // versionHmr is restart dependent not build dependent
//   // it is only used during development
//   // not necessary for static files
//   // remove it
//   ['web.browser', 'web.browser.legacy', 'web.cordova'].forEach((arch) => {
//     delete autoupdate?.versions?.[arch]?.versionHmr;
//   });

//   if(_.isEqual(autoupdateCache, autoupdate)) return;
//   autoupdateCache = autoupdate;

//   // projRoot is prior to .meteor directory
//   const projRoot = cwd = process.cwd().split('/.meteor')[0];
//   const autoupdatePath = projRoot + `/private/mstatic/autoupdate.json`;
//   let currentAutoupdate;
//   try {
//     currentAutoupdate = fs.readFileSync(autoupdatePath, {encoding: 'utf-8'});
//   } catch(e) {
//     if(e.code !== 'ENOENT') throw new Error(e);
//     Meris.log.info(`Autoupdate creating: ${autoupdatePath}`);
//   }

//   if(currentAutoupdate && _.isEqual(autoupdateCache, JSON.parse(currentAutoupdate))) return;

//   console.warn(`RESTARTING: autoupdate updated at ${autoupdatePath}`, autoupdateCache);
//   fs.outputFileSync(autoupdatePath, JSON.stringify(autoupdateCache));
// });
