/*
 *  Started to code this but then thought outputing a file would
 *  be a better option.  Checking in, in case I need to come back
 *  to it.
 */

function handlePOSTautoupdate(req, res, next) {
  console.log('Got autoupdate!');
  res.status(200).end();
}

Meteor.startup(() => {
  Meris.onResource('POST', 'autoupdate', handlePOSTautoupdate, undefined, 'device');
});
