import {Chart, Testing} from 'cdk8s';
import {HelmChart} from "./helm-chart";
import * as path from "path";
import * as cp from 'child_process';

describe('Values overrides', () => {
    test('no overrides', () => {
      // when
      const app = Testing.app();
      const chart = new Chart(app, 'test-chart');
      new HelmChart(chart, 'test-helm-chart', {
        chart: path.join(__dirname, 'mysql'),
      })
      const results = Testing.synth(chart);

      // then
      const deployment = results.find(x => x.kind === 'Deployment');
      expect(deployment.spec.template.spec.containers[0].image).toEqual("mysql:5.7.31");

    });

    test('takes overrides as filename', () => {
      // when
      const app = Testing.app();
      const chart = new Chart(app, 'test-chart');
      new HelmChart(chart, 'test-helm-chart', {
        chart: path.join(__dirname, 'mysql'),
        values: 'dev-only.yaml'
      })
      const results = Testing.synth(chart);

      // then
      const deployment = results.find(x => x.kind === 'Deployment');
      expect(deployment.spec.template.spec.containers[0].image).toEqual("mysql:5.7.32");
    });

    test('takes override as object', () => {
      // when
      const app = Testing.app();
      const chart = new Chart(app, 'test-chart');
      new HelmChart(chart, 'test-helm-chart', {
        chart: path.join(__dirname, 'mysql'),
        values: {
          imageTag: '5.7.33'
        }
      })
      const results = Testing.synth(chart);

      // then
      const deployment = results.find(x => x.kind === 'Deployment');
      expect(deployment.spec.template.spec.containers[0].image).toEqual("mysql:5.7.33");
    });
  }
)


function checkHelmLocal() {
  const helmProcess = cp.spawnSync("helm");
  if (helmProcess.error) {
    throw new Error("You must have Helm installed locally to run these tests. https://helm.sh/docs/intro/install/")
  }
}


describe('uses local vs docker', () => {


  it('uses local when available', () => {
    checkHelmLocal();

    const app = Testing.app();
    const chart = new Chart(app, 'test-chart');
    new HelmChart(chart, 'test-helm-chart', {
      chart: './mysql',
    });


    Testing.synth(chart); // no error here means success
  });

  it('uses docker when local not available', () => {

    const app = Testing.app();
    const chart = new Chart(app, 'test-chart');
    new HelmChart(chart, 'test-helm-chart', {
      chart: './mysql',
      helmCmd: 'not-helm'
    });

    Testing.synth(chart); // no error here means success
  });

});