const fs = require('fs');
const util = require('util');

async function diff() {
  const text = await util.promisify(fs.readFile)('./package.json');
  const config = JSON.parse(text);
  const overrides = config.contributes.configuration.properties['python.analysis.diagnosticSeverityOverrides'].properties;

  const schemaText = await util.promisify(fs.readFile)('./schemas/pyrightconfig.schema.json');
  const schema = JSON.parse(schemaText);
  for (const [key, val] of Object.entries(schema.properties)) {
    if (val['$ref'] === '#/definitions/diagnostic') {
      if (!overrides[key]) {
        console.error('missing:', key);
      } else {
        const obj = overrides[key];
        if (obj.default !== val.default) {
          console.error(`${key}, package.json value: ${obj.default}, schema value: ${val.default}`);
        }
      }
    }
  }
}

diff();
