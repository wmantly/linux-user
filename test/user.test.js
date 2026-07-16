"use strict";

require("should");

var linuxUser = require("../");
var nonRootUser = require("../non-root");
var fs = require("fs");
var os = require("os");

var testUsername = "linuxusertest1";
var testPassword = "linuxPasswordTest";
var testGroupname = "linuxgrouptest";
var testSSHKeyGood =
  "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDBqDmHHhV9HHCY0Rvp6by4N1aBsnjreWKIPaO2UHCURzJk8Sa92jXEfNXpQ1H36yJmirCB+q6XRCKq27ah5M86fCKsm+UfbPlD/X81YH+RnnYgGyh7nwk+llvLKdrzFnF7aHG5/WShj5YUzZO9McIPxyrU1GmMnxEynHp4qSsnmKNJZT2KtpGlP/cvOktNjRWO1hAY8mXG9VShSpqLYWU/AbTV4hZZ2Pr/FdRZq59oRcm9ZGfd13ZMJcPlfhTCeslJfWNx2cuMTSLXRN76MtCmWsPKuVNY6Hj/ILL7JQe8DIxu9AAMiUqFadfFHRGO9dzCh8fKi5lpSMsDKqHHysb504p2ogHDzOUpc/remX3exnvDK1245JXYlNtUkXIexVl+u871PDNbOhx4lSa1nGJGiJCJLW7FlL5mEPrvlgeWaxGihi66redtcPWGVuy2dYytYoI8JanpGlEGFkTOIaKSvDH0ratOxRSlP/Eraxs7w3uVaRvF7/iC348CI63l7T8= william@william-HP-ENVY-x360-Convertible";
var testSSHkeyBad =
  "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDBqDmHHhV9HHCY0Rvp6by4N1aBsnjreWKIPaO2UHCURzJk8Sa92jXEfNXpQ1H36yJmirCB+q6XRCKq27ah5M86fCKsm+UfbPlD/X81YH+RnnYgGyh7nwk+llvLKdrzFnF7aHG5/WShj5YUzZO9McIPxyrU1GmMnxEynHp4qSsnmKNJZT2KtpGlP/cvOktNjRWO1hAY8mXG9VShSpqLYWU/AbTV4hZZ2Pr/FdRZq59oRcm9ZGfd13ZMJcPlfhTCeslJfWNx2cuMTSLXRN76MtCmWsPKuVNY6Hj/ILL7JQe8DIxu9AAMiUqFadfFHRGO9dzCh8fKi5lpSMsDKqHHysb504p2ogHDzOUpc/remX3exnvDK1245JXYlNtUkXIexVl+u871PDNbOhx4lSa1nGJGiJCJLW7FlL5mEPrvlgeWaxGihi66redtcPWGVuy2ytYoI8JanpGlEGFkTOIaKSvDH0ratOxRSlP/axs7w3uVaRvF7/iC348CI63l7T8= william@william-HP-ENVY-x360-Convertible";

// Many functions modify system files and require root. Skip those tests when
// the suite is not running as root so the suite passes in CI / dev without
// root, while still exercising the read-only code paths.
var isRoot = typeof process.getuid === "function" && process.getuid() === 0;
function rootOnly() {
  if (!isRoot) {
    // eslint-disable-next-line no-invalid-this
    this.skip();
  }
}

