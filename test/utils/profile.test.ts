/**
 * Copyright 2022. TIBCO Software Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */
import { ProfileConfigManager, ProfileConfig } from '../../src/utils/profile';
import { BaseCommand, CLIBaseError, Profile, secureStore } from '../../src';
import { expect, test } from '@oclif/test';

import * as sinon from 'sinon';
import * as fs from 'fs-extra';
import * as tmp from 'tmp';
import path = require('path');
import { setCommand } from '../../src/utils/log';

describe('utils', () => {
  describe('config', () => {
    describe('Config Manager', () => {
      test.it('create & save config data in a file when file does not exist', () => {
        let dir = tmp.dirSync({ unsafeCleanup: true });
        let configManager = new ProfileConfigManager(dir.name);
        let config = new ProfileConfig('cid', '1.0.0', 'default_user', []);
        configManager.save(config);
        expect(fs.existsSync(path.join(dir.name, 'config.json'))).to.equal(true);
        expect(fs.readJsonSync(path.join(dir.name, 'config.json'))).to.deep.equal(config);
      });
      test.it('should give error when saving a null/unloaded config', () => {
        let dir = tmp.dirSync({ unsafeCleanup: true });
        let configManager = new ProfileConfigManager(dir.name);
        expect(configManager.save).to.throw(Error);
      });

      describe('ConfigManager.load', () => {
        let config: any, configManager: ProfileConfigManager, dir: tmp.DirResult;

        before(() => {
          dir = tmp.dirSync({ unsafeCleanup: true });
          configManager = new ProfileConfigManager(dir.name);
          config = new ProfileConfig('cid', '1.0.0', 'default_user', []);
        });

        test.it('give error when config file not found', () => {
          expect(configManager.getConfig).to.throw(Error);
        });

        test.it('load config data from a file', () => {
          configManager.save(config);
          expect(configManager.getConfig()).to.deep.equal(config);
        });

        test.it('should return already loaded config data instead of reading file', () => {
          let cfg = configManager.getConfig();
          cfg.defaultProfile = 'eu_user';
          let configManager2 = new ProfileConfigManager(dir.name);
          expect(configManager2.getConfig().defaultProfile).to.be.equal('eu_user');
        });
      });
    });

    describe('User Config', () => {
      describe('Config.addProfile', () => {
        let command: any;
        let secureStoreStub: any;
        let secrets: any;

        before(() => {
          command = new BaseCommand([], []);
          setCommand(command);
          secureStoreStub = sinon.stub(secureStore, 'saveProfileSecrets');
          secrets = {
            accessToken: 'at.asdf',
            refreshToken: 'rt.zxcv',
            accessTokenExp: 118726383638,
            refreshTokenExp: 118726383638,
          };
        });

        after(() => {
          secureStoreStub.restore();
        });

        test.it('add profile', () => {
          let config = new ProfileConfig('cid', '1.0.0', 'default_user', []);
          let prof: Profile = { name: 'eu-user', org: 'acme', region: 'eu' };
          config.addProfile(prof, secrets);
          expect(config.profiles).to.deep.include(prof);
        });

        test.it('Add profile to replace existing profile', () => {
          let config = new ProfileConfig('cid', '1.0.0', 'default_user', [
            { name: 'eu-user', org: 'acme', region: 'eu' },
          ]);
          let prof: Profile = { name: 'eu-user', org: 'myorg', region: 'eu' };
          config.addProfile(prof, secrets);
          expect(config.profiles.length.toString()).to.be.equal('1');
          expect(config.profiles).to.be.deep.equal([prof]);
        });
        test.it('Should throw error if details are insufficient', () => {
          let config = new ProfileConfig('cid', '1.0.0', 'default_user', []);
          let prof: Profile = { name: '', org: '', region: 'eu' };
          expect(() => {
            config.addProfile(prof, secrets);
          }).to.throw(Error);
        });
      });
      describe('Config.getProfile', () => {
        let config: ProfileConfig;
        let profile1: any;
        let profile2: any;
        before(() => {
          profile1 = { name: 'eu-user', org: 'acme', region: 'eu' };
          profile2 = { name: 'default_user', org: 'myorg', region: 'us' };
          config = new ProfileConfig('cid', '1.0.0', 'default_user', [profile1, profile2]);
        });
        test.it('get profile by name', () => {
          expect(config.getProfileByName('eu-user')).to.be.equal(profile1);
        });
        test.it('should return default profile if no profile name', () => {
          expect(config.getProfileByName()).to.be.equal(profile2);
        });
        test.it('should throw error if profile not found', () => {
          expect(() => {
            config.getProfileByName('dummy_profile');
          }).to.throw(Error);
        });
      });

      describe('Config.removeProfile', () => {
        let secureStoreStub: any;
        let config: ProfileConfig;
        let profile1: any;
        let profile2: any;
        before(() => {
          secureStoreStub = sinon.stub(secureStore, 'removeProfileSecrets');
        });
        beforeEach(() => {
          profile1 = { name: 'eu-user', org: 'acme', region: 'eu' };
          profile2 = { name: 'default_user', org: 'myorg', region: 'us' };
          config = new ProfileConfig('cid', '1.0.0', 'default_user', [profile1, profile2]);
        });

        after(() => {
          secureStoreStub.restore();
        });

        test.it('remove profile', () => {
          config.removeProfile('eu-user');
          expect(config.profiles).to.be.deep.equal([profile2]);
        });

        test.it('remove profile which does not exist', () => {
          config.removeProfile('in-user');
          expect(config.profiles).to.be.deep.equal([profile1, profile2]);
        });

        test.it('should give error when removing default profile', () => {
          expect(() => {
            config.removeProfile('default_user');
          }).to.throw(Error);
        });
      });
    });
  });
});
