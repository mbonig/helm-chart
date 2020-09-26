import { Construct } from 'constructs';
import { App, Chart } from 'cdk8s';
import * as path from "path";
import { HelmChart } from "./helm-chart";


export class MyChart extends Chart {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    // define resources here
    new HelmChart(this, 'mysql', {
      chart: path.join(__dirname, 'mysql')
    });
  }
}

const app = new App();
new MyChart(app, 'helm-chart');
app.synth();