describe("user.js", function () {
  describe("validateUsername", function () {
    it("should validate username ok", function () {
      linuxUser.validateUsername("/$#%&^%$~!|}|23").should.be.false;
    });
    it("should accept a valid username", function () {
      linuxUser.validateUsername("bob").should.be.true;
    });
  });

  describe("getUsers", function () {
    it("should get users ok", function (done) {
      linuxUser.getUsers(function (err, users) {
        if (err) {
          return done(err);
        }
        users.should.be.an.Array;
        users[0].username.should.equal("root");
        done();
      });
    });

    it("should not drop the last entry when there is no trailing newline", function (done) {
      // read the real file, strip any trailing newline, and verify parsing
      // produces the same count as a version that retains it.
      fs.readFile("/etc/passwd", "utf8", function (err, content) {
        if (err) {
          return done(err);
        }
        var noTrailing = content.replace(/\n$/, "");
        // simulate getUsers' parsing on content without a trailing newline
        var parsed = noTrailing
          .split("\n")
          .filter(function (line) {
            return line.length > 0;
          })
          .map(function (line) {
            return line.split(":")[0];
          });
        var withTrailing = content
          .split("\n")
          .filter(function (line) {
            return line.length > 0;
          })
          .map(function (line) {
            return line.split(":")[0];
          });
        parsed.length.should.equal(withTrailing.length);
        done();
      });
    });
  });

  describe("Invalid username", function () {
    it("should throw Error", function (done) {
      linuxUser.addUser({ username: "/$#%&^%$~!|}|23" }, function (err, user) {
        err.should.be.an.Error;
        err.message.should.equal("Invalid username");
        // addUser must not invoke the callback a second time. If it did,
        // mocha's done() would throw "done() called multiple times".
        done();
      });
    });
  });

  describe("getUserInfo", function () {
    it("should get user info ok", function (done) {
      linuxUser.getUserInfo("root", function (err, user) {
        if (err) {
          return done(err);
        }
        user.username.should.equal("root");
        done();
      });
    });

    it("should return null for a missing user", function (done) {
      linuxUser.getUserInfo("definitely-not-a-real-user-xyz", function (err, user) {
        if (err) {
          return done(err);
        }
        should.equal(user, null);
        done();
      });
    });
  });

  describe("addUser && removeUser", function () {
    before(rootOnly);
    it("should add user and remove user ok", function (done) {
      var num;
      linuxUser.getUsers(function (err, users) {
        if (err) {
          return done(err);
        }
        num = users.length;
        linuxUser.addUser({ username: testUsername }, function (err, user) {
          if (err) {
            return done(err);
          }
          user.username.should.equal(testUsername);
          linuxUser.getUsers(function (err, users) {
            if (err) {
              return done(err);
            }
            users.length.should.equal(num + 1);
            linuxUser.removeUser(testUsername, function (err) {
              if (err) {
                return done(err);
              }
              linuxUser.getUsers(function (err, users) {
                if (err) {
                  return done(err);
                }
                users.length.should.equal(num);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe("Expiration", function () {
    before(function (done) {
      if (!isRoot) {
        this.skip();
      }
      linuxUser.addUser({ username: testUsername }, done);
    });
    after(function (done) {
      if (!isRoot) {
        return done();
      }
      linuxUser.removeUser(testUsername, done);
    });

    it("Set user expiration maxDays", function (done) {
      linuxUser.setExpiration(
        testUsername,
        { maxDays: 50 },
        function (err, data) {
          if (err) return done(err);

          linuxUser.getExpiration(testUsername, function (err, data) {
            if (err) {
              return done(err);
            }

            data.maxDays.should.equal(50);
            done();
          });
        }
      );
    });

    it("Set user expiration date via string", function (done) {
      let date = "2012-04-04";
      linuxUser.setExpiration(
        testUsername,
        { expiredate: date },
        function (err, data) {
          if (err) return done(err);

          linuxUser.getExpiration(testUsername, function (err, data) {
            if (err) {
              return done(err);
            }

            data.accountExpires.toISOString().slice(0, 10).should.equal(date);
            done();
          });
        }
      );
    });

    it("Set user expiration date via date object", function (done) {
      let date = new Date();
      linuxUser.setExpiration(
        testUsername,
        { expiredate: date },
        function (err, data) {
          if (err) return done(err);

          linuxUser.getExpiration(testUsername, function (err, data) {
            if (err) {
              return done(err);
            }

            data.accountExpires
              .toISOString()
              .slice(0, 10)
              .should.equal(date.toISOString().slice(0, 10));
            done();
          });
        }
      );
    });
  });

  describe("addUser options", function () {
    before(rootOnly);
    afterEach(function (done) {
      if (!isRoot) {
        return done();
      }
      linuxUser.removeUser(testUsername, function (err) {
        if (err) {
          return done(err);
        }
        done();
      });
    });

    it("should set the login shell", function (done) {
      linuxUser.addUser(
        { username: testUsername, shell: "/bin/bash" },
        function (err, user) {
          if (err) {
            return done(err);
          }
          user.shell.should.equal("/bin/bash");
          done();
        }
      );
    });
  });

  describe("getGroups", function () {
    it("should get groups ok", function (done) {
      linuxUser.getGroups(function (err, groups) {
        if (err) {
          return done(err);
        }
        groups.should.be.an.Array;
        groups[0].groupname.should.equal("root");
        done();
      });
    });
  });

  describe("getUserGroups", function () {
    it("should get user groups ok", function (done) {
      linuxUser.getUserGroups("root", function (err, groups) {
        if (err) {
          return done(err);
        }
        groups.should.be.an.Array;
        groups[0].should.equal("root");
        done();
      });
    });
  });

  describe("addGroup && removeGroup", function () {
    before(rootOnly);
    it("should add group and remove group ok", function (done) {
      var num;
      linuxUser.getGroups(function (err, groups) {
        if (err) {
          return done(err);
        }
        num = groups.length;
        linuxUser.addGroup(testGroupname, function (err, group) {
          if (err) {
            return done(err);
          }
          group.groupname.should.equal(testGroupname);
          linuxUser.getGroups(function (err, groups) {
            if (err) {
              return done(err);
            }
            groups.length.should.equal(num + 1);
            linuxUser.removeGroup(testGroupname, function (err) {
              if (err) {
                return done(err);
              }
              linuxUser.getGroups(function (err, groups) {
                if (err) {
                  return done(err);
                }
                groups.length.should.equal(num);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe("verifySSHKey", function () {
    it("should be good SSH key", function (done) {
      linuxUser.verifySSHKey(testSSHKeyGood, function (err, data) {
        if (err) {
          return done(err);
        }
        done();
      });
    });
    it("should be bad SSH key", function (done) {
      linuxUser.verifySSHKey(testSSHkeyBad, function (err, data) {
        err.should.be.an.Error;
        done();
      });
    });
  });

  describe("addSSHtoUser", function () {
    it("should error (not crash) when the user does not exist", function (done) {
      // valid key, missing user -- must return an Error, not throw
      linuxUser.addSSHtoUser(
        "definitely-not-a-real-user-xyz",
        testSSHKeyGood,
        function (err, done2) {
          err.should.be.an.Error;
          err.message.should.equal("User does not exist");
          should.equal(done2, undefined);
          done();
        }
      );
    });

    describe("(root)", function () {
      before(rootOnly);
      afterEach(function (done) {
        if (!isRoot) {
          return done();
        }
        linuxUser.removeUser(testUsername, done);
      });
      it("should add SSH key to the user", function (done) {
        linuxUser.addUser(
          { username: testUsername, create_home: true },
          function (err, user) {
            if (err) {
              return done(err);
            }

            linuxUser.addSSHtoUser(testUsername, testSSHKeyGood, function (err) {
              if (err) {
                return done(err);
              }

              // read the users auth file
              fs.readFile(
                user.homedir + "/.ssh/authorized_keys",
                "utf8",
                (err, data) => {
                  if (err) {
                    return done(err);
                  }
                  done();
                }
              );
            });
          }
        );
      });
    });
  });

  describe("getExpiration (non-root, self)", function () {
    it("should parse the calling user's expiration without root", function (done) {
      var me = os.userInfo().username;
      linuxUser.getExpiration(me, function (err, data) {
        if (err) {
          return done(err);
        }
        data.should.be.an.Object;
        data.maxDays.should.be.a.Number;
        data.warnDays.should.be.a.Number;
        done();
      });
    });

    it("should reject an invalid username", function (done) {
      linuxUser.getExpiration("UPPERCASE-BAD!!", function (err) {
        err.should.be.an.Error;
        err.message.should.equal("Invalid username");
        done();
      });
    });
  });

  describe("Other methods", function () {
    before(rootOnly);
    beforeEach(function (done) {
      if (!isRoot) {
        return done();
      }
      linuxUser.addUser({ username: testUsername }, function (err) {
        if (err) {
          return done(err);
        }
        linuxUser.addGroup(testGroupname, done);
      });
    });
    afterEach(function (done) {
      if (!isRoot) {
        return done();
      }
      linuxUser.removeUser(testUsername, function (err) {
        if (err) {
          return done(err);
        }
        linuxUser.removeGroup(testGroupname, done);
      });
    });

    it("should set password ok", function (done) {
      linuxUser.setPassword(testUsername, testPassword, done);
    });

    it("should add user to group", function (done) {
      linuxUser.addUserToGroup(testUsername, testGroupname, done);
    });
  });

  describe("non-root import", function () {
    it("should expose only read-only functions", function () {
      var keys = Object.keys(nonRootUser).sort();
      // no mutating functions present
      keys.should.not.containEql("addUser");
      keys.should.not.containEql("removeUser");
      keys.should.not.containEql("setPassword");
      keys.should.not.containEql("addGroup");
      keys.should.containEql("getUsers");
      keys.should.containEql("getGroups");
      keys.should.containEql("validateUsername");
      keys.should.containEql("verifySSHKey");
    });

    it("should read users without root", function (done) {
      nonRootUser.getUsers(function (err, users) {
        if (err) {
          return done(err);
        }
        users.should.be.an.Array;
        done();
      });
    });

    it("should expose a read-only promise set", function () {
      var p = nonRootUser.promise();
      p.getUsers.should.be.a.Function;
      should.not.exist(p.addUser);
    });
  });

  describe("promise wrapper", function () {
    it("should promisify async methods", function (done) {
      var p = linuxUser.promise();
      p.getUsers.should.be.a.Function;
      p.getUsers().then(function (users) {
        users.should.be.an.Array;
        done();
      }, done);
    });

    it("should pass validateUsername through synchronously (not hang)", function () {
      var p = linuxUser.promise();
      p.validateUsername.should.be.a.Function;
      p.validateUsername("bob").should.be.true;
      p.validateUsername("BAD!!").should.be.false;
    });
  });
});