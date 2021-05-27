# autoupdate-static

This package monitors the `autoupdate.json` file of static meteor builds.  When the `autoupdate.json` file changes, `autoupdate-static` will call the `autoupdate` hook to set the autoupdate parameters for the static application.

This will then initiate an autoupdate.

## Install
`meteor add brucejo:autoupdate-static`

## Set the static install directories to monitor
`autoupdate-static` initializes the directories to monitor in 2 ways:

### Meteor settings file

Add an entry to your `<meteor settings>.json` file, for example:

```json
{
  ...
  "config": {
    "autoupdate.static": {
      "monitors": ["path/to/static/release/1", "path/to/static/release/2"]
    }
  }
}
```
### `AUTOUPDATE_MONITORS` Environment variable
Set `AUTOUPDATE_MONITORS` with a comma separated list of the release directories to monitor.

For example:

```bash
$> export AUTOUPDATE_MONITORS="path/to/static/release/1,path/to/static/release/2"
```
Setting the `AUTOUPDATE_MONITORS` will override any values set by the the `<meteor settings>.json` file.
