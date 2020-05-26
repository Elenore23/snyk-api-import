import * as path from 'path';
import * as fs from 'fs';

import { ImportProjects } from '../../src/scripts/import-projects';
import {
  IMPORT_PROJECTS_FILE_NAME,
  IMPORT_LOG_NAME,
  FAILED_LOG_NAME,
} from '../../src/common';

describe('Import projects script', () => {
  const logPath = path.resolve(__dirname, IMPORT_LOG_NAME);
  afterEach(() => {
    fs.unlinkSync(logPath);
  });
  it('succeeds to import targets from file', async () => {
    const projects = await ImportProjects(
      path.resolve(__dirname + `/fixtures/${IMPORT_PROJECTS_FILE_NAME}`),
      __dirname,
    );
    expect(projects).not.toBe([]);
    expect(projects[0]).toMatchObject({
      projectUrl: expect.any(String),
      success: true,
      targetFile: expect.any(String),
    });
    const logFile = fs.readFileSync(logPath, 'utf8');
    expect(logFile).toMatch('shallow-goof-policy');
    expect(logFile).toMatch('composer-with-vulns');
    expect(logFile).toMatch('ruby-with-versions:');
  }, 30000000);
});

describe('Import skips previously imported', () => {
  const logPath = path.resolve(
    __dirname + '/fixtures/with-import-log',
    IMPORT_LOG_NAME,
  );
  it('succeeds to import targets from file', async () => {
    const projects = await ImportProjects(
      path.resolve(
        __dirname + `/fixtures/with-import-log/${IMPORT_PROJECTS_FILE_NAME}`,
      ),
      __dirname + '/fixtures/with-import-log',
    );
    expect(projects.length === 0).toBeTruthy();
    const logFile = fs.readFileSync(logPath, 'utf8');
    expect(logFile).toMatchSnapshot();
  }, 30000000);
});

describe('Skips & logs issues', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    const logPath = path.resolve(
      process.env.SNYK_LOG_PATH as string,
      IMPORT_LOG_NAME,
    );
    const failedLogPath = path.resolve(
      process.env.SNYK_LOG_PATH as string,
      FAILED_LOG_NAME,
    );
    jest.clearAllMocks();
    try {
      fs.unlinkSync(failedLogPath);
      fs.unlinkSync(logPath);
    } catch (e) {
      // do nothing
    }
    process.env = { ...OLD_ENV };
  });

  it('Skips any badly formatted targets', async () => {
    const logRoot = __dirname + '/fixtures/invalid-target/';
    process.env.SNYK_LOG_PATH = logRoot;
    const logPath = path.resolve(
      process.env.SNYK_LOG_PATH as string,
      IMPORT_LOG_NAME,
    );
    const failedLogPath = path.resolve(
      process.env.SNYK_LOG_PATH as string,
      FAILED_LOG_NAME,
    );
    const projects = await ImportProjects(
      path.resolve(__dirname + '/fixtures/invalid-target/import-projects-invalid-target.json'),
    );
    expect(projects.length === 0).toBeTruthy();
    let logFile = null;
    try {
      logFile = fs.readFileSync(logPath, 'utf8');
    } catch (e) {
      expect(logFile).toBeNull();
    }
    const failedLog = fs.readFileSync(failedLogPath, 'utf8');
    expect(failedLog).toMatch('shallow-goof-policy');
  }, 300);

  it('Logs failed when API errors', async () => {
    const logRoot = __dirname + '/fixtures/single-project/';
    process.env.SNYK_LOG_PATH = logRoot;
    const logPath = path.resolve(
      process.env.SNYK_LOG_PATH as string,
      IMPORT_LOG_NAME,
    );
    const failedLogPath = path.resolve(process.env.SNYK_LOG_PATH as string, FAILED_LOG_NAME);
    process.env.SNYK_HOST = 'https://do-not-exist.com';
    // TODO: ensure all failures are logged & assert it is present in the log
    const projects = await ImportProjects(
      path.resolve(
        __dirname + '/fixtures/single-project/import-projects-single.json',
      ),
    );
    let logFile = null;
    try {
      logFile = fs.readFileSync(logPath, 'utf8');
    } catch (e) {
      expect(logFile).toBeNull();
    }
    expect(projects.length === 0).toBeTruthy();
    const failedLog = fs.readFileSync(failedLogPath, 'utf8');
    expect(failedLog).toMatch('ruby-with-versions');
  }, 300);
});

describe('Error handling', () => {
  it('shows correct error when input can not be loaded', async () => {
    expect(
      ImportProjects(`do-not-exist/${IMPORT_PROJECTS_FILE_NAME}`),
    ).rejects.toThrow('File can not be found at location');
  }, 300);
  it('shows correct error when input is invalid json', async () => {
    expect(
      ImportProjects(
        path.resolve(__dirname + '/fixtures/import-projects-invalid.json'),
      ),
    ).rejects.toThrow('Failed to parse targets from');
  }, 300);
});