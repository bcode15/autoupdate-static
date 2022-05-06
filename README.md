# autoupdate-static

`autoupdate-static` is intended to aid in the creation of meteor client applications that share a single DDP server.

This package can perform 2 separate actions:
1. `autoupdate-static` can emit an `autoupdate.json` file whenever the autoupdate parmeters have changed for this server.  NOTE: this feature does not emit files if `Meteor.isDevelopment` is not `true `.
2. `autoupdate-static` can monitor the `autoupdate.json` file emitted by a foreign meteor server.  When `autoupdate-static` detects a file change it will load the new file and inform the `autoupdate` system to send an autoupdate change to the clients of the foreign server. This will then initiate an autoupdate.

## Install
`meteor add bcode15:autoupdate-static`

## Enable autoupdate.json monitoring
`autoupdate-static` initializes the directories to monitor in 2 ways:

### Meteor settings file

Add a `config['autoupdate.static'].monitors` field to your `<meteor settings>.json` file, for example:

```json
{
  ...
  "config": {
    "autoupdate.static": {
      "monitors": ["/absolute/path/to/foreign1/autoupdate/", "/absolute/path/to/foreign2/autoupdate/"]
    }
  }
}
```
### `AUTOUPDATE_MONITORS` Environment variable
Set `AUTOUPDATE_MONITORS` with a comma separated list of the release directories to monitor.

For example:

```bash
$> export AUTOUPDATE_MONITORS="/absolute/path/to/foreign1/autoupdate/,/absolute/path/to/foreign2/autoupdate/"
```
Setting the `AUTOUPDATE_MONITORS` will override any values set by the the `<meteor settings>.json` file.

## Enable emitting autoupdate.json
`autoupdate-static` enable emitting the autoupdate.json file in 2 ways:

### Meteor settings file

Add a `config['autoupdate.static'].emit` field to your `<meteor settings>.json` file, for example:

```json
{
  ...
  "config": {
    "autoupdate.static": {
      "emit": "/absolute/path/to/autoupdate.json/output/"
    }
  }
}
```
### `AUTOUPDATE_EMITPATH` Environment variable
Set `AUTOUPDATE_EMITPATH` with the path to emit the autoupdate.json file.

For example:

```bash
$> export AUTOUPDATE_EMITPATH="/absolute/path/to/autoupdate.json/output/"
```
Setting the `AUTOUPDATE_EMITPATH` will override any values set in the the `<meteor settings>.json` file.

## Typical Usage

`autoupdate-static` would be used in situations when you have multiple **"secondary"** Meteor projects that share a **"primary"** server for all DDP operations.

`autoupdate-static` enables all the **"secondary"** clients to receive autoupdate notifications when the source code changes.

This is especially useful during development.

### Scenario

```
# On the secondary server
secondary$ AUTOUPDATE_EMITPATH=/absolute/path/to/autoupdate.json/output/ meteor run

# On the primary server
primary$ AUTOUPDATE_MONITORS=/absolute/path/to/autoupdate.json/output/ meteor run
```

This will set up the **"secondary"** to emit an `autoupdate.json` file that the **"primary"** will monitor.

**Note**: you can also encode this in the `<meteor settings>.json` file.
