import { Construct } from "constructs";
import { ApiObject } from "cdk8s";
import * as fs from "fs";
import * as path from "path";

const cp = require('child_process');
const yaml = require('js-yaml');

interface HelmChartProps {
  /*
   * The absolute path to the chart that is being imported.
   */
  chart: string;
  /*
  * An optional string or object which provides all of the override values for the charts.
  *
  * If a string is provided than it must be relative to the chart path.
  * */
  values?: string | { [key: string]: any };
}

function stringToParams(params: string) {
  return params.split(' ').filter(x => !!x);
}

function convertYamlDocsToObjects(docs: string[]) {
  return docs.filter((x: string) => !!x).map((doc: string) => yaml.safeLoad(doc))
}

export class HelmChart extends Construct {
  constructor(scope: Construct, id: string, props: HelmChartProps) {
    super(scope, id);

    let optionalValues = "";
    let additionalVolumes = "";
    if (props.values) {
      if (typeof props.values === "string") {
        optionalValues = `-f ${props.values}`;
      }
      if (typeof props.values === "object") {
        const tempDir = path.join(process.cwd(), '.helm-temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
        }
        fs.writeFileSync(path.join(tempDir, 'overrides.yaml'), yaml.safeDump(props.values));
        additionalVolumes = `-v ${tempDir}:/props`;
        optionalValues = `-f /props/overrides.yaml`;
      }
    }

    const dockerProcess = cp.spawnSync('docker', stringToParams(`run -v ${props.chart}:/app ${additionalVolumes} -w /app alpine/helm template ${optionalValues} .`));

    let err = dockerProcess.stderr.toString();
    if (err) {
      throw new Error('An error occurred rendering the template: ' + err);
    }

    const docs = dockerProcess.stdout.toString().split("---");
    const convertedObjects = convertYamlDocsToObjects(docs);

    let importCount = 0;
    for (const raw of convertedObjects) {
      new ApiObject(this, `imported-${importCount}`, raw);
      importCount++;
    }
  }
}
