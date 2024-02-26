/* eslint-disable no-console */
import { Meteor } from 'meteor/meteor';
import fs from 'fs-extra';
import path from 'path';
import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';
import { AutoupdateHookOtherClient } from 'meteor/autoupdate';
import { WebApp } from 'meteor/webapp';
/* global process console */

checkNpmVersions(
  {
    'simpl-schema': '3.4.4',
    lodash: '4.17.21'
  },
  'brucejo:autoupdate-static'
);

import SimpleSchema from 'simpl-schema';
import _ from 'lodash';

const schemaVersionContext = new SimpleSchema({
  version: String,
  versionRefreshable: String,
  versionNonRefreshable: String,
  versionReplaceable: String,
  // assets are ignored but they could be defined
  assets: {
    type: Array,
    optional: true
  },
  'assets.$': Object,
  'assets.$.url': String
}).newContext();

const schemaAutoupdateContext = new SimpleSchema({
  versions: {
    type: Object,
    blackbox: true
  },
  appId: String
}).newContext();

const PRFX = 'AutoupdateStatic:';
const log = (...args) => console.log(PRFX, ...args);
const error = (...args) => console.error(PRFX, ...args);

const expectedKeys = ['web.browser', 'web.browser.legacy', 'web.cordova'];
/**
 * validate the autoupdate schema
 *
 * @param {string} path - path to file, used for error strings
 * @param {any} aUpdateObject - autoupdate object to be validated
 * @returns {boolean} - true if valid object, false otherwise
 */
function validate(path, aUpdateObject) {
  const autoupdate = _.pick(aUpdateObject, ['versions', 'appId']);

  // Simpl-Schema does not support dotted keynames (e.g. 'web.browser')
  // So need to validate in 2 steps

  // Validate the top level object
  schemaAutoupdateContext.validate(autoupdate);

  if (!schemaAutoupdateContext.isValid()) {
    error(`${path}: did not pass schema validation, ignoring`);
    error(schemaAutoupdateContext.validationErrors());
    return false;
  }

  // Make sure expected keys are in autoupdate.versions
  const versionKeys = _.keys(autoupdate.versions);
  // make sure versionKeys are in the expectedKeys set
  if (_.difference(versionKeys, expectedKeys).length > 0) {
    error(`Expected ${expectedKeys} in autoupdate.versions, found: ${versionKeys}, ignoring`);
    return false;
  }

  // finally check version keys
  for (const k of versionKeys) {
    schemaVersionContext.validate(autoupdate.versions[k]);
    if (!schemaVersionContext.isValid()) {
      error(`${path}: did not pass schema validation, ignoring`);
      error(schemaVersionContext.validationErrors());
      return false;
    }
  }

  return true;
}

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

/**
 * Closure function that returns the watched files handler function
 *
 * @param {string} filePath - path to the file that has changed
 * @returns {() => void} -
 */
function fileChangeHander(filePath) {
  return function () {
    log(`Change detected [${new Date().toLocaleString()}]: ${filePath}\n`);
    let autoupdate;
    try {
      const json = fs.readFileSync(filePath, 'utf8');
      autoupdate = JSON.parse(json);
    } catch (e) {
      // handle case where file does not exist
      if (e.code === 'ENOENT') {
        log(`${filePath} not found`);
        return;
      }
      // onerror noop
      // log it
      error(`Error parsing autoupdate.json`, e);
    }
    if (!autoupdate || !validate(filePath, autoupdate)) return;
    log(`[${autoupdate.appId}] version: ${autoupdate.versions?.['web.browser']?.version}\n`);
    AutoupdateHookOtherClient(autoupdate.appId, autoupdate);
  };
}

Meteor.startup(() => {
  const envMonitors = process.env.AUTOUPDATE_MONITORS;
  let allWatched =
    (envMonitors && envMonitors.split(',')) || Meteor.settings.config?.['autoupdate.static']?.monitors || [];

  if (allWatched.length < 1) {
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
    // if the file exists then force a call to the handler
    if (fs.existsSync(watched)) fileChangeHander(watched)();
    // from here on out the registered handler will be called by watchFile
    fs.watchFile(watched, fileChangeHander(watched));
  });
});

const autoupdatePath = process.env.AUTOUPDATE_EMITPATH || Meteor.settings.config?.['autoupdate.static']?.emit;

if (autoupdatePath) {
  // Monitor any updates to app configuration
  let autoupdateCache;
  WebApp.addUpdatedNotifyHook(({ runtimeConfig }) => {
    // for development builds only
    if (!Meteor.isDevelopment) return;
    // if we have a new autoupdate & it is different than the one on
    // disk, then write out a new one (when we write a new one meteor will restart)
    const autoupdate = _.cloneDeep(runtimeConfig.autoupdate);
    // Ignore all updates that have empty versions
    if (!autoupdate.versions || Object.keys(autoupdate.versions).length === 0) return;
    // versionHmr is restart dependent not build dependent
    // it is only used during development not necessary for autoupdate files
    // remove it
    ['web.browser', 'web.browser.legacy', 'web.cordova'].forEach((arch) => {
      delete autoupdate?.versions?.[arch]?.versionHmr;
    });

    if (_.isEqual(autoupdateCache, autoupdate)) return;
    autoupdateCache = autoupdate;

    let currentAutoupdate;
    const autoupdateFile = path.join(autoupdatePath, 'autoupdate.json');
    try {
      currentAutoupdate = fs.readFileSync(autoupdateFile, { encoding: 'utf-8' });
    } catch (e) {
      if (e.code !== 'ENOENT') throw new Error(e);
      log(`Autoupdate creating: ${autoupdateFile}`);
    }

    // No autoupdate change to disk version, bail
    if (currentAutoupdate && _.isEqual(autoupdateCache, JSON.parse(currentAutoupdate))) return;

    log(`Updating ${autoupdateFile}`, autoupdateCache);
    fs.outputFileSync(autoupdateFile, JSON.stringify(autoupdateCache));
  });
}
