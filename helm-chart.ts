import {Construct} from "constructs";
import {ApiObject} from "cdk8s";
import * as fs from "fs";
import * as path from "path";

const cp = require('child_process');
const yaml = require('js-yaml');

interface HelmChartProps {
  /**
   * The absolute path to the chart that is being imported.
   *
   * @example "./mysql"
   */
  chart: string;

  /**
   * An optional string or object which provides all of the override values for the charts.
   *
   * If a string is provided than it must be relative to the chart path.
   * */
  values?: string | { [key: string]: any };

  /**
   * A local 'helm' command to run. If not found, it will fall back to using a docker image.
   *
   * @default "helm"
   */
  helmCmd?: string;
}

function stringToParams(params: string) {
  return params.split(' ').filter(x => !!x);
}

function convertYamlDocsToObjects(docs: string[]) {
  return docs.filter((x: string) => !!x).map((doc: string) => yaml.safeLoad(doc))
}

function getAbsolutePath(chart: string) {
  return chart.startsWith("/") ? chart : path.join(__dirname, chart);
}

export class HelmChart extends Construct {
  constructor(scope: Construct, id: string, props: HelmChartProps) {
    super(scope, id);

    let optionalValues = "";
    let additionalVolumes = "";
    let overrideValuesLocation: string = "";
    const canRunLocally = this.checkLocal(props.helmCmd);

    if (props.values) {
      if (typeof props.values === "string") {
        optionalValues = `-f ${props.values}`;
      }
      if (typeof props.values === "object") {
        const tempDir = path.join(process.cwd(), '.helm-temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
        }
        overrideValuesLocation = path.join(tempDir, 'overrides.yaml');
        fs.writeFileSync(overrideValuesLocation, yaml.safeDump(props.values));
        additionalVolumes = `-v ${tempDir}:/props`;
        optionalValues = canRunLocally ? `-f ${overrideValuesLocation}` : `-f /props/overrides.yaml`;
      }
    }

    let docs: string[];

    if (canRunLocally) {

      const helmProcess = cp.spawnSync(props.helmCmd ?? "helm", stringToParams(`template ${optionalValues} .`), {cwd: props.chart});
      const err = helmProcess.stderr.toString();
      if (err) {
        throw new Error('An error occurred rendering the template: ' + err);
      }
      docs = helmProcess.stdout.toString().split("---");

    } else {

      let absolutePath = getAbsolutePath(props.chart);
      const dockerProcess = cp.spawnSync('docker', stringToParams(`run -v ${absolutePath}:/app ${additionalVolumes} -w /app alpine/helm template ${optionalValues} .`));

      let err = dockerProcess.stderr.toString();
      if (err) {
        throw new Error('An error occurred rendering the template: ' + err);
      }
      docs = dockerProcess.stdout.toString().split("---");
    }

    const convertedObjects = convertYamlDocsToObjects(docs);

    let importCount = 0;
    for (const raw of convertedObjects) {
      new ApiObject(this, `imported-${importCount}`, raw);
      importCount++;
    }
  }

  private checkLocal(helmCmd: string | undefined) {
    const helmProcess = cp.spawnSync(helmCmd ?? "helm", ["version"]);
    if (helmProcess.error) {
      console.warn("Could not find local Helm. Falling back to docker. If you'd rather not use Docker, ensure 'helm' has been install and is available in the path. You can also override the helm command to use by specifying the `helmCmd` prop.");
      return false;
    }
    return true;
  }
}
