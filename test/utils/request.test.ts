/**
 * Copyright 2022. TIBCO Software Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */
import { expect } from '@oclif/test';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { HTTPError } from '../../src/index';
import * as nock from 'nock';
import { HTTPRequest } from '../../src/utils/request';
import * as tmp from 'tmp';
import * as md5 from 'md5-file';
import * as os from 'os';

import path = require('path');
chai.use(chaiAsPromised);
let testUrl = 'http://www.myapi.com';
describe('utils', () => {
  describe('HTTP Requests', () => {
    describe('doRequest', () => {
      it('send GET request and receive data', async () => {
        nock(testUrl).get('/tci/v1/apps').reply(200, 'Success');
        let req = new HTTPRequest();
        let resp = await req.doRequest('/tci/v1/apps', { baseURL: testUrl });
        expect(resp.body).to.be.equal('Success');
        expect(resp.statusCode).to.be.equal(200);
      });
      it('override baseURl when complete URL is passed in function parameters', async () => {
        nock('https://www.abc.com').get('/tci/v1/apps').reply(200);
        let req = new HTTPRequest();
        let resp = await req.doRequest('https://www.abc.com/tci/v1/apps', { baseURL: testUrl });
        expect(resp.statusCode).to.be.equal(200);
      });

      it('override options body when it is passed explicitly in function parameters', async () => {
        nock(testUrl)
          .post('/tci/v1/apps')
          .reply(201, function (uri, body) {
            return body;
          });
        let req = new HTTPRequest();
        let resp = await req.doRequest('/tci/v1/apps', { baseURL: testUrl, data: 'node-app' }, 'flogo-app');
        expect(resp.statusCode).to.be.equal(201);
        expect(resp.body).to.be.equal('flogo-app');
      });

      it('throw HTTP Error if client side or server side error', () => {
        nock(testUrl).get('/tci/v1/apps').reply(401, 'Failed');
        let req = new HTTPRequest();
        expect(req.doRequest('/tci/v1/apps', { baseURL: testUrl }))
          .to.be.eventually.rejectedWith(HTTPError)
          .and.has.property('httpCode', 401)
          .and.property('data', 'Failed');
      });
      it('throw Error for a request timeout', async () => {
        nock(testUrl).get('/tci/v1/apps').delay(31000).reply(200, 'Success');
        let req = new HTTPRequest();
        expect(req.doRequest('/tci/v1/apps', { baseURL: testUrl }))
          .to.be.eventually.rejectedWith(Error)
          .and.has.property('message', 'timeout of 30000ms exceeded');
      });
      it('receive appropriate User Agent', async () => {
        let s = nock(testUrl)
          .get('/tci/v1/apps')
          .reply(200, function (uri, body) {
            return this.req.headers['User-Agent'] || this.req.headers['user-agent'];
          })
          .persist(true);

        const pkg = require('../../package.json');
        let req = new HTTPRequest();
        let resp = await req.doRequest('/tci/v1/apps', { baseURL: testUrl });
        expect(resp.body).to.be.equal(` @tibco-software/cic-cli-core/${pkg.version} ${os.platform()} ${os.arch()} `);

        let req2 = new HTTPRequest('show-apps', 'tsc');
        let resp2 = await req2.doRequest('/tci/v1/apps', { baseURL: testUrl });
        expect(resp2.body).to.be.equal(
          `tsc @tibco-software/cic-cli-core/${pkg.version} ${os.platform()} ${os.arch()} show-apps`
        );
        s.persist(false);
      });
    });

    describe('download files', () => {
      it('download json file from a given endpoint', async () => {
        let filePath = path.join(__dirname, '/sample-data.json');
        nock(testUrl).get('/v1/data').replyWithFile(200, filePath);
        const tmpObj = tmp.fileSync();
        let resp = await new HTTPRequest().download('/v1/data', tmpObj.name, { baseURL: testUrl }, false);
        expect(resp).to.be.true;

        expect(cmpFile(__dirname + '/sample-data.json', tmpObj.name)).to.be.true;
      });
      it('throw error when storage location in invalid', async () => {
        let filePath = path.join(__dirname, '/sample-data.json');
        nock(testUrl).get('/v1/data').replyWithFile(200, filePath);

        let req = new HTTPRequest();
        let resp = req.download('/v1/data', path.join('a', 'b', 'c'), { baseURL: testUrl }, false);
        expect(resp).to.be.rejectedWith(Error);
      });
    });

    describe('upload files', () => {
      it('upload json file', async () => {
        nock(testUrl)
          .post('/v1/file')
          .reply(function (u, body) {
            return [201];
          });
        let req = new HTTPRequest();
        let resp = await req.upload(
          '/v1/file',
          { file: 'ok', path: path.join(__dirname, 'vp.json') },
          { baseURL: testUrl },
          false
        );
      });
    });

    describe('addHTTPOptions', () => {
      it('get default HTTP Options', () => {
        let req = new HTTPRequest();
        let options = req.addHttpOptions();
        expect(options).to.have.all.keys('timeout', 'headers', 'validateStatus');
        expect(options).to.have.nested.property('headers.Connection', 'close');
        expect(options).to.have.nested.property('headers.User-Agent');
      });
    });
  });
});

function cmpFile(pathA: string, pathB: string) {
  return md5.sync(pathA) === md5.sync(pathB);
}
