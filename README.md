# linux-user

Node.js module for Linux user and group management.

Easily manage Linux users and groups with a simple API. Full promise and `async/await` support out of the box, ES5 compatibility, and **zero dependencies**!

> ⚠️ **Note**: This module must be running on Linux and requires root user privileges for most operations.

[![NPM](https://nodei.co/npm/linux-sys-user.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/linux-sys-user/)

## Notes

This is a fork of [wxygeek](https://github.com/wxygeek) abandoned [linux-user](https://github.com/wxygeek/linux-user) project.

## Installation

`$ npm install linux-sys-user --save`

Most of the functions require privileged(root) access. The methods that
simply return information will work, as well as the methods that only work on
current user will also work with out root. 


## Testing

`$ npm test`

The testing libraries only work with NodeJS 6 and up.

Tests that modify system state require root. When the suite is **not** run as
root, those tests are automatically skipped and the read-only tests still run,
so `npm test` passes in CI and on dev machines without root. To exercise the
full suite, run as root:

```bash
sudo ./node_modules/mocha/bin/mocha
```

Newer version of NPM does not allow executing as root, if you run into this
issue, call mocha directly as shown above.

## Non-root usage

Most functions that modify the system require root, but the read-only
functions only read `/etc/passwd` and `/etc/group` (world-readable) or operate
on the calling user, so they work without root.

Importing the main module prints a warning when it is not running as root. If
you only need the read-only functions you can import the non-root path, which
exposes only those functions and emits **no** root warning:

```js
// read-only subset, no root warning, safe to use without root
var linuxUser = require('linux-user/non-root');

linuxUser.getUsers(function (err, users) {
  // ...
});
```

The non-root export exposes: `getUsers`, `getGroups`, `getUserInfo`,
`getUserGroups`, `getExpiration`, `validateUsername`, and `verifySSHKey`, plus
a read-only `promise()` factory. The same set is also available as
`require('linux-user').nonRoot` for convenience (the main import still emits the
root warning in that case).

## Usage

This works with your normal require and execute callback functions. Every method
takes a callback and is non-blocking.

All callbacks follow the Node.js convention `(err, result)`. Errors are always
`Error` objects (or `null` on success) -- they are never passed as strings or
booleans.

### Examples

* add Linux user

```js
var linuxUser = require('linux-sys-user');

linuxUser.addUser({username:"gkuchan", create_home:true, shell:null}, function (err, user) {
  if(err) {
    return console.error(err);
  }
  console.log(user);
  // ------------------------------------------
  // { username: 'gkuchan',
  //   password: 'x',
  //   uid: 1001,
  //   gid: 1001,
  //   fullname: '',
  //   homedir: '/home/gkuchan',
  //   shell: '/usr/sbin/nologin' }
  // ------------------------------------------
});
```
* get users

```js
var linuxUser = require('linux-sys-user');

linuxUser.getUsers(function (err, users) {
  if(err) {
    return console.error(err);
  }
  console.log(users);
  // ------------------------------------------
  // [ { username: 'root',
  //   password: 'x',
  //   uid: 0,
  //   gid: 0,
  //   fullname: 'root',
  //   homedir: '/root',
  //   shell: '/bin/bash' },
  // { username: 'daemon',
  //   password: 'x',
  //   uid: 1,
  //   gid: 1,
  //   fullname: 'daemon',
  //   homedir: '/usr/sbin',
  //   shell: '/usr/sbin/nologin' },
  // { username: 'bin',
  //   password: 'x',
  //   uid: 2,
  //   gid: 2,
  //   fullname: 'bin',
  //   homedir: '/bin',
  //   shell: '/usr/sbin/nologin' } ]
  //   ------------------------------------------
  });
```

### Promises

This project works with promises right out of the box! Just grab the promise
function.

```js
var linuxUser = require('linux-sys-user').promise();
```

This will NodeJS's `util.promisify` by default. You can pass your own promisify
function like, like bluebird:

```js
var bluebird = require('bluebird');
var linuxUser = require('linux-sys-user').promise(bluebird.promisify);

```

** `bluebird` is NOT included with this package! ** If you are using a older
version of NodeJS( less then 8 ) you will need something like it.

This will work with `.then()`, `.catch()` and the `async`/`await` pattern.

Synchronous helpers such as `validateUsername` are **not** promisified -- they
are passed through unchanged and still return their value directly (promisifying
them would produce a promise that never settles). The read-only functions are
available as a promise set too:

```js
var p = require('linux-user/non-root').promise();
var users = await p.getUsers();
var valid = p.validateUsername('bob'); // still synchronous, returns boolean
```

```js

let user = await addUser({username:"gkuchan", create_home:true, shell:null});
console.log(user);
  // ------------------------------------------
  // { username: 'gkuchan',
  //   password: 'x',
  //   uid: 1001,
  //   gid: 1001,
  //   fullname: '',
  //   homedir: '/home/gkuchan',
  //   shell: '/usr/sbin/nologin' }
  // ------------------------------------------

``` 

### Core APIs

* linuxUser.addUser(config, callback)

  This method is a front end to the `useradd` command on your system. Please
  consult you systems man page for details on your version and implementation.

	* config Object
    
      * `username` *String* User name of the user to be created.
      
      * `shell` *String* or *Null* Path to the login shell, setting `null` will
      use `/usr/sbin/nologin` as the path.

      ```
      The name of the user's login shell. The default is to leave this
      field blank, which causes the system to select the default login
      shell specified by the SHELL variable in /etc/default/useradd, or
      an empty string by default.
      ```

      * `create_home` *Boolean* `true` will create the home directory, `false`
      will not.

      * `home_dir` *String* Path to the user home directory.

        ```
        The new user will be created using HOME_DIR as the value for the
        user's login directory. The default is to append the LOGIN name to
        BASE_DIR and use that as the login directory name. The directory
        HOME_DIR does not have to exist but will not be created if it is
        missing.
        ```

      * `expiredate` *String* The date on which the user account will be
      disabled. The date is specified in the format `YYYY-MM-DD`..

      ```
      If not specified, useradd will use the default expiry date
      specified by the EXPIRE variable in /etc/default/useradd, or an
      empty string (no expiry) by default.
      ```

      * `skel` *String*

      ```
      The skeleton directory, which contains files and directories to be
      copied in the user's home directory, when the home directory is
      created by useradd.

      This option is only valid if the -m (or --create-home) option is
      specified.

      If this option is not set, the skeleton directory is defined by the
      SKEL variable in /etc/default/useradd or, by default, /etc/skel.

      If possible, the ACLs and extended attributes are copied.

      ```
      * `system` *Boolean* Create a system account.

      ```
      System users will be created with no aging information in
      /etc/shadow, and their numeric identifiers are chosen in the
      SYS_UID_MIN-SYS_UID_MAX range, defined in /etc/login.defs, instead
      of UID_MIN-UID_MAX (and their GID counterparts for the creation of
      groups).

      Note that useradd will not create a home directory for such a user,
      regardless of the default setting in /etc/login.defs (CREATE_HOME).
      You have to specify the -m options if you want a home directory for
      a system account to be created.

      ```
      * `selinux_user` *String* The SELinux user for the user's login.

      ```
      The default is to leave this field blank, which causes the system to
      select the default SELinux user.
      ```

	* callback function(err, userInfo)

  A string may be passed instead of an object as a shortcut for
  `{ username: string, create_home: true }`.

* linuxUser.getExpiration(username, callback)

  Gets expiration information about a user, returns an Object:
  ```js
  Expiration data {
    changed: 2023-04-04T04:00:00.000Z,
    passwordExpires: null,
    inactive: null,
    accountExpires: 1970-01-31T05:00:00.000Z,
    minDays: 0,
    maxDays: 99999,
    warnDays: 7
  }
  ```

* linuxUser.setExpiration(config, callback)
  
  Set the user password expiration and inactivity.
  * config object

  * `lastday` LAST_DAY
    Set the number of days since January 1st, 1970 when the password was last
    changed. The date may also be expressed in the format YYYY-MM-DD (or the
    format more commonly used in your area).
    **Setting this to zero will force the password to be changed on the next
    login**

  * `expiredate` EXPIRE_DATE
    Set the date or number of days since January 1, 1970 on which the
    user's account will no longer be accessible. The date may also be expressed
    in the format YYYY-MM-DD (or the format more commonly used in your area). A
    user whose account is locked must contact the system administrator before
    being able to use the system again. Passing the number -1 as the EXPIRE_DATE
    will remove an account expiration date.

  * `inactive` INACTIVE
    Set the number of days of inactivity after a password has expired before the
    account is locked. The INACTIVE option is the number of days of inactivity.
    A user whose account is locked must contact the system administrator before
    being able to use the system again. Passing the number -1 as the INACTIVE
    will remove an account's inactivity.

    **`lastday`, `expiredate`, and `inactive` can be set as a String of days
    since January 1st, 1970, or formatted YYYY-MM-DD or a native Date object.**


  * `minDays` MIN_DAYS
    Set the minimum number of days between password changes to MIN_DAYS. A value
    of zero for this field indicates that the user may change his/her password
    at any time.

  * `maxDays` MAX_DAYS
    Set the maximum number of days during which a password is valid. When
    MAX_DAYS plus LAST_DAY is less than the current day, the user will be
    required to change his/her password before being able to use his/her
    account. This occurrence can be planned for in advance by use of the
    `warnDays` option, which provides the user with advance warning. Passing the
    number -1 as MAX_DAYS will remove checking a password's validity.

  * `warnDays` WARN_DAYS
    Set the number of days of warning before a password change is required. The
    WARN_DAYS option is the number of days prior to the password expiring that a
    user will be warned his/her password is about to expire.

* linuxUser.removeUser(username, callback)
	* username String
	* callback function(err)
	
* linuxUser.getUsers(callback)
	* callback function(err, usersInfo)
	
* linuxUser.getUserInfo(username, callback)
	* username String
	* callback function(err, userInfo)
	
* linuxUser.getUserGroups(username, callback)
	* username String
	* callback function(err, groups)
	
* linuxUser.setPassword(username, password, callback)
	* username String
	* password String
	* callback function(err)

  Uses `chpasswd` to set the password non-interactively. The system must
  have `chpasswd` available (usually provided by `shadow-utils`).

* linuxUser.addGroup(groupname, callback)
	* groupname String
	* callback function(err, groupInfo)
	
* linuxUser.removeGroup(groupname, callback)
	* groupname String
	* callback function(err)
	
* linuxUser.getGroups(callback)
	* callback function(err, groupsInfo)
	
* linuxUser.getGroupInfo(groupname, callback)
	* groupname String
	* callback function(err, groupInfo)
	
* linuxUser.addUserToGroup(username, groupname, callback)
	* username String
	* groupname String
	* callback function(err)

### Other APIs

* linuxUser.validateUsername(username)
	* return boolen
	* check a string is a valid linux username or not


* linuxUser.verifySSHKey(key, callback)
	* key String
	* callback function(err, key info)


* linuxUser.addSSHtoUser(user, key, callback)
	* user String
	* key String
	* callback function(err, true)

  The key is appended to the user's `~/.ssh/authorized_keys` only if it is
  not already present.


### License

MIT
